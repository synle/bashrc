import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Absolute path to the manual SteamOS setup script. */
const setupPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/steamos/setup.bash");
/** Shell source containing the shared shortcut registration entry point. */
const registrationSource = fs
  .readFileSync(setupPath, "utf-8")
  .split("# Run SteamTinkerLaunch for the verified account after checking executable exists.", 2)[1]
  .split("# Update one same-name shortcut while preserving unrelated Steam metadata.", 1)[0];
/** Temporary homes owned by this spec and removed after each test. */
const sandboxes = [];

/**
 * Run the registration wrapper in an isolated home with controlled command output.
 * @param {object} options Scenario overrides for command status, preflight, and repetitions.
 * @returns {object} Process output and paths for checking forwarded arguments and side effects.
 * @throws {Error} If fixture creation fails; creates temporary files cleaned after each test.
 */
function runRegistration({ exitStatus = 0, preflight = "", missingExecutable = false, calls = 1 } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-logging-"));
  sandboxes.push(home);
  const binFolder = path.join(home, "bin");
  const executable = path.join(home, "Private App.AppImage");
  const argumentsPath = path.join(home, "arguments");
  fs.mkdirSync(binFolder);
  if (!missingExecutable) fs.writeFileSync(executable, "app\n", { mode: 0o755 });
  fs.writeFileSync(
    path.join(binFolder, "steamtinkerlaunch"),
    `#!/usr/bin/env bash
[ -f "$HOME/account-configured" ] || exit 99
printf '%s\\n' "$@" > "$HOME/arguments"
echo 'command stdout'
echo 'command stderr' >&2
exit ${exitStatus}
`,
    { mode: 0o755 },
  );
  const result = spawnSync(
    "/bin/bash",
    [
      "-c",
      `${registrationSource}
function _steam_shortcuts_file() { printf '%s/.steam/steam/userdata/12345/config/shortcuts.vdf\\n' "$HOME"; }
function _configure_steamtinkerlaunch_account() { touch "$HOME/account-configured"; }
${preflight}
${Array.from({ length: calls }, () => '_steamtinkerlaunch_add "$@"').join("\n")}`,
      "bash",
      "--appname=Private Title",
      `--exepath=${executable}`,
      "--launchoptions=https://private.example/?token=not-a-real-secret",
    ],
    { encoding: "utf-8", env: { ...process.env, HOME: home, PATH: `${binFolder}:${process.env.PATH}` } },
  );
  return { ...result, home, executable, argumentsPath };
}

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("SteamOS shortcut registration diagnostics (subprocess)", () => {
  it.each([0, 17, 127])("reports command exit status %i and preserves output and arguments", (exitStatus) => {
    const result = runRegistration({ exitStatus });

    expect(result.status, result.stderr).toBe(exitStatus);
    expect(result.stdout).toBe("command stdout\n");
    expect(result.stderr).toContain("[DEBUG] SteamTinkerLaunch add: validating executable");
    expect(result.stderr).toContain("[DEBUG] SteamTinkerLaunch add: resolving Steam account");
    expect(result.stderr).toContain("[DEBUG] SteamTinkerLaunch add: preparing account config and refreshing path cache");
    expect(result.stderr).toContain("[DEBUG] SteamTinkerLaunch add: starting addnonsteamgame; command output follows");
    expect(result.stderr).toContain("command stderr\n");
    expect(result.stderr).toMatch(new RegExp(`SteamTinkerLaunch add: command finished; exit status ${exitStatus}; elapsed [0-9]+s`));
    expect(fs.readFileSync(result.argumentsPath, "utf-8")).toBe(
      `addnonsteamgame\n--appname=Private Title\n--exepath=${result.executable}\n--launchoptions=https://private.example/?token=not-a-real-secret\n`,
    );
    expect(result.stderr).not.toContain("private.example");
    expect(result.stderr).not.toContain("Private Title");
    expect(result.stderr).not.toContain("12345");
  });

  it("identifies account resolution failure without invoking the command", () => {
    const result = runRegistration({ preflight: "function _steam_shortcuts_file() { return 1; }" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SteamTinkerLaunch add: account resolution failed; command not started");
    expect(result.stderr).not.toContain("starting addnonsteamgame");
    expect(result.stdout).toBe("");
    expect(fs.existsSync(path.join(result.home, "account-configured"))).toBe(false);
    expect(fs.existsSync(result.argumentsPath)).toBe(false);
  });

  it("identifies account preparation failure without invoking the command", () => {
    const result = runRegistration({ preflight: "function _configure_steamtinkerlaunch_account() { return 1; }" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SteamTinkerLaunch add: account config or path-cache refresh failed; command not started");
    expect(result.stderr).not.toContain("starting addnonsteamgame");
    expect(result.stdout).toBe("");
    expect(fs.existsSync(result.argumentsPath)).toBe(false);
  });

  it("logs executable preflight before rejecting a missing executable", () => {
    const result = runRegistration({ missingExecutable: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[DEBUG] SteamTinkerLaunch add: validating executable");
    expect(result.stderr).toContain("binary or AppImage path not found or not present");
    expect(result.stderr).not.toContain("resolving Steam account");
    expect(result.stdout).toBe("");
    expect(fs.existsSync(result.argumentsPath)).toBe(false);
  });

  it("reports each command result when registration is repeated", () => {
    const result = runRegistration({ calls: 2 });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("command stdout\ncommand stdout\n");
    expect(result.stderr.match(/command finished; exit status 0/g)).toHaveLength(2);
    expect(fs.existsSync(result.argumentsPath)).toBe(true);
  });
});
