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
    expect(dark).toMatchObject({
      name: "Sy Dark",
      base: "dark",
      overrides: { claude: "#5ca0d7", text: "#e8e8e8", error: "#f67070", userMessageBackground: "#161616", selectionBg: "#1b3c5e" },
    });
    expect(light).toMatchObject({
      name: "Sy Light",
      base: "light",
      overrides: { claude: "#0252ad", text: "#1e1e1e", error: "#840000", userMessageBackground: "#ececec", selectionBg: "#96c6fa" },
    });
    expect(JSON.parse(fileSystem[`${targetFolder}/settings.json`]).theme).toBe("custom:sy-dark");
  });

  it.each(["light", "light-ansi", "light-daltonized", "custom:sy-light", "custom:ayu-light", "custom:catppuccin-latte"])(
    "keeps light appearance from %s",
    async (theme) => {
      fileSystem[`${targetFolder}/settings.json`] = JSON.stringify({ theme, env: { USER_SETTING: "kept" } });

      await getIndexFunction("_doSettingsWork")(targetFolder);

      expect(JSON.parse(fileSystem[`${targetFolder}/settings.json`])).toMatchObject({
        theme: "custom:sy-light",
        env: { USER_SETTING: "kept" },
      });
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
    expect(JSON.parse(settings)).toMatchObject({ theme: "custom:sy-dark", model: "sonnet" });
  });

  it("selects Ayu defaults through the existing custom-theme opt-out", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    fileSystem[`${targetFolder}/settings.json`] = JSON.stringify({ theme: "custom:sy-light" });

    await getIndexFunction("_doSettingsWork")(targetFolder);

    expect(JSON.parse(fileSystem[`${targetFolder}/themes/ayu-dark.json`])).toMatchObject({
      name: "Ayu Dark",
      base: "dark",
      overrides: { claude: "#e6b450", text: "#bfbdb6", error: "#d95757", userMessageBackground: "#141821" },
    });
    expect(JSON.parse(fileSystem[`${targetFolder}/themes/ayu-light.json`])).toMatchObject({
      name: "Ayu Light",
      base: "light",
      overrides: { claude: "#f29718", text: "#5c6166", error: "#e65050", userMessageBackground: "#f8f9fa" },
    });
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
