/** Windows Terminal appearance output and saved-settings upgrade regressions. */
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { getIndexFunction } from "./setup.js";

/**
 * Generate serialized Terminal settings through the real installer with isolated IO.
 * @param {object} oldSettings Existing user settings; left unchanged.
 * @param {boolean} windows Whether to return Windows deployment instead of portable CI output.
 * @param {object} overrides Owned IO boundaries to replace for download and failure scenarios.
 * @returns {Promise<object>} Serialized installer output without filesystem writes.
 */
async function generateAppearance(oldSettings = {}, windows = true, overrides = {}) {
  let written;
  let artifact;
  const sandbox = {
    IS_CI: true,
    IS_DRY_RUN: false,
    fs: { statSync: () => ({ size: 1024 }) },
    pathExists: () => true,
    is_os_windows: windows,
    BUILD_DIR: ".build",
    EDITOR_CONFIGS: { fontFamily: "Fixture Mono", fontSize: 16, fontWeightKeyword: "normal", terminalScrollback: 5000 },
    path,
    log: () => {},
    getTheme: () => ({ dark: "Campbell", light: "Campbell" }),
    json: getIndexFunction("json"),
    readJson: async (strings) => (strings[0].includes("windows-terminal-keys") ? [] : structuredClone(oldSettings)),
    getWindowUserBaseDir: () => "/mnt/c/Users/Test User",
    findPathFromList: () => null,
    findPath: () => "/mnt/c/Users/Test User/AppData/Local/Packages/Terminal",
    hasBinary: (name) => name === "pwsh.exe",
    toWindowsPath: getIndexFunction("toWindowsPath"),
    downloadAsset: async () => {},
    exitIfPathNotFound: () => {},
    backupConfigFile: async () => {},
    writeBuildArtifact: async ([entry]) => {
      artifact = JSON.parse(JSON.stringify(entry.data));
    },
    writeJson: async (_target, settings) => {
      written = JSON.parse(JSON.stringify(settings));
    },
    ...overrides,
  };
  let source = fs.readFileSync("software/scripts/windows-terminal.js", "utf8");
  if (process.env.BASHRC_TEST_COVERAGE === "1") {
    const { createInstrumenter } = createRequire(import.meta.url)("istanbul-lib-instrument");
    source = createInstrumenter({ coverageVariable: "__VITEST_COVERAGE__", coverageGlobalScope: "globalThis" }).instrumentSync(
      source,
      path.resolve("software/scripts/windows-terminal.js"),
    );
    sandbox.__VITEST_COVERAGE__ = globalThis.__VITEST_COVERAGE__;
  }
  vm.runInNewContext(source, sandbox);
  await sandbox.doWork();
  return windows ? written : artifact;
}

describe("Windows Terminal modern appearance", () => {
  it.each([true, false])("emits current cursor and font defaults for Windows=%s", async (windows) => {
    const settings = await generateAppearance({}, windows);
    expect(settings.profiles.defaults).toMatchObject({
      cursorShape: "underscore",
      font: { face: "Fixture Mono", size: 12, weight: "semi-bold", cellHeight: "1.1" },
      showMarksOnScrollbar: true,
      suppressApplicationTitle: false,
      scrollbarState: "visible",
      adjustIndistinguishableColors: "always",
    });
    expect(settings.profiles.defaults).not.toHaveProperty("icon");
    expect(settings.profiles.defaults).not.toHaveProperty("cursorHeight");
    expect(settings.profiles.defaults).not.toHaveProperty("fontFace");
    expect(settings.profiles.defaults).not.toHaveProperty("fontSize");
    expect(settings.profiles.defaults).not.toHaveProperty("fontWeight");
    expect(settings).not.toHaveProperty("experimental.rendering.forceFullRepaint");
  });

  it.each([
    [{ name: "Ubuntu-24.04", elevate: false }, true],
    [{ name: "debian" }, true],
    [{ name: "Kali", source: "Microsoft.WSL", elevate: false }, false],
    [{ name: "Windows PowerShell" }, undefined],
    [{ name: "Custom", elevate: true }, true],
    [{}, undefined],
  ])("repairs numeric cellHeight to a string while enforcing appearance and selective elevation for %j", async (profile, elevate) => {
    const oldProfile = {
      ...profile,
      guid: "fixture",
      showMarksOnScrollbar: false,
      suppressApplicationTitle: true,
      scrollbarState: "hidden",
      adjustIndistinguishableColors: "never",
      font: { face: "Custom Mono", size: 18, weight: "light", cellHeight: 1.1 },
    };
    const first = await generateAppearance({ profiles: { defaults: oldProfile, list: [oldProfile] } });
    const savedProfile = first.profiles.list.find(({ guid }) => guid === "fixture");
    expect(savedProfile.elevate).toBe(elevate);
    expect(savedProfile).toMatchObject({
      showMarksOnScrollbar: true,
      suppressApplicationTitle: false,
      scrollbarState: "visible",
      adjustIndistinguishableColors: "always",
      font: { face: "Custom Mono", size: 18, weight: "semi-bold", cellHeight: "1.1" },
    });
    expect(first.profiles.defaults.font.cellHeight).toBe("1.1");
    expect(first.profiles.defaults).not.toHaveProperty("elevate");
    expect(await generateAppearance(first)).toEqual(first);
    expect(oldProfile.font.weight).toBe("light");
    expect(oldProfile.font.cellHeight).toBe(1.1);
  });

  it.each(["default.ico", null, ""])("preserves the saved default icon %j without adding explicit WSL overrides", async (icon) => {
    const settings = await generateAppearance({ profiles: { defaults: { icon }, list: [{ name: "Ubuntu", guid: "u" }] } });
    expect(settings.profiles.defaults.icon).toBe(icon);
    expect(settings.profiles.list.find(({ guid }) => guid === "u")).not.toHaveProperty("icon");
    expect(await generateAppearance(settings)).toEqual(settings);
  });

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

  it("removes a previously saved forced repaint setting without dropping unrelated settings", async () => {
    const settings = await generateAppearance({ "experimental.rendering.forceFullRepaint": true, customSetting: "keep" });
    expect(settings).not.toHaveProperty("experimental.rendering.forceFullRepaint");
    expect(settings.customSetting).toBe("keep");
  });

  it("colors only shell tabs and preserves profile icons and terminal backgrounds", async () => {
    const settings = await generateAppearance({
      profiles: {
        list: [
          { name: "Ubuntu", guid: "u", icon: "ubuntu.ico", background: "#112233", tabColor: "#ffffff" },
          { name: "Debian", guid: "d", source: "Windows.Terminal.Wsl", icon: "debian.ico" },
          { name: "Kali", guid: "k", source: "Microsoft.WSL" },
          { name: "Windows PowerShell", guid: "ps", icon: "powershell.ico", background: "#012456" },
          { name: "Custom", guid: "custom", hidden: false, icon: "custom.ico", tabColor: "#123456" },
        ],
      },
    });
    expect(settings.profiles.list.map(({ name, icon, tabColor, background }) => ({ name, icon, tabColor, background }))).toEqual([
      { name: "Ubuntu", icon: "ubuntu.ico", tabColor: "#e95420", background: "#112233" },
      { name: "Debian", icon: "debian.ico", tabColor: "#e95420", background: undefined },
      { name: "Kali", icon: undefined, tabColor: "#e95420", background: undefined },
      {
        name: "Powershell v7",
        icon: "C:\\Users\\Test User\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png",
        tabColor: "#000000",
        background: undefined,
      },
      { name: "Powershell v5", icon: "powershell.ico", tabColor: "#012456", background: "#012456" },
      { name: "Custom", icon: "custom.ico", tabColor: "#123456", background: undefined },
    ]);
    expect(settings.defaultProfile).toBe("u");
  });

  it("updates existing managed shell tabs and preserves hidden values on repeat deployment", async () => {
    const oldSettings = {
      profiles: {
        list: [
          { name: "PowerShell 7", guid: "{91c9f255-5190-4a5e-9ee5-d05d36dece87}", tabColor: "#ffffff", icon: "old.ico", hidden: true },
          { name: "Powershell v5", guid: "ps", hidden: false },
        ],
      },
    };
    const first = await generateAppearance(oldSettings);
    expect(first.profiles.list.map(({ name, icon, tabColor, hidden }) => ({ name, icon, tabColor, hidden }))).toEqual([
      {
        name: "Powershell v7",
        icon: "C:\\Users\\Test User\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png",
        tabColor: "#000000",
        hidden: true,
      },
      { name: "Powershell v5", icon: undefined, tabColor: "#012456", hidden: false },
    ]);
    expect(await generateAppearance(first)).toEqual(first);
    expect(oldSettings.profiles.list[0].icon).toBe("old.ico");
  });

  it("migrates frozen legacy default fonts without losing nested custom font settings", async () => {
    const settings = await generateAppearance({
      profiles: {
        defaults: { fontFace: "Old Mono", fontSize: 15, fontWeight: "bold", font: { features: { liga: 0 } }, cursorHeight: 50 },
        list: [{ name: "Windows PowerShell", guid: "ps", font: { size: 17, axes: { wght: 600 } } }],
      },
    });
    const legacy = settings.profiles.list.find(({ guid }) => guid === "ps");
    expect(legacy.font).toEqual({
      face: "Old Mono",
      size: 17,
      weight: "semi-bold",
      cellHeight: "1.1",
      features: { liga: 0 },
      axes: { wght: 600 },
    });
    expect(legacy).not.toHaveProperty("fontFace");
    expect(legacy).not.toHaveProperty("fontSize");
    expect(legacy).not.toHaveProperty("fontWeight");
    expect(legacy).not.toHaveProperty("cursorHeight");
  });

  it.each([
    [{}, { weight: "semi-bold", cellHeight: "1.1" }],
    [{ fontFace: "Custom Mono" }, { face: "Custom Mono", weight: "semi-bold", cellHeight: "1.1" }],
    [{ fontSize: 18 }, { size: 18, weight: "semi-bold", cellHeight: "1.1" }],
    [{ fontWeight: 700 }, { weight: "semi-bold", cellHeight: "1.1" }],
    [
      { fontFace: "Old", fontSize: 19, fontWeight: "bold", font: { face: "Modern", size: 20, weight: 500, features: { liga: 0 } } },
      { face: "Modern", size: 20, weight: "semi-bold", cellHeight: "1.1", features: { liga: 0 } },
    ],
  ])("migrates only present per-profile legacy font fields: %j", async (fontSettings, expected) => {
    const settings = await generateAppearance({ profiles: [{ name: "Custom", guid: "custom", hidden: false, ...fontSettings }] });
    const profile = settings.profiles.list.find(({ guid }) => guid === "custom");
    expect(profile.font).toEqual(expected);
    expect(profile).not.toHaveProperty("fontFace");
    expect(profile).not.toHaveProperty("fontSize");
    expect(profile).not.toHaveProperty("fontWeight");
  });

  it("preserves height for explicit vintage cursors but removes it for underscore cursors", async () => {
    const settings = await generateAppearance({
      profiles: [
        { name: "Custom vintage", guid: "v", cursorShape: "vintage", cursorHeight: 35 },
        { name: "Custom underscore", guid: "u", cursorShape: "underscore", cursorHeight: 50 },
      ],
    });
    expect(settings.profiles.list.find(({ guid }) => guid === "v")).toMatchObject({ cursorShape: "vintage", cursorHeight: 35 });
    expect(settings.profiles.list.find(({ guid }) => guid === "u")).not.toHaveProperty("cursorHeight");
  });
});
