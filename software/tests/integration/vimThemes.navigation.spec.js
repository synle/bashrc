/** Native navigation integration: actual focus, split/tab switches, cursor movement, and idle refresh. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import { fileSystem, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "../setup.js";
import { probeTheme } from "./vimThemes.helpers.js";

beforeAll(() => loadScriptHelpers("software/scripts/vim-config.js"));
beforeEach(() => {
  setSandboxGlobal("is_gui", true);
  setSandboxGlobal("is_os_windows", false);
  setSandboxGlobal("IS_CI", false);
  setSandboxGlobal("getRuntimeOption", () => false);
  fileSystem["theme/sy/vim_dark.jsonc"] = fs.readFileSync("theme/sy/vim_dark.jsonc", "utf-8");
  fileSystem["theme/sy/vim_light.jsonc"] = fs.readFileSync("theme/sy/vim_light.jsonc", "utf-8");
});

describe("Vim native navigation integration", () => {
  it.each(["FocusGained", "WinEnter", "TabEnter", "CursorHold", "CursorHoldI"])("queries the terminal background on %s", async (event) => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, "dark", ['let &t_RB = "\\e]11;?\\x07"', `doautocmd ${event}`]);

    expect(result.terminalOutput).toContain("\u001b]11;?\u0007");
    expect({ scheme: result.scheme, background: result.background, foreground: result.foreground, tag: result.tag }).toMatchInlineSnapshot(`
      {
        "background": "dark",
        "foreground": "#e8e8e8",
        "scheme": "sy-dark",
        "tag": "#5ca0d7",
      }
    `);
  });

  it.each([
    ["split", "split", "wincmd p"],
    ["tab", "tabnew", "tabprevious"],
  ])("refreshes after navigating to an existing %s", async (_kind, create, navigate) => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, "dark", [
      "set t_RB=",
      create,
      'let &t_RB = "\\e]11;?\\x07"',
      "call echoraw('navigation-ready')",
      navigate,
    ]);

    expect(result.terminalOutput.split("navigation-ready")[1]).toContain("\u001b]11;?\u0007");
    expect({ scheme: result.scheme, background: result.background, foreground: result.foreground, tag: result.tag }).toMatchInlineSnapshot(`
      {
        "background": "dark",
        "foreground": "#e8e8e8",
        "scheme": "sy-dark",
        "tag": "#5ca0d7",
      }
    `);
  });

  it.each([
    ["normal", "CursorHold", "j", 2, "first"],
    ["insert", "CursorHoldI", "iabc", 1, "abcfirst"],
  ])("refreshes after real %s-mode navigation pauses", async (_mode, event, keys, line, text) => {
    const selection = await getIndexFunction("_doVimTheme")([]);
    const result = await probeTheme(selection, "dark", [
      'let &t_RB = "\\e]11;?\\x07"',
      "call setline(1, ['first', 'second'])",
      `autocmd ${event} * call RecordThemeProbe()`,
      "call echoraw('navigation-ready')",
      `call feedkeys(${JSON.stringify(keys)}, 't')`,
      "return",
    ]);

    expect(result.terminalOutput.split("navigation-ready")[1]).toContain("\u001b]11;?\u0007");
    expect(result.line).toBe(line);
    expect(result.text).toBe(text);
    expect({ scheme: result.scheme, background: result.background }).toMatchInlineSnapshot(`
      {
        "background": "dark",
        "scheme": "sy-dark",
      }
    `);
  });

  it("reports native Vim command errors instead of waiting for the process timeout", async () => {
    const selection = await getIndexFunction("_doVimTheme")([]);

    await expect(probeTheme(selection, "dark", ["throw 'owned probe failure'"])).rejects.toThrow("owned probe failure");
  });
});
