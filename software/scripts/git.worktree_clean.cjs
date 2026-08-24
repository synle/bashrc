#!/usr/bin/env node
/**
 * worktree_clean — remove clean worktrees whose branches are merged.
 *
 * Scope is always the current working folder and nested repositories. The
 * primary worktree, dirty worktrees, detached worktrees, and ambiguous states
 * stay untouched.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** @type {number} Maximum directory depth below the current working folder. */
const MAX_DEPTH = 3;

/** @type {Set<string>} Folders that should not be searched recursively. */
const IGNORED_FOLDERS = new Set([`.git`, `.hg`, `.svn`, `build`, `coverage`, `dist`, `node_modules`, `target`, `vendor`]);

/** @type {Record<string, string>} ANSI escape sequences used by human output. */
const ANSI = {
  reset: `\x1b[0m`,
  bold: `\x1b[1m`,
  cyan: `\x1b[36m`,
  dim: `\x1b[2m`,
  green: `\x1b[32m`,
  red: `\x1b[31m`,
  yellow: `\x1b[33m`,
};

/**
 * Print one human-facing line.
 * @param {string} line
 * @returns {void}
 */
function print(line = ``) {
  process.stdout.write(`${line}\n`);
}

/**
 * Print a diagnostic line.
 * @param {string} line
 * @returns {void}
 */
function info(line) {
  process.stderr.write(`worktree_clean: ${line}\n`);
}

/**
 * Exit with a user-facing error.
 * @param {string} message
 * @returns {never}
 */
function die(message) {
  info(message);
  process.exit(1);
}

/**
 * Wrap text in ANSI color when human output supports it.
 * @param {string} text
 * @param {string} code
 * @param {boolean} enabled
 * @returns {string}
 */
function paint(text, code, enabled) {
  return enabled ? `${code}${text}${ANSI.reset}` : text;
}

/**
 * Turn any URL inside a display string into an OSC 8 terminal hyperlink so it is
 * clickable, but only when color/TTY human output is enabled. Piped output (enabled =
 * false) is returned untouched so logs stay greppable. Byte-equivalent to
 * format_hyperlink() in common-functions.bash — duplicated because this script deploys as
 * a standalone executable. See AGENTS.md (Terminal links).
 * @param {string} text
 * @param {boolean} enabled
 * @returns {string}
 */
function linkify(text, enabled) {
  if (!enabled) return text;
  return text.replace(/https?:\/\/\S+/g, (url) => `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`);
}

/**
 * Parse command-line options.
 * @param {string[]} argv
 * @returns {{dryRun: boolean, noColor: boolean, force: boolean, help: boolean}}
 */
function parseArgs(argv) {
  const options = { dryRun: false, noColor: false, force: false, help: false };

  for (const arg of argv) {
    if (arg === `--dry-run`) options.dryRun = true;
    else if (arg === `--force` || arg === `-f`) options.force = true;
    else if (arg === `--no-color`) options.noColor = true;
    else if (arg === `--help` || arg === `-h`) options.help = true;
    else die(`unknown option '${arg}'`);
  }

  return options;
}

/**
 * Run a command without a shell.
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @returns {{status: number, stdout: string, stderr: string}}
 */
function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: `utf-8`,
    stdio: [`ignore`, `pipe`, `pipe`],
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || ``,
    stderr: result.stderr || ``,
  };
}

/**
 * Resolve a folder to a stable absolute path.
 * @param {string} folder
 * @returns {string}
 */
function realPath(folder) {
  try {
    return fs.realpathSync(folder);
  } catch {
    return path.resolve(folder);
  }
}

/**
 * Resolve the top-level checkout containing a folder.
 * @param {string} folder
 * @returns {string|null}
 */
function repoRootFrom(folder) {
  const result = runCommand(`git`, [`rev-parse`, `--show-toplevel`], folder);
  if (result.status !== 0) return null;
  const root = result.stdout.trim();
  if (!root) return null;

  const worktrees = runCommand(`git`, [`worktree`, `list`, `--porcelain`], root);
  if (worktrees.status === 0) {
    const primary = parseWorktrees(worktrees.stdout).find((worktree) => !worktree.bare);
    if (primary) return realPath(primary.path);
  }

  return realPath(root);
}

/**
 * Find repositories at and below the scan folder.
 * @param {string} scanRoot
 * @returns {string[]}
 */
function findGitRepos(scanRoot) {
  const repos = new Set();
  const addRepo = (folder) => {
    const root = repoRootFrom(folder);
    if (root) repos.add(root);
  };

  addRepo(scanRoot);

  /**
   * Walk one folder level.
   * @param {string} folder
   * @param {number} depth
   * @returns {void}
   */
  function walk(folder, depth) {
    if (depth > MAX_DEPTH) return;

    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(`.`) || IGNORED_FOLDERS.has(entry.name)) continue;

      const child = path.join(folder, entry.name);
      if (fs.existsSync(path.join(child, `.git`))) addRepo(child);
      walk(child, depth + 1);
    }
  }

  walk(scanRoot, 0);
  return [...repos].sort();
}

/**
 * Resolve a readable repository label from its origin remote.
 * @param {string} repoRoot
 * @returns {string}
 */
function repoLabel(repoRoot) {
  const result = runCommand(`git`, [`remote`, `get-url`, `origin`], repoRoot);
  const origin = result.stdout.trim();
  if (!origin) return path.basename(repoRoot);

  const match = origin.match(/(?:github\.com|gitlab\.com|bitbucket\.org)[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match ? match[1] : origin;
}

/**
 * Resolve a default branch ref available in the repository.
 * @param {string} repoRoot
 * @returns {string|null}
 */
function defaultBranchRef(repoRoot) {
  const symbolic = runCommand(`git`, [`symbolic-ref`, `--quiet`, `refs/remotes/origin/HEAD`], repoRoot).stdout.trim();
  if (symbolic) return symbolic;

  for (const ref of [`refs/remotes/origin/main`, `refs/remotes/origin/master`, `refs/heads/main`, `refs/heads/master`]) {
    if (runCommand(`git`, [`rev-parse`, `--verify`, `--quiet`, `${ref}^{commit}`], repoRoot).status === 0) return ref;
  }

  return null;
}

/**
 * Parse `git worktree list --porcelain`.
 * @param {string} raw
 * @returns {Array<{path: string, branch: string|null, detached: boolean, bare: boolean, locked: boolean, prunable: boolean}>}
 */
function parseWorktrees(raw) {
  const worktrees = [];
  let current = null;

  const finish = () => {
    if (current) worktrees.push(current);
  };

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith(`worktree `)) {
      finish();
      current = {
        path: line.slice(`worktree `.length),
        branch: null,
        detached: false,
        bare: false,
        locked: false,
        prunable: false,
      };
    } else if (!current) {
      continue;
    } else if (line === `bare`) {
      current.bare = true;
    } else if (line === `detached`) {
      current.detached = true;
    } else if (line === `locked` || line.startsWith(`locked `)) {
      current.locked = true;
    } else if (line === `prunable` || line.startsWith(`prunable `)) {
      current.prunable = true;
    } else if (line.startsWith(`branch `)) {
      current.branch = line.slice(`branch `.length);
    }
  }

  finish();
  return worktrees;
}

/**
 * Read all worktrees owned by one repository.
 * @param {string} repoRoot
 * @returns {Array<{path: string, branch: string|null, detached: boolean, bare: boolean, locked: boolean, prunable: boolean}>|null}
 */
function listWorktrees(repoRoot) {
  const result = runCommand(`git`, [`worktree`, `list`, `--porcelain`], repoRoot);
  if (result.status !== 0) return null;
  return parseWorktrees(result.stdout);
}

/**
 * Check whether a worktree has uncommitted changes.
 * @param {string} worktreePath
 * @returns {boolean|null}
 */
function dirtyState(worktreePath) {
  const result = runCommand(`git`, [`status`, `--porcelain`], worktreePath);
  if (result.status !== 0) return null;
  return result.stdout.trim().length > 0;
}

/**
 * Detect whether `branch` is already contained in `defaultRef`.
 * @param {string} repoRoot
 * @param {string} branch
 * @param {string|null} defaultRef
 * @returns {boolean}
 */
function branchIsMerged(repoRoot, branch, defaultRef) {
  if (!branch || !defaultRef) return false;
  return runCommand(`git`, [`merge-base`, `--is-ancestor`, branch, defaultRef], repoRoot).status === 0;
}

/**
 * Check whether GitHub reports a branch's pull request as merged.
 * @param {string} repoRoot
 * @param {string|null} branch
 * @param {boolean} ghAvailable
 * @returns {{state: string, url: string}|null}
 */
function pullRequestState(repoRoot, branch, ghAvailable) {
  if (!ghAvailable || !branch) return null;
  const branchName = branch.replace(/^refs\/heads\//, ``);
  const result = runCommand(`gh`, [`pr`, `view`, branchName, `--json`, `state,url`], repoRoot);
  if (result.status !== 0) return null;

  try {
    const parsed = JSON.parse(result.stdout);
    return { state: parsed.state || ``, url: parsed.url || `` };
  } catch {
    return null;
  }
}

/**
 * Describe the cleanup decision for one worktree.
 * @param {{path: string, branch: string|null, detached: boolean, bare: boolean, locked: boolean, prunable: boolean}} worktree
 * @param {string} primaryPath
 * @param {string} repoRoot
 * @param {string|null} defaultRef
 * @param {boolean} ghAvailable
 * @param {boolean} [force] Remove every non-primary worktree, skipping dirty/merged checks.
 * @returns {{remove: boolean, reason: string}}
 */
function cleanupDecision(worktree, primaryPath, repoRoot, defaultRef, ghAvailable, force = false) {
  if (worktree.path === primaryPath) return { remove: false, reason: `primary worktree` };
  if (worktree.bare) return { remove: false, reason: `bare repository entry` };
  if (force) return { remove: true, reason: `forced removal (--force)` };
  if (worktree.prunable) return { remove: false, reason: `prunable entry; run git worktree prune separately` };
  if (worktree.locked) return { remove: false, reason: `locked worktree` };
  if (worktree.detached || !worktree.branch) return { remove: false, reason: `detached worktree` };
  if (!fs.existsSync(worktree.path)) return { remove: false, reason: `worktree folder is missing` };

  const dirty = dirtyState(worktree.path);
  if (dirty === null) return { remove: false, reason: `could not read worktree status` };
  if (dirty) return { remove: false, reason: `uncommitted changes` };

  if (branchIsMerged(repoRoot, worktree.branch, defaultRef)) {
    return { remove: true, reason: `branch merged into ${defaultRef || `default branch`}` };
  }

  const pullRequest = pullRequestState(repoRoot, worktree.branch, ghAvailable);
  if (pullRequest && pullRequest.state === `MERGED`) {
    return { remove: true, reason: `PR merged${pullRequest.url ? ` · ${pullRequest.url}` : ``}` };
  }
  if (pullRequest && pullRequest.state) return { remove: false, reason: `PR state ${pullRequest.state}` };

  return { remove: false, reason: `branch is not merged` };
}

/**
 * Remove one worktree.
 * @param {string} repoRoot
 * @param {string} worktreePath
 * @param {boolean} [force] Pass `--force` so dirty or locked worktrees still go.
 * @returns {{removed: boolean, reason: string}}
 */
function removeWorktree(repoRoot, worktreePath, force = false) {
  const args = force ? [`worktree`, `remove`, `--force`, `--force`, worktreePath] : [`worktree`, `remove`, worktreePath];
  const result = runCommand(`git`, args, repoRoot);
  if (result.status === 0) return { removed: true, reason: force ? `removed (forced)` : `removed` };
  const message = (result.stderr || `git worktree remove failed`).trim().split(/\r?\n/)[0];
  return { removed: false, reason: message };
}

/**
 * Print command help.
 * @returns {void}
 */
function printHelp() {
  print(`worktree_clean: remove clean worktrees whose branches are merged`);
  print(`  Scope: current working folder and nested repositories (depth ${MAX_DEPTH})`);
  print(`  Usage: worktree_clean [--dry-run] [--force|-f] [--no-color]`);
  print(`  --force: remove EVERY non-primary worktree, skipping the dirty/merged checks`);
}

/**
 * Run the CLI.
 * @returns {void}
 */
function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const scanRoot = realPath(process.cwd());
  const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && !options.noColor;
  const repos = findGitRepos(scanRoot);
  const ghAvailable = runCommand(`gh`, [`--version`], scanRoot).status === 0;
  let removed = 0;
  let wouldRemove = 0;
  let kept = 0;

  print(`${paint(`🧭 PWD`, ANSI.bold + ANSI.yellow, color)} ${scanRoot}`);
  print(`${paint(`🔎 SCOPE`, ANSI.dim, color)} current folder + nested repositories`);
  if (options.force) {
    print(`${paint(`💥 FORCE`, ANSI.bold + ANSI.red, color)} removing every non-primary worktree, dirty/merged checks skipped`);
  }

  if (repos.length === 0) {
    print(`${paint(`⚠️`, ANSI.yellow, color)} no git repositories found below PWD`);
    return;
  }

  for (const repoRoot of repos) {
    const label = repoLabel(repoRoot);
    const defaultRef = defaultBranchRef(repoRoot);
    const worktrees = listWorktrees(repoRoot);

    print(`\n${paint(`📦 REPO`, ANSI.bold + ANSI.cyan, color)} ${label}`);
    print(`   ${paint(`ROOT`, ANSI.dim, color)} ${repoRoot}`);
    print(`   ${paint(`DEFAULT`, ANSI.dim, color)} ${defaultRef || `unknown`}`);

    if (!worktrees) {
      print(`   ${paint(`⚠️`, ANSI.yellow, color)} could not read worktrees`);
      continue;
    }

    const primaryPath = worktrees.find((worktree) => !worktree.bare)?.path || ``;
    for (const worktree of worktrees) {
      const decision = cleanupDecision(worktree, primaryPath, repoRoot, defaultRef, ghAvailable, options.force);
      const branch = worktree.branch ? worktree.branch.replace(/^refs\/heads\//, ``) : `detached`;
      let icon = `⏭️`;
      let action = `KEEP`;
      let actionColor = ANSI.yellow;

      if (decision.remove) {
        if (options.dryRun) {
          icon = `🧪`;
          action = `WOULD REMOVE`;
          actionColor = ANSI.cyan;
          wouldRemove += 1;
        } else {
          const result = removeWorktree(repoRoot, worktree.path, options.force);
          if (result.removed) {
            icon = `🧹`;
            action = `REMOVED`;
            actionColor = ANSI.green;
            removed += 1;
          } else {
            icon = `⚠️`;
            action = `KEEP`;
            actionColor = ANSI.red;
            kept += 1;
            decision.reason = result.reason;
          }
        }
      } else {
        kept += 1;
      }

      print(`   ├─ ${icon} ${paint(action, actionColor, color)} ${worktree.path}`);
      print(`   │  ${paint(`BRANCH`, ANSI.dim, color)} ${branch} · ${linkify(decision.reason, color)}`);
    }
  }

  const removedCount = options.dryRun ? wouldRemove : removed;
  const verb = options.dryRun ? `would remove` : `removed`;
  print(`\n${paint(`✅ DONE`, ANSI.bold + ANSI.green, color)} ${repos.length} repo(s) · ${verb} ${removedCount} · kept ${kept}`);
}

main();
