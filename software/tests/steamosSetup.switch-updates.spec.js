/** Real filesystem checks for sorting Switch update files during manual SteamOS setup. */
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Production move block only, without interactive provisioning or final confirmation. */
const MOVE_UPDATES = fs
  .readFileSync("software/scripts/steamos/setup.bash", "utf8")
  .split("# --- Switch update files ---")[1]
  .split("# --- Done - Final clean up and confirmation ---")[0];
/** Temporary homes owned by this spec and removed after each test. */
const homes = [];

/**
 * Create a private home and ROM folder for one test.
 * @returns {{home: string, roms: string, dlc: string}} Absolute fixture paths; registers cleanup before creating ROMs.
 * @throws {Error} On filesystem failure.
 */
function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "switch-updates-"));
  homes.push(home);
  const roms = path.join(home, "Emulation/roms/switch");
  fs.mkdirSync(roms, { recursive: true });
  return { home, roms, dlc: path.join(roms, "dlc") };
}

/**
 * Execute the real production block without running provisioning or reading host startup files.
 * @param {string} home Private fixture home.
 * @param {string} [prefix=""] Shell command overrides for explicit failure/race scenarios.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured process status and output; moves only fixture files.
 */
function runMoves(home, prefix = "") {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", `${prefix}\n${MOVE_UPDATES}`], {
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, HOME: home, BASH_ENV: "/dev/null" },
  });
}

afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe("Switch update files", () => {
  it.each([
    "Game - Update - v2.nsp",
    "- Update - patch.xci",
    ".hidden - Update - patch.bin",
    "Game's [special]* - Update - patch.nsp",
    "Pok\u00e9mon - Update - \u65e5\u672c.nsp",
    "Game\nTitle - Update - patch.nsp",
  ])("moves literal matching file %j and preserves its name and bytes", (name) => {
    const { home, roms, dlc } = fixture();
    fs.writeFileSync(path.join(roms, name), Buffer.from([0, 1, 127, 255]));

    const result = runMoves(home);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Switch update moved:");
    expect(fs.existsSync(path.join(roms, name))).toBe(false);
    expect(fs.readFileSync(path.join(dlc, name))).toEqual(Buffer.from([0, 1, 127, 255]));
  });

  it("moves multiple updates but leaves base games, folders, nested files, and symlinks untouched", () => {
    const { home, roms, dlc } = fixture();
    fs.writeFileSync(path.join(roms, "One - Update - 1.nsp"), "first");
    fs.writeFileSync(path.join(roms, "Two - Update - 2.nsp"), "second");
    fs.writeFileSync(path.join(roms, "Base Game.nsp"), "base");
    fs.mkdirSync(path.join(roms, "Folder - Update - content"));
    fs.mkdirSync(path.join(roms, "nested"));
    fs.writeFileSync(path.join(roms, "nested/Nested - Update - 1.nsp"), "nested");
    fs.symlinkSync("Base Game.nsp", path.join(roms, "Link - Update - 1.nsp"));

    const result = runMoves(home);

    expect(result.status, result.stderr).toBe(0);
    expect(fs.readdirSync(dlc).sort()).toEqual(["One - Update - 1.nsp", "Two - Update - 2.nsp"]);
    expect(fs.readFileSync(path.join(dlc, "One - Update - 1.nsp"), "utf8")).toBe("first");
    expect(fs.readFileSync(path.join(dlc, "Two - Update - 2.nsp"), "utf8")).toBe("second");
    expect(fs.readFileSync(path.join(roms, "Base Game.nsp"), "utf8")).toBe("base");
    expect(fs.statSync(path.join(roms, "Folder - Update - content")).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(roms, "nested/Nested - Update - 1.nsp"), "utf8")).toBe("nested");
    expect(fs.readlinkSync(path.join(roms, "Link - Update - 1.nsp"))).toBe("Base Game.nsp");
  });

  it.each(["Game - update - 1.nsp", "Game-Update-1.nsp", "Game - DLC - 1.nsp", "Game.nsp"])(
    "leaves nonmatching file %j unchanged without creating dlc",
    (name) => {
      const { home, roms, dlc } = fixture();
      fs.writeFileSync(path.join(roms, name), "keep");

      const result = runMoves(home);

      expect(result.status, result.stderr).toBe(0);
      expect(fs.readFileSync(path.join(roms, name), "utf8")).toBe("keep");
      expect(fs.existsSync(dlc)).toBe(false);
      expect(result.stdout).not.toContain("Switch update moved:");
    },
  );

  it("skips a missing ROM folder without creating it", () => {
    const { home, roms } = fixture();
    fs.rmdirSync(roms);

    const result = runMoves(home);

    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(roms)).toBe(false);
    expect(result.stdout).not.toContain("Switch update moved:");
  });

  it("does nothing on an empty folder or after an update has already moved", () => {
    const { home, roms, dlc } = fixture();
    const empty = runMoves(home);
    expect(empty.status, empty.stderr).toBe(0);
    expect(fs.readdirSync(roms)).toEqual([]);
    fs.writeFileSync(path.join(roms, "Game - Update - 1.nsp"), "update");
    const first = runMoves(home);
    expect(first.status, first.stderr).toBe(0);

    const second = runMoves(home);

    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).not.toContain("Switch update moved:");
    expect(fs.readdirSync(roms)).toEqual(["dlc"]);
    expect(fs.readFileSync(path.join(dlc, "Game - Update - 1.nsp"), "utf8")).toBe("update");
  });

  it("preserves both files when a destination already exists", () => {
    const { home, roms, dlc } = fixture();
    fs.mkdirSync(dlc);
    fs.writeFileSync(path.join(roms, "Game - Update - 1.nsp"), "incoming");
    fs.writeFileSync(path.join(dlc, "Game - Update - 1.nsp"), "existing");

    const result = runMoves(home);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("destination exists; keeping source:");
    expect(result.stdout).not.toContain("Switch update moved:");
    expect(fs.readFileSync(path.join(roms, "Game - Update - 1.nsp"), "utf8")).toBe("incoming");
    expect(fs.readFileSync(path.join(dlc, "Game - Update - 1.nsp"), "utf8")).toBe("existing");
  });

  it("preserves destination folders and dangling links instead of moving into or replacing them", () => {
    const { home, roms, dlc } = fixture();
    fs.mkdirSync(dlc);
    fs.writeFileSync(path.join(roms, "Folder - Update - 1.nsp"), "folder source");
    fs.writeFileSync(path.join(roms, "Link - Update - 1.nsp"), "link source");
    fs.mkdirSync(path.join(dlc, "Folder - Update - 1.nsp"));
    fs.symlinkSync("missing-target", path.join(dlc, "Link - Update - 1.nsp"));

    const result = runMoves(home);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("destination exists; keeping source:");
    expect(fs.readdirSync(path.join(dlc, "Folder - Update - 1.nsp"))).toEqual([]);
    expect(fs.readlinkSync(path.join(dlc, "Link - Update - 1.nsp"))).toBe("missing-target");
    expect(fs.readFileSync(path.join(roms, "Folder - Update - 1.nsp"), "utf8")).toBe("folder source");
    expect(fs.readFileSync(path.join(roms, "Link - Update - 1.nsp"), "utf8")).toBe("link source");
  });

  it("rejects a symlinked dlc folder without writing outside the ROM folder", () => {
    const { home, roms, dlc } = fixture();
    const outside = path.join(home, "outside");
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, dlc);
    fs.writeFileSync(path.join(roms, "Game - Update - 1.nsp"), "incoming");

    const result = runMoves(home);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("dlc must not be a symbolic link");
    expect(fs.readdirSync(outside)).toEqual([]);
    expect(fs.readlinkSync(dlc)).toBe(outside);
    expect(fs.readFileSync(path.join(roms, "Game - Update - 1.nsp"), "utf8")).toBe("incoming");
  });

  it("reports destination creation failure and retains the source", () => {
    const { home, roms, dlc } = fixture();
    fs.writeFileSync(dlc, "not a folder");
    fs.writeFileSync(path.join(roms, "Game - Update - 1.nsp"), "incoming");

    const result = runMoves(home);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("could not create dlc folder");
    expect(result.stdout).not.toContain("Switch update moved:");
    expect(fs.readFileSync(dlc, "utf8")).toBe("not a folder");
    expect(fs.readFileSync(path.join(roms, "Game - Update - 1.nsp"), "utf8")).toBe("incoming");
  });

  it("reports a failed move and retains the source", () => {
    const { home, roms, dlc } = fixture();
    fs.writeFileSync(path.join(roms, "Game - Update - 1.nsp"), "incoming");

    const result = runMoves(home, "function mv() { return 7; }");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Switch update move failed:");
    expect(result.stdout).not.toContain("Switch update moved:");
    expect(fs.readFileSync(path.join(roms, "Game - Update - 1.nsp"), "utf8")).toBe("incoming");
    expect(fs.readdirSync(dlc)).toEqual([]);
  });

  it("preserves a destination created between the conflict check and move", () => {
    const { home, roms, dlc } = fixture();
    fs.writeFileSync(path.join(roms, "Game - Update - 1.nsp"), "incoming");

    const result = runMoves(
      home,
      'function mv() { printf "%s" "racing writer" > "$HOME/Emulation/roms/switch/dlc/Game - Update - 1.nsp"; command mv "$@"; }',
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("destination exists; keeping source:");
    expect(result.stdout).not.toContain("Switch update moved:");
    expect(fs.readFileSync(path.join(roms, "Game - Update - 1.nsp"), "utf8")).toBe("incoming");
    expect(fs.readFileSync(path.join(dlc, "Game - Update - 1.nsp"), "utf8")).toBe("racing writer");
  });

  it("does not nest an update inside a destination folder created just before the move", () => {
    const { home, roms, dlc } = fixture();
    fs.writeFileSync(path.join(roms, "Game - Update - 1.nsp"), "incoming");

    const result = runMoves(home, 'function mv() { mkdir "$HOME/Emulation/roms/switch/dlc/Game - Update - 1.nsp"; command mv "$@"; }');

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("destination exists; keeping source:");
    expect(result.stdout).not.toContain("Switch update moved:");
    expect(fs.readFileSync(path.join(roms, "Game - Update - 1.nsp"), "utf8")).toBe("incoming");
    expect(fs.readdirSync(path.join(dlc, "Game - Update - 1.nsp"))).toEqual([]);
  });
});
