/** Terminal-only watcher notification contracts using an isolated Unix PTY. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

/** Actual watcher and help predicate, without loading the user's installed profile. */
const PROFILE = readFileSync("software/scripts/bash-file-utils.profile.bash", "utf8");
/** Production help predicate required by the watcher. */
const HELP = readFileSync("software/bootstrap/profile-core.sh", "utf8").match(/^function is_help_arg\(\) \{[\s\S]*?^\}/m)[0];
/** Bounded PTY transport; teardown kills only its own child process group. */
const TERMINAL_DRIVER = String.raw`
import errno, os, pty, select, signal, sys, time
pid, terminal = pty.fork()
if pid == 0:
    os.execv("/bin/bash", ["bash", "--noprofile", "--norc", sys.argv[1], *sys.argv[2:]])
deadline = time.monotonic() + 8
try:
    while True:
        if time.monotonic() >= deadline:
            raise TimeoutError("watcher PTY exceeded 8 seconds")
        ready, _, _ = select.select([terminal], [], [], 0.1)
        if not ready:
            continue
        try:
            data = os.read(terminal, 65536)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            break
        if not data:
            break
        os.write(1, data)
    _, status = os.waitpid(pid, 0)
    pid = None
    sys.exit(os.waitstatus_to_exitcode(status))
finally:
    os.close(terminal)
    if pid is not None:
        os.killpg(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
`;

/**
 * Run real shell rendering with owned frames, title recorder, and bounded waits.
 * @param {object} [options] - Literal frame and terminal boundary controls.
 * @param {string[]} [options.frames] - Completed command output for each iteration.
 * @param {number} [options.sleepLimit=4] - Wait calls before the fixture returns 73.
 * @param {string} [options.interval="30"] - Requested whole-second interval.
 * @param {string} [options.outputMode="terminal"] - Terminal or pipe transport.
 * @param {string} [options.term="xterm-256color"] - Terminal capability name.
 * @param {string[]} [options.flags=[]] - Public watcher options.
 * @param {string} [options.titleSupport="available"] - Available or missing title helper.
 * @param {number} [options.compareStatus=0] - Nonzero comparison failure injection.
 * @returns {object} Process status, exact display bytes, titles, waits, and remaining caches.
 * @throws {Error} On fixture failures; always removes the owned sandbox.
 */
function runTerminal({ frames = ["old\n", "new\n", "new\n"], sleepLimit = 4, interval = "30", outputMode = "terminal", term = "xterm-256color", flags = [], titleSupport = "available", compareStatus = 0 } = {}) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "watch notice's "));
  try {
    const bin = path.join(folder, "bin");
    mkdirSync(bin);
    writeFileSync(path.join(folder, "titles"), "");
    writeFileSync(path.join(folder, "waits"), "");
    writeFileSync(path.join(folder, "count"), "0\n");
    writeFileSync(path.join(folder, "sleep_count"), "0\n");
    frames.forEach((frame, index) => writeFileSync(path.join(folder, `frame.${index + 1}`), frame));
    writeFileSync(path.join(bin, "clear"), "#!/bin/bash\nprintf '<clear>\\n'\n", { mode: 0o755 });
    writeFileSync(path.join(bin, "sleep"), `#!/bin/bash
printf '%s\n' "$1" >> "$WAITS"
IFS= read -r count < "$SLEEP_COUNT"
count=$((count + 1))
printf '%s\n' "$count" > "$SLEEP_COUNT"
[ "$count" -lt "$SLEEP_LIMIT" ] || exit 73
`, { mode: 0o755 });
    if (titleSupport === "available") {
      writeFileSync(path.join(bin, "set_terminal_title"), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$TITLES"\n', { mode: 0o755 });
    }
    if (compareStatus !== 0) {
      writeFileSync(path.join(bin, "cmp"), '#!/bin/bash\nexit "$COMPARE_STATUS"\n', { mode: 0o755 });
    }
    const runner = path.join(folder, "runner.bash");
    writeFileSync(runner, `${HELP}\n${PROFILE}\n
# Emit an owned completed frame; the wait boundary ends the loop without real sleeps.
function probe() {
  local _count
  IFS= read -r _count < "$COUNT"
  _count=$((_count + 1))
  printf '%s\n' "$_count" > "$COUNT"
  command cat "$FRAME_PREFIX.$_count"
}
watch_interval "$@" probe
`);
    const options = {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        BASH_ENV: "/dev/null",
        PATH: `${bin}:/usr/bin:/bin`,
        TERM: term,
        TMPDIR: folder,
        COUNT: path.join(folder, "count"),
        FRAME_PREFIX: path.join(folder, "frame"),
        TITLES: path.join(folder, "titles"),
        WAITS: path.join(folder, "waits"),
        SLEEP_COUNT: path.join(folder, "sleep_count"),
        SLEEP_LIMIT: String(sleepLimit),
        COMPARE_STATUS: String(compareStatus),
      },
    };
    // The driver receives argv literally; no command or fixture path enters shell syntax.
    const result = outputMode === "terminal"
      ? spawnSync("python3", ["-c", TERMINAL_DRIVER, runner, ...flags, interval], options)
      : spawnSync("/bin/bash", ["--noprofile", "--norc", runner, ...flags, interval], options);
    return { ...result, output: result.stdout.replace(/\r\n/g, "\n"), titles: readFileSync(path.join(folder, "titles"), "utf8"), waits: readFileSync(path.join(folder, "waits"), "utf8"), caches: readdirSync(folder).filter((name) => name.startsWith("watch_interval.")) };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("watcher terminal notifications", () => {
  it("uses plain status titles and renders the first frame without a bell", () => {
    const result = runTerminal({ frames: ["old\n"], sleepLimit: 1 });
    expect(result.status, result.stderr).toBe(73);
    expect(result.output).toBe("<clear>\nold\n");
    expect(result.titles).toBe("Refreshing\nWaiting\n");
    expect(result.waits).toBe("30\n");
    expect(result.caches).toEqual([]);
  });

  it("rings only on changes and counts the two-second Updated state inside the wait", () => {
    const result = runTerminal();
    expect(result.status, result.stderr).toBe(73);
    expect(result.output).toBe("<clear>\nold\n<clear>\nnew\n\x07");
    expect(result.titles).toBe("Refreshing\nWaiting\nRefreshing\nUpdated\nWaiting\nRefreshing\nWaiting\n");
    expect(result.waits).toBe("30\n2\n28\n30\n");
    expect(result.caches).toEqual([]);
  });

  it("does not redraw identical completed output", () => {
    const result = runTerminal({ frames: ["same\n", "same\n"], sleepLimit: 2 });
    expect(result.status, result.stderr).toBe(73);
    expect(result.output).toBe("<clear>\nsame\n");
    expect(result.titles).toBe("Refreshing\nWaiting\nRefreshing\nWaiting\n");
    expect(result.waits).toBe("30\n30\n");
  });

  it("never extends a one-second interval for the update indicator", () => {
    const result = runTerminal({ interval: "1", sleepLimit: 3 });
    expect(result.status, result.stderr).toBe(73);
    expect(result.waits).toBe("1\n1\n1\n");
    expect(result.titles).toBe("Refreshing\nWaiting\nRefreshing\nUpdated\nWaiting\nRefreshing\nWaiting\n");
  });

  it.each([
    [["a\n", "a\n\n", "a\n\n"], "<clear>\na\n<clear>\na\n\n\x07"],
    [["a\u0000", "b\u0000", "b\u0000"], "<clear>\na\u0000<clear>\nb\u0000\x07"],
    [["", "", ""], "<clear>\n"],
  ])("compares complete bytes for frames %j", (frames, output) => {
    const result = runTerminal({ frames, sleepLimit: 3 });
    expect(result.status, result.stderr).toBe(73);
    expect(result.output).toBe(output);
    expect(result.caches).toEqual([]);
  });

  it.each([
    ["pipe", "xterm-256color"],
    ["terminal", "dumb"],
  ])("avoids cosmetic notifications in %s output with TERM=%s", (outputMode, term) => {
    const result = runTerminal({ frames: ["old\n", "new\n"], sleepLimit: 2, outputMode, term });
    expect(result.status, result.stderr).toBe(73);
    expect(result.output).toBe("<clear>\nold\n<clear>\nnew\n");
    expect(result.titles).toBe("");
    expect(result.waits).toBe("30\n30\n");
  });

  it("leaves live mode free of title and bell notifications", () => {
    const result = runTerminal({ frames: ["old\n", "new\n"], sleepLimit: 2, flags: ["--no-cache"] });
    expect(result.status, result.stderr).toBe(73);
    expect(result.output).toBe("<clear>\nold\n<clear>\nnew\n");
    expect(result.titles).toBe("");
    expect(result.caches).toEqual([]);
  });

  it("still renders and rings when the optional title helper is absent", () => {
    const result = runTerminal({ titleSupport: "missing" });
    expect(result.status, result.stderr).toBe(73);
    expect(result.titles).toBe("");
    expect(result.output).toBe("<clear>\nold\n<clear>\nnew\n\x07");
    expect(result.waits).toBe("30\n2\n28\n30\n");
  });

  it("reports comparison failures without displaying or announcing an unverified change", () => {
    const result = runTerminal({ frames: ["old\n", "new\n"], sleepLimit: 2, compareStatus: 2 });
    expect(result.status, result.output + result.stderr).toBe(2);
    expect(result.output).toContain("cache comparison failed");
    expect(result.output).toContain("<clear>\nold\n");
    expect(result.output).not.toContain("new\n");
    expect(result.titles).toBe("Refreshing\nWaiting\nRefreshing\n");
    expect(result.caches).toEqual([]);
  });
});
