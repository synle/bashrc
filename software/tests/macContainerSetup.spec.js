/** Exercise the temporary macOS Docker Desktop removal without changing the host. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { spawnSync } from "child_process";

/** Actual migration shell, executed with isolated command boundaries. */
const migration = readFileSync(new URL("../scripts/mac/_full-setup.docker-uninstall.sh", import.meta.url), "utf8");

/** Model app presence and Homebrew outcomes without touching installed applications. */
const harness = `
function [() {
  if [[ "$1" == "!" && "$2" == "-d" && "$3" == "/Applications/Docker.app" ]]; then
    test "$APP_PRESENT" != 1
  else
    builtin [ "$@"
  fi
}
function has_persistent_binary() { test "$BREW_PRESENT" = 1; }
function run_native() { "$@"; }
function brew() {
  if [[ "$1" == "list" ]]; then
    printf '%s\\n' "$CASKS"
    return "$LIST_STATUS"
  fi
  printf 'ACTION:brew'
  printf ' <%s>' "$@"
  printf '\\n'
  return "$UNINSTALL_STATUS"
}
`;

/**
 * Execute the real migration with explicit host facts and command outcomes.
 * @param {object} overrides - Environment overrides for a single isolated scenario.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and captured output.
 */
function runMigration(overrides = {}) {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-p", "-c", harness + migration], {
    encoding: "utf8",
    env: {
      PATH: "/usr/bin:/bin",
      is_os_mac: "1",
      APP_PRESENT: "1",
      BREW_PRESENT: "1",
      CASKS: "docker-desktop",
      LIST_STATUS: "0",
      UNINSTALL_STATUS: "0",
      ...overrides,
    },
  });
}

describe("macOS container migration", () => {
  it.each(["docker-desktop", "docker"])("removes the registered %s cask without purging user data", (cask) => {
    const result = runMigration({ CASKS: cask });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      `ACTION:brew <uninstall> <--cask> <${cask}>\n>> Docker Desktop uninstall >> Removed app; retained user data\n`,
    );
    expect(result.stderr).toBe("");
  });

  it.each([
    [{ is_os_mac: "0" }, ">> Docker Desktop uninstall >> Skipped (macOS only)\n"],
    [{ APP_PRESENT: "0" }, ">> Docker Desktop uninstall >> Skipped (Docker.app absent)\n"],
  ])("does nothing outside the eligible host state %j", (state, output) => {
    const result = runMigration(state);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(output);
    expect(result.stderr).toBe("");
  });

  it.each([
    [{ BREW_PRESENT: "0" }, "ERROR: Homebrew is required to uninstall Docker Desktop safely.\n"],
    [
      { CASKS: "orbstack" },
      "ERROR: Docker.app is not Homebrew-managed. Uninstall it manually before rerunning setup; user data was not changed.\n",
    ],
  ])("rejects unsafe removal state %j without effects", (state, error) => {
    const result = runMigration(state);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(error);
  });

  it("stops when the package inventory fails", () => {
    const result = runMigration({ LIST_STATUS: "1" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("does not report success when uninstall fails", () => {
    const result = runMigration({ UNINSTALL_STATUS: "1" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("ACTION:brew <uninstall> <--cask> <docker-desktop>\n");
  });

  it("queues OrbStack instead of Docker Desktop in macOS setup", () => {
    const setup = readFileSync(new URL("../scripts/mac/_full-setup.sh", import.meta.url), "utf8");
    const guiPackages = setup
      .split("# --- GUI apps (skip if already present in /Applications or brew cask cache) ---")[1]
      .split("# --- Shell Setup (default shell) ---")[0];
    const result = spawnSync(
      "/bin/bash",
      ["--noprofile", "--norc", "-p", "-c", `function installBrewPackageInBackground() { printf '%s\\n' "$*"; }\n${guiPackages}`],
      { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--cask --app=OrbStack.app orbstack\n");
    expect(result.stdout).not.toContain("Docker.app");
  });
});
