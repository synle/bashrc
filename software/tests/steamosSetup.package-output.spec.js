/** Execute verbose-package logging and deferred USB work through the actual manual setup shell functions. */
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Only the real logging helper executes; no system provisioning is sourced. */
const source = fs.readFileSync("software/scripts/steamos/setup.bash", "utf8");
/** Bounded helper source, ending before account preflight invocation. */
const logger = source.slice(source.indexOf("function _run_long_install()"), source.indexOf("\n_start_steamos_setup_log || exit 1"));
/** Test-owned temporary roots, removed after every subprocess. */
const folders = [];

/** Run a verbose command fixture with controlled stdout/stderr and return its private output log and process result. */
function run({ status = 0, twice = false, badRoot = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-package-log-"));
  folders.push(home);
  const result = spawnSync(
    "/bin/bash",
    [
      "-c",
      `
${logger}
STEAMOS_SETUP_STARTED=20261025-080000
function verbose_command() {
  printf '%s\\n' "$@" >> "$HOME/arguments"
  echo 'verbose stdout'
  echo 'verbose stderr' >&2
  read -r input && exit 99
  return ${status}
}
_run_long_install "Package operation" verbose_command "argument with spaces" "quote'; literal"
status=$?
${twice ? '_run_long_install "Second operation" verbose_command second; status=$?' : ""}
echo 'short output stays visible'
printf 'log=%s\\n' "\${STEAMOS_PACKAGE_LOG:-}"
exit "$status"
`,
    ],
    {
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        HOME: home,
        TMPDIR: home,
        BASHRC_TEMP_ROOT_DIR: badRoot ? path.join(home, "missing") : home,
        BASH_ENV: "",
        ENV: "",
      },
    },
  );
  const logs = fs.readdirSync(home).filter((name) => name.startsWith("sy-log-"));
  return { ...result, home, logs };
}

afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("SteamOS long package output (Bash subprocess)", () => {
  it("captures both streams privately while leaving short progress visible and passing literal arguments", () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Package operation; output log:");
    expect(result.stdout).toContain("short output stays visible");
    expect(result.stdout).not.toContain("verbose stdout");
    expect(result.stderr).not.toContain("verbose stderr");
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatch(/^sy-log-20261025-080000-steamos-setup-output\.[A-Za-z0-9]+\.txt$/);
    expect(fs.statSync(path.join(result.home, result.logs[0])).mode & 0o777).toBe(0o600);
    expect(fs.readFileSync(path.join(result.home, result.logs[0]), "utf8")).toBe(
      "\n>>> Package operation\nverbose stdout\nverbose stderr\n>>> Exit status: 0\n",
    );
    expect(fs.readFileSync(path.join(result.home, "arguments"), "utf8")).toBe("argument with spaces\nquote'; literal\n");
  });

  it("appends subsequent long operations to the same run log", () => {
    const result = run({ twice: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.logs).toHaveLength(1);
    expect(fs.readFileSync(path.join(result.home, result.logs[0]), "utf8")).toBe(
      "\n>>> Package operation\nverbose stdout\nverbose stderr\n>>> Exit status: 0\n\n>>> Second operation\nverbose stdout\nverbose stderr\n>>> Exit status: 0\n",
    );
  });

  it("preserves a failing exit status and exposes the log path, not the verbose failure body", () => {
    const result = run({ status: 23 });
    expect(result.status).toBe(23);
    expect(result.stderr).toContain("Package operation failed (status 23); review");
    expect(result.stderr).not.toContain("verbose stderr");
    expect(fs.readFileSync(path.join(result.home, result.logs[0]), "utf8")).toContain("verbose stderr\n>>> Exit status: 23\n");
  });

  it("does not execute a package command when its log cannot be created", () => {
    const result = run({ badRoot: true });
    expect(result.status).toBe(1);
    expect(result.logs).toEqual([]);
    expect(fs.existsSync(path.join(result.home, "arguments"))).toBe(false);
  });

  it("runs the real Brave prerequisite noninteractively through the logging seam", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "steamos-flatpak-log-"));
    folders.push(home);
    fs.mkdirSync(path.join(home, "bin"));
    fs.writeFileSync(
      path.join(home, "bin/flatpak"),
      '#!/bin/bash\nprintf "%s\\n" "$@" > "$HOME/arguments"\necho "flatpak verbose"\necho "flatpak error stream" >&2\n',
      { mode: 0o755 },
    );
    const prerequisite = source.slice(
      source.indexOf("function _install_flatpak_brave_prerequisite()"),
      source.indexOf("\nBRAVE_FLATPAK_READY=0"),
    );
    const result = spawnSync("/bin/bash", ["-c", `${logger}\n${prerequisite}\n_install_flatpak_brave_prerequisite`], {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, HOME: home, BASHRC_TEMP_ROOT_DIR: home, PATH: `${home}/bin:${process.env.PATH}`, BASH_ENV: "" },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(home, "arguments"), "utf8")).toBe("install\n--user\n-y\nflathub\ncom.brave.Browser\n");
    expect(result.stdout).toContain("ready for browser shortcut registration");
    expect(result.stdout).not.toContain("flatpak verbose");
    expect(result.stderr).not.toContain("flatpak error stream");
  });
});
