/** Runs canonical renderer inputs through GUI/terminal setup helpers with controlled filesystem effects. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/ghostty.js");
  loadScriptHelpers("software/scripts/android_termux/termux-colors.js");
  loadScriptHelpers("software/scripts/advanced/sublime-text.js");
  loadScriptHelpers("software/scripts/advanced/zed.js");
});
beforeEach(() => {
  setSandboxGlobal("is_gui", true);
  setSandboxGlobal("getRuntimeOption", () => false);
});

describe("native terminal renderers", () => {
  it.each(["dark", "light"])("renders %s Ghostty and Termux source values", async (mode) => {
    const ghostty = await getIndexFunction("_buildThemeContent")(mode);
    const termux = await getIndexFunction("_buildTermuxColors")(mode);
    expect(ghostty).toContain(`theme/sy/ghostty_${mode}.jsonc`);
    expect(ghostty).toContain(mode === "dark" ? "palette = 0=#6e6e6e" : "palette = 0=#000000");
    expect(termux).toContain(`theme/sy/termux_${mode}.jsonc`);
    expect(termux).toContain(mode === "dark" ? "background:     #0a0a0a" : "background:     #f8f8f8");
  });
  it("rejects unknown terminal appearances before writing output", async () => {
    await expect(getIndexFunction("_buildTermuxColors")("auto")).rejects.toThrow("Invalid Sy theme selector");
    expect(Object.keys(fileSystem)).toEqual([]);
  });
});

describe("canonical editor source loading", () => {
  it("reads both native Zed themes with required appearance and player data", async () => {
    const result = await getIndexFunction("_readZedSources")();
    expect(result.darkTheme.themes[0].appearance).toBe("dark");
    expect(result.lightTheme.themes[0].appearance).toBe("light");
    expect(result.darkTheme.themes[0].style.players).toHaveLength(8);
  });
  it("deploys Sublime native schemes instead of archival wrappers", async () => {
    await getIndexFunction("_doConfigWork")("/mock/sublime", []);
    const dark = JSON.parse(fileSystem["/mock/sublime/Packages/User/Sy Dark.sublime-color-scheme"]);
    const light = JSON.parse(fileSystem["/mock/sublime/Packages/User/Sy Light.sublime-color-scheme"]);
    expect(dark.globals.find_highlight_foreground).toBe("#e8e8e8");
    expect(light.globals.find_highlight_foreground).toBe("#1e1e1e");
    expect(dark).not.toHaveProperty("definition");
  });
  it("rejects malformed Sublime light shape before either scheme is written", async () => {
    fileSystem["theme/sy/sublime_light.jsonc"] = '{"globals":[],"rules":[]}';
    await expect(getIndexFunction("_doConfigWork")("/mock/sublime", [])).rejects.toThrow("Invalid Sy Sublime source");
    expect(fileSystem).not.toHaveProperty("/mock/sublime/Packages/User/Sy Dark.sublime-color-scheme");
    expect(fileSystem).not.toHaveProperty("/mock/sublime/Packages/User/Sy Light.sublime-color-scheme");
  });
});
