/** Windows Terminal generated settings and profile policy regression tests. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

loadScriptHelpers("software/scripts/windows-terminal.js");
const prioritizeProfiles = getIndexFunction("_prioritizeWindowsTerminalProfiles");

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
    is_os_windows: windows,
    BUILD_DIR: ".build",
    EDITOR_CONFIGS: {},
    path,
    log: () => {},
    getTheme: () => ({ dark: "Campbell", light: "Campbell" }),
    json: getIndexFunction("json"),
    readJson: async (strings) => (strings[0].includes("windows-terminal-keys") ? [] : structuredClone(oldSettings)),
    getWindowUserBaseDir: () => "/mnt/c/Users/test",
    findPathFromList: () => executable,
    findPath: () => "/mnt/c/Users/test/AppData/Local/Packages/Terminal",
    toWindowsPath: () => "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
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

describe("Windows Terminal profile policy", () => {
  it("orders WSL, Windows PowerShell, Azure, then other profiles with missing visibility defaults", () => {
    expect(
      prioritizeProfiles([
        { name: "Azure", source: "Windows.Terminal.Azure" },
        { name: "Developer PowerShell for VS 2022", source: "Windows.Terminal.VisualStudio" },
        { name: "Windows PowerShell" },
        { name: "Command Prompt" },
        { name: "Kali", source: "Microsoft.WSL" },
        { name: "Ubuntu" },
      ]).map(({ name, hidden }) => [name, hidden]),
    ).toEqual([
      ["Ubuntu", false],
      ["Kali", false],
      ["Windows PowerShell", false],
      ["Azure", false],
      ["Developer PowerShell for VS 2022", true],
      ["Command Prompt", true],
    ]);
  });

  it("preserves explicit true and false visibility for every profile category", () => {
    expect(
      prioritizeProfiles([
        { name: "Kali", source: "Microsoft.WSL", hidden: true },
        { name: "Windows PowerShell", hidden: true },
        { name: "Command Prompt", hidden: false },
        { name: "Azure", source: "Windows.Terminal.Azure", hidden: true },
      ]).map(({ hidden }) => hidden),
    ).toEqual([true, true, true, false]);
  });

  it("hides miscellaneous profiles without WSL while retaining Command Prompt's scheme", () => {
    expect(
      prioritizeProfiles([
        { name: "Custom", colorScheme: "old" },
        { name: "Command Prompt", colorScheme: "Campbell" },
      ]),
    ).toEqual([
      { name: "Custom", hidden: true },
      { name: "Command Prompt", colorScheme: "Campbell", hidden: true },
    ]);
  });

  it("handles empty lists and normalizes non-boolean hidden values without mutating input", () => {
    const input = [
      { name: "Windows PowerShell", hidden: null },
      { name: "Custom", hidden: "false" },
    ];
    expect(prioritizeProfiles(input)).toEqual([
      { name: "Windows PowerShell", hidden: false },
      { name: "Custom", hidden: true },
    ]);
    expect(input).toEqual([
      { name: "Windows PowerShell", hidden: null },
      { name: "Custom", hidden: "false" },
    ]);
    expect(prioritizeProfiles([])).toEqual([]);
  });
});

describe("Windows Terminal generated settings", () => {
  it("replaces the string paste warning with false and removes disabled generators", async () => {
    const settings = await generateSettings({
      "warning.multiLinePaste": "never",
      disabledProfileSources: [
        "Windows.Terminal.Wsl",
        "Windows.Terminal.VisualStudio",
        "Windows.Terminal.PowershellCore",
        "Windows.Terminal.Azure",
      ],
    });
    expect(settings["warning.multiLinePaste"]).toBe(false);
    expect(settings).not.toHaveProperty("disabledProfileSources");
  });

  it.each([
    [["pwsh"], null, "pwsh"],
    [["pwsh.exe"], null, "pwsh.exe"],
    [[], "/mnt/c/Program Files/PowerShell/7/pwsh.exe", '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo'],
  ])("creates a separate v7 profile for binaries %j without changing the legacy command", async (binaries, executable, commandline) => {
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
      colorScheme: "Campbell",
      startingDirectory: "%USERPROFILE%",
      hidden: false,
    });
    expect(settings.profiles.list[1]).toMatchObject({ name: "Powershell v5", guid: "ps", commandline: "pwsh", hidden: false });
    expect(settings.defaultProfile).toBe("{91c9f255-5190-4a5e-9ee5-d05d36dece87}");
  });

  it("preserves legacy command, explicit styling, and inherited appearance", async () => {
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
    expect(first.profiles.list[1]).toMatchObject({
      name: "Powershell v5",
      guid: "ps",
      commandline: "powershell.exe -NoLogo",
      background: "#012456",
      padding: "4",
      hidden: true,
      font: { face: "Custom Mono", size: 15 },
      opacity: 73,
      colorScheme: "Legacy blue",
    });
    expect(first.profiles.list[0].colorScheme).toEqual({ dark: "Prompt green", light: "Campbell" });
    expect(first.schemes).toEqual(expect.arrayContaining(oldSettings.schemes));
    expect(await generateSettings(first, ["pwsh"])).toEqual(first);
    expect(oldSettings.profiles.list[0].name).toBe("Windows PowerShell");
  });

  it("keeps explicit legacy styling without pwsh and does not fabricate a v7 profile", async () => {
    const settings = await generateSettings({
      profiles: [{ name: "Windows PowerShell", guid: "ps", colorScheme: "Campbell", cursorShape: "bar" }],
    });
    expect(settings.profiles.list).toHaveLength(1);
    expect(settings.profiles.list[0]).toMatchObject({
      name: "Powershell v5",
      guid: "ps",
      colorScheme: "Campbell",
      cursorShape: "bar",
      hidden: false,
    });
    expect(settings.profiles.list[0]).not.toHaveProperty("commandline");
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
      colorScheme: "Campbell",
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
    expect(artifact["warning.multiLinePaste"]).toBe(false);
    const first = await generateSettings({ profiles: { list: [{ name: "Windows PowerShell", guid: "ps" }] } }, ["pwsh"]);
    expect(await generateSettings(first, ["pwsh"])).toEqual(first);
  });
});
