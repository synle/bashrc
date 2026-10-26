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
    const dark = JSON.parse(fileSystem[`${piHome}/themes/Sy Dark.json`]);
    expect({ name: dark.name, appearance: dark.appearance, colors: { text: dark.colors.text } }).toMatchInlineSnapshot(`
      {
        "appearance": "dark",
        "colors": {
          "text": "#e8e8e8",
        },
        "name": "Sy Dark",
      }
    `);
    const light = JSON.parse(fileSystem[`${piHome}/themes/Sy Light.json`]);
    expect({ name: light.name, appearance: light.appearance, colors: { text: light.colors.text } }).toMatchInlineSnapshot(`
      {
        "appearance": "light",
        "colors": {
          "text": "#1e1e1e",
        },
        "name": "Sy Light",
      }
    `);
  });
  it("preserves explicit foreign selections and unrelated preferences", async () => {
    fileSystem[`${piHome}/settings.json`] = JSON.stringify({ theme: "foreign", customPreference: 0 });
    await getIndexFunction("_doPiSettingsWork")(piHome);
    const settings = JSON.parse(fileSystem[`${piHome}/settings.json`]);
    expect({ theme: settings.theme, customPreference: settings.customPreference }).toMatchInlineSnapshot(`
      {
        "customPreference": 0,
        "theme": "foreign",
      }
    `);
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
    const settings = JSON.parse(fileSystem[`${ocHome}/.config/opencode/tui.json`]);
    expect({ theme: settings.theme, userPreference: settings.userPreference }).toMatchInlineSnapshot(`
      {
        "theme": "foreign",
        "userPreference": false,
      }
    `);
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
    expect({ name: result.ui.customThemes["Sy Dark"].name, type: result.ui.customThemes["Sy Dark"].type, DarkGray: result.ui.customThemes["Sy Dark"].DarkGray, text: { secondary: result.ui.customThemes["Sy Dark"].text.secondary } }).toMatchInlineSnapshot(`
      {
        "DarkGray": "#6e6e6e",
        "name": "Sy Dark",
        "text": {
          "secondary": "#b2b2b2",
        },
        "type": "custom",
      }
    `);
    expect(result.ui.customThemes["Sy Light"].text.primary).toBe("#1e1e1e");
    expect(result.ui.customThemes["Sy Dark"].background).not.toHaveProperty("input");
    expect(result.ui.customThemes["Sy Dark"].ui).toMatchInlineSnapshot(`
      {
        "comment": "#76a762",
        "gradient": [
          "#5ca0d7",
          "#4ec9b0",
          "#c586c0",
        ],
        "symbol": "#e8e8e8",
      }
    `);
    expect(result.ui.customThemes["Sy Light"].ui).toMatchInlineSnapshot(`
      {
        "comment": "#004a15",
        "gradient": [
          "#0033b3",
          "#00416f",
          "#6c0099",
        ],
        "symbol": "#1e1e1e",
      }
    `);
    expect(result.ui.customThemes["Sy Dark"].AccentGreen).toBe("#5ca0d7");
    expect(result.ui.customThemes["Sy Light"].AccentGreen).toBe("#0033b3");
    expect(result.ui.customThemes["Sy Dark"].status.success).toBe("#76a762");
  });
  it("replaces invalid managed UI overrides while preserving light selection and foreign themes", async () => {
    fileSystem[`${geminiHome}/settings.json`] = JSON.stringify({
      ui: {
        theme: "Sy Light",
        customThemes: {
          "Sy Dark": { ui: { active: "#ffffff", focus: "#ffffff" } },
          "Sy Light": { ui: { active: "#000000", focus: "#000000" } },
          foreign: { name: "foreign", type: "custom" },
        },
      },
    });
    await getIndexFunction("_doGeminiSettingsWork")(geminiHome);
    const result = JSON.parse(fileSystem[`${geminiHome}/settings.json`]);
    expect(result.ui.theme).toBe("Sy Light");
    expect(result.ui.customThemes["Sy Dark"].ui).not.toHaveProperty("active");
    expect(result.ui.customThemes["Sy Dark"].ui).not.toHaveProperty("focus");
    expect(result.ui.customThemes["Sy Light"].ui).not.toHaveProperty("active");
    expect(result.ui.customThemes["Sy Light"].ui).not.toHaveProperty("focus");
    expect(result.ui.customThemes.foreign).toEqual({ name: "foreign", type: "custom" });
    const first = fileSystem[`${geminiHome}/settings.json`];
    await getIndexFunction("_doGeminiSettingsWork")(geminiHome);
    expect(fileSystem[`${geminiHome}/settings.json`]).toBe(first);
  });

  it("preserves foreign themes and user-only custom entries", async () => {
    fileSystem[`${geminiHome}/settings.json`] = JSON.stringify({
      ui: { theme: "foreign", customThemes: { foreign: { name: "foreign", type: "custom" } } },
      userPreference: 0,
    });
    await getIndexFunction("_doGeminiSettingsWork")(geminiHome);
    const settings = JSON.parse(fileSystem[`${geminiHome}/settings.json`]);
    expect({ ui: { theme: settings.ui.theme, customThemes: { foreign: { name: settings.ui.customThemes.foreign.name } } }, userPreference: settings.userPreference }).toMatchInlineSnapshot(`
      {
        "ui": {
          "customThemes": {
            "foreign": {
              "name": "foreign",
            },
          },
          "theme": "foreign",
        },
        "userPreference": 0,
      }
    `);
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
