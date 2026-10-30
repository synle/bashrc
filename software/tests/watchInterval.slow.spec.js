/** Bounded subprocess contracts for interval-based cached and live rendering. */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing the actual shipped shell sources. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Full utility partial, loaded as a real shell profile. */
const PROFILE = readFileSync(path.join(ROOT, "software/scripts/bash-file-utils.profile.bash"), "utf8");
/** Actual help predicate without bootstrap side effects. */
const HELP = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8").match(
  /^function is_help_arg\(\) \{[\s\S]*?^\}/m,
)[0];
/** Actual convenience alias, isolated from the network-facing PR implementation. */
const PR_LIST_ALIAS = readFileSync(path.join(ROOT, "software/scripts/bash-git-helpers.profile.bash"), "utf8").match(
  /^alias pr_list=.*$/m,
)[0];
/** Native temporary-file creator used behind the recording executable. */
const MKTEMP = execFileSync("/bin/bash", ["-c", "type -P mktemp"], { encoding: "utf8" }).trim();

/**
 * Run the shipped watcher with deterministic rendering and wait boundaries.
 * @param {string[]} args - Literal user arguments, passed without interpolation.
 * @param {object} [options] - Command, cycle, signal, and filesystem fault controls.
 * @param {number} [options.cycles=2] - Completed iterations before sleep returns 73.
 * @param {number} [options.commandStatus=0] - Probe command exit status.
 * @param {number} [options.mktempStatus=0] - Cache creation boundary exit status.
 * @param {number} [options.mktempFailureAt=1] - Cache creation attempt that can fail.
 * @param {number} [options.clearStatus=0] - Terminal clear boundary exit status.
 * @param {string} [options.signal=""] - Signal sent to the watcher during sleep.
 * @param {string} [options.invocation] - Fixed shell invocation for exercising alias expansion.
 * @returns {object} Exit status, display bytes, intermediate display observations, and cache effects.
 * @throws {Error} On fixture errors; removes only the owned sandbox in all cases.
 */
function runWatcher(
  args,
  {
    cycles = 2,
    commandStatus = 0,
    mktempStatus = 0,
    mktempFailureAt = 1,
    clearStatus = 0,
    signal = "",
    invocation = 'watch_interval "$@"',
  } = {},
) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "watch-interval-' space-\u2603-"));
  try {
    const bin = path.join(sandbox, "bin");
    mkdirSync(bin);
    writeFileSync(path.join(sandbox, "screen"), "old screen\n");
    writeFileSync(path.join(sandbox, "count"), "0\n");
    writeFileSync(path.join(sandbox, "cache_attempts"), "0\n");
    writeFileSync(path.join(sandbox, "events"), "");
    writeFileSync(path.join(sandbox, "observations"), "");
    writeFileSync(
      path.join(bin, "mktemp"),
      `#!/bin/bash
printf 'mktemp\n' >> "$EVENTS"
IFS= read -r attempt < "$CACHE_ATTEMPTS"
attempt=$((attempt + 1))
printf '%s\n' "$attempt" > "$CACHE_ATTEMPTS"
if [ "$attempt" -eq "$MKTEMP_FAILURE_AT" ] && [ "$MKTEMP_STATUS" -ne 0 ]; then
  printf 'cache creation failed\n' >&2
  exit "$MKTEMP_STATUS"
fi
exec "$REAL_MKTEMP" "$@"
`,
      { mode: 0o755 },
    );
    writeFileSync(
      path.join(bin, "clear"),
      `#!/bin/bash
printf 'clear\n' >> "$EVENTS"
[ "$CLEAR_STATUS" -eq 0 ] || { printf 'clear failed\n' >&2; exit "$CLEAR_STATUS"; }
printf '<clear>\n'
`,
      { mode: 0o755 },
    );
    writeFileSync(
      path.join(bin, "sleep"),
      `#!/bin/bash
printf 'sleep:%s\n' "$1" >> "$EVENTS"
if [ -n "$STOP_SIGNAL" ]; then kill -s "$STOP_SIGNAL" "$PPID"; exit 0; fi
IFS= read -r iteration < "$COUNT"
[ "$iteration" -lt "$CYCLES" ] || exit 73
`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `
${HELP}
${PROFILE}
# Probe observes the displayed bytes after emitting partial command output.
function probe() {
  local _iteration
  IFS= read -r _iteration < "$COUNT"
  _iteration=$((_iteration + 1))
  printf '%s\n' "$_iteration" > "$COUNT"
  printf 'out:%s\n' "$_iteration"
  printf 'err:%s\n' "$_iteration" >&2
  printf '<during:%s>\n' "$_iteration" >> "$OBSERVATIONS"
  command cat "$SCREEN" >> "$OBSERVATIONS"
  return "$COMMAND_STATUS"
}
# Replace only the network-facing leaf while retaining the actual pr_list alias.
function pr_list_my_open() { probe; }
${PR_LIST_ALIAS}
trap ':' INT TERM
_before_traps=$(trap -p INT TERM)
_interval_seconds=parent
eval "$INVOCATION" >> "$SCREEN"
_status=$?
[ "$_before_traps" = "$(trap -p INT TERM)" ] || exit 91
[ "$_interval_seconds" = parent ] || exit 92
command cat "$SCREEN"
exit "$_status"
`,
        "test",
        ...args,
      ],
      {
        cwd: sandbox,
        env: {
          ...process.env,
          BASH_ENV: "/dev/null",
          PATH: `${bin}:/usr/bin:/bin`,
          TMPDIR: sandbox,
          REAL_MKTEMP: MKTEMP,
          EVENTS: path.join(sandbox, "events"),
          SCREEN: path.join(sandbox, "screen"),
          OBSERVATIONS: path.join(sandbox, "observations"),
          COUNT: path.join(sandbox, "count"),
          CYCLES: String(cycles),
          COMMAND_STATUS: String(commandStatus),
          MKTEMP_STATUS: String(mktempStatus),
          MKTEMP_FAILURE_AT: String(mktempFailureAt),
          CACHE_ATTEMPTS: path.join(sandbox, "cache_attempts"),
          CLEAR_STATUS: String(clearStatus),
          STOP_SIGNAL: signal,
          INVOCATION: invocation,
        },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    return {
      ...result,
      events: readFileSync(path.join(sandbox, "events"), "utf8"),
      observations: readFileSync(path.join(sandbox, "observations"), "utf8"),
      cacheFiles: readdirSync(sandbox).filter((name) => name.startsWith("watch_interval.")),
    };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("interval watcher subprocess", () => {
  it("streams the first frame and keeps it visible until the next cached capture finishes", () => {
    const result = runWatcher(["probe"]);
    expect(result.status, result.stderr).toBe(73);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("old screen\n<clear>\nout:1\nerr:1\n<clear>\nout:2\nerr:2\n");
    expect(result.observations.split("<during:2>\n")[1]).toBe("old screen\n<clear>\nout:1\nerr:1\n");
    expect(result.events).toBe("mktemp\nmktemp\nclear\nsleep:30\nclear\nsleep:30\n");
    expect(result.cacheFiles).toEqual([]);
  });
  it.each([
    ["f5", "60"],
    ["f5_120", "120"],
  ])("runs %s pr_list at its fixed interval", (alias, interval) => {
    const result = runWatcher(["pr_list"], { cycles: 1, invocation: `${alias} "$@"` });
    expect(result.status, result.stderr).toBe(73);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("old screen\n<clear>\nout:1\nerr:1\n");
    expect(result.events).toBe(`mktemp\nmktemp\nclear\nsleep:${interval}\n`);
    expect(result.cacheFiles).toEqual([]);
  });
  it.each(["1", "5", "86400"])("uses explicit interval %s without waiting before the first run", (interval) => {
    const result = runWatcher([interval, "probe"], { cycles: 1 });
    expect(result.status, result.stderr).toBe(73);
    expect(result.events).toBe(`mktemp\nmktemp\nclear\nsleep:${interval}\n`);
    expect(result.stdout).toContain("<clear>\nout:1\nerr:1\n");
  });

  it("clears first and streams live without creating any cache when opted out", () => {
    const result = runWatcher(["--no-cache", "5", "probe"], { mktempStatus: 65 });
    expect(result.status, result.stderr).toBe(73);
    expect(result.stdout).toBe("old screen\n<clear>\nout:1\n<clear>\nout:2\n");
    expect(result.stderr).toBe("err:1\nerr:2\n");
    expect(result.observations).toBe("<during:1>\nold screen\n<clear>\nout:1\n<during:2>\nold screen\n<clear>\nout:1\n<clear>\nout:2\n");
    expect(result.events).toBe("clear\nsleep:5\nclear\nsleep:5\n");
    expect(result.cacheFiles).toEqual([]);
  });

  it("defaults to thirty seconds in live mode too", () => {
    const result = runWatcher(["--no-cache", "probe"], { cycles: 1 });
    expect(result.status).toBe(73);
    expect(result.events).toBe("clear\nsleep:30\n");
  });

  it.each([
    [],
    ["--no-cache"],
    ["5"],
    [""],
    ["0", "probe"],
    ["86401", "probe"],
    ["999999999999999999999", "probe"],
    ["-1", "probe"],
    ["0.5", "probe"],
    ["--unknown", "probe"],
    ["5", "probe", "extra"],
  ])("rejects invalid input %j without changing the display or creating a cache", (...args) => {
    const result = runWatcher(args);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("old screen\n");
    expect(result.stderr).toContain("watch_interval:");
    expect(result.events).toBe("");
    expect(result.cacheFiles).toEqual([]);
  });

  it("prints inline help without running commands or creating a cache", () => {
    const result = runWatcher(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: watch_interval [--no-cache] [interval_seconds] <command>");
    expect(result.stderr).toBe("");
    expect(result.events).toBe("");
  });

  it.each([[], ["--no-cache"]])("continues after failed commands in mode %j", (...flags) => {
    const result = runWatcher([...flags, "probe"], { commandStatus: 7 });
    expect(result.status).toBe(73);
    expect(result.stdout).toContain("out:2\n");
    expect(result.stdout + result.stderr).toContain("err:2\n");
    expect(result.cacheFiles).toEqual([]);
  });

  it("runs quoted shell expressions without corrupting quotes or Unicode", () => {
    const result = runWatcher(["probe; printf '%s\\n' \"space 'quote' \\ slash \u2603\" | command cat"], { cycles: 1 });
    expect(result.status, result.stderr).toBe(73);
    expect(result.stdout, JSON.stringify({ stderr: result.stderr, events: result.events, observations: result.observations })).toContain(
      "space 'quote' \\ slash \u2603\n",
    );
  });

  it("replaces stale cached bytes with genuinely empty output", () => {
    const result = runWatcher(["probe >/dev/null 2>&1"], { cycles: 1 });
    expect(result.status).toBe(73);
    expect(result.stdout).toBe("old screen\n<clear>\n");
    expect(result.cacheFiles).toEqual([]);
  });

  it("leaves the display intact when cache creation fails", () => {
    const result = runWatcher(["probe"], { mktempStatus: 65 });
    expect(result.status).toBe(65);
    expect(result.stdout).toBe("old screen\n");
    expect(result.stderr).toContain("cache creation failed");
    expect(result.events).toBe("mktemp\n");
    expect(result.cacheFiles).toEqual([]);
  });

  it("removes the first cache if creating the second cache fails", () => {
    const result = runWatcher(["probe"], { mktempStatus: 65, mktempFailureAt: 2 });
    expect(result.status).toBe(65);
    expect(result.stdout).toBe("old screen\n");
    expect(result.stderr).toContain("cache creation failed");
    expect(result.events).toBe("mktemp\nmktemp\n");
    expect(result.cacheFiles).toEqual([]);
  });

  it("cleans the cache if terminal clearing fails", () => {
    const result = runWatcher(["probe"], { clearStatus: 66 });
    expect(result.status).toBe(66);
    expect(result.stdout).toBe("old screen\n");
    expect(result.stderr).toContain("clear failed");
    expect(result.cacheFiles).toEqual([]);
  });

  it.each([
    ["INT", 130],
    ["TERM", 143],
  ])("cleans the cache on %s without replacing caller traps", (signal, status) => {
    const result = runWatcher(["probe"], { signal });
    expect(result.status, result.stderr).toBe(status);
    expect(result.stdout).toContain("<clear>\nout:1\nerr:1\n");
    expect(result.events).toBe("mktemp\nmktemp\nclear\nsleep:30\n");
    expect(result.cacheFiles).toEqual([]);
  });
});
