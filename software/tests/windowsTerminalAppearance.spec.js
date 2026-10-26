/** Windows Terminal appearance output and saved-settings upgrade regressions. */
import { describe, it, expect } from "vitest";
import { generateAppearance } from "./windowsTerminal.helpers.js";

describe("Windows Terminal modern appearance", () => {
  it.each([true, false])("emits current cursor and font defaults for Windows=%s", async (windows) => {
    const settings = await generateAppearance({}, windows);
    expect({
      cursorShape: settings.profiles.defaults.cursorShape,
      font: {
        face: settings.profiles.defaults.font.face,
        size: settings.profiles.defaults.font.size,
        weight: settings.profiles.defaults.font.weight,
        cellHeight: settings.profiles.defaults.font.cellHeight,
      },
      showMarksOnScrollbar: settings.profiles.defaults.showMarksOnScrollbar,
      suppressApplicationTitle: settings.profiles.defaults.suppressApplicationTitle,
      scrollbarState: settings.profiles.defaults.scrollbarState,
      adjustIndistinguishableColors: settings.profiles.defaults.adjustIndistinguishableColors,
    }).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "cursorShape": "underscore",
        "font": {
          "cellHeight": "1.1",
          "face": "Fixture Mono",
          "size": 12,
          "weight": "semi-bold",
        },
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "suppressApplicationTitle": false,
      }
    `);
    expect(settings.profiles.defaults).not.toHaveProperty("icon");
    expect(settings.profiles.defaults).not.toHaveProperty("cursorHeight");
    expect(settings.profiles.defaults).not.toHaveProperty("fontFace");
    expect(settings.profiles.defaults).not.toHaveProperty("fontSize");
    expect(settings.profiles.defaults).not.toHaveProperty("fontWeight");
    expect(settings).not.toHaveProperty("experimental.rendering.forceFullRepaint");
  });

  it.each([
    [{ name: "Ubuntu-24.04", elevate: false }, false],
    [{ name: "debian" }, undefined],
    [{ name: "Kali", source: "Microsoft.WSL", elevate: false }, false],
    [{ name: "Windows PowerShell" }, undefined],
    [{ name: "Custom", elevate: true }, true],
    [{}, undefined],
  ])("repairs numeric cellHeight while preserving saved elevation without forcing administrator mode for %j", async (profile, elevate) => {
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
    expect({
      showMarksOnScrollbar: savedProfile.showMarksOnScrollbar,
      suppressApplicationTitle: savedProfile.suppressApplicationTitle,
      scrollbarState: savedProfile.scrollbarState,
      adjustIndistinguishableColors: savedProfile.adjustIndistinguishableColors,
      font: {
        face: savedProfile.font.face,
        size: savedProfile.font.size,
        weight: savedProfile.font.weight,
        cellHeight: savedProfile.font.cellHeight,
      },
    }).toMatchInlineSnapshot(`
      {
        "adjustIndistinguishableColors": "always",
        "font": {
          "cellHeight": "1.1",
          "face": "Custom Mono",
          "size": 18,
          "weight": "semi-bold",
        },
        "scrollbarState": "visible",
        "showMarksOnScrollbar": true,
        "suppressApplicationTitle": false,
      }
    `);
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

  it("removes a previously saved forced repaint setting without dropping unrelated settings", async () => {
    const settings = await generateAppearance({ "experimental.rendering.forceFullRepaint": true, customSetting: "keep" });
    expect(settings).not.toHaveProperty("experimental.rendering.forceFullRepaint");
    expect(settings.customSetting).toBe("keep");
  });

  it("preserves saved tab colors and icons while unifying terminal content", async () => {
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
    expect(settings.profiles.list.map(({ name, icon, tabColor, background }) => ({ name, icon, tabColor, background })))
      .toMatchInlineSnapshot(`
      [
        {
          "background": undefined,
          "icon": "ubuntu.ico",
          "name": "Ubuntu",
          "tabColor": "#ffffff",
        },
        {
          "background": undefined,
          "icon": "debian.ico",
          "name": "Debian",
          "tabColor": "#e95420",
        },
        {
          "background": undefined,
          "icon": undefined,
          "name": "Kali",
          "tabColor": "#e95420",
        },
        {
          "background": undefined,
          "icon": "C:\\Users\\Test User\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png",
          "name": "Powershell v7",
          "tabColor": "#000000",
        },
        {
          "background": undefined,
          "icon": "powershell.ico",
          "name": "Powershell v5",
          "tabColor": "#012456",
        },
        {
          "background": undefined,
          "icon": "custom.ico",
          "name": "Custom",
          "tabColor": "#123456",
        },
      ]
    `);
    expect(settings.defaultProfile).toBe("u");
  });

  it("preserves existing managed tab colors and hidden values on repeat deployment", async () => {
    const oldSettings = {
      profiles: {
        list: [
          { name: "PowerShell 7", guid: "{91c9f255-5190-4a5e-9ee5-d05d36dece87}", tabColor: "#ffffff", icon: "old.ico", hidden: true },
          { name: "Powershell v5", guid: "ps", hidden: false },
        ],
      },
    };
    const first = await generateAppearance(oldSettings);
    expect(first.profiles.list.map(({ name, icon, tabColor, hidden }) => ({ name, icon, tabColor, hidden }))).toMatchInlineSnapshot(`
      [
        {
          "hidden": true,
          "icon": "C:\\Users\\Test User\\AppData\\Local\\Packages\\Terminal\\LocalState\\powershell7.png",
          "name": "Powershell v7",
          "tabColor": "#ffffff",
        },
        {
          "hidden": false,
          "icon": undefined,
          "name": "Powershell v5",
          "tabColor": "#012456",
        },
      ]
    `);
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
    expect(legacy.font).toMatchInlineSnapshot(`
      {
        "axes": {
          "wght": 600,
        },
        "cellHeight": "1.1",
        "face": "Old Mono",
        "features": {
          "liga": 0,
        },
        "size": 17,
        "weight": "semi-bold",
      }
    `);
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
    const vintageProfile = settings.profiles.list.find(({ guid }) => guid === "v");
    expect({ cursorShape: vintageProfile.cursorShape, cursorHeight: vintageProfile.cursorHeight }).toMatchInlineSnapshot(`
      {
        "cursorHeight": 35,
        "cursorShape": "vintage",
      }
    `);
    expect(settings.profiles.list.find(({ guid }) => guid === "u")).not.toHaveProperty("cursorHeight");
  });
});
