#!/usr/bin/env node
/*
 * git_checkout - smarter branch checkout for repos that use worktrees.
 *
 * Behavior:
 *   - one plain local-branch argument, not checked out elsewhere -> delegate to `git checkout`
 *   - one plain local-branch argument, already checked out in another worktree ->
 *     print a copy-paste-runnable block with repo + branch context that ends with
 *     `cd <that-worktree>`
 *   - anything else -> delegate to `git checkout` unchanged
 */

const { spawnSync } = require("child_process");

/** Standard terminal separator. */
const LINE_BREAK_EQUAL = "=".repeat(80);

/**
 * Run git and capture its result.
 * @param {string[]} args
 * @param {{cwd?: string, stdio?: "pipe"|"inherit"|"ignore"}} [options]
 * @returns {{status: number, stdout: string, stderr: string}}
 */
function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    env: process.env,
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim(),
  };
}

/**
 * Resolve current repo root.
 * @returns {string|null}
 */
function repoRoot() {
  const result = git(["rev-parse", "--show-toplevel"]);
  return result.status === 0 ? result.stdout : null;
}

/**
 * Check whether a local branch exists.
 * @param {string} branch
 * @returns {boolean}
 */
function hasLocalBranch(branch) {
  return git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
}

/**
 * Parse `git worktree list --porcelain` and return the worktree path currently holding `branch`.
 * Includes the primary checkout when it is on that branch.
 * @param {string} branch
 * @returns {string|null}
 */
function branchWorktreePath(branch) {
  const result = git(["worktree", "list", "--porcelain"]);
  if (result.status !== 0) return null;

  let currentPath = null;
  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length);
      continue;
    }
    if (line === `branch refs/heads/${branch}`) {
      return currentPath;
    }
  }
  return null;
}

/**
 * Print a copy-paste-runnable block that starts from the caller's current folder and ends by
 * cd'ing into the worktree already holding the branch.
 * @param {string} repoName
 * @param {string} branch
 * @param {string} currentFolder
 * @param {string} worktreeFolder
 * @returns {void}
 */
function printCdSummary(repoName, branch, currentFolder, worktreeFolder) {
  process.stdout.write(`${LINE_BREAK_EQUAL}\n`);
  process.stdout.write(`REPO: "${repoName}"\n`);
  process.stdout.write(`BRANCH: "${branch}"\n`);
  process.stdout.write(`PWD: "${currentFolder}"\n`);
  process.stdout.write(`cd "${currentFolder}"\n`);
  process.stdout.write(`cd "${worktreeFolder}"\n`);
  process.stdout.write(`${LINE_BREAK_EQUAL}\n`);
}

/**
 * Delegate unchanged to `git checkout`, preserving its exit code and stdio.
 * @param {string[]} args
 * @returns {number}
 */
function delegateCheckout(args) {
  const result = spawnSync("git", ["checkout", ...args], {
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });
  return result.status === null ? 1 : result.status;
}

/**
 * Main entrypoint.
 * @returns {number}
 */
function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0].startsWith("-")) {
    return delegateCheckout(args);
  }

  const branch = args[0];
  const currentRoot = repoRoot();
  if (!currentRoot || !hasLocalBranch(branch)) {
    return delegateCheckout(args);
  }

  const occupiedWorktree = branchWorktreePath(branch);
  if (!occupiedWorktree || occupiedWorktree === currentRoot) {
    return delegateCheckout(args);
  }

  printCdSummary(currentRoot.split("/").pop() || currentRoot, branch, process.cwd(), occupiedWorktree);
  return 0;
}

process.exitCode = main();
