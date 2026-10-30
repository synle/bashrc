/** First cached-frame streaming through a bounded, acknowledgement-driven Unix PTY. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

/** Production watcher source, without the user's installed shell profile. */
const PROFILE = readFileSync("software/scripts/bash-file-utils.profile.bash", "utf8");
/** Production help predicate required by the watcher. */
const HELP = readFileSync("software/bootstrap/profile-core.sh", "utf8").match(/^function is_help_arg\(\) \{[\s\S]*?^\}/m)[0];
/** Native utilities allowed in the isolated PATH, excluding tee and rm for boundary tests. */
const CORE_TOOLS = spawnSync("/bin/bash", ["-c", "type -P cat mktemp cmp tr"], { encoding: "utf8" }).stdout.trim().split("\n");
/** Native cleanup executable used after injecting a second terminal signal. */
const RM = spawnSync("/bin/bash", ["-c", "type -P rm"], { encoding: "utf8" }).stdout.trim();
/** Python executable resolved before the fixture replaces PATH. */
const PYTHON = spawnSync("/bin/bash", ["-c", "type -P python3"], { encoding: "utf8" }).stdout.trim();
/** Native capture utility used rather than mocking byte copying. */
const TEE = spawnSync("/bin/bash", ["-c", "type -P tee"], { encoding: "utf8" }).stdout.trim();
/** Release the producer only after its first chunk reaches the real terminal. */
const DRIVER = String.raw`
import errno, os, pty, select, signal, sys, time, tty
pid, terminal = pty.fork()
if pid == 0:
    tty.setraw(0)
    os.execv("/bin/bash", ["bash", "--noprofile", "--norc", sys.argv[1]])
output = b""
released = False
deadline = time.monotonic() + 8
try:
    while True:
        if time.monotonic() >= deadline:
            raise AssertionError("first chunk was not visible while the command waited for release")
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
        output += data
        os.write(1, data)
        if not released and b"FIRST\n" in output:
            released = True
            if os.environ["COMMAND_MODE"] == "interrupt":
                os.killpg(pid, signal.SIGINT)
            elif os.environ["COMMAND_MODE"] == "handshake":
                os.write(terminal, b"continue\n")
    _, status = os.waitpid(pid, 0)
    pid = None
    result = os.waitstatus_to_exitcode(status)
    sys.exit(128 - result if result < 0 else result)
finally:
    os.close(terminal)
    if pid is not None:
        os.killpg(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
`;

/**
 * Run first-frame rendering with real tee and an owned command handshake.
 * @param {object} [options] - Command, pipeline, and tee boundary controls.
 * @param {string} [options.commandMode="handshake"] - Handshake, plain, or interrupt producer.
 * @param {number} [options.commandStatus=0] - Producer return status after its final chunk.
 * @param {string} [options.pipefail="on"] - Whether the caller enables pipefail.
 * @param {string} [options.teeSupport="native"] - Native or missing executable.
 * @param {number} [options.teeStatus=0] - Nonzero tee failure injection.
 * @param {string} [options.cleanupSignal=""] - INT or TERM sent to the owned cleanup process and watcher during cleanup.
 * @returns {object} Process status, displayed bytes, captured baseline, titles, and retained caches.
 * @throws {Error} On fixture failure; always removes the owned sandbox.
 */
function runStream({ commandMode = "handshake", commandStatus = 0, pipefail = "on", teeSupport = "native", teeStatus = 0, cleanupSignal = "" } = {}) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "watch stream's "));
  try {
    const bin = path.join(folder, "bin");
    mkdirSync(bin);
    CORE_TOOLS.forEach((binary) => symlinkSync(binary, path.join(bin, path.basename(binary))));
    if (cleanupSignal) {
      writeFileSync(
        path.join(bin, "rm"),
        '#!/bin/bash\nprintf "cleanup:%s\\n" "$CLEANUP_SIGNAL"\nkill -s "$CLEANUP_SIGNAL" "$PPID" "$$"\nexec "$REAL_RM" "$@"\n',
        { mode: 0o755 },
      );
    } else {
      symlinkSync(RM, path.join(bin, "rm"));
    }
    if (teeStatus !== 0) {
      writeFileSync(path.join(bin, "tee"), '#!/bin/bash\nprintf "tee fixture failed\\n" >&2\nexit "$TEE_STATUS"\n', { mode: 0o755 });
    } else if (teeSupport === "native") {
      symlinkSync(TEE, path.join(bin, "tee"));
    }
    writeFileSync(path.join(folder, "snapshot"), "");
    writeFileSync(path.join(folder, "titles"), "");
    writeFileSync(path.join(bin, "clear"), "#!/bin/bash\nprintf '<clear>\\n'\n", { mode: 0o755 });
    writeFileSync(path.join(bin, "set_terminal_title"), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$TITLES"\n', { mode: 0o755 });
    writeFileSync(path.join(bin, "sleep"), '#!/bin/bash\ncommand cat "$TMPDIR"/watch_interval.* > "$SNAPSHOT"\nexit 73\n', { mode: 0o755 });
    const runner = path.join(folder, "runner.bash");
    writeFileSync(
      runner,
      `${HELP}\n${PROFILE}\n
set -e
if [ "$PIPEFAIL_MODE" = on ]; then set -o pipefail; fi
shopt -s expand_aliases
# Waiting for an acknowledgement makes first-output timing observable without sleeps.
function probe() {
  printf 'FIRST\\n'
  printf 'ERR_FIRST\\n' >&2
  if [ "$COMMAND_MODE" != plain ]; then IFS= read -r _reply; fi
  printf 'END\\n'
  return "$COMMAND_STATUS"
}
eval 'f5 probe'
`,
    );
    const result = spawnSync(PYTHON, ["-c", DRIVER, runner], {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        BASH_ENV: "/dev/null",
        PATH: bin,
        TERM: "xterm-256color",
        TMPDIR: folder,
        COMMAND_MODE: commandMode,
        COMMAND_STATUS: String(commandStatus),
        CLEANUP_SIGNAL: cleanupSignal,
        REAL_RM: RM,
        PIPEFAIL_MODE: pipefail,
        TEE_STATUS: String(teeStatus),
        SNAPSHOT: path.join(folder, "snapshot"),
        TITLES: path.join(folder, "titles"),
      },
    });
    return {
      ...result,
      snapshot: readFileSync(path.join(folder, "snapshot"), "utf8"),
      titles: readFileSync(path.join(folder, "titles"), "utf8"),
      caches: readdirSync(folder).filter((name) => name.startsWith("watch_interval.")),
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("first cached frame streaming", () => {
  it("shows the initial chunk before the command can finish and saves exactly the streamed bytes", () => {
    const result = runStream();
    expect(result.status, result.stdout + result.stderr).toBe(73);
    expect(result.stdout).toBe("<clear>\nFIRST\nERR_FIRST\nEND\n");
    expect(result.snapshot).toBe("FIRST\nERR_FIRST\nEND\n");
    expect(result.titles).toBe("Refreshing\nWaiting\n");
    expect(result.caches).toEqual([]);
  });

  it.each(["on", "off"])("continues after command failure with pipefail %s when tee succeeds", (pipefail) => {
    const result = runStream({ commandMode: "plain", commandStatus: 7, pipefail });
    expect(result.status, result.stdout + result.stderr).toBe(73);
    expect(result.snapshot).toBe("FIRST\nERR_FIRST\nEND\n");
    expect(result.titles).toBe("Refreshing\nWaiting\n");
    expect(result.caches).toEqual([]);
  });

  it("propagates tee failure and removes incomplete caches", () => {
    const result = runStream({ commandMode: "plain", teeStatus: 74 });
    expect(result.status, result.stdout + result.stderr).toBe(74);
    expect(result.stdout).toContain("tee fixture failed");
    expect(result.snapshot).toBe("");
    expect(result.titles).toBe("Refreshing\n");
    expect(result.caches).toEqual([]);
  });

  it("rejects missing tee before starting the command or creating a cache", () => {
    const result = runStream({ commandMode: "plain", teeSupport: "missing" });
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain("tee executable required");
    expect(result.stdout).not.toContain("FIRST\n");
    expect(result.titles).toBe("");
    expect(result.caches).toEqual([]);
  });

  it.each(["INT", "TERM"])("finishes cache cleanup when a second %s reaches the watcher and cleanup process", (cleanupSignal) => {
    const result = runStream({ commandMode: "interrupt", cleanupSignal });
    expect(result.status, result.stdout + result.stderr).toBe(130);
    expect(result.stdout).toContain(`cleanup:${cleanupSignal}\n`);
    expect(result.caches).toEqual([]);
  });

  it("cleans both caches when interrupted during the initial streaming command", () => {
    const result = runStream({ commandMode: "interrupt" });
    expect(result.status, result.stdout + result.stderr).toBe(130);
    expect(result.stdout).toContain("FIRST\n");
    expect(result.snapshot).toBe("");
    expect(result.caches).toEqual([]);
  });
});
