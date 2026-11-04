/** Isolated Ghostty AppImage downloads and existing Steam registration fixtures. */
import { afterEach, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Setup source read without executing host provisioning. */
const setup = fs.readFileSync("software/scripts/steamos/setup.bash", "utf8");
/** Ghostty download block, empty until the installation behavior exists. */
const download = (setup.split("# --- Ghostty (AppImage) ---")[1] || "").split("# --- Moonlight (AppImage) ---")[0];
/** Existing AppImage registration pass, excluding KDE configuration. */
const registration = setup.split("# --- Applications AppImages ---")[1].split("# --- KDE favorites and taskbar pins ---")[0];
/** Test-owned temporary homes. */
const roots = [];

/** Remove only homes created by these fixtures. */
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

/**
 * Create a private home with the same Applications location used by setup.
 * @returns {string} Absolute test home; records ownership for cleanup.
 * @throws {Error} If fixture directories cannot be created.
 */
function createHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "steamos ghostty-"));
  roots.push(home);
  fs.mkdirSync(path.join(home, "Applications"));
  return home;
}

/**
 * Execute the real download block against a bounded local transport fixture.
 * @param {string} home - Private home containing Applications.
 * @param {string} status - Curl fixture exit status.
 * @param {string} content - Downloaded bytes supplied by the transport fixture.
 * @returns {object} Process exit status and captured output.
 * @throws {Error} If spawning the fixture shell fails.
 */
function install(home, status = "0", content = "#!/bin/sh") {
  return spawnSync(
    "/bin/bash",
    [
      "-c",
      `APPS_FOLDER="$HOME/Applications"
function curl() {
  printf '%s\\n' "$@" > "$HOME/download-args"
  printf '%s' "$CURL_CONTENT" > "\${@: -1}"
  return "$CURL_STATUS"
}
function _add_steam_shortcut() { printf 'REGISTER|%s|%s|%s\\n' "$1" "$2" "$3"; }
${download}
${registration}`,
    ],
    {
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, HOME: home, CURL_STATUS: status, CURL_CONTENT: content },
    },
  );
}

it("installs the tagged stable AppImage instead of a disappearing nightly asset", () => {
  const home = createHome();
  const result = install(home);
  const executable = path.join(home, "Applications/Ghostty.AppImage");

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout).toContain(`REGISTER|Ghostty|${executable}|\n`);
  expect(fs.readdirSync(path.join(home, "Applications"))).toEqual(["Ghostty.AppImage"]);
  expect(fs.readFileSync(executable, "utf8")).toBe("#!/bin/sh");
  expect(fs.statSync(executable).mode & 0o111).toBe(0o111);
  expect(fs.readFileSync(path.join(home, "download-args"), "utf8").split("\n")).toContain(
    "https://github.com/pkgforge-dev/ghostty-appimage/releases/download/v1.4.0/Ghostty-1.4.0-x86_64.AppImage",
  );
  fs.unlinkSync(path.join(home, "download-args"));
  const rerun = install(home, "22");
  expect(rerun.status, rerun.stdout + rerun.stderr).toBe(0);
  expect(rerun.stdout).toContain("Ghostty AppImage already present");
  expect(fs.existsSync(path.join(home, "download-args"))).toBe(false);
  expect(fs.readFileSync(executable, "utf8")).toBe("#!/bin/sh");
});

it("reuses an existing AppImage and repairs executable permissions without downloading", () => {
  const home = createHome();
  const executable = path.join(home, "Applications/Ghostty.AppImage");
  fs.writeFileSync(executable, "existing ghostty", { mode: 0o644 });
  const result = install(home);

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout).toContain("Ghostty AppImage already present");
  expect(fs.readFileSync(executable, "utf8")).toBe("existing ghostty");
  expect(fs.statSync(executable).mode & 0o111).toBe(0o111);
  expect(fs.existsSync(path.join(home, "download-args"))).toBe(false);
});

it.each([
  ["failed", "22", "partial"],
  ["empty", "0", ""],
])("does not retain or register an AppImage after a %s download", (_condition, status, content) => {
  const home = createHome();
  const result = install(home, status, content);

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout + result.stderr).toContain("Ghostty AppImage download or preparation failed");
  expect(fs.readdirSync(path.join(home, "Applications"))).toEqual([]);
  expect(result.stdout).not.toContain("REGISTER|");
});

it("registers Ghostty through the existing Applications pass", () => {
  const home = createHome();
  fs.writeFileSync(path.join(home, "Applications/Ghostty.AppImage"), "ghostty", { mode: 0o755 });
  const result = spawnSync(
    "/bin/bash",
    [
      "-c",
      `APPS_FOLDER="$HOME/Applications"
function _add_steam_shortcut() { printf '%s|%s|%s\\n' "$1" "$2" "$3"; }
${registration}`,
    ],
    { encoding: "utf8", timeout: 10000, env: { ...process.env, HOME: home } },
  );

  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toBe(`Ghostty|${home}/Applications/Ghostty.AppImage|\n`);
});
