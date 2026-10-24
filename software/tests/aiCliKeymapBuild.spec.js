import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import fs from "fs";

import path from "path";

import { fileSystem, loadScriptHelpers, getIndexFunction, setSandboxGlobal } from "./setup.js";

function preloadJsoncFromDisk(relPath) {
  fileSystem[relPath] = fs.readFileSync(path.resolve(relPath), "utf-8");
}

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/claude/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/copilot/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/gemini/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

beforeEach(async () => {
  preloadJsoncFromDisk("software/scripts/advanced/llm/claude/claude-keys.common.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/claude/claude-keys.windows.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/copilot/copilot-keys.common.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/copilot/copilot-keys.windows.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/gemini/gemini-keys.common.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/gemini/gemini-keys.windows.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/opencode/opencode-keys.windows.jsonc");

  // Claude + Copilot's `_getKeyConfig` / `_getCopilotKeyConfig` helpers read
  // pre-populated module-level vars (the live `_doKeysWork` orchestrator
  // assigns these from `await readJson` before calling the formatter). We
  // mirror that population step here so the formatter has data to work with.
  const readJson = getIndexFunction("readJson");
  setSandboxGlobal("CLAUDE_COMMON_KEY_BINDINGS", await readJson`software/scripts/advanced/llm/claude/claude-keys.common.jsonc`);
  setSandboxGlobal("CLAUDE_WINDOWS_ONLY_KEY_BINDINGS", await readJson`software/scripts/advanced/llm/claude/claude-keys.windows.jsonc`);
  setSandboxGlobal("COPILOT_COMMON_KEY_BINDINGS", await readJson`software/scripts/advanced/llm/copilot/copilot-keys.common.jsonc`);
  setSandboxGlobal("COPILOT_WINDOWS_ONLY_KEY_BINDINGS", await readJson`software/scripts/advanced/llm/copilot/copilot-keys.windows.jsonc`);
});

describe("AI CLI keymap build — Claude Code", () => {
  it("produces the expected merged config for macOS (OS_KEY → meta)", () => {
    const config = getIndexFunction("_getKeyConfig")(true);
    expect(config).toEqual({
      $schema: "https://www.schemastore.org/claude-code-keybindings.json",
      $docs: "https://code.claude.com/docs/en/keybindings",
      bindings: [
        {
          context: "Scroll",
          bindings: { "ctrl+home": "scroll:top", "ctrl+end": "scroll:bottom" },
        },
        {
          context: "Global",
          bindings: {
            "ctrl+t": "app:toggleTodos",
          },
        },
        {
          context: "Chat",
          bindings: {
            "shift+enter": "chat:newline",
            "ctrl+enter": "chat:newline",
            "meta+z": "chat:undo",
            "meta+l": "chat:clearInput",
            "ctrl+l": "chat:clearInput",
            "ctrl+a": null,
            "ctrl+e": null,
            home: null,
            end: null,
            "ctrl+g": "chat:externalEditor",
            "ctrl+x": "chat:externalEditor",
            "ctrl+v": "chat:imagePaste",
          },
        },
      ],
    });
  });

  it("produces the expected merged config for Windows/Linux (OS_KEY → alt, alt+v nulled)", () => {
    const config = getIndexFunction("_getKeyConfig")(false);
    expect(config).toEqual({
      $schema: "https://www.schemastore.org/claude-code-keybindings.json",
      $docs: "https://code.claude.com/docs/en/keybindings",
      bindings: [
        {
          context: "Scroll",
          bindings: { "ctrl+home": "scroll:top", "ctrl+end": "scroll:bottom" },
        },
        {
          context: "Global",
          bindings: {
            "ctrl+t": "app:toggleTodos",
          },
        },
        {
          context: "Chat",
          bindings: {
            "shift+enter": "chat:newline",
            "ctrl+enter": "chat:newline",
            "alt+z": "chat:undo",
            "alt+l": "chat:clearInput",
            "ctrl+l": "chat:clearInput",
            "ctrl+a": null,
            "ctrl+e": null,
            home: null,
            end: null,
            "ctrl+g": "chat:externalEditor",
            "ctrl+x": "chat:externalEditor",
            "ctrl+v": "chat:imagePaste",
            "alt+v": null,
          },
        },
      ],
    });
  });
});

describe("AI CLI keymap build — GitHub Copilot CLI", () => {
  it("produces the expected merged config for macOS (OS_KEY → meta)", () => {
    const config = getIndexFunction("_getCopilotKeyConfig")(true);
    expect(config).toEqual({
      $schema: "https://example.invalid/copilot-cli-keybindings.json",
      $docs: "https://docs.github.com/copilot/concepts/agents/about-copilot-cli",
      bindings: [
        {
          context: "Global",
          bindings: {
            "ctrl+t": "app:toggleTodos",
          },
        },
        {
          context: "Chat",
          bindings: {
            "shift+enter": "chat:newline",
            "ctrl+enter": "chat:newline",
            "meta+z": "chat:undo",
            "meta+l": "chat:clearInput",
            "ctrl+l": "chat:clearInput",
            "ctrl+a": null,
            "ctrl+e": null,
            home: null,
            end: null,
            "ctrl+g": "chat:externalEditor",
            "ctrl+x": "chat:externalEditor",
            "ctrl+v": "chat:imagePaste",
          },
        },
      ],
    });
  });

  it("produces the expected merged config for Windows/Linux (OS_KEY → alt, alt+v nulled)", () => {
    const config = getIndexFunction("_getCopilotKeyConfig")(false);
    expect(config).toEqual({
      $schema: "https://example.invalid/copilot-cli-keybindings.json",
      $docs: "https://docs.github.com/copilot/concepts/agents/about-copilot-cli",
      bindings: [
        {
          context: "Global",
          bindings: {
            "ctrl+t": "app:toggleTodos",
          },
        },
        {
          context: "Chat",
          bindings: {
            "shift+enter": "chat:newline",
            "ctrl+enter": "chat:newline",
            "alt+z": "chat:undo",
            "alt+l": "chat:clearInput",
            "ctrl+l": "chat:clearInput",
            "ctrl+a": null,
            "ctrl+e": null,
            home: null,
            end: null,
            "ctrl+g": "chat:externalEditor",
            "ctrl+x": "chat:externalEditor",
            "ctrl+v": "chat:imagePaste",
            "alt+v": null,
          },
        },
      ],
    });
  });
});

describe("AI CLI keymap build — Google Gemini CLI", () => {
  it("produces the expected flat-array config for macOS (OS_KEY → cmd, no windows supplement)", async () => {
    const bindings = await getIndexFunction("_loadGeminiManagedKeybindings")(true);
    expect(bindings).toEqual([
      { command: "app.showFullTodos", key: "ctrl+t" },
      { command: "input.newline", key: "shift+enter" },
      { command: "input.newline", key: "ctrl+enter" },
      { command: "edit.undo", key: "cmd+z" },
      { command: "-app.clearScreen", key: "ctrl+l" },
      { command: "edit.clear", key: "ctrl+l" },
      { command: "edit.clear", key: "cmd+l" },
      { command: "input.openExternalEditor", key: "ctrl+g" },
      { command: "input.openExternalEditor", key: "ctrl+x" },
      { command: "input.paste", key: "ctrl+v" },
      { command: "edit.deleteWordLeft", key: "ctrl+w" },
      { command: "edit.deleteWordLeft", key: "ctrl+backspace" },
      { command: "cursor.home", key: "ctrl+a" },
      { command: "cursor.home", key: "home" },
      { command: "cursor.end", key: "ctrl+e" },
      { command: "cursor.end", key: "end" },
      { command: "scroll.home", key: "ctrl+home" },
      { command: "scroll.end", key: "ctrl+end" },
    ]);
  });

  it("produces the expected flat-array config for Windows/Linux (OS_KEY → alt, -input.paste alt+v appended)", async () => {
    const bindings = await getIndexFunction("_loadGeminiManagedKeybindings")(false);
    expect(bindings).toEqual([
      { command: "app.showFullTodos", key: "ctrl+t" },
      { command: "input.newline", key: "shift+enter" },
      { command: "input.newline", key: "ctrl+enter" },
      { command: "edit.undo", key: "alt+z" },
      { command: "-app.clearScreen", key: "ctrl+l" },
      { command: "edit.clear", key: "ctrl+l" },
      { command: "edit.clear", key: "alt+l" },
      { command: "input.openExternalEditor", key: "ctrl+g" },
      { command: "input.openExternalEditor", key: "ctrl+x" },
      { command: "input.paste", key: "ctrl+v" },
      { command: "edit.deleteWordLeft", key: "ctrl+w" },
      { command: "edit.deleteWordLeft", key: "ctrl+backspace" },
      { command: "cursor.home", key: "ctrl+a" },
      { command: "cursor.home", key: "home" },
      { command: "cursor.end", key: "ctrl+e" },
      { command: "cursor.end", key: "end" },
      { command: "scroll.home", key: "ctrl+home" },
      { command: "scroll.end", key: "ctrl+end" },
      { command: "-input.paste", key: "alt+v" },
    ]);
  });
});

describe("AI CLI keymap build — OpenCode", () => {
  /** @type {Record<string, any>} */
  const OPENCODE_EXPECTED = {
    leader: "ctrl+o",
    editor_open: "ctrl+g,ctrl+x",
    messages_first: "ctrl+home,ctrl+alt+shift+g",
    messages_last: "ctrl+end,ctrl+alt+g",
    input_newline: "shift+return,ctrl+return,alt+return,ctrl+j",
    input_line_home: "ctrl+a,home",
    input_line_end: "ctrl+e,end",
    input_buffer_home: "super+home",
    input_buffer_end: "super+end",
    session_rename: "f6",
    input_clear: "escape",
    session_compact: "ctrl+l,super+l,<leader>c",
    history_previous: "up,ctrl+r",
    input_undo: "super+z,ctrl+-",
    input_paste: "ctrl+v",
    input_delete_word_backward: "ctrl+w,ctrl+backspace",
    messages_copy: "ctrl+y",
    command_list: "ctrl+p,super+p",
    sidebar_toggle: "ctrl+\\,super+\\",
  };

  it("keeps common keybinds on non-Windows platforms", async () => {
    const keybinds = await getIndexFunction("_loadOpencodeKeybinds")(false);
    expect(keybinds).toEqual(OPENCODE_EXPECTED);
    expect(JSON.stringify(keybinds)).toContain("super+");
  });

  it("replaces super chords with alt on Windows without duplicate aliases", async () => {
    const keybinds = await getIndexFunction("_loadOpencodeKeybinds")(true);
    expect(keybinds).toEqual({
      ...OPENCODE_EXPECTED,
      input_buffer_home: "alt+home",
      input_buffer_end: "alt+end",
      session_compact: "ctrl+l,alt+l,<leader>c",
      input_undo: "alt+z,ctrl+-",
      command_list: "ctrl+p",
      sidebar_toggle: "ctrl+\\,alt+\\",
    });
    expect(JSON.stringify(keybinds)).not.toContain("super+");
    const chords = Object.values(keybinds).flatMap((value) => value.split(","));
    expect(new Set(chords).size, "Windows keymap should not bind a chord to multiple commands").toBe(chords.length);
  });
});
