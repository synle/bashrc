/** Managed PowerShell icons preserve offline behavior and reject failed downloads atomically. */
import { describe, expect, it, vi } from "vitest";
import { generateAppearance } from "./windowsTerminal.helpers.js";

describe("Windows Terminal managed PowerShell icons", () => {
  it("deploys the official black PowerShell icon locally for the managed v7 profile only", async () => {
    const downloadAsset = vi.fn(async () => {});
    const settings = await generateAppearance({}, true, { downloadAsset });
    expect(downloadAsset).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/PowerShell/PowerShell/master/assets/Powershell_black_64.png",
      "/mnt/c/Users/Test User/AppData/Local/Packages/Terminal/LocalState/powershell7.png",
    );
    expect(settings.profiles.list[0].icon).toBe("C:\\Users\\Test User\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png");
    expect(settings.profiles.defaults).not.toHaveProperty("icon");
  });

  it("keeps portable artifacts independent of host-specific icon downloads", async () => {
    const downloadAsset = vi.fn();
    const settings = await generateAppearance({}, false, { downloadAsset });
    expect(downloadAsset).not.toHaveBeenCalled();
    expect(settings.profiles.list).toEqual([]);
  });

  it("does not download a managed icon when PowerShell 7 is absent", async () => {
    const downloadAsset = vi.fn();
    const settings = await generateAppearance({}, true, { hasBinary: () => false, downloadAsset });
    expect(downloadAsset).not.toHaveBeenCalled();
    expect(settings.profiles.list).toEqual([]);
  });

  it("leaves saved settings and backups untouched when the icon download fails", async () => {
    const writeJson = vi.fn();
    const backupConfigFile = vi.fn();
    await expect(
      generateAppearance({}, true, {
        downloadAsset: async () => {
          throw new Error("fixture download failure");
        },
        writeJson,
        backupConfigFile,
      }),
    ).rejects.toThrow("fixture download failure");
    expect(writeJson).not.toHaveBeenCalled();
    expect(backupConfigFile).not.toHaveBeenCalled();
  });

  it.each([false, true])("rejects an unavailable icon with exists=%s even when the download resolves", async (exists) => {
    const writeJson = vi.fn();
    const backupConfigFile = vi.fn();
    await expect(
      generateAppearance({}, true, {
        pathExists: () => exists,
        fs: { statSync: () => ({ size: 0 }) },
        writeJson,
        backupConfigFile,
      }),
    ).rejects.toThrow("PowerShell 7 icon download did not produce a non-empty file");
    expect(writeJson).not.toHaveBeenCalled();
    expect(backupConfigFile).not.toHaveBeenCalled();
  });

  it("allows an offline dry-run without downloading a physical icon", async () => {
    const settings = await generateAppearance({}, true, { IS_DRY_RUN: true, pathExists: () => false });
    expect(settings.profiles.list[0].icon).toBe("C:\\Users\\Test User\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png");
  });
});
