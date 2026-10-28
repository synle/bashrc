#!/usr/bin/env node
/** List local Git worktrees as grouped human-readable output or a JSON array. */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** @type {number} Maximum nested repository depth below the current folder. */
const MAX_DEPTH = 3;
/** @type {number} Deadline for each local Git query in milliseconds. */
const GIT_TIMEOUT_MS = 10000;
/** @type {Set<string>} Cache and build folders excluded from recursive discovery. */
const IGNORED_FOLDERS = new Set([`build`, `coverage`, `dist`, `node_modules`, `target`, `vendor`]);

/**
 * Parse the two output modes and help without changing Git state.
 * @param {string[]} argv Command-line arguments.
 * @returns {{mode: string, help: boolean}} Selected output mode and help flag.
 * @throws {Error} An argument is unknown or selects conflicting modes.
 */
function parseArgs(argv) {
  let mode = null;
  let help = false;
  for (const arg of argv) {
    if (arg === `--help` || arg === `-h`) {
      help = true;
      continue;
    }
    if (arg !== `--raw` && arg !== `--pretty`) throw new Error(`unknown option '${arg}'`);
    const selected = arg.slice(2);
    if (mode !== null && mode !== selected) throw new Error(`choose only one of --raw and --pretty`);
    mode = selected;
  }
  return { mode: mode === null ? `pretty` : mode, help };
}

/**
 * Query local Git without a shell or interactive input.
 * @param {string} folder Working folder.
 * @param {string[]} args Git arguments.
 * @returns {{status: number|null, stdout: string, stderr: string}} Untrimmed Git result.
 * @throws {Error} Git cannot execute, exceeds its deadline, or exceeds its output buffer.
 */
function git(folder, args) {
  const result = spawnSync(`git`, args, {
    cwd: folder,
    encoding: `utf8`,
    stdio: [`ignore`, `pipe`, `pipe`],
    timeout: GIT_TIMEOUT_MS,
  });
  if (result.error) throw result.error;
  return result;
}

/**
 * Decode NUL-delimited worktree records without Git's quoted-path ambiguity.
 * @param {string} raw Output of git worktree list --porcelain -z.
 * @returns {Array<{path: string, branch: string|null, bare: boolean}>} Worktrees in Git order, primary first.
 */
function parseWorktrees(raw) {
  const worktrees = [];
  let current = null;
  for (const field of raw.split(`\0`)) {
    if (field.startsWith(`worktree `)) {
      current = { path: field.slice(9), branch: null, bare: false };
      worktrees.push(current);
    } else if (current && field.startsWith(`branch refs/heads/`)) {
      current.branch = field.slice(`branch refs/heads/`.length);
    } else if (current && field === `bare`) {
      current.bare = true;
    }
  }
  return worktrees;
}

/**
 * Resolve origin identity without exposing credentials or making remote requests.
 * @param {string} folder Repository or worktree folder.
 * @param {string} root Primary checkout path used for a missing-origin fallback.
 * @returns {{org: string|null, repo: string}} Remote identity, or local folder identity.
 * @throws {TypeError} Origin uses a malformed network URL.
 */
function repoIdentity(folder, root) {
  const origin = git(folder, [`remote`, `get-url`, `origin`]).stdout.trim();
  let remotePath = ``;
  if (/^(?:https?|ssh|git):\/\//i.test(origin)) {
    try {
      remotePath = new URL(origin).pathname;
    } catch (error) {
      if (error instanceof TypeError) error.message = `invalid origin URL in ${folder}`;
      throw error;
    }
  } else {
    const scp = origin.match(/^(?:[^@/]+@)?[^:/]+:(.+)$/);
    if (scp) remotePath = scp[1];
  }
  const parts = remotePath
    .replace(/\/+$/, ``)
    .replace(/\.git$/, ``)
    .split(`/`)
    .filter(Boolean);
  if (parts.length < 2) return { org: null, repo: path.basename(root) };
  return { org: parts.slice(0, -1).join(`/`), repo: parts[parts.length - 1] };
}

/**
 * Discover repository inventories at and below the current folder, deduplicated by primary root.
 * Hidden/cache folders and symbolic links are not traversed; linked worktrees may reside outside the scan root.
 * @param {string} scanRoot Current working folder.
 * @returns {Array<{org: string|null, repo: string, root: string, worktrees: ReturnType<typeof parseWorktrees>}>} Sorted repository groups.
 * @throws {Error} A folder cannot be read or an identified repository cannot list worktrees.
 */
function findRepos(scanRoot) {
  const repos = new Map();

  /**
   * Probe one candidate with Git and visit eligible children within the depth limit.
   * @param {string} folder Candidate folder.
   * @param {number} depth Nesting depth below the scan root.
   * @returns {void} Adds each discovered repository once.
   */
  function walk(folder, depth) {
    const probe = git(folder, [`rev-parse`, `--git-dir`]);
    if (probe.status === 0) {
      const result = git(folder, [`worktree`, `list`, `--porcelain`, `-z`]);
      if (result.status !== 0) throw new Error(`cannot list worktrees in ${folder}`);
      const worktrees = parseWorktrees(result.stdout);
      if (worktrees.length === 0) throw new Error(`no worktree records returned for ${folder}`);
      const root = worktrees[0].path;
      if (!repos.has(root)) repos.set(root, { ...repoIdentity(folder, root), root, worktrees });
    } else if (probe.status !== 128) {
      throw new Error(`cannot inspect Git repository in ${folder}`);
    }
    if (depth === MAX_DEPTH) return;

    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(`.`) || entry.name.includes(`.secret.`) || IGNORED_FOLDERS.has(entry.name)) continue;
      walk(path.join(folder, entry.name), depth + 1);
    }
  }

  walk(scanRoot, 0);
  return [...repos.values()].sort((a, b) => a.root.localeCompare(b.root));
}

/**
 * Escape terminal control bytes in display text; raw JSON preserves the original strings.
 * @param {string} value Branch, identity, or path to display.
 * @returns {string} Single-line terminal-safe text.
 */
function display(value) {
  return value.replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, `0`)}`);
}

/**
 * Render the requested output mode without changing repositories or worktrees.
 * @returns {void} Writes the inventory or help to stdout.
 * @throws {Error} Arguments or local discovery fail; the CLI boundary reports the failure on stderr.
 */
function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      `worktree_list: list local Git worktrees\n` +
        `Usage: worktree_list [--raw | --pretty]\n` +
        `Scope: current folder and nested repositories (depth ${MAX_DEPTH}); includes primary and linked worktrees.\n` +
        `--pretty  Grouped repository headers and worktree rows (default).\n` +
        `--raw     JSON array: branch_name, repo, org, worktree_path, root_path.\n` +
        `          Detached/bare branches and unknown organizations are null.\n` +
        `--help, -h  Show this help.\n`,
    );
    return;
  }
  const repos = findRepos(process.cwd());
  if (options.mode === `raw`) {
    const rows = repos.flatMap(({ org, repo, root, worktrees }) =>
      worktrees.map((worktree) => ({ branch_name: worktree.branch, repo, org, worktree_path: worktree.path, root_path: root })),
    );
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  const groups = repos.map(({ org, repo, root, worktrees }) => {
    const label = org === null ? repo : `${org}/${repo}`;
    const rows = worktrees.map((worktree) => {
      const branch = worktree.bare ? `(bare)` : (worktree.branch ?? `(detached)`);
      return `🌳  ${display(branch)} ${display(worktree.path)}`;
    });
    return [`📦 ${display(label)}  ${display(root)}`, ...rows].join(`\n`);
  });
  process.stdout.write(groups.length === 0 ? `No Git repositories found.\n` : `${groups.join(`\n\n`)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`worktree_list: ${error.message}\n`);
  process.exitCode = 1;
}
