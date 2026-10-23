/** Exercises persisted CLI theme outputs, selection preservation, opt-out, and rejection without user-home IO. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/pi/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/gemini/setup.js");
});
beforeEach(() => {
  setSandboxGlobal("is_gui", false);
  setSandboxGlobal("getRuntimeOption", () => false);
});

const piHome = "/mock/home/.pi/agent";
const ocHome = "/mock/home";
const geminiHome = "/mock/home/.gemini";

describe("Pi native theme deployment", () => {
  it("writes both appearances and a light-first automatic selection on headless hosts", async () => {
    await getIndexFunction("_doPiSettingsWork")(piHome);
    expect(JSON.parse(fileSystem[`${piHome}/settings.json`]).theme).toBe("Sy Light/Sy Dark");
    expect(JSON.parse(fileSystem[`${piHome}/themes/Sy Dark.json`])).toMatchObject({
      name: "Sy Dark",
      appearance: "dark",
      colors: { text: "#e8e8e8" },
    });
    expect(JSON.parse(fileSystem[`${piHome}/themes/Sy Light.json`])).toMatchObject({
      name: "Sy Light",
      appearance: "light",
      colors: { text: "#1e1e1e" },
    });
  });
  it("preserves explicit foreign selections and unrelated preferences", async () => {
    fileSystem[`${piHome}/settings.json`] = JSON.stringify({ theme: "foreign", customPreference: 0 });
    await getIndexFunction("_doPiSettingsWork")(piHome);
    expect(JSON.parse(fileSystem[`${piHome}/settings.json`])).toMatchObject({ theme: "foreign", customPreference: 0 });
  });
  it("stays byte-stable on repeat deployment", async () => {
    await getIndexFunction("_doPiSettingsWork")(piHome);
    const first = fileSystem[`${piHome}/themes/Sy Dark.json`];
    const settings = fileSystem[`${piHome}/settings.json`];
    await getIndexFunction("_doPiSettingsWork")(piHome);
    expect(fileSystem[`${piHome}/themes/Sy Dark.json`]).toBe(first);
    expect(fileSystem[`${piHome}/settings.json`]).toBe(settings);
  });
  it("deselects owned themes without writing theme files when opted out", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    expect(await getIndexFunction("_doPiThemeWork")(piHome, "Sy Light/Sy Dark")).toBe("system");
    expect(Object.keys(fileSystem)).toEqual([]);
  });
  it.each(["../escape", "system", "Sy/Light"])("rejects unsafe/reserved native name %s before changing settings", async (name) => {
    fileSystem["theme/sy/pi_light.jsonc"] = JSON.stringify({ name, appearance: "light", colors: { text: "#1e1e1e" } });
    const settings = JSON.stringify({ theme: "light" });
    fileSystem[`${piHome}/settings.json`] = settings;
    await expect(getIndexFunction("_doPiSettingsWork")(piHome)).rejects.toThrow("Invalid Pi light theme");
    expect(fileSystem[`${piHome}/settings.json`]).toBe(settings);
    expect(fileSystem).not.toHaveProperty(`${piHome}/themes/Sy Dark.json`);
    expect(fileSystem).not.toHaveProperty(`${piHome}/settings.json.bak_original`);
  });
  it("rejects an invalid explicit selection without writes", async () => {
    await expect(getIndexFunction("_doPiThemeWork")(piHome, false)).rejects.toThrow("Invalid Pi theme selection");
    expect(Object.keys(fileSystem)).toEqual([]);
  });
});

describe("OpenCode paired native themes", () => {
  it("persists a complete paired theme and selects its filename ID", async () => {
    await getIndexFunction("_writeOpencodeTuiConfig")(ocHome, false);
    const theme = JSON.parse(fileSystem[`${ocHome}/.config/opencode/themes/sy.json`]);
    expect(theme.theme.text).toEqual({ dark: "#e8e8e8", light: "#1e1e1e" });
    expect(Object.keys(theme.theme)).toHaveLength(50);
    expect(JSON.parse(fileSystem[`${ocHome}/.config/opencode/tui.json`]).theme).toBe("sy");
  });
  it("preserves a foreign ID and unrelated TUI configuration", async () => {
    fileSystem[`${ocHome}/.config/opencode/tui.json`] = JSON.stringify({ theme: "foreign", userPreference: false });
    await getIndexFunction("_writeOpencodeTuiConfig")(ocHome, false);
    expect(JSON.parse(fileSystem[`${ocHome}/.config/opencode/tui.json`])).toMatchObject({ theme: "foreign", userPreference: false });
  });
  it("selects the native fallback without creating a theme when opted out", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    expect(await getIndexFunction("_doOpencodeThemeWork")(ocHome, "sy")).toBe("opencode");
    expect(Object.keys(fileSystem)).toEqual([]);
  });
  it("rejects mismatched appearances before writing the theme or TUI settings", async () => {
    fileSystem["theme/sy/opencode_light.jsonc"] = '{"theme":{"text":"#1e1e1e"}}';
    const original = JSON.stringify({ theme: "foreign" });
    fileSystem[`${ocHome}/.config/opencode/tui.json`] = original;
    await expect(getIndexFunction("_writeOpencodeTuiConfig")(ocHome, false)).rejects.toThrow("matching non-empty native role objects");
    expect(fileSystem[`${ocHome}/.config/opencode/tui.json`]).toBe(original);
    expect(fileSystem).not.toHaveProperty(`${ocHome}/.config/opencode/themes/sy.json`);
  });
  it("rejects invalid generated color values without output", async () => {
    fileSystem["theme/sy/opencode_dark.jsonc"] = '{"theme":{"text":"#e8e8e8"}}';
    fileSystem["theme/sy/opencode_light.jsonc"] = '{"theme":{"text":"invalid"}}';
    await expect(getIndexFunction("_doOpencodeThemeWork")(ocHome)).rejects.toThrow("expected generated hex colors");
    expect(fileSystem).not.toHaveProperty(`${ocHome}/.config/opencode/themes/sy.json`);
  });
});

describe("Gemini custom theme integration", () => {
  it("persists native custom objects and the supported DarkGray control", async () => {
    await getIndexFunction("_doGeminiSettingsWork")(geminiHome);
    const result = JSON.parse(fileSystem[`${geminiHome}/settings.json`]);
    expect(result.ui.theme).toBe("Sy Dark");
    expect(result.ui.customThemes["Sy Dark"]).toMatchObject({
      name: "Sy Dark",
      type: "custom",
      DarkGray: "#6e6e6e",
      text: { secondary: "#b2b2b2" },
    });
    expect(result.ui.customThemes["Sy Light"].text.primary).toBe("#1e1e1e");
    expect(result.ui.customThemes["Sy Dark"].background).not.toHaveProperty("input");
  });
  it("preserves foreign themes and user-only custom entries", async () => {
    fileSystem[`${geminiHome}/settings.json`] = JSON.stringify({
      ui: { theme: "foreign", customThemes: { foreign: { name: "foreign", type: "custom" } } },
      userPreference: 0,
    });
    await getIndexFunction("_doGeminiSettingsWork")(geminiHome);
    expect(JSON.parse(fileSystem[`${geminiHome}/settings.json`])).toMatchObject({
      ui: { theme: "foreign", customThemes: { foreign: { name: "foreign" } } },
      userPreference: 0,
    });
  });
  it("preserves light appearance through managed opt-out", async () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    const settings = { ui: { theme: "Sy Light" } };
    await getIndexFunction("_doGeminiThemeWork")(settings);
    expect(settings.ui.theme).toBe("Default Light");
    expect(Object.keys(fileSystem)).toEqual([]);
  });
  it("rejects invalid custom-theme dictionaries before writing settings", async () => {
    const original = JSON.stringify({ ui: { customThemes: [] } });
    fileSystem[`${geminiHome}/settings.json`] = original;
    await expect(getIndexFunction("_doGeminiSettingsWork")(geminiHome)).rejects.toThrow("Invalid Gemini customThemes");
    expect(fileSystem[`${geminiHome}/settings.json`]).toBe(original);
    expect(fileSystem).not.toHaveProperty(`${geminiHome}/settings.json.bak_original`);
  });
});
