/** Verifies Google Gemini CLI keymap generation on macOS and Windows/Linux. */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileSystem, loadScriptHelpers, getIndexFunction } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/gemini/setup.js");
});

beforeEach(() => {
  fileSystem["software/scripts/advanced/llm/gemini/gemini-keys.common.jsonc"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/llm/gemini/gemini-keys.common.jsonc"),
    "utf-8",
  );
  fileSystem["software/scripts/advanced/llm/gemini/gemini-keys.windows.jsonc"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/llm/gemini/gemini-keys.windows.jsonc"),
    "utf-8",
  );
});

describe("AI CLI keymap build - Google Gemini CLI", () => {
  it("produces the expected flat-array config for macOS (OS_KEY to cmd, no windows supplement)", async () => {
    const bindings = await getIndexFunction("_loadGeminiManagedKeybindings")(true);
    expect(bindings).toMatchInlineSnapshot(`
      [
        {
          "command": "app.showFullTodos",
          "key": "ctrl+t",
        },
        {
          "command": "input.newline",
          "key": "shift+enter",
        },
        {
          "command": "input.newline",
          "key": "ctrl+enter",
        },
        {
          "command": "edit.undo",
          "key": "cmd+z",
        },
        {
          "command": "-app.clearScreen",
          "key": "ctrl+l",
        },
        {
          "command": "edit.clear",
          "key": "ctrl+l",
        },
        {
          "command": "edit.clear",
          "key": "cmd+l",
        },
        {
          "command": "input.openExternalEditor",
          "key": "ctrl+g",
        },
        {
          "command": "input.openExternalEditor",
          "key": "ctrl+x",
        },
        {
          "command": "input.paste",
          "key": "ctrl+v",
        },
        {
          "command": "edit.deleteWordLeft",
          "key": "ctrl+w",
        },
        {
          "command": "edit.deleteWordLeft",
          "key": "ctrl+backspace",
        },
        {
          "command": "cursor.home",
          "key": "ctrl+a",
        },
        {
          "command": "cursor.home",
          "key": "home",
        },
        {
          "command": "cursor.end",
          "key": "ctrl+e",
        },
        {
          "command": "cursor.end",
          "key": "end",
        },
        {
          "command": "scroll.home",
          "key": "ctrl+home",
        },
        {
          "command": "scroll.end",
          "key": "ctrl+end",
        },
      ]
    `);
  });

  it("produces the expected flat-array config for Windows/Linux (OS_KEY to alt, -input.paste alt+v appended)", async () => {
    const bindings = await getIndexFunction("_loadGeminiManagedKeybindings")(false);
    expect(bindings).toMatchInlineSnapshot(`
      [
        {
          "command": "app.showFullTodos",
          "key": "ctrl+t",
        },
        {
          "command": "input.newline",
          "key": "shift+enter",
        },
        {
          "command": "input.newline",
          "key": "ctrl+enter",
        },
        {
          "command": "edit.undo",
          "key": "alt+z",
        },
        {
          "command": "-app.clearScreen",
          "key": "ctrl+l",
        },
        {
          "command": "edit.clear",
          "key": "ctrl+l",
        },
        {
          "command": "edit.clear",
          "key": "alt+l",
        },
        {
          "command": "input.openExternalEditor",
          "key": "ctrl+g",
        },
        {
          "command": "input.openExternalEditor",
          "key": "ctrl+x",
        },
        {
          "command": "input.paste",
          "key": "ctrl+v",
        },
        {
          "command": "edit.deleteWordLeft",
          "key": "ctrl+w",
        },
        {
          "command": "edit.deleteWordLeft",
          "key": "ctrl+backspace",
        },
        {
          "command": "cursor.home",
          "key": "ctrl+a",
        },
        {
          "command": "cursor.home",
          "key": "home",
        },
        {
          "command": "cursor.end",
          "key": "ctrl+e",
        },
        {
          "command": "cursor.end",
          "key": "end",
        },
        {
          "command": "scroll.home",
          "key": "ctrl+home",
        },
        {
          "command": "scroll.end",
          "key": "ctrl+end",
        },
        {
          "command": "-input.paste",
          "key": "alt+v",
        },
      ]
    `);
  });
});
