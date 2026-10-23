#!/usr/bin/env node
/*
 * worktree_create - create or reuse the canonical worktree for one branch.
 *
 * The leaf folder is derived only from the branch:
 *   $HOME/.worktrees/<owner>/<repo>/<sanitized-branch>
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** Maximum time allowed for an optional remote fetch before local recovery continues. */
const WORKTREE_FETCH_TIMEOUT_MS = 5000;

/**
 * Write a diagnostic line to stderr.
 * @param {string} message
 * @returns {void}
 */
function info(message) {
  process.stderr.write(`${message}\n`);
}

/**
 * Run git and return its result.
 * @param {string[]} args
 * @param {{cwd?: string, stdio?: string, timeout?: number}} [options]
 * @returns {{status: number, stdout: string, stderr: string}}
 */
function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    timeout: options.timeout,
    env: process.env,
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim(),
  };
}

/**
 * Convert a branch name into one safe path segment.
 * @param {string} branch
 * @returns {string}
 */
function sanitizeBranch(branch) {
  return branch.replace(/[^A-Za-z0-9._-]+/g, `_`).replace(/^[-._]+|[-._]+$/g, ``);
}

/**
 * Resolve owner and repository from origin.
 * @returns {{owner: string, repo: string}|null}
 */
function remoteParts() {
  const remote = git(["remote", "get-url", "origin"]);
  if (remote.status !== 0 || !remote.stdout) return null;
  const clean = remote.stdout
    .replace(/^[A-Za-z0-9+.-]+:\/\//, ``)
    .replace(/^[^@]+@/, ``)
    .replace(/^[^/:]+:/, ``)
    .replace(/\/+$/, ``)
    .replace(/\.git$/, ``);
  const parts = clean.split(`/`).filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

/**
 * Resolve the canonical path without creating anything.
 * @param {string} branch
 * @returns {string|null}
 */
function worktreePath(branch) {
  const remote = remoteParts();
  if (!remote) {
    info(`worktree_create: no origin remote or invalid origin URL`);
    return null;
  }
  const leaf = sanitizeBranch(branch);
  if (!leaf) {
    info(`worktree_create: branch '${branch}' has no usable characters`);
    return null;
  }
  return path.join(process.env.HOME || ``, `.worktrees`, remote.owner, remote.repo, leaf);
}

/**
 * Return the primary checkout folder.
 * @returns {string|null}
 */
function primaryFolder() {
  const result = git(["rev-parse", "--show-toplevel"]);
  return result.status === 0 ? result.stdout : null;
}

/**
 * Find a non-primary linked worktree already on the branch.
 * @param {string} branch
 * @param {string} primary
 * @returns {string|null}
 */
function existingWorktree(branch, primary) {
  const result = git(["worktree", "list", "--porcelain"]);
  if (result.status !== 0) return null;
  let folder = ``;
  for (const line of result.stdout.split(`\n`)) {
    if (line.startsWith(`worktree `)) folder = line.slice(`worktree `.length);
    if (line === `branch refs/heads/${branch}` && folder !== primary) return folder;
  }
  return null;
}

/**
 * Add a worktree using the safest available branch state.
 * @param {string} folder
 * @param {string} branch
 * @returns {boolean}
 */
function addWorktree(folder, branch) {
  fs.mkdirSync(path.dirname(folder), { recursive: true });
  git(["fetch", "origin", branch], { stdio: "ignore", timeout: WORKTREE_FETCH_TIMEOUT_MS });

  let unpushed = ``;
  const localBranch = git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  if (localBranch.status === 0) {
    const ahead = git(["rev-list", "--count", `origin/${branch}..${branch}`]);
    unpushed = ahead.status === 0 ? ahead.stdout : ``;
  }

  if (unpushed && unpushed !== `0` && git(["worktree", "add", folder, branch]).status === 0) {
    info(`  -> created worktree on '${branch}', keeping ${unpushed} unpushed local commit(s)`);
    return true;
  }

  const originBranch = git(["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`]);
  if (originBranch.status === 0 && git(["worktree", "add", folder, "-B", branch, `origin/${branch}`]).status === 0) {
    info(`  -> created worktree on '${branch}'`);
    return true;
  }
  if (localBranch.status === 0 && git(["worktree", "add", folder, branch]).status === 0) {
    info(`  -> created worktree on existing local branch '${branch}'`);
    return true;
  }
  if (git(["worktree", "add", folder, "-b", branch]).status === 0) {
    info(`  -> created worktree on new branch '${branch}'`);
    return true;
  }
  if (
    (originBranch.status === 0 && git(["worktree", "add", "--detach", folder, `origin/${branch}`]).status === 0) ||
    git(["worktree", "add", "--detach", folder, branch]).status === 0
  ) {
    info(`  -> '${branch}' is checked out elsewhere; created a DETACHED worktree`);
    return true;
  }
  return false;
}

/**
 * Refresh a resolved worktree without changing the path-only stdout contract.
 * @param {string} folder Existing worktree root.
 * @returns {void} Diagnostics go to stderr; graph failure does not undo Git success.
 */
function refreshCodeGraph(folder) {
  const result = spawnSync("codegraph_refresh", [folder], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: 310000,
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.error || result.status !== 0) {
    info(`worktree_create: CodeGraph not ready; run codegraph_refresh on this worktree before graph-backed exploration`);
  }
}

/**
 * Create or reuse a worktree and refresh its local graph unless only resolving a path.
 * @returns {number} Git creation status, independent of reported graph readiness.
 */
function main() {
  const args = process.argv.slice(2);
  const pathOnly = args[0] === `--path-only`;
  if (pathOnly) args.shift();
  const branch = args[0];
  if (!branch || args.length !== 1) {
    info(`Usage: worktree_create [--path-only] <branch>`);
    return 1;
  }

  const folder = worktreePath(branch);
  if (!folder) return 1;
  if (pathOnly) {
    process.stdout.write(`${folder}\n`);
    return 0;
  }

  const primary = primaryFolder();
  if (!primary) {
    info(`worktree_create: not inside a Git repository`);
    return 1;
  }
  git(["worktree", "prune"], { stdio: "ignore" });
  const reused = existingWorktree(branch, primary);
  if (reused) {
    info(`  -> reusing worktree already on '${branch}': ${reused}`);
    refreshCodeGraph(reused);
    process.stdout.write(`${reused}\n`);
    return 0;
  }
  if (!addWorktree(folder, branch)) {
    info(`worktree_create: could not create '${folder}' for branch '${branch}'`);
    return 1;
  }
  refreshCodeGraph(folder);
  process.stdout.write(`${folder}\n`);
  return 0;
}

process.exitCode = main();
