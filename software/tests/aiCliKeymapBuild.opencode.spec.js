/** Verifies OpenCode keymap generation on macOS and Windows/Linux. */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileSystem, loadScriptHelpers, getIndexFunction } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

beforeEach(() => {
  fileSystem["software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc"),
    "utf-8",
  );
  fileSystem["software/scripts/advanced/llm/opencode/opencode-keys.windows.jsonc"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/llm/opencode/opencode-keys.windows.jsonc"),
    "utf-8",
  );
});

describe("AI CLI keymap build - OpenCode", () => {
  it("keeps common keybinds on non-Windows platforms", async () => {
    const keybinds = await getIndexFunction("_loadOpencodeKeybinds")(false);
    expect(keybinds).toMatchInlineSnapshot(`
      {
        "command_list": "ctrl+p,super+p",
        "editor_open": "ctrl+g,ctrl+x",
        "history_previous": "up,ctrl+r",
        "input_buffer_end": "super+end",
        "input_buffer_home": "super+home",
        "input_clear": "escape",
        "input_delete_word_backward": "ctrl+w,ctrl+backspace",
        "input_line_end": "ctrl+e,end",
        "input_line_home": "ctrl+a,home",
        "input_newline": "shift+return,ctrl+return,alt+return,ctrl+j",
        "input_paste": "ctrl+v",
        "input_undo": "super+z,ctrl+-",
        "leader": "ctrl+o",
        "messages_copy": "ctrl+y",
        "messages_first": "ctrl+home,ctrl+alt+shift+g",
        "messages_last": "ctrl+end,ctrl+alt+g",
        "session_compact": "ctrl+l,super+l,<leader>c",
        "session_rename": "f6",
        "sidebar_toggle": "ctrl+\\,super+\\",
      }
    `);
    expect(JSON.stringify(keybinds)).toContain("super+");
  });

  it("replaces super chords with alt on Windows without duplicate aliases", async () => {
    const keybinds = await getIndexFunction("_loadOpencodeKeybinds")(true);
    expect(keybinds).toMatchInlineSnapshot(`
      {
        "command_list": "ctrl+p",
        "editor_open": "ctrl+g,ctrl+x",
        "history_previous": "up,ctrl+r",
        "input_buffer_end": "alt+end",
        "input_buffer_home": "alt+home",
        "input_clear": "escape",
        "input_delete_word_backward": "ctrl+w,ctrl+backspace",
        "input_line_end": "ctrl+e,end",
        "input_line_home": "ctrl+a,home",
        "input_newline": "shift+return,ctrl+return,alt+return,ctrl+j",
        "input_paste": "ctrl+v",
        "input_undo": "alt+z,ctrl+-",
        "leader": "ctrl+o",
        "messages_copy": "ctrl+y",
        "messages_first": "ctrl+home,ctrl+alt+shift+g",
        "messages_last": "ctrl+end,ctrl+alt+g",
        "session_compact": "ctrl+l,alt+l,<leader>c",
        "session_rename": "f6",
        "sidebar_toggle": "ctrl+\\,alt+\\",
      }
    `);
    expect(JSON.stringify(keybinds)).not.toContain("super+");
    const chords = Object.values(keybinds).flatMap((value) => value.split(","));
    expect(new Set(chords).size, "Windows keymap should not bind a chord to multiple commands").toBe(chords.length);
  });
});
