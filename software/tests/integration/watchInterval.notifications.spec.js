/** Terminal-only watcher notification contracts using an isolated Unix PTY. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

/** Actual watcher and help predicate, without loading the user's installed profile. */
const PROFILE = readFileSync("software/scripts/bash-file-utils.profile.bash", "utf8");
/** Production help predicate required by the watcher. */
const HELP = readFileSync("software/bootstrap/profile-core.sh", "utf8").match(/^function is_help_arg\(\) \{[\s\S]*?^\}/m)[0];
/** Actual clear alias, kept available when the executable is deliberately absent. */
const CLEAR_ALIAS = readFileSync("software/bootstrap/profile-advanced.sh", "utf8").match(/^alias clear=.*$/m)[0];
/** Native core tools for a PATH that deliberately contains no clear executable. */
const CORE_TOOLS = spawnSync("/bin/bash", ["-c", "type -P cat mktemp cmp tee tr rm"], { encoding: "utf8" }).stdout.trim().split("\n");
/** Resolve Python before the child fixture replaces PATH. */
const PYTHON = spawnSync("/bin/bash", ["-c", "type -P python3"], { encoding: "utf8" }).stdout.trim();
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
 * @param {string} [options.clearSupport="executable"] - Executable or alias-only clear support.
 * @param {string} [options.colorPolicy="plain"] - Plain frames or auto/off/no-color color-aware output.
 * @returns {object} Process status, exact display bytes, titles, waits, and remaining caches.
 * @throws {Error} On fixture failures; always removes the owned sandbox.
 */
function runTerminal({
  frames = ["old\n", "new\n", "new\n"],
  sleepLimit = 4,
  interval = "30",
  outputMode = "terminal",
  term = "xterm-256color",
  flags = [],
  titleSupport = "available",
  compareStatus = 0,
  clearSupport = "executable",
  colorPolicy = "plain",
} = {}) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "watch notice's "));
  try {
    const bin = path.join(folder, "bin");
    mkdirSync(bin);
    writeFileSync(path.join(folder, "titles"), "");
    writeFileSync(path.join(folder, "waits"), "");
    writeFileSync(path.join(folder, "count"), "0\n");
    writeFileSync(path.join(folder, "sleep_count"), "0\n");
    frames.forEach((frame, index) => writeFileSync(path.join(folder, `frame.${index + 1}`), frame));
    if (clearSupport === "executable") {
      writeFileSync(path.join(bin, "clear"), "#!/bin/bash\nprintf '<clear>\\n'\n", { mode: 0o755 });
    } else {
      CORE_TOOLS.forEach((binary) => symlinkSync(binary, path.join(bin, path.basename(binary))));
    }
    writeFileSync(
      path.join(bin, "sleep"),
      `#!/bin/bash
printf '%s\n' "$1" >> "$WAITS"
IFS= read -r count < "$SLEEP_COUNT"
count=$((count + 1))
printf '%s\n' "$count" > "$SLEEP_COUNT"
[ "$count" -lt "$SLEEP_LIMIT" ] || exit 73
`,
      { mode: 0o755 },
    );
    if (titleSupport === "available") {
      writeFileSync(path.join(bin, "set_terminal_title"), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$TITLES"\n', { mode: 0o755 });
    }
    if (compareStatus !== 0) {
      writeFileSync(path.join(bin, "cmp"), '#!/bin/bash\nexit "$COMPARE_STATUS"\n', { mode: 0o755 });
    }
    const runner = path.join(folder, "runner.bash");
    writeFileSync(
      runner,
      `${HELP}\nshopt -s expand_aliases\n${CLEAR_ALIAS}\n${PROFILE}\n
# Emit an owned completed frame; the wait boundary ends the loop without real sleeps.
function probe() {
  local _count
  IFS= read -r _count < "$COUNT"
  _count=$((_count + 1))
  printf '%s\n' "$_count" > "$COUNT"
  local _color=0
  if [ "$COLOR_POLICY" != plain ] && [ "\${FORCE_COLOR:-}" = 1 ] && [ -z "\${NO_COLOR:-}" ]; then
    _color=1
    printf '\\033[35m'
  fi
  command cat "$FRAME_PREFIX.$_count"
  if ((_color)); then printf '\\033[0m'; fi
}
eval 'f5 "$@" probe'
`,
    );
    const options = {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        BASH_ENV: "/dev/null",
        PATH: clearSupport === "executable" ? `${bin}:/usr/bin:/bin` : bin,
        TERM: term,
        TMPDIR: folder,
        COUNT: path.join(folder, "count"),
        FRAME_PREFIX: path.join(folder, "frame"),
        TITLES: path.join(folder, "titles"),
        WAITS: path.join(folder, "waits"),
        SLEEP_COUNT: path.join(folder, "sleep_count"),
        SLEEP_LIMIT: String(sleepLimit),
        COMPARE_STATUS: String(compareStatus),
        COLOR_POLICY: colorPolicy,
      },
    };
    delete options.env.FORCE_COLOR;
    delete options.env.NO_COLOR;
    if (colorPolicy === "off") options.env.FORCE_COLOR = "0";
    if (colorPolicy === "no-color") options.env.NO_COLOR = "1";
    // The driver receives argv literally; no command or fixture path enters shell syntax.
    const result =
      outputMode === "terminal"
        ? spawnSync(PYTHON, ["-c", TERMINAL_DRIVER, runner, ...flags, interval], options)
        : spawnSync("/bin/bash", ["--noprofile", "--norc", runner, ...flags, interval], options);
    return {
      ...result,
      output: result.stdout.replace(/\r\n/g, "\n"),
      titles: readFileSync(path.join(folder, "titles"), "utf8"),
      waits: readFileSync(path.join(folder, "waits"), "utf8"),
      caches: readdirSync(folder).filter((name) => name.startsWith("watch_interval.")),
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("watcher terminal notifications", () => {
  it.each([
    [[], "Refreshing\nWaiting\n"],
    [["--no-cache"], ""],
  ])("clears without an executable when only the clear alias exists with flags %j", (flags, titles) => {
    const result = runTerminal({ frames: ["old\n"], sleepLimit: 1, flags, clearSupport: "alias-only" });
    expect(result.status, result.output + result.stderr).toBe(73);
    expect(result.output).toBe("\x1b[H\x1b[2J\x1b[3Jold\n");
    expect(result.titles).toBe(titles);
    expect(result.caches).toEqual([]);
  });

  it.each([
    ["auto", "terminal", "xterm-256color", "<clear>\n\x1b[35mold\n\x1b[0m"],
    ["auto", "pipe", "xterm-256color", "<clear>\nold\n"],
    ["auto", "terminal", "dumb", "<clear>\nold\n"],
    ["off", "terminal", "xterm-256color", "<clear>\nold\n"],
    ["no-color", "terminal", "xterm-256color", "<clear>\nold\n"],
  ])("preserves color policy %s for %s output with TERM=%s", (colorPolicy, outputMode, term, output) => {
    const result = runTerminal({ frames: ["old\n"], sleepLimit: 1, colorPolicy, outputMode, term });
    expect(result.status, result.output + result.stderr).toBe(73);
    expect(result.output).toBe(output);
    expect(result.caches).toEqual([]);
  });

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

  it.each(["1", "01"])("never extends one-second interval %s for the update indicator", (interval) => {
    const result = runTerminal({ interval, sleepLimit: 3 });
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
