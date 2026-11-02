/** Filesystem checks for production Steam icon restoration and dated backups. */
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Production restore and backup sections without interactive provisioning. */
const ICONS = fs
  .readFileSync("software/scripts/steamos/setup.bash", "utf8")
  .split("# --- Setting up the icons for SteamOS ---")[1]
  .split("# --- Applications AppImages ---")[0];
/** Owned fixture folders removed after each test. */
const folders = [];

/**
 * Create an isolated home with Desktop grid content and one Steam account.
 * @returns {string} Temporary home folder.
 * @throws {Error} On filesystem failure; registers cleanup before creating fixture content.
 */
function homeFolder() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "steam-icons-"));
  folders.push(home);
  fs.mkdirSync(path.join(home, "Desktop/grid"), { recursive: true });
  fs.mkdirSync(path.join(home, ".local/share/Steam/userdata/123/config"), { recursive: true });
  fs.writeFileSync(path.join(home, "Desktop/grid/icon with spaces.png"), "current icons");
  fs.writeFileSync(path.join(home, "Desktop/grid/.hidden"), "hidden icon");
  return home;
}

/**
 * Run the real icon sections; an optional shell prefix injects tar failure.
 * @param {string} home Isolated home folder.
 * @param {string} [prefix=""] Fixture command overrides.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and captured output.
 */
function runIcons(home, prefix = "") {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", `${prefix}\n${ICONS}`], {
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, HOME: home, BASH_ENV: "/dev/null", TZ: "UTC" },
  });
}

/**
 * Store an independent archive version with a fixed modification time.
 * @param {string} home Fixture home folder.
 * @param {string} name Archive basename.
 * @param {string} content Expected icon bytes.
 * @param {number} modified Modification time in seconds since epoch.
 * @returns {string} Created archive path; updates fixture grid before archiving.
 */
function archive(home, name, content, modified) {
  fs.writeFileSync(path.join(home, "Desktop/grid/icon with spaces.png"), content);
  const target = path.join(home, "Desktop", name);
  execFileSync("tar", ["-czf", target, "-C", path.join(home, "Desktop"), "grid"], { env: { ...process.env, BASH_ENV: "/dev/null" } });
  fs.utimesSync(target, modified, modified);
  return target;
}

afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("Steam icon archives", () => {
  it("backs up Desktop grid without an input archive and preserves hidden files and source", () => {
    const home = homeFolder();
    const result = runIcons(home);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Skipping restore");
    const backup = result.stdout.match(/Steam icons backup saved: (.+)/)[1];
    expect(path.basename(backup)).toMatch(/^grid-\d{4}-\d{2}-\d{2}\.tar\.gz$/);
    expect(execFileSync("tar", ["-xOzf", backup, "grid/icon with spaces.png"], { encoding: "utf8" })).toBe("current icons");
    expect(execFileSync("tar", ["-xOzf", backup, "grid/.hidden"], { encoding: "utf8" })).toBe("hidden icon");
    expect(fs.readFileSync(path.join(home, "Desktop/grid/icon with spaces.png"), "utf8")).toBe("current icons");
  });

  it.each([
    ["grid.tar.gz", "grid-2099-12-31.tar.gz"],
    ["grid-2000-01-01.tar.gz", "grid.tar.gz"],
  ])("restores newest %s rather than filename-sorted %s", (newest, oldest) => {
    const home = homeFolder();
    archive(home, oldest, "old icons", 1000);
    const selected = archive(home, newest, "newest icons", 2000);
    fs.writeFileSync(path.join(home, "Desktop/grid/icon with spaces.png"), "unrestored");
    fs.mkdirSync(path.join(home, "Desktop/grid-not-an-archive.tar.gz"));
    const result = runIcons(home);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Steam icons archive found: ${selected}. Extracting...`);
    expect(fs.readFileSync(path.join(home, ".local/share/Steam/userdata/123/config/grid/icon with spaces.png"), "utf8")).toBe(
      "newest icons",
    );
    const backup = result.stdout.match(/Steam icons backup saved: (.+)/)[1];
    expect(execFileSync("tar", ["-xOzf", backup, "grid/icon with spaces.png"], { encoding: "utf8" })).toBe("newest icons");
  });

  it("preserves existing dated backups on rerun", () => {
    const home = homeFolder();
    const first = runIcons(home);
    expect(first.status, first.stderr).toBe(0);
    const original = first.stdout.match(/Steam icons backup saved: (.+)/)[1];
    const bytes = fs.readFileSync(original);
    const second = runIcons(home);
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain(`Steam icons backup saved: ${original.replace(/\.tar\.gz$/, "-1.tar.gz")}`);
    expect(fs.readFileSync(original)).toEqual(bytes);
  });

  it("skips missing input and source without creating an archive", () => {
    const home = homeFolder();
    fs.rmSync(path.join(home, "Desktop/grid"), { recursive: true });
    const result = runIcons(home);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Skipping backup");
    expect(fs.readdirSync(path.join(home, "Desktop"))).toEqual([]);
  });

  it("reports archive creation failure and retains source icons", () => {
    const home = homeFolder();
    const result = runIcons(home, "function tar() { return 7; }");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Steam icons backup failed");
    expect(result.stdout).not.toContain("backup saved");
    expect(fs.readFileSync(path.join(home, "Desktop/grid/icon with spaces.png"), "utf8")).toBe("current icons");
  });

  it("stops after corrupt archive extraction instead of backing up stale content", () => {
    const home = homeFolder();
    fs.writeFileSync(path.join(home, "Desktop/grid.tar.gz"), "invalid archive");
    const result = runIcons(home);
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("backup saved");
    expect(fs.readdirSync(path.join(home, "Desktop"))).toEqual(["grid", "grid.tar.gz"]);
    expect(fs.readFileSync(path.join(home, "Desktop/grid/icon with spaces.png"), "utf8")).toBe("current icons");
  });
});
