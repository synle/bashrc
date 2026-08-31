/**
 * Runs the standalone `set_terminal_title` command (installed to
 * ~/.local/bin, source software/scripts/set_terminal_title.cli.bash) for real
 * and asserts its three routes.
 *
 * The whole reason this command exists is that a raw OSC `printf` cannot set
 * the title from an agent's tool shell: under a TUI harness that shell's stdout
 * is a captured pipe with no tty, so the escape is swallowed. This spec pins the
 * behaviors that route around that — the deterministic usage + no-op-safety
 * paths always, and the tmux self-rename path when tmux is present:
 *
 *   - Usage: no args (or -h/--help) prints usage and exits non-zero.
 *   - No-op safety: given a title but no terminal and no owning tmux window, it
 *     exits 0 and writes nothing. A cosmetic title must never fail the caller.
 *   - Self-rename precision (tmux only): it renames ONLY its own window,
 *     resolved by process ancestry, and never a sibling window — the property
 *     that lets parallel agents in sibling panes coexist without retitling each
 *     other. This is the bug the naive `tmux display-message` "current window"
 *     approach would ship.
 */
import { describe, it, expect } from "vitest";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PAYLOAD = path.join(ROOT_DIR, "software/scripts/set_terminal_title.cli.bash");

/** @type {boolean} Whether a usable tmux binary is on PATH for the self-rename test. */
const HAS_TMUX = spawnSync("bash", ["-c", "command -v tmux"], { encoding: "utf-8" }).status === 0;

/**
 * Runs the payload through bash with stdio fully piped, so the child never sees
 * a controlling terminal — exactly the condition an agent tool shell runs in.
 * @param {string[]} args - Arguments passed to set_terminal_title.
 * @returns {{status: number, stdout: string, stderr: string}} Captured result.
 */
function runTitle(args) {
  const result = spawnSync("bash", [PAYLOAD, ...args], { encoding: "utf-8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("set_terminal_title", () => {
  it("prints usage and exits non-zero when given no arguments", () => {
    const result = runTitle([]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("set_terminal_title:");
    expect(result.stdout).toContain("Usage: set_terminal_title <title...>");
  });

  it("prints usage for -h and --help", () => {
    for (const flag of ["-h", "--help"]) {
      const result = runTitle([flag]);
      expect(result.status, `flag ${flag}`).toBe(1);
      expect(result.stdout, `flag ${flag}`).toContain("set_terminal_title:");
    }
  });

  it("no-ops (exit 0, no output) when there is no terminal and no owning tmux window", () => {
    // spawnSync gives the child piped stdio, so /dev/tty is unavailable and the
    // test process is not a tmux pane descendant — the route-3 fall-through.
    const result = runTitle(["🔨 Working — no terminal here"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it.skipIf(!HAS_TMUX)("caps the title at 40 chars, marking the cut with a single ellipsis", () => {
    // The truncation runs before any route, so the tmux self-rename path exposes
    // exactly what would reach a terminal tab. A 60-char title must land as 39
    // chars plus the ellipsis = 40 chars total.
    const socketDir = spawnSync("mktemp", ["-d"], { encoding: "utf-8" }).stdout.trim();
    const session = "stt_cap_spec";
    const env = { ...process.env, TMUX_TMPDIR: socketDir };

    /**
     * Runs a shell snippet against the private tmux server.
     * @param {string} snippet - Bash to execute.
     * @returns {{status: number, stdout: string, stderr: string}} Captured result.
     */
    const sh = (snippet) => spawnSync("bash", ["-c", snippet], { env, encoding: "utf-8" });

    try {
      sh(`tmux -f /dev/null new-session -d -s ${session} -n TARGET -x 80 -y 24`);
      sh(`tmux set-option -g automatic-rename off`);
      const targetId = sh(`tmux list-windows -t ${session} -F '#{window_id} #{window_name}' | awk '$2=="TARGET"{print $1}'`).stdout.trim();

      const longTitle = "x".repeat(60);
      sh(
        `tmux send-keys -t ${targetId} ` +
          `"export TMUX_TMPDIR='${socketDir}'; bash '${PAYLOAD}' '${longTitle}'; tmux wait-for -S ${session}_done" Enter`,
      );
      sh(`tmux wait-for ${session}_done`);

      const target = sh(`tmux display-message -p -t ${targetId} '#{window_name}'`).stdout.trim();
      expect([...target]).toHaveLength(40);
      expect(target).toBe("x".repeat(39) + "…");
    } finally {
      sh(`tmux kill-server`);
      spawnSync("rm", ["-rf", socketDir]);
    }
  });

  it.skipIf(!HAS_TMUX)("renames only its own tmux window, never a sibling", () => {
    // A private tmux server the test fully owns, so it never sees, touches, or
    // is influenced by a real session — critical on a dev box already running
    // agents on the default socket. TMUX_TMPDIR relocates tmux's default socket
    // (the one the payload's bare `tmux` uses), and `-f /dev/null` skips the
    // user's ~/.tmux.conf so `automatic-rename` cannot clobber the sibling name
    // out from under the assertion. The pane exports the same TMUX_TMPDIR so the
    // payload inside it resolves to this same private server.
    const socketDir = spawnSync("mktemp", ["-d"], { encoding: "utf-8" }).stdout.trim();
    const session = "stt_spec";
    const env = { ...process.env, TMUX_TMPDIR: socketDir };

    /**
     * Runs a shell snippet against the private tmux server.
     * @param {string} snippet - Bash to execute.
     * @returns {{status: number, stdout: string, stderr: string}} Captured result.
     */
    const sh = (snippet) => spawnSync("bash", ["-c", snippet], { env, encoding: "utf-8" });

    /**
     * Resolves a window's stable id from its (original) name.
     * @param {string} name - Window name to look up.
     * @returns {string} The `#{window_id}` (e.g. "@3").
     */
    const windowId = (name) =>
      sh(`tmux list-windows -t ${session} -F '#{window_id} #{window_name}' | awk -v n=${name} '$2==n{print $1}'`).stdout.trim();

    try {
      // Two windows: TARGET (where the command runs) and SIBLING (must be left
      // alone). The command runs as a child of TARGET's pane shell, so TARGET's
      // pane process is one of its ancestors and SIBLING's is not. Ids are
      // captured up front because TARGET's name changes out from under us.
      sh(`tmux -f /dev/null new-session -d -s ${session} -n TARGET -x 80 -y 24`);
      sh(`tmux set-option -g automatic-rename off`);
      sh(`tmux new-window -t ${session} -n SIBLING`);
      const targetId = windowId("TARGET");
      const siblingId = windowId("SIBLING");

      // wait-for gives a deterministic rendezvous — no sleep, no polling.
      sh(
        `tmux send-keys -t ${targetId} ` +
          `"export TMUX_TMPDIR='${socketDir}'; bash '${PAYLOAD}' 'RENAMED_BY_SPEC'; tmux wait-for -S ${session}_done" Enter`,
      );
      sh(`tmux wait-for ${session}_done`);

      const target = sh(`tmux display-message -p -t ${targetId} '#{window_name}'`).stdout.trim();
      const sibling = sh(`tmux display-message -p -t ${siblingId} '#{window_name}'`).stdout.trim();

      expect(target).toBe("RENAMED_BY_SPEC");
      expect(sibling).toBe("SIBLING");
    } finally {
      sh(`tmux kill-server`);
      spawnSync("rm", ["-rf", socketDir]);
    }
  });
});
