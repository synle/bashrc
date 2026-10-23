/** Runs the real Termux color installer with controlled IO to prove opt-out absence of effects. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileSystem, getIndexFunction, loadScriptHelpers, mockExecCommands, setSandboxGlobal } from "./setup.js";

const target = "/mock/home/.termux/colors.properties";
let disabled;
let mode;
beforeAll(() => loadScriptHelpers("software/scripts/android_termux/termux-colors.js"));
beforeEach(() => {
  disabled = false;
  mode = "";
  setSandboxGlobal("getRuntimeOption", (key, parser) => {
    const value = key === "IS_CUSTOM_THEME_DISABLED" ? (disabled ? "1" : "0") : key === "TERMUX_THEME_MODE" ? mode : "";
    return parser ? parser(value) : value;
  });
});

describe("Termux custom-theme opt-out", () => {
  it("preserves existing colors without reading invalid sources or mode when disabled", async () => {
    disabled = true;
    mode = "unsupported";
    fileSystem[target] = "background: #123456\n";
    fileSystem["theme/sy/termux_dark.jsonc"] = "{broken";
    await getIndexFunction("doWork")();
    expect(fileSystem[target]).toBe("background: #123456\n");
    expect(Object.keys(fileSystem).sort()).toEqual([target, "theme/sy/termux_dark.jsonc"].sort());
    expect(mockExecCommands).toEqual([]);
  });
  it("creates no file, backup, or folder when disabled without an existing config", async () => {
    disabled = true;
    await getIndexFunction("doWork")();
    expect(Object.keys(fileSystem)).toEqual([]);
    expect(mockExecCommands).toEqual([]);
  });
  it.each([
    ["dark", "#0a0a0a"],
    ["light", "#f8f8f8"],
  ])("renders enabled %s colors and stays byte-stable", async (appearance, background) => {
    mode = appearance;
    await getIndexFunction("doWork")();
    const first = fileSystem[target];
    expect(first).toContain(`background:     ${background}`);
    expect(first).toContain(`theme/sy/termux_${appearance}.jsonc`);
    await getIndexFunction("doWork")();
    expect(fileSystem[target]).toBe(first);
  });
});
