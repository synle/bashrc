/** Real controlling-terminal contracts for worktree navigation and cleanup confirmation. */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Production shell entry points without unrelated profile startup. */
const NAVIGATION = fs
  .readFileSync("software/scripts/bash-git-helpers.profile.bash", "utf8")
  .split("# worktree_cd: change to a worktree matching branch and optional repository keywords.")[1]
  .split("# --- Git Patch Transfer ---")[0];
/** Production cleanup executable. */
const CLEANER = path.resolve("software/scripts/git.worktree_clean.cjs");
/** Bounded PTY driver; replies only after each actual prompt and reaps only its own child. */
const DRIVER = String.raw`
import errno, json, os, pty, select, signal, sys, time
replies = json.loads(os.environ['TTY_REPLIES'])
marker = os.environ['TTY_MARKER'].encode()
pid, terminal = pty.fork()
if pid == 0:
    os.execv('/bin/bash', ['bash', '--noprofile', '--norc', '-O', 'expand_aliases', '-c', sys.argv[1]])
output = b''
sent = 0
deadline = time.monotonic() + 8
try:
    while True:
        if time.monotonic() >= deadline:
            raise TimeoutError('worktree terminal exceeded 8 seconds')
        if not select.select([terminal], [], [], 0.1)[0]:
            continue
        try:
            data = os.read(terminal, 65536)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            break
        if not data:
            break
        output += data
        if sent < len(replies) and output.count(marker) > sent:
            os.write(terminal, bytes.fromhex(replies[sent]))
            sent += 1
    _, status = os.waitpid(pid, 0)
    pid = None
    print(json.dumps({'status': os.waitstatus_to_exitcode(status), 'output': output.decode(errors='replace')}))
finally:
    os.close(terminal)
    if pid is not None:
        os.killpg(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
`;

/**
 * Run a literal shell script with replies delivered only to the controlling terminal.
 * @param {string} root Private fixture folder.
 * @param {string} script Caller shell code.
 * @param {string[]} replies Response lines in prompt order.
 * @param {string} marker Prompt marker.
 * @returns {{status: number, output: string}} Child status and normalized terminal output.
 */
function terminal(root, script, replies, marker) {
  const result = spawnSync("/usr/bin/python3", ["-c", DRIVER, script], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      BASH_ENV: os.devNull,
      HOME: root,
      NODE: process.execPath,
      CLEANER,
      PATH: `${root}/bin:${path.dirname(process.execPath)}:/usr/bin:/bin`,
      TERM: "dumb",
      NO_COLOR: "1",
      NODE_OPTIONS: "",
      TTY_REPLIES: JSON.stringify(replies.map((reply) => Buffer.from(reply).toString("hex"))),
      TTY_MARKER: marker,
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_NOSYSTEM: "1",
    },
  });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout.replaceAll("\\r\\n", "\\n"));
}

/**
 * Exercise the real shell function with a real numbered-choice terminal.
 * @param {string[]} replies Selection lines.
 * @param {number} [count] Matching inventory size.
 * @returns {{status: number, output: string}} Captured shell outcome with normalized paths.
 */
function navigate(replies, count = 2) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-prompt-")));
  try {
    fs.mkdirSync(path.join(root, "bin"));
    const inventory = Array.from({ length: count }, (_, index) => {
      const folder = path.join(root, `tree-${index + 1}`);
      fs.mkdirSync(folder);
      return { branch_name: `feature/task-${index + 1}`, repo: "widget-store", org: "acme", worktree_path: folder, root_path: root };
    });
    fs.writeFileSync(path.join(root, "inventory.json"), JSON.stringify(inventory));
    fs.writeFileSync(path.join(root, "navigation.bash"), NAVIGATION);
    fs.writeFileSync(
      path.join(root, "bin", "worktree_list"),
      `#!${process.execPath}\nprocess.stdout.write(require('fs').readFileSync('inventory.json'));\n`,
      { mode: 0o755 },
    );
    const result = terminal(
      root,
      `
function is_help_arg() { [ "\${1:-}" = --help ]; }
function safe_source() { /bin/bash -n "$1" && builtin source "$1"; }
function print_action_summary() { printf 'SUMMARY:%s\\n' "$1"; }
safe_source ./navigation.bash || exit $?
worktree_navigate task
status=$?
printf 'RESULT:%s\\n' "$PWD"
exit "$status"
`,
      replies,
      "Choose 1-",
    );
    return { status: result.status, output: result.output.replaceAll(root, "<root>") };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("worktree terminal prompts", () => {
  it("changes the caller's folder after selecting a numbered match", () => {
    const result = navigate(["2\n"]);
    expect(result.status).toBe(0);
    expect(result.output).toContain("SUMMARY:<root>/tree-2\nRESULT:<root>/tree-2\n");
  });

  it("accepts choice ten and never displays an eleventh choice", () => {
    const result = navigate(["10\n"], 12);
    expect(result.status).toBe(0);
    expect(result.output).toContain("RESULT:<root>/tree-10\n");
    expect(result.output).not.toContain("11)");
  });

  it("rejects out-of-range and nonnumeric input before accepting a valid choice", () => {
    const result = navigate(["11\n", "bad\n", "1\n"]);
    expect(result.status).toBe(0);
    expect(result.output.match(/invalid choice/g)).toHaveLength(2);
    expect(result.output).toContain("RESULT:<root>/tree-1\n");
  });

  it("cancels with n without a summary or folder change", () => {
    const result = navigate(["n\n"]);
    expect(result.status).toBe(0);
    expect(result.output).not.toContain("SUMMARY:");
    expect(result.output).toContain("RESULT:<root>\n");
  });

  it("reads cleanup all/y/N from a real terminal and preserves declined worktrees", () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-clean-prompt-")));
    try {
      fs.mkdirSync(path.join(root, "bin"));
      fs.writeFileSync(path.join(root, "bin", "gh"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
      const git = (...args) =>
        execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", `core.hooksPath=${os.devNull}`, ...args], {
          cwd: root,
          stdio: "ignore",
          timeout: 10000,
          env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" },
        });
      git("init", "--quiet", "--initial-branch=main", "repo");
      git("-C", "repo", "commit", "--quiet", "--allow-empty", "-m", "initial");
      git("-C", "repo", "worktree", "add", "--quiet", "-b", "first", path.join(root, "a-first"));
      git("-C", "repo", "worktree", "add", "--quiet", "-b", "second", path.join(root, "b-second"));
      fs.writeFileSync(path.join(root, "a-first", "local.txt"), "first pending\n");
      fs.writeFileSync(path.join(root, "b-second", "local.txt"), "second pending\n");
      const result = terminal(root, '"$NODE" "$CLEANER" --mode interactive', ["N\n", "y\n"], "[all/y/N]: ");
      expect(result.status).toBe(0);
      expect(result.output).toContain("pending worktree 1 of 2");
      expect(result.output).toContain("pending worktree 2 of 2");
      expect(fs.existsSync(path.join(root, "a-first"))).toBe(true);
      expect(fs.existsSync(path.join(root, "b-second"))).toBe(false);
      expect(fs.existsSync(path.join(root, "repo"))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
