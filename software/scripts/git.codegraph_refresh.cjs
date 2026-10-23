#!/usr/bin/env node
/** Refresh one worktree-local CodeGraph index without changing Git history. */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** Maximum runtime for initial indexing or incremental refresh, in milliseconds. */
const CODEGRAPH_REFRESH_TIMEOUT_MS = 300000;

/**
 * Execute a bounded child with no stdin and telemetry disabled.
 * @param {string} command Executable name.
 * @param {string[]} args Literal argument vector.
 * @param {string} cwd Working folder.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured child result.
 */
function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: CODEGRAPH_REFRESH_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, CODEGRAPH_TELEMETRY: "0" },
  });
}

/**
 * Emit one JSON outcome; diagnostics never enter stdout.
 * @param {string} status Graph readiness outcome.
 * @param {string|null} workspace Resolved worktree root, if known.
 * @param {string} reason Explanation including whether retry is safe.
 * @returns {number} Zero for ready, two for deferred, otherwise one.
 */
function report(status, workspace, reason) {
  process.stdout.write(`${JSON.stringify({ status, workspace, reason })}\n`);
  if (status === "initialized" || status === "refreshed") return 0;
  return status === "deferred" ? 2 : 1;
}

/**
 * Initialize or sync the exact Git worktree root supplied by the caller.
 * Refuse shared indexes, unfinished Git operations, and concurrent refreshes.
 * @returns {number} Readiness exit status; failures never mutate Git history.
 */
function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0]) return report("failed", null, "Expected one worktree folder; retry with an absolute Git root.");
  const root = run("git", ["rev-parse", "--show-toplevel"], path.resolve(args[0]));
  if (root.status !== 0) return report("failed", null, "workspace must be an existing Git worktree; retry after correcting it.");
  const workspace = fs.realpathSync(root.stdout.trim());
  if (fs.realpathSync(path.resolve(args[0])) !== workspace) {
    return report("failed", workspace, "workspace must name the worktree root, not a subfolder; retry with the reported root.");
  }
  if (process.env.CODEGRAPH_DIR && process.env.CODEGRAPH_DIR !== ".codegraph") {
    return report("failed", workspace, "CODEGRAPH_DIR must be unset or .codegraph; correct it before retrying.");
  }
  // WSL and Windows must not share SQLite handles. Use a Linux-native checkout
  // until this adapter supports CodeGraph's OS-specific mounted-drive index name.
  if (process.platform === "linux" && /^\/mnt\/[a-z]\//i.test(workspace)) {
    return report("deferred", workspace, "Mounted Windows drive: use a Linux-native worktree before retrying.");
  }
  const unmerged = run("git", ["ls-files", "--unmerged"], workspace);
  if (unmerged.status !== 0) return report("failed", workspace, "Cannot inspect unmerged paths; fix Git access before retrying.");
  const gitFolder = run("git", ["rev-parse", "--absolute-git-dir"], workspace);
  if (gitFolder.status !== 0) return report("failed", workspace, "Cannot resolve worktree Git metadata; fix Git access before retrying.");
  const metadata = gitFolder.stdout.trim();
  if (
    unmerged.stdout.trim() ||
    ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD"].some((name) =>
      fs.existsSync(path.join(metadata, name)),
    )
  ) {
    return report(
      "deferred",
      workspace,
      "Git operation unfinished; complete or abort it before retrying. Do not trust the graph meanwhile.",
    );
  }
  const index = path.join(workspace, ".codegraph");
  const database = path.join(index, "codegraph.db");
  // lstat rejects dangling links as well as links to another checkout's index.
  for (const target of [index, database]) {
    try {
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink() || (target === index && !stat.isDirectory())) {
        return report(
          "failed",
          workspace,
          "Index must be a worktree-local folder and database, never shared symlinks; resolve ownership before retrying.",
        );
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const lock = path.join(metadata, "codegraph-refresh.lock");
  try {
    fs.mkdirSync(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return report(
      "deferred",
      workspace,
      "Refresh lock present; wait for its owner. Remove a stale lock only after verifying no refresh runs.",
    );
  }
  try {
    const initialized = fs.existsSync(database);
    const result = run("codegraph", initialized ? ["sync", workspace] : ["init", workspace, "--yes"], workspace);
    if (result.error && result.error.code === "ENOENT")
      return report("unavailable", workspace, "codegraph executable missing; install it, then retry.");
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0 || !fs.existsSync(database)) {
      return report(
        "failed",
        workspace,
        "CodeGraph refresh failed or exceeded its 300-second budget; inspect diagnostics before retrying. Graph readiness unverified.",
      );
    }
    return report(initialized ? "refreshed" : "initialized", workspace, "Worktree-local refresh completed.");
  } finally {
    fs.rmdirSync(lock);
  }
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`codegraph_refresh: ${error.code || error.name}\n`);
  process.exitCode = report("failed", null, "Filesystem or process error; inspect permissions and retry only after resolving the cause.");
}
