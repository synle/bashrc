/** Isolated repositories and native subprocess helpers for Git-default contract specs. */
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { execFileSync, spawnSync } from "child_process";
import { getIndexFunction } from "./setup.js";

/** Current test's private repository, never shared across files or cases. @type {string} */
export let folder;
/** Owned parent of the untouched template and disposable repository copies. @type {string} */
let rootFolder;
/** Wrapper section includes the production function and its shell aliases. */
const WRAPPER = fs
  .readFileSync(process.env.GIT_WRAPPER_PROFILE || "software/bootstrap/profile-advanced.sh", "utf8")
  .split("# --- Aliases: Git ---\n")[1]
  .split("# --- Aliases: Editors ---")[0];

/** Native pager integration needs Delta and Python's Unix PTY support. @type {boolean} */
export const HAS_DELTA_PTY =
  process.platform !== "win32" && spawnSync("delta", ["--version"]).status === 0 && spawnSync("python3", ["--version"]).status === 0;
/** Capture terminal output without an interactive pager or terminal color query. */
const PAGER_PTY = `
import errno, os, pty, sys
pid, master = pty.fork()
if pid == 0:
    os.execvp("git", ["git", "-c", "core.pager=delta", "-c", "delta.detect-dark-light=never", *sys.argv[1:]])
try:
    while True:
        try:
            data = os.read(master, 65536)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            break
        if not data:
            break
        os.write(1, data)
finally:
    os.close(master)
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
`;

/**
 * Execute native Git inside the current private fixture.
 * @param {...string} args - Literal Git arguments.
 * @returns {string} Trimmed stdout; throws on timeout or a nonzero exit.
 */
export function git(...args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, GIT_CONFIG_GLOBAL: path.join(folder, ".git/test.config"), GIT_CONFIG_NOSYSTEM: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Execute the production Git wrapper inside the current private fixture.
 * @param {...string} args - Literal wrapper arguments.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and captured output, including failures.
 */
export function shell(...args) {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", WRAPPER + '\ngit "$@"', "test", ...args], {
    cwd: folder,
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, BASH_ENV: "/dev/null", GIT_CONFIG_GLOBAL: path.join(folder, ".git/test.config"), GIT_CONFIG_NOSYSTEM: "1" },
  });
}

// 2026-10-27: private template copies cut the 57-case split run from 19.90s to 14.42-14.74s.
// Prepare once per isolated file; never expose the template to a test's mutations.
beforeAll(async () => {
  rootFolder = fs.mkdtempSync(path.join(os.tmpdir(), "git-defaults-"));
  folder = path.join(rootFolder, "template");
  fs.mkdirSync(folder);
  git("init", "-q");
  const sandbox = {
    REPO_OWNER: "acme",
    readText: async () => fs.readFileSync("software/scripts/git.gitconfig", "utf8"),
    appendTextBlock: getIndexFunction("appendTextBlock"),
    log: (...args) => {
      throw new Error(args.join(" "));
    },
  };
  vm.runInNewContext(fs.readFileSync(process.env.GIT_CONFIG_SCRIPT || "software/scripts/git.js", "utf8"), sandbox);
  const config = await sandbox._getGitConfig({ email: "email = dev@example.invalid" });
  fs.writeFileSync(path.join(folder, ".git/test.config"), config);
  git("config", "core.fsmonitor", "false");
  git("config", "core.hooksPath", ".git/hooks");
  git("config", "commit.gpgsign", "false");
  git("config", "maintenance.auto", "false");
  fs.writeFileSync(path.join(folder, "note.txt"), "old line\n");
  fs.writeFileSync(path.join(folder, ".gitignore"), "ignored.txt\n");
  git("add", "note.txt", ".gitignore");
  git("commit", "-qm", "Base");
});

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(rootFolder, "case-"));
  // Copy files rather than hardlinking: mutations, hooks, and Git objects stay test-owned.
  fs.cpSync(path.join(rootFolder, "template"), folder, { recursive: true });
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

afterAll(() => {
  if (rootFolder) fs.rmSync(rootFolder, { recursive: true, force: true });
});

/**
 * Render an alias through the real Delta pager attached to a private pseudo-terminal.
 * @param {string} alias - Git command or generated alias to render with patch output.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and captured terminal output.
 */
export function runPager(alias) {
  const env = {
    ...process.env,
    BASH_ENV: "/dev/null",
    TERM: "xterm-256color",
    DELTA_PAGER: "cat",
    GIT_CONFIG_GLOBAL: path.join(folder, ".git/test.config"),
    GIT_CONFIG_NOSYSTEM: "1",
  };
  delete env.GIT_PAGER;
  return spawnSync("python3", ["-c", PAGER_PTY, alias, "-p"], { cwd: folder, env, encoding: "utf8", timeout: 5000 });
}
