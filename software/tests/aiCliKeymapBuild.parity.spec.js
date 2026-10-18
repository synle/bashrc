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

describe("AI CLI keymap parity — HOME → BOL, END → EOL across all 4 tools", () => {
  /**
   * Asserts that for a given Claude/Copilot context-group config, the Chat
   * context has matching null bindings for ctrl+a/home (BOL pair) and
   * ctrl+e/end (EOL pair). Null means "unbound here — terminal readline
   * handles the chord", which is the explicit pass-through pattern.
   *
   * @param {object} config - The merged keybinding config (output of `_getKeyConfig` / `_getCopilotKeyConfig`).
   * @param {string} toolName - Display label for the failure message.
   */
  function expectClaudeShapedHomeEndParity(config, toolName) {
    const chat = config.bindings.find((g) => g.context === "Chat");
    expect(chat, `${toolName}: Chat context group must exist`).toBeDefined();
    expect(chat.bindings["ctrl+a"], `${toolName}: ctrl+a should be nulled (readline pass-through)`).toBeNull();
    expect(chat.bindings["home"], `${toolName}: home should be nulled (parity with ctrl+a)`).toBeNull();
    expect(chat.bindings["ctrl+e"], `${toolName}: ctrl+e should be nulled (readline pass-through)`).toBeNull();
    expect(chat.bindings["end"], `${toolName}: end should be nulled (parity with ctrl+e)`).toBeNull();
  }

  it("Claude: ctrl+a / home both unbound (BOL), ctrl+e / end both unbound (EOL)", () => {
    expectClaudeShapedHomeEndParity(getIndexFunction("_getKeyConfig")(true), "Claude mac");
    expectClaudeShapedHomeEndParity(getIndexFunction("_getKeyConfig")(false), "Claude win/linux");
  });

  it("Copilot: ctrl+a / home both unbound (BOL), ctrl+e / end both unbound (EOL)", () => {
    expectClaudeShapedHomeEndParity(getIndexFunction("_getCopilotKeyConfig")(true), "Copilot mac");
    expectClaudeShapedHomeEndParity(getIndexFunction("_getCopilotKeyConfig")(false), "Copilot win/linux");
  });

  it("Gemini: cursor.home bound to BOTH ctrl+a and home; cursor.end bound to BOTH ctrl+e and end", async () => {
    for (const isOsMac of [true, false]) {
      const bindings = await getIndexFunction("_loadGeminiManagedKeybindings")(isOsMac);
      const homeKeys = bindings.filter((b) => b.command === "cursor.home").map((b) => b.key);
      const endKeys = bindings.filter((b) => b.command === "cursor.end").map((b) => b.key);
      expect(homeKeys, `Gemini (mac=${isOsMac}): cursor.home chord set`).toEqual(["ctrl+a", "home"]);
      expect(endKeys, `Gemini (mac=${isOsMac}): cursor.end chord set`).toEqual(["ctrl+e", "end"]);
    }
  });

  it("OpenCode: input_line_home includes ctrl+a and home; input_line_end includes ctrl+e and end", async () => {
    const keybinds = await getIndexFunction("_loadOpencodeKeybinds")(false);
    expect(keybinds.input_line_home.split(",")).toEqual(["ctrl+a", "home"]);
    expect(keybinds.input_line_end.split(",")).toEqual(["ctrl+e", "end"]);
  });
});
