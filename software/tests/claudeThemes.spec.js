/** Verifies persisted Claude Sy adapters, appearance selection, opt-out, and repeat deployment. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import { fileSystem, getIndexConstant, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

/** @type {string} Isolated Claude configuration folder in the sandbox filesystem. */
const targetFolder = "/mock/home/.claude";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/claude/setup.js");
});

beforeEach(() => {
  setSandboxGlobal("is_gui", true);
  setSandboxGlobal("getRuntimeOption", () => false);
  fileSystem["theme/sy/claude_dark.jsonc"] = fs.readFileSync("theme/sy/claude_dark.jsonc", "utf-8");
  fileSystem["theme/sy/claude_light.jsonc"] = fs.readFileSync("theme/sy/claude_light.jsonc", "utf-8");
});

describe("Claude Sy themes", () => {
  it("deploys existing Sy JSONC colors and selects Sy Dark", async () => {
    await getIndexFunction("_doSettingsWork")(targetFolder);

    const dark = JSON.parse(fileSystem[`${targetFolder}/themes/sy-dark.json`]);
    const light = JSON.parse(fileSystem[`${targetFolder}/themes/sy-light.json`]);
    expect({ name: dark.name, base: dark.base, overrides: { claude: dark.overrides.claude, text: dark.overrides.text, error: dark.overrides.error, userMessageBackground: dark.overrides.userMessageBackground, selectionBg: dark.overrides.selectionBg } }).toMatchInlineSnapshot(`
      {
        "base": "dark",
        "name": "Sy Dark",
        "overrides": {
          "claude": "#5ca0d7",
          "error": "#f67070",
          "selectionBg": "#1b3c5e",
          "text": "#e8e8e8",
          "userMessageBackground": "#161616",
        },
      }
    `);
    expect({ name: light.name, base: light.base, overrides: { claude: light.overrides.claude, text: light.overrides.text, error: light.overrides.error, userMessageBackground: light.overrides.userMessageBackground, selectionBg: light.overrides.selectionBg } }).toMatchInlineSnapshot(`
      {
        "base": "light",
        "name": "Sy Light",
        "overrides": {
          "claude": "#0252ad",
          "error": "#840000",
          "selectionBg": "#96c6fa",
          "text": "#1e1e1e",
          "userMessageBackground": "#ececec",
        },
      }
    `);
    expect(JSON.parse(fileSystem[`${targetFolder}/settings.json`]).theme).toBe("custom:sy-dark");
  });

  it.each(["light", "light-ansi", "light-daltonized", "custom:sy-light", "custom:ayu-light", "custom:catppuccin-latte"])(
    "keeps light appearance from %s",
    async (theme) => {
      fileSystem[`${targetFolder}/settings.json`] = JSON.stringify({ theme, env: { USER_SETTING: "kept" } });

      await getIndexFunction("_doSettingsWork")(targetFolder);

      const deployedSettings = JSON.parse(fileSystem[`${targetFolder}/settings.json`]);
    expect({ theme: deployedSettings.theme, env: { USER_SETTING: deployedSettings.env.USER_SETTING } }).toMatchInlineSnapshot(`
      {
        "env": {
          "USER_SETTING": "kept",
        },
        "theme": "custom:sy-light",
      }
    `);
    },
  );

  it("switches a foreign dark theme to Sy Dark and stays byte-stable on rerun", async () => {
    fileSystem[`${targetFolder}/settings.json`] = JSON.stringify({ theme: "custom:foreign", model: "sonnet" });
    await getIndexFunction("_doSettingsWork")(targetFolder);
    const dark = fileSystem[`${targetFolder}/themes/sy-dark.json`];
    const light = fileSystem[`${targetFolder}/themes/sy-light.json`];
    const settings = fileSystem[`${targetFolder}/settings.json`];

    await getIndexFunction("_doSettingsWork")(targetFolder);

    expect(fileSystem[`${targetFolder}/themes/sy-dark.json`]).toBe(dark);
    expect(fileSystem[`${targetFolder}/themes/sy-light.json`]).toBe(light);
    expect(fileSystem[`${targetFolder}/settings.json`]).toBe(settings);
    const deployedSettings = JSON.parse(settings);
    expect({ theme: deployedSettings.theme, model: deployedSettings.model }).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "theme": "custom:sy-dark",
      }
    `);
  });

  it("selects Ayu defaults through the existing custom-theme opt-out", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    fileSystem[`${targetFolder}/settings.json`] = JSON.stringify({ theme: "custom:sy-light" });

    await getIndexFunction("_doSettingsWork")(targetFolder);

    const dark = JSON.parse(fileSystem[`${targetFolder}/themes/ayu-dark.json`]);
    expect({ name: dark.name, base: dark.base, overrides: { claude: dark.overrides.claude, text: dark.overrides.text, error: dark.overrides.error, userMessageBackground: dark.overrides.userMessageBackground } }).toMatchInlineSnapshot(`
      {
        "base": "dark",
        "name": "Ayu Dark",
        "overrides": {
          "claude": "#e6b450",
          "error": "#d95757",
          "text": "#bfbdb6",
          "userMessageBackground": "#141821",
        },
      }
    `);
    const light = JSON.parse(fileSystem[`${targetFolder}/themes/ayu-light.json`]);
    expect({ name: light.name, base: light.base, overrides: { claude: light.overrides.claude, text: light.overrides.text, error: light.overrides.error, userMessageBackground: light.overrides.userMessageBackground } }).toMatchInlineSnapshot(`
      {
        "base": "light",
        "name": "Ayu Light",
        "overrides": {
          "claude": "#f29718",
          "error": "#e65050",
          "text": "#5c6166",
          "userMessageBackground": "#f8f9fa",
        },
      }
    `);
    expect(JSON.parse(fileSystem[`${targetFolder}/settings.json`]).theme).toBe("custom:ayu-light");
    expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-dark.json`);
  });

  it("uses fallback selection IDs from the shared registry", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    const registry = getIndexConstant("APP_TO_THEMES_MAP");
    const original = registry.claude;
    registry.claude = ["custom:alternate-dark", "custom:alternate-light"];
    try {
      await getIndexFunction("_doSettingsWork")(targetFolder);
      expect(JSON.parse(fileSystem[`${targetFolder}/settings.json`]).theme).toBe("custom:alternate-dark");
      expect(JSON.parse(fileSystem[`${targetFolder}/themes/alternate-dark.json`]).name).toBe("Ayu Dark");
      expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-dark.json`);
    } finally {
      registry.claude = original;
    }
  });

  it.each([
    ["missing", "{}", /Invalid Sy claude\/light source/],
    ["null", "null", /Invalid Sy claude\/light source/],
    ["array", "[]", /Invalid Sy claude\/light source/],
    ["incomplete", '{"name":"Sy Light","foreground":"#1e1e1e"}', /Invalid Claude light native theme/],
    ["malformed", "{broken", /Invalid Sy claude\/light source/],
  ])("rejects %s light source before writing either theme or settings", async (_kind, source, error) => {
    fileSystem["theme/sy/claude_light.jsonc"] = source;
    const existing = JSON.stringify({ theme: "light" });
    fileSystem[`${targetFolder}/settings.json`] = existing;

    await expect(getIndexFunction("_doSettingsWork")(targetFolder)).rejects.toThrow(error);

    expect(fileSystem[`${targetFolder}/settings.json`]).toBe(existing);
    expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-dark.json`);
    expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-light.json`);
  });

  it("keeps existing Sy files but selects Ayu when opted out", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    fileSystem[`${targetFolder}/themes/sy-light.json`] = "existing adapter";
    fileSystem[`${targetFolder}/settings.json`] = JSON.stringify({ theme: "custom:sy-light" });

    await getIndexFunction("_doSettingsWork")(targetFolder);

    expect(JSON.parse(fileSystem[`${targetFolder}/settings.json`]).theme).toBe("custom:ayu-light");
    expect(fileSystem[`${targetFolder}/themes/sy-light.json`]).toBe("existing adapter");
    expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-dark.json`);
  });

  it("deploys native Sy themes for a headless terminal interface", async () => {
    setSandboxGlobal("is_gui", false);
    await getIndexFunction("_doSettingsWork")(targetFolder);
    expect(JSON.parse(fileSystem[`${targetFolder}/settings.json`]).theme).toBe("custom:sy-dark");
    expect(JSON.parse(fileSystem[`${targetFolder}/themes/sy-dark.json`]).overrides.text).toBe("#e8e8e8");
    expect(JSON.parse(fileSystem[`${targetFolder}/themes/sy-light.json`]).base).toBe("light");
  });

  it("keeps native selection without Sy writes on an opted-out headless host", async () => {
    setSandboxGlobal("is_gui", false);
    setSandboxGlobal("getRuntimeOption", () => true);
    await getIndexFunction("_doSettingsWork")(targetFolder);
    expect(JSON.parse(fileSystem[`${targetFolder}/settings.json`]).theme).toBe("dark");
    expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-dark.json`);
    expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-light.json`);
  });

  it("leaves theme selection unchanged when adapter deployment fails", async () => {
    const writeJson = getIndexFunction("writeJson");
    const existing = JSON.stringify({ theme: "light", model: "sonnet" });
    fileSystem[`${targetFolder}/settings.json`] = existing;
    setSandboxGlobal("writeJson", async () => {
      throw new Error("Theme write denied");
    });
    try {
      await expect(getIndexFunction("_doSettingsWork")(targetFolder)).rejects.toThrow("Theme write denied");
      expect(fileSystem[`${targetFolder}/settings.json`]).toBe(existing);
      expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-dark.json`);
      expect(fileSystem).not.toHaveProperty(`${targetFolder}/themes/sy-light.json`);
    } finally {
      setSandboxGlobal("writeJson", writeJson);
    }
  });
});
