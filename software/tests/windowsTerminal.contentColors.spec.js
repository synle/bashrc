/** Shared terminal content colors preserve per-profile tab and title-bar identity. */
import { describe, expect, it } from "vitest";
import { generateSettings } from "./windowsTerminal.helpers.js";

describe("Windows Terminal shared content colors", () => {
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
