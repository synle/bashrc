/** Behavioral checks for the profile's server-resetting ADB wrapper. */
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { getIndexFunction } from "./setup.js";

/** Repository root containing the real profile sources. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Production wrapper executed through the real Bash consumer. */
const WRAPPER = readFileSync(path.join(ROOT, "software/bootstrap/profile-advanced.sh"), "utf8").match(/function adb\(\) \{[\s\S]*?\n\}/)[0];
/** Production help predicate rather than a test-specific substitute. */
const HELP = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8").match(
  /function is_help_arg\(\) \{[\s\S]*?\n\}/,
)[0];

/**
 * Invoke the production wrapper twice-loaded in an isolated Bash with recording executables.
 * @param {string[]} args - Literal arguments forwarded without interpolation.
 * @param {object} [options] - Executable availability, platform, and failure controls.
 * @param {boolean} [options.available=true] - Whether a real executable exists in the private PATH.
 * @param {string} [options.binary="adb"] - Executable name, including adb.exe for Windows.
 * @param {boolean} [options.windows=false] - Whether Windows executable routing applies.
 * @param {number} [options.killStatus=0] - Native shutdown exit status.
 * @param {number} [options.status=0] - Native requested-command exit status.
 * @param {string} [options.profile=""] - Additional generated platform profile to load.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured native status and output.
 * @throws {Error} On fixture setup errors; removes the private sandbox in all cases.
 */
function runWrapper(args, { available = true, binary = "adb", windows = false, killStatus = 0, status = 0, profile = "" } = {}) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "adb wrapper-"));
  try {
    symlinkSync("/usr/bin/tr", path.join(sandbox, "tr"));
    if (available) {
      writeFileSync(
        path.join(sandbox, binary),
        `#!/bin/bash
printf 'CALL\\n'
for arg in "$@"; do
  printf '<%s>\\n' "$arg"
done
if [ "\${1:-}" = kill-server ]; then
  exit "$ADB_KILL_STATUS"
fi
exit "$ADB_STATUS"
`,
        { mode: 0o755 },
      );
    }
    return spawnSync(
      "/bin/bash",
      ["--noprofile", "--norc", "-c", `${HELP}\n${WRAPPER}\n${WRAPPER}\n${profile}\nadb "$@"`, "test", ...args],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          BASH_ENV: "/dev/null",
          PATH: sandbox,
          is_os_windows: windows ? "1" : "0",
          ADB_KILL_STATUS: String(killStatus),
          ADB_STATUS: String(status),
        },
        timeout: 5000,
      },
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("adb profile wrapper", () => {
  it.each([
    [["usb"], "CALL\n<kill-server>\nCALL\n<usb>\n"],
    [["connect", "192.0.2.1:5555"], "CALL\n<kill-server>\nCALL\n<connect>\n<192.0.2.1:5555>\n"],
    [["devices", "-l"], "CALL\n<kill-server>\nCALL\n<devices>\n<-l>\n"],
    [["tcpip", "5555"], "CALL\n<kill-server>\nCALL\n<tcpip>\n<5555>\n"],
    [["reconnect"], "CALL\n<kill-server>\nCALL\n<reconnect>\n"],
    [
      ["-s", "device serial", "shell", "printf '%s'", "", "a\\b;$(false)\n\u00e9"],
      "CALL\n<kill-server>\nCALL\n<-s>\n<device serial>\n<shell>\n<printf '%s'>\n<>\n<a\\b;$(false)\n\u00e9>\n",
    ],
    [[], "CALL\n<kill-server>\nCALL\n"],
  ])("stops the server before forwarding %j unchanged", (args, output) => {
    const result = runWrapper(args);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(output);
    expect(result.stderr).toBe("");
  });

  it("reports an unavailable executable without invoking another command", () => {
    const result = runWrapper(["usb"], { available: false });
    expect(result.status).toBe(127);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("adb is not installed\n");
  });

  it("does not mistake the wrapper function for an installed executable", () => {
    const result = runWrapper([], { available: false });
    expect(result.status).toBe(127);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("adb is not installed\n");
  });

  it("stops after a shutdown failure and preserves its status", () => {
    const result = runWrapper(["connect", "192.0.2.1"], { killStatus: 9 });
    expect(result.status).toBe(9);
    expect(result.stdout).toBe("CALL\n<kill-server>\n");
    expect(result.stderr).toBe("");
  });

  it("preserves the requested command's failure status after successful shutdown", () => {
    const result = runWrapper(["usb"], { status: 7 });
    expect(result.status).toBe(7);
    expect(result.stdout).toBe("CALL\n<kill-server>\nCALL\n<usb>\n");
    expect(result.stderr).toBe("");
  });

  it("forwards explicit kill-server exactly once, including its arguments and failure", () => {
    const result = runWrapper(["kill-server", "extra argument"], { killStatus: 8 });
    expect(result.status).toBe(8);
    expect(result.stdout).toBe("CALL\n<kill-server>\n<extra argument>\n");
    expect(result.stderr).toBe("");
  });

  it("adds wrapper help while still resetting and forwarding native help", () => {
    const result = runWrapper(["--help"], { status: 3 });
    expect(result.status).toBe(3);
    expect(result.stdout).toBe("CALL\n<kill-server>\nCALL\n<--help>\n");
    expect(result.stderr).toContain("adb: stop the server before forwarding ADB commands");
  });

  it("preserves Windows adb.exe routing without an alias bypassing the wrapper", async () => {
    let profile = "";
    const context = vm.createContext({
      code: getIndexFunction("code"),
      registerPlatformTweaks: (_platform, content) => {
        profile = content;
      },
    });
    vm.runInContext(readFileSync(path.join(ROOT, "software/scripts/windows/_only.js"), "utf8"), context);
    await context.doWork();
    const result = runWrapper(["usb"], { binary: "adb.exe", windows: true, profile: `shopt -s expand_aliases\n${profile}` });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("CALL\n<kill-server>\nCALL\n<usb>\n");
    expect(result.stderr).toBe("");
  });

  it("does not select a Windows executable on a non-Windows host", () => {
    const result = runWrapper(["usb"], { binary: "adb.exe" });
    expect(result.status).toBe(127);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("adb is not installed\n");
  });

  it("reports missing executables on Windows too", () => {
    const result = runWrapper(["usb"], { available: false, windows: true });
    expect(result.status).toBe(127);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("adb is not installed\n");
  });
});
