/** Windows Terminal generated settings regression tests. */
import { describe, it, expect } from "vitest";
import { generateSettings } from "./windowsTerminal.helpers.js";

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
    expect(settings.profiles.list[0]).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "colorScheme": {
          "dark": "Sy Dark",
          "light": "Sy Light",
        },
        "commandline": "pwsh",
        "font": {
          "cellHeight": "1.1",
          "weight": "semi-bold",
        },
        "guid": "{91c9f255-5190-4a5e-9ee5-d05d36dece87}",
        "hidden": true,
        "icon": "C:\\Users\\test\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png",
        "name": "Powershell v7",
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "startingDirectory": "D:/",
        "suppressApplicationTitle": false,
        "tabColor": "#000000",
        "tabTitle": "Mine",
      }
    `);
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
    expect(settings.profiles.list.map(({ name, hidden }) => [name, hidden])).toMatchInlineSnapshot(`
      [
        [
          "Ubuntu",
          false,
        ],
        [
          "Powershell v7",
          false,
        ],
        [
          "Powershell v5",
          false,
        ],
        [
          "Azure",
          false,
        ],
        [
          "Command Prompt",
          true,
        ],
      ]
    `);
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
});
