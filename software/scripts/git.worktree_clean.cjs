#!/usr/bin/env node
/**
 * worktree_clean — preserve uncertain worktrees, confirm pending deletions, or purge linked worktrees.
 *
 * Scope is the current working folder and nested repositories. Primary and bare
 * repositories always stay. Preserve is the default; interactive and purge can
 * permanently delete uncommitted and untracked work.
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
  blue: `\x1b[34m`,
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
 * Render display URLs as blue OSC 8 links only when color/TTY human output is enabled, without suffix hints.
 * Piped output (enabled = false) and dumb terminals remain unchanged so logs stay greppable.
 * Standalone deployment prevents sharing the shell helper. See AGENTS.md (Terminal links).
 * @param {string} text
 * @param {boolean} enabled
 * @returns {string}
 */
function linkify(text, enabled) {
  if (!enabled) return text;
  if (!process.env.TERM || process.env.TERM === `dumb`) return text;
  return text.replace(/https?:\/\/\S+/g, (url) => `\x1b]8;;${url}\x1b\\${paint(url, ANSI.blue, enabled)}\x1b]8;;\x1b\\`);
}

/**
 * Parse cleanup modes before any repository mutation; --force remains a purge alias.
 * @param {string[]} argv Command-line arguments.
 * @returns {{dryRun: boolean, noColor: boolean, force: boolean, help: boolean, mode: string}} Validated options.
 * @sideEffects Invalid arguments terminate the CLI with status 1 before any repository changes.
 */
function parseArgs(argv) {
  const options = { dryRun: false, noColor: false, force: false, help: false, mode: `preserve` };
  let selectedMode = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    let mode = null;
    if (arg === `--dry-run`) options.dryRun = true;
    else if (arg === `--force` || arg === `-f`) mode = `purge`;
    else if (arg === `--mode`) mode = argv[++index] ?? ``;
    else if (arg.startsWith(`--mode=`)) mode = arg.slice(`--mode=`.length);
    else if (arg === `--no-color`) options.noColor = true;
    else if (arg === `--help` || arg === `-h`) options.help = true;
    else die(`unknown option '${arg}'`);
    if (mode === null) continue;
    if (![`preserve`, `interactive`, `purge`].includes(mode)) die(`--mode must be preserve, interactive, or purge`);
    if (selectedMode !== null && selectedMode !== mode) die(`conflicting cleanup modes`);
    selectedMode = mode;
    options.mode = mode;
    options.force = mode === `purge`;
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
 * Resolve the owning primary checkout or bare repository from a checkout folder.
 * @param {string} folder
 * @returns {string|null}
 */
function repoRootFrom(folder) {
  const result = runCommand(`git`, [`rev-parse`, `--show-toplevel`], folder);
  if (result.status !== 0) return null;
  const root = result.stdout.trim();
  if (!root) return null;

  const worktrees = runCommand(`git`, [`worktree`, `list`, `--porcelain`, `-z`], root);
  if (worktrees.status === 0) {
    const primary = parseWorktrees(worktrees.stdout)[0];
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
 * Parse NUL-delimited `git worktree list --porcelain -z`, preserving unusual path bytes.
 * @param {string} raw
 * @returns {Array<{path: string, branch: string|null, detached: boolean, bare: boolean, locked: boolean, prunable: boolean}>}
 */
function parseWorktrees(raw) {
  const worktrees = [];
  let current = null;

  const finish = () => {
    if (current) worktrees.push(current);
  };

  for (const line of raw.split(`\0`)) {
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
 * Read registered worktrees using unquoted, NUL-delimited paths.
 * @param {string} repoRoot
 * @returns {Array<{path: string, branch: string|null, detached: boolean, bare: boolean, locked: boolean, prunable: boolean}>|null}
 */
function listWorktrees(repoRoot) {
  const result = runCommand(`git`, [`worktree`, `list`, `--porcelain`, `-z`], repoRoot);
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
 * Check whether GitHub reports a branch's pull request state and placeholder markers.
 * @param {string} repoRoot
 * @param {string|null} branch
 * @param {boolean} ghAvailable
 * @returns {{state: string, url: string, isDraft: boolean, title: string}|null}
 */
function pullRequestState(repoRoot, branch, ghAvailable) {
  if (!ghAvailable || !branch) return null;
  const branchName = branch.replace(/^refs\/heads\//, ``);
  const result = runCommand(`gh`, [`pr`, `view`, branchName, `--json`, `state,url,isDraft,title`], repoRoot);
  if (result.status !== 0) return null;

  try {
    const parsed = JSON.parse(result.stdout);
    return {
      state: parsed.state || ``,
      url: parsed.url || ``,
      isDraft: parsed.isDraft === true,
      title: parsed.title || ``,
    };
  } catch {
    return null;
  }
}

/**
 * Detect the parked pre-implementation placeholder PR state.
 * @param {{state: string, url: string, isDraft: boolean, title: string}|null} pullRequest
 * @returns {boolean}
 */
function isPlaceholderDraft(pullRequest) {
  return Boolean(pullRequest && pullRequest.state === `OPEN` && pullRequest.isDraft && /placeholder/i.test(pullRequest.title));
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

  const pullRequest = pullRequestState(repoRoot, worktree.branch, ghAvailable);
  if (isPlaceholderDraft(pullRequest)) {
    return { remove: false, reason: `placeholder draft pending implementation${pullRequest.url ? ` · ${pullRequest.url}` : ``}` };
  }

  if (branchIsMerged(repoRoot, worktree.branch, defaultRef)) {
    return { remove: true, reason: `branch merged into ${defaultRef || `default branch`}` };
  }

  if (pullRequest && pullRequest.state === `MERGED`) {
    return { remove: true, reason: `PR merged${pullRequest.url ? ` · ${pullRequest.url}` : ``}` };
  }
  if (pullRequest && pullRequest.state) return { remove: false, reason: `PR state ${pullRequest.state}` };

  return { remove: false, reason: `branch is not merged` };
}

/**
 * Revalidate registration and branch identity, then remove one non-primary worktree.
 * @param {string} repoRoot Repository that owns the registration.
 * @param {string} worktreePath Absolute registered target.
 * @param {boolean} [force] Force removal even when dirty or locked.
 * @param {string|null} [expectedBranch] Previously observed branch, including detached null.
 * @returns {{removed: boolean, reason: string}} Outcome; failures never count as removals.
 * @sideEffects Permanently deletes the selected worktree and its registration on success.
 */
function removeWorktree(repoRoot, worktreePath, force = false, expectedBranch = undefined) {
  const live = listWorktrees(repoRoot);
  const entry = live?.find((worktree) => worktree.path === worktreePath);
  if (!entry || entry.bare || entry.path === live[0].path || !path.isAbsolute(worktreePath)) {
    return { removed: false, reason: `target is no longer a registered non-primary worktree` };
  }
  if (expectedBranch !== undefined && entry.branch !== expectedBranch)
    return { removed: false, reason: `worktree branch changed; keeping it` };
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
  print(`worktree_clean: remove local worktrees with preserve, interactive, or purge mode`);
  print(`  Scope: current working folder and nested repositories (depth ${MAX_DEPTH})`);
  print(`  Usage: worktree_clean [--mode preserve|interactive|purge] [--dry-run] [--no-color]`);
  print(`  --mode=preserve: remove only safely merged clean worktrees (default)`);
  print(`  --mode=interactive: safe cleanup, then confirm each pending worktree with all/y/N`);
  print(`  --mode=purge: permanently delete EVERY non-primary worktree without prompting`);
  print(`  --force, -f: compatibility aliases for --mode purge`);
  print(`  Primary and bare repositories always stay. Dirty, untracked, detached, and locked worktrees can be deleted.`);
  print(`  --dry-run: never delete or prompt; interactive pending entries remain pending.`);
}

/**
 * Ask for each pending deletion through a controlling terminal, after safe cleanup finishes.
 * @param {Array<{repoRoot: string, label: string, worktree: object}>} pending Kept linked worktrees.
 * @returns {{removed: number, removedPaths: Set<string>, failed: Set<string>}} Successful deletions and failed target paths.
 * @sideEffects Prompts on the terminal and force-removes only explicitly approved worktrees.
 */
function confirmPending(pending) {
  const result = { removed: 0, removedPaths: new Set(), failed: new Set() };
  if (pending.length === 0) return result;
  let terminal;
  try {
    terminal = fs.openSync(`/dev/tty`, `r+`);
  } catch (error) {
    info(`cannot open controlling terminal (${error.code}); pending worktrees kept`);
    process.exitCode = 1;
    return result;
  }
  let all = false;
  try {
    info(`Approved deletions permanently remove uncommitted and untracked work. Primary and bare repositories stay.`);
    for (let index = 0; index < pending.length; index += 1) {
      const { repoRoot, label, worktree } = pending[index];
      let answer = `all`;
      if (!all) {
        answer = pendingChoice(
          terminal,
          `Delete pending worktree ${index + 1} of ${pending.length} · ${label} · ${worktree.path}? [all/y/N]: `,
        );
      }
      if (answer === null) {
        info(`terminal input closed; remaining pending worktrees kept`);
        process.exitCode = 1;
        break;
      }
      if (answer === `n`) continue;
      if (answer === `all`) all = true;
      const deletion = removeWorktree(repoRoot, worktree.path, true, worktree.branch);
      if (deletion.removed) {
        result.removed += 1;
        result.removedPaths.add(worktree.path);
        print(`🧹 REMOVED ${worktree.path} · confirmed deletion`);
      } else {
        result.failed.add(worktree.path);
        info(`kept ${worktree.path}: ${deletion.reason}`);
      }
    }
  } finally {
    fs.closeSync(terminal);
  }
  return result;
}

/**
 * Read one bounded all/y/N answer; empty input means No, invalid answers re-prompt, and EOF cancels the remainder.
 * @param {number} terminal Open terminal descriptor.
 * @param {string} question Human-facing prompt.
 * @returns {string|null} all, y, n, or null at EOF.
 * @throws {Error} Terminal I/O fails; the CLI boundary reports the failure.
 */
function pendingChoice(terminal, question) {
  const byte = Buffer.alloc(1);
  const maxAnswerBytes = 32;
  const safeQuestion = question.replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, `0`)}`);
  while (true) {
    fs.writeSync(terminal, safeQuestion);
    let answer = ``;
    let oversized = false;
    while (true) {
      if (fs.readSync(terminal, byte, 0, 1, null) === 0) return null;
      if (byte[0] === 10) break;
      if (byte[0] === 13) continue;
      if (answer.length < maxAnswerBytes) answer += String.fromCharCode(byte[0]);
      else oversized = true;
    }
    answer = answer.trim().toLowerCase();
    if (!oversized && [`all`, `y`, `n`, ``].includes(answer)) return answer || `n`;
    fs.writeSync(terminal, `Enter all, y, or N.\n`);
  }
}

/**
 * Perform scoped cleanup, then optional pending confirmations, and report actual removal counts.
 * @returns {void} Sets a nonzero exit status for failed removals or unavailable interactive input.
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
  const ghAvailable = !options.force && runCommand(`gh`, [`--version`], scanRoot).status === 0;
  const pending = [];
  const failed = new Set();
  let removed = 0;
  let wouldRemove = 0;
  let kept = 0;

  print(`${paint(`🧭 PWD`, ANSI.bold + ANSI.yellow, color)} ${scanRoot}`);
  print(`${paint(`🔎 SCOPE`, ANSI.dim, color)} current folder + nested repositories`);
  if (options.force) {
    print(`${paint(`💥 FORCE`, ANSI.bold + ANSI.red, color)} purge: removing every non-primary worktree, dirty/merged checks skipped`);
    print(`Warning: uncommitted and untracked work will be permanently deleted. Primary and bare repositories stay.`);
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
      process.exitCode = 1;
      continue;
    }

    const primaryPath = worktrees[0]?.path || ``;
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
          const result = removeWorktree(repoRoot, worktree.path, options.force, worktree.branch);
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
            failed.add(worktree.path);
          }
        }
      } else {
        kept += 1;
      }

      if (options.mode === `interactive` && action === `KEEP` && worktree.path !== primaryPath && !worktree.bare) {
        pending.push({ repoRoot, label, worktree });
      }
      print(`   ├─ ${icon} ${paint(action, actionColor, color)} ${worktree.path}`);
      print(`   │  ${paint(`BRANCH`, ANSI.dim, color)} ${branch} · ${linkify(decision.reason, color)}`);
    }
  }

  if (options.mode === `interactive` && pending.length > 0) {
    print(`\nPENDING ${pending.length} worktree(s)${options.dryRun ? `; confirmation skipped (--dry-run)` : ``}`);
    if (!options.dryRun) {
      const confirmed = confirmPending(pending);
      removed += confirmed.removed;
      kept -= confirmed.removed;
      for (const target of confirmed.removedPaths) failed.delete(target);
      for (const target of confirmed.failed) failed.add(target);
    }
  }
  if (failed.size > 0) process.exitCode = 1;
  const removedCount = options.dryRun ? wouldRemove : removed;
  const verb = options.dryRun ? `would remove` : `removed`;
  const heading = process.exitCode ? `⚠️ INCOMPLETE` : `✅ DONE`;
  print(`\n${paint(heading, ANSI.bold + ANSI.green, color)} ${repos.length} repo(s) · ${verb} ${removedCount} · kept ${kept}`);
}

try {
  main();
} catch (error) {
  info(`cleanup interrupted (${error.code || error.name}); remaining worktrees kept`);
  process.exitCode = 1;
}
