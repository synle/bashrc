/** Final Windows cleanup must execute the maintained Explorer script, not just deploy a Desktop copy. */
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

/** Repository source used by both automatic execution and Desktop deployment. @type {string} */
const MENU_SOURCE = fs.readFileSync("software/scripts/windows/windows-context-menu.ps1.bash", "utf8");

/**
 * Load the real final Windows step with owned filesystem/process boundaries.
 * @param {object} overrides Boundary replacements for failure and dry-run cases.
 * @returns {object} Context exposing doWork and recorded deployment effects.
 */
function loadCleanup(overrides = {}) {
  const context = {
    path,
    Buffer,
    BUILD_DIR: "/build",
    POWERSHELL_SYLE_PATH: "/working/profile.ps1",
    IS_DRY_RUN: false,
    log: vi.fn(),
    readText: vi.fn(async (strings) =>
      strings[0] === "software/scripts/windows/windows-context-menu.ps1.bash" ? MENU_SOURCE : "# profile fixture\n",
    ),
    removeEmptyBlocks: (value) => value,
    cleanupExtraWhitespaces: (value) => value,
    pathExists: () => true,
    execBash: vi.fn(async () => "C:\\Users\\Test User\\Documents"),
    execBashSync: vi.fn(() => "Done"),
    mkdir: vi.fn(),
    writeBuildArtifact: vi.fn(),
    backupConfigFile: vi.fn(),
    writeText: vi.fn(),
    deleteFile: vi.fn(),
    ...overrides,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("software/scripts/windows/~cleanup.js", "utf8"), context);
  return context;
}

/** Decode the exact maintenance payload passed to inbox Windows PowerShell. @param {string} command Shell invocation. @returns {string} PowerShell source. */
function decodeMaintenance(command) {
  expect(command).toMatch(/^powershell\.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand [A-Za-z0-9+/=]+$/);
  return Buffer.from(command.match(/-EncodedCommand ([A-Za-z0-9+/=]+)$/)[1], "base64").toString("utf16le");
}

describe("final Windows Explorer maintenance deployment", () => {
  it("executes the exact shared maintenance source on each normal run without a Desktop dependency or elevation", async () => {
    const context = loadCleanup();
    await context.doWork();
    await context.doWork();
    expect(context.execBashSync.mock.calls).toHaveLength(2);
    expect(decodeMaintenance(context.execBashSync.mock.calls[0][0])).toBe(MENU_SOURCE);
    expect(decodeMaintenance(context.execBashSync.mock.calls[1][0])).toBe(MENU_SOURCE);
    expect(context.deleteFile.mock.calls).toEqual([["/working/profile.ps1"], ["/working/profile.ps1"]]);
  });

  it("does not execute or load menu maintenance during an offline dry-run", async () => {
    const context = loadCleanup({ IS_DRY_RUN: true });
    await context.doWork();
    expect(context.execBashSync.mock.calls).toEqual([]);
    expect(context.execBash.mock.calls).toEqual([]);
    expect(context.readText.mock.calls.map(([strings]) => strings[0])).toEqual(["/working/profile.ps1"]);
    expect(context.writeText.mock.calls).toEqual([]);
    expect(context.deleteFile.mock.calls).toEqual([]);
  });

  it("propagates maintenance failure and retains the working copy after profile deployment", async () => {
    const context = loadCleanup({
      execBashSync: vi.fn(() => {
        throw new Error("fixture maintenance failed");
      }),
    });
    await expect(context.doWork()).rejects.toThrow("fixture maintenance failed");
    expect(context.writeText.mock.calls.map(([file]) => file)).toEqual([
      "/mnt/c/Users/Test User/Documents/PowerShell/Microsoft.PowerShell_profile.ps1",
      "/mnt/c/Users/Test User/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1",
    ]);
    expect(context.deleteFile.mock.calls).toEqual([]);
  });
});
