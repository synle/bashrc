/** Windows Terminal generated settings regression tests. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { getIndexFunction, readSyThemeFixture } from "./setup.js";

/**
 * Execute the installer with owned IO boundaries and return serialized settings output.
 * @param {object} oldSettings Existing user settings.
 * @param {string[]} binaries Available executable names.
 * @param {string|null} executable Discovered Windows PowerShell executable path.
 * @param {boolean} windows Whether to exercise Windows deployment rather than portable CI output.
 * @returns {Promise<object>} Settings serialized by the real installer; no disk writes occur.
 */
async function generateSettings(oldSettings = {}, binaries = [], executable = null, windows = true) {
  let written;
  let artifact;
  const sandbox = {
    IS_CI: true,
    IS_DRY_RUN: false,
    fs: { statSync: () => ({ size: 1024 }) },
    pathExists: () => true,
    is_os_windows: windows,
    BUILD_DIR: ".build",
    EDITOR_CONFIGS: {},
    path,
    log: () => {},
    getTheme: () => ({ dark: "Campbell", light: "Campbell" }),
    json: getIndexFunction("json"),
    readSyTheme: readSyThemeFixture,
    readJson: async (strings) => (strings[0].includes("windows-terminal-keys") ? [] : structuredClone(oldSettings)),
    getWindowUserBaseDir: () => "/mnt/c/Users/test",
    findPathFromList: () => executable,
    findPath: () => "/mnt/c/Users/test/AppData/Local/Packages/Terminal",
    toWindowsPath: getIndexFunction("toWindowsPath"),
    downloadAsset: async () => {},
    hasBinary: (name) => binaries.includes(name),
    exitIfPathNotFound: () => {},
    backupConfigFile: async () => {},
    writeBuildArtifact: async ([entry]) => {
      artifact = JSON.parse(JSON.stringify(entry.data));
    },
    writeJson: async (_target, settings) => {
      written = JSON.parse(JSON.stringify(settings));
    },
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

describe("Windows Terminal generated settings", () => {
  it.each([
    {},
    { disabledProfileSources: [] },
    { disabledProfileSources: ["Windows.Terminal.Wsl", "Windows.Terminal.PowershellCore"] },
    { disabledProfileSources: ["Windows.Terminal.Azure", "Windows.Terminal.VisualStudio"] },
  ])("preserves disabled generator preferences %j while disabling paste warnings", async (oldSettings) => {
    const settings = await generateSettings({ ...oldSettings, "warning.multiLinePaste": "never" });
    expect(settings["warning.multiLinePaste"]).toBe(false);
    expect(settings.disabledProfileSources).toEqual(oldSettings.disabledProfileSources);
  });

  it.each([
    [["pwsh"], null, "pwsh"],
    [["pwsh.exe"], null, "pwsh.exe"],
    [[], "/mnt/c/Program Files/PowerShell/7/pwsh.exe", '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo'],
  ])("creates a separate v7 profile for binaries %j and normalizes the legacy executable", async (binaries, executable, commandline) => {
    const settings = await generateSettings(
      { profiles: { list: [{ name: "Windows PowerShell", guid: "ps", commandline: "pwsh" }] } },
      binaries,
      executable,
    );
    expect(settings.profiles.list).toHaveLength(2);
    expect(settings.profiles.list[0]).toEqual({
      name: "Powershell v7",
      guid: "{91c9f255-5190-4a5e-9ee5-d05d36dece87}",
      commandline,
      font: { weight: "semi-bold", cellHeight: "1.1" },
      showMarksOnScrollbar: true,
      suppressApplicationTitle: false,
      scrollbarState: "visible",
      adjustIndistinguishableColors: "always",
      colorScheme: { dark: "Sy Dark", light: "Sy Light" },
      startingDirectory: "%USERPROFILE%",
      icon: "C:\\Users\\test\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png",
      hidden: false,
      tabColor: "#000000",
    });
    expect(settings.profiles.list[1]).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "antialiasingMode": "cleartype",
        "bellStyle": "all",
        "colorScheme": {
          "dark": "Sy Dark",
          "light": "Sy Light",
        },
        "commandline": "powershell.exe",
        "cursorShape": "underscore",
        "font": {
          "cellHeight": "1.1",
          "size": null,
          "weight": "semi-bold",
        },
        "guid": "ps",
        "hidden": false,
        "intenseTextStyle": "bright",
        "name": "Powershell v5",
        "padding": "10, 8, 10, 8",
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "suppressApplicationTitle": false,
        "tabColor": "#012456",
      }
    `);
    expect(settings.defaultProfile).toBe("{91c9f255-5190-4a5e-9ee5-d05d36dece87}");
  });

  it("normalizes the legacy command while preserving explicit styling and inherited appearance", async () => {
    const oldSettings = {
      schemes: [
        { name: "Legacy blue", background: "#012456" },
        { name: "Prompt green", foreground: "#00ff00" },
      ],
      profiles: {
        defaults: { font: { face: "Custom Mono", size: 15 }, opacity: 73, colorScheme: "Legacy blue" },
        list: [
          {
            name: "Windows PowerShell",
            guid: "ps",
            commandline: "powershell.exe -NoLogo",
            background: "#012456",
            padding: "4",
            hidden: true,
          },
          { name: "Command Prompt", colorScheme: { dark: "Prompt green", light: "Campbell" } },
        ],
      },
    };
    const first = await generateSettings(oldSettings, ["pwsh"]);
    expect(first.profiles.list[1]).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "antialiasingMode": "cleartype",
        "bellStyle": "all",
        "colorScheme": {
          "dark": "Sy Dark",
          "light": "Sy Light",
        },
        "commandline": "powershell.exe",
        "cursorShape": "underscore",
        "font": {
          "cellHeight": "1.1",
          "face": "Custom Mono",
          "size": 15,
          "weight": "semi-bold",
        },
        "guid": "ps",
        "hidden": true,
        "intenseTextStyle": "bright",
        "name": "Powershell v5",
        "opacity": 73,
        "padding": "4",
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "suppressApplicationTitle": false,
        "tabColor": "#012456",
      }
    `);
    expect(first.profiles.list[1]).not.toHaveProperty("background");
    expect(first.profiles.list[0].colorScheme).toEqual({ dark: "Sy Dark", light: "Sy Light" });
    expect(first.schemes).toEqual(expect.arrayContaining(oldSettings.schemes));
    expect(await generateSettings(first, ["pwsh"])).toEqual(first);
    expect(oldSettings.profiles.list[0].name).toBe("Windows PowerShell");
  });

  it("keeps explicit legacy styling without pwsh and does not fabricate a v7 profile", async () => {
    const settings = await generateSettings({
      profiles: [{ name: "Windows PowerShell", guid: "ps", colorScheme: "Campbell", cursorShape: "bar" }],
    });
    expect(settings.profiles.list).toHaveLength(1);
    expect(settings.profiles.list[0]).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "antialiasingMode": "cleartype",
        "bellStyle": "all",
        "colorScheme": {
          "dark": "Sy Dark",
          "light": "Sy Light",
        },
        "commandline": "powershell.exe",
        "cursorShape": "bar",
        "font": {
          "cellHeight": "1.1",
          "size": null,
          "weight": "semi-bold",
        },
        "guid": "ps",
        "hidden": false,
        "intenseTextStyle": "bright",
        "name": "Powershell v5",
        "padding": "10, 8, 10, 8",
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "suppressApplicationTitle": false,
        "tabColor": "#012456",
      }
    `);
    expect(settings.profiles.list[0].commandline).toBe("powershell.exe");
    expect(settings.defaultProfile).toBe("ps");
  });

  it("updates a prior managed v7 profile without changing its explicit visibility or custom fields", async () => {
    const settings = await generateSettings(
      {
        profiles: {
          list: [
            {
              name: "PowerShell 7",
              guid: "{91c9f255-5190-4a5e-9ee5-d05d36dece87}",
              hidden: true,
              commandline: "pwsh.exe",
              tabTitle: "Mine",
              startingDirectory: "D:/",
            },
            { name: "Windows PowerShell", guid: "ps", hidden: false, colorScheme: "Campbell" },
          ],
        },
      },
      ["pwsh"],
    );
    expect(settings.profiles.list).toHaveLength(2);
    expect(settings.profiles.list[0]).toEqual({
      name: "Powershell v7",
      guid: "{91c9f255-5190-4a5e-9ee5-d05d36dece87}",
      hidden: true,
      commandline: "pwsh",
      tabTitle: "Mine",
      startingDirectory: "D:/",
      icon: "C:\\Users\\test\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png",
      colorScheme: { dark: "Sy Dark", light: "Sy Light" },
      tabColor: "#000000",
      font: { weight: "semi-bold", cellHeight: "1.1" },
      showMarksOnScrollbar: true,
      suppressApplicationTitle: false,
      scrollbarState: "visible",
      adjustIndistinguishableColors: "always",
    });
    expect(settings.defaultProfile).toBe("ps");
  });

  it("orders both shell versions before Azure and miscellaneous profiles", async () => {
    const settings = await generateSettings(
      {
        profiles: [
          { name: "Command Prompt", guid: "cmd" },
          { name: "Azure", source: "Windows.Terminal.Azure", guid: "az" },
          { name: "Windows PowerShell", guid: "ps" },
          { name: "Ubuntu", guid: "u" },
        ],
      },
      ["pwsh"],
    );
    expect(settings.profiles.list.map(({ name, hidden }) => [name, hidden])).toEqual([
      ["Ubuntu", false],
      ["Powershell v7", false],
      ["Powershell v5", false],
      ["Azure", false],
      ["Command Prompt", true],
    ]);
    expect(settings.defaultProfile).toBe("u");
  });

  it("selects the first visible WSL with a GUID and preserves all profiles", async () => {
    const settings = await generateSettings({
      profiles: {
        list: [
          { name: "Windows PowerShell", guid: "ps" },
          { name: "Ubuntu", guid: "hidden", hidden: true },
          { name: "Debian" },
          { name: "Kali", source: "Microsoft.WSL", guid: "kali" },
        ],
      },
    });
    expect(settings.defaultProfile).toBe("kali");
    expect(settings.profiles.list).toHaveLength(4);
  });

  it("falls back to another visible profile and preserves prior default if all hidden", async () => {
    expect((await generateSettings({ profiles: [{ name: "Custom", guid: "custom", hidden: false }] })).defaultProfile).toBe("custom");
    expect(
      (await generateSettings({ defaultProfile: "old", profiles: { list: [{ name: "Ubuntu", guid: "u", hidden: true }] } })).defaultProfile,
    ).toBe("old");
  });

  it("emits portable artifacts without host-specific profiles and remains idempotent", async () => {
    const artifact = await generateSettings({}, [], null, false);
    expect(artifact.profiles.list).toEqual([]);
    expect(artifact).not.toHaveProperty("disabledProfileSources");
    expect(artifact["warning.multiLinePaste"]).toBe(false);
    const first = await generateSettings({ profiles: { list: [{ name: "Windows PowerShell", guid: "ps" }] } }, ["pwsh"]);
    expect(await generateSettings(first, ["pwsh"])).toEqual(first);
  });
  it("shares content colors across every profile while preserving distinct tab and title-bar controls", async () => {
    const input = {
      theme: "dark",
      themes: [{ name: "saved-ui" }],
      profiles: {
        defaults: { background: "#222222", tabColor: "#aabbcc" },
        list: [
          {
            name: "Ubuntu",
            guid: "u",
            tabColor: "#112233",
            tabTitle: "Linux",
            background: "#123456",
            foreground: "#654321",
            cursorColor: "#abcdef",
            selectionBackground: "#fedcba",
            unfocusedAppearance: { colorScheme: "old", background: "#333333", foreground: "#444444", opacity: 60 },
          },
          { name: "Powershell v7", guid: "{91c9f255-5190-4a5e-9ee5-d05d36dece87}", tabColor: "#223344" },
          { name: "Windows PowerShell", guid: "ps", tabColor: "#334455" },
          { name: "Azure", source: "Windows.Terminal.Azure", guid: "az", tabColor: "#445566" },
          { name: "Command Prompt", guid: "cmd", tabColor: "#556677", colorScheme: "Campbell" },
          { name: "Custom", guid: "custom", tabColor: null, colorScheme: "foreign" },
        ],
      },
    };
    const result = await generateSettings(input, ["pwsh"]);
    for (const profile of result.profiles.list) {
      expect(profile.colorScheme).toEqual({ dark: "Sy Dark", light: "Sy Light" });
      expect(profile).not.toHaveProperty("background");
      expect(profile).not.toHaveProperty("foreground");
      expect(profile).not.toHaveProperty("cursorColor");
      expect(profile).not.toHaveProperty("selectionBackground");
    }
    expect(result.profiles.list.map((profile) => profile.tabColor)).toEqual(["#112233", "#223344", "#334455", "#445566", "#556677", null]);
    expect(result.profiles.list[0]).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "colorScheme": {
          "dark": "Sy Dark",
          "light": "Sy Light",
        },
        "font": {
          "cellHeight": "1.1",
          "weight": "semi-bold",
        },
        "guid": "u",
        "hidden": false,
        "name": "Ubuntu",
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "suppressApplicationTitle": false,
        "tabColor": "#112233",
        "tabTitle": "Linux",
        "unfocusedAppearance": {
          "colorScheme": {
            "dark": "Sy Dark",
            "light": "Sy Light",
          },
          "opacity": 60,
        },
      }
    `);
    expect(result.profiles.list[0].unfocusedAppearance).not.toHaveProperty("background");
    expect(result.profiles.list[0].unfocusedAppearance).not.toHaveProperty("foreground");
    expect(result.theme).toBe("dark");
    expect(result.profiles.defaults.tabColor).toBe("#aabbcc");
    expect(result.themes).toEqual([{ name: "saved-ui" }]);
    expect(input.profiles.list[0].background).toBe("#123456");
    expect(await generateSettings(result, ["pwsh"])).toEqual(result);
  });
});
