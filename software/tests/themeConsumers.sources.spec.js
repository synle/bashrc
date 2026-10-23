/** Verifies active-source ownership, terminal gating, and the native VS Code settings envelope. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

beforeAll(() => loadScriptHelpers("software/scripts/advanced/vs-code.js"));
beforeEach(() => {
  setSandboxGlobal("is_gui", false);
  setSandboxGlobal("getRuntimeOption", () => false);
});

describe("shared active source contract", () => {
  it("keeps GUI display gating while allowing headless terminal interfaces", () => {
    expect(getIndexFunction("shouldInstallCustomTheme")()).toBe(false);
    expect(getIndexFunction("shouldInstallCustomTheme")("terminal")).toBe(true);
  });
  it("honors terminal opt-out and rejects unknown surfaces", () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    expect(getIndexFunction("shouldInstallCustomTheme")("terminal")).toBe(false);
    expect(() => getIndexFunction("shouldInstallCustomTheme")("unknown")).toThrow("Theme surface must be gui or terminal");
  });
  it.each([
    ["../pi", "dark"],
    ["_palette", "dark"],
    ["pi", "system"],
    [null, "dark"],
  ])("rejects unsafe selector %s/%s before writes", async (app, mode) => {
    await expect(getIndexFunction("readSyTheme")(app, mode)).rejects.toThrow("Invalid Sy theme selector");
    expect(Object.keys(fileSystem)).toEqual([]);
  });
  it.each(["{}", "null", "[]", '"not-an-object"', '{"definition":{}}', '{"captureStatus":"gap"}', "{broken"])(
    "rejects invalid/archive/capability source %s",
    async (source) => {
      fileSystem["theme/sy/pi_dark.jsonc"] = source;
      await expect(getIndexFunction("readSyTheme")("pi", "dark")).rejects.toThrow("Invalid Sy pi/dark source");
      expect(Object.keys(fileSystem)).toEqual(["theme/sy/pi_dark.jsonc"]);
    },
  );
});

describe("native VS Code customization settings", () => {
  it("places theme selectors inside color, TextMate, and semantic customization settings", async () => {
    const dark = await getIndexFunction("readSyTheme")("vscode", "dark");
    const light = await getIndexFunction("readSyTheme")("vscode", "light");
    const result = getIndexFunction("_getSettings")(
      { "workbench.colorCustomizations": { "panel.border": "#123456" }, "[javascript]": { "editor.tabSize": 4 } },
      dark,
      light,
      [],
      { is_prebuilt_config: true },
    );
    expect(result).not.toHaveProperty("[Default High Contrast]");
    expect(result["workbench.colorCustomizations"]["[Default High Contrast]"]["editor.background"]).toBe("#0a0a0a");
    expect(result["editor.tokenColorCustomizations"]["[Default High Contrast]"]).toHaveProperty("textMateRules");
    expect(result["editor.semanticTokenColorCustomizations"]["[Default High Contrast]"].rules.newOperator).toBe("#e8e8e8");
    expect(result["editor.semanticTokenColorCustomizations"]["[Default High Contrast Light]"].rules.newOperator).toBe("#1e1e1e");
    expect(result["workbench.colorCustomizations"]["panel.border"]).toBe("#123456");
    expect(result["[javascript]"]).toEqual({ "editor.tabSize": 4 });
  });
  it("omits managed scoped colors when local custom themes are disabled", () => {
    setSandboxGlobal("getRuntimeOption", () => true);
    const result = getIndexFunction("_getSettings")({}, {}, {}, [], { is_prebuilt_config: false });
    expect(result).not.toHaveProperty("workbench.colorCustomizations");
    expect(result).not.toHaveProperty("editor.semanticTokenColorCustomizations");
  });
});
