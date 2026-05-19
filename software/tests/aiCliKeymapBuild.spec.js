/**
 * @file aiCliKeymapBuild.spec.js — Snapshot regression tests for the keymap
 *   merge/format pipelines of all four AI CLI assistants (Claude Code, GitHub
 *   Copilot CLI, Google Gemini CLI, OpenCode).
 *
 * Strategy
 * --------
 * For each tool, we exercise the SAME helper that `setup.js` uses at deploy
 * time (no duplicated merge/substitution logic in the test):
 *
 *   Claude   → `_getKeyConfig(isOsMac)`             (claude/setup.js)
 *   Copilot  → `_getCopilotKeyConfig(isOsMac)`      (copilot/setup.js)
 *   Gemini   → `_loadGeminiManagedKeybindings(isOsMac)` (gemini/setup.js)
 *   OpenCode → `_loadOpencodeKeybinds(isOsMac)`     (opencode/setup.js)
 *
 * Each helper is fed the ACTUAL `*-keys.common.jsonc` (+ `*-keys.windows.jsonc`
 * where applicable) read off disk via the test sandbox's mocked `readJson`,
 * with NO pre-existing user keybindings file ("empty default state" baseline).
 * The resulting JSON is asserted against an inline expected literal — when a
 * chord or merge rule changes intentionally, the failing diff makes the new
 * expected output obvious in the PR review.
 *
 * Both platforms are covered:
 *   - isOsMac = true   → OS_KEY resolves to the tool's mac modifier
 *                         (`meta` for Claude/Copilot, `cmd` for Gemini,
 *                          `super` for OpenCode)
 *   - isOsMac = false  → OS_KEY resolves to `alt` (Windows/Linux);
 *                         the `*-keys.windows.jsonc` supplement (where it
 *                         exists) is concatenated on top of the common set
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileSystem, loadScriptHelpers, getIndexFunction, setSandboxGlobal } from "./setup.js";

// ----------------------------------------------------------------------------
// Test fixture loaders
// ----------------------------------------------------------------------------

/**
 * Preload the test sandbox's mocked `fileSystem` with the real JSONC file
 * contents at the relative repo paths the production helpers read from. The
 * sandbox's `readJson` override (setup.js) routes `fileSystem` reads through
 * `parseJsonWithComments` (which strips `//` line comments and trailing
 * commas), so the JSONC source survives intact — unlike `fetchResponses`
 * which goes through plain `JSON.parse` and chokes on the comments.
 *
 * The key MUST be the EXACT path string the helper passes to its template-
 * literal `readJson` call (e.g. "software/scripts/advanced/llm/claude/
 * claude-keys.common.jsonc").
 *
 * MUST be called from beforeEach (not beforeAll) because setup.js's own
 * beforeEach wipes `fileSystem` between tests.
 *
 * @param {string} relPath - Relative path from repo root, matching the helper's `readJson` argument.
 */
function preloadJsoncFromDisk(relPath) {
  fileSystem[relPath] = fs.readFileSync(path.resolve(relPath), "utf-8");
}

/** Pre-populates the sandbox with the four tools' setup.js helpers (top-level vars accessible via getIndexFunction). */
beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/claude/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/copilot/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/gemini/setup.js");
  loadScriptHelpers("software/scripts/advanced/llm/opencode/setup.js");
});

/** Per-test preload of all four tools' jsonc files — setup.js's beforeEach wipes fetchResponses, so we re-seed every test. */
beforeEach(async () => {
  preloadJsoncFromDisk("software/scripts/advanced/llm/claude/claude-keys.common.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/claude/claude-keys.windows.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/copilot/copilot-keys.common.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/copilot/copilot-keys.windows.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/gemini/gemini-keys.common.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/gemini/gemini-keys.windows.jsonc");
  preloadJsoncFromDisk("software/scripts/advanced/llm/opencode/opencode-keys.common.jsonc");

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

// ----------------------------------------------------------------------------
// Claude Code
// ----------------------------------------------------------------------------

describe("AI CLI keymap build — Claude Code", () => {
  it("produces the expected merged config for macOS (OS_KEY → meta)", () => {
    const config = getIndexFunction("_getKeyConfig")(true);
    expect(config).toEqual({
      $schema: "https://www.schemastore.org/claude-code-keybindings.json",
      $docs: "https://code.claude.com/docs/en/keybindings",
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
            "ctrl+a": null,
            "ctrl+e": null,
            home: null,
            end: null,
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
            "ctrl+a": null,
            "ctrl+e": null,
            home: null,
            end: null,
            "ctrl+x": "chat:externalEditor",
            "ctrl+v": "chat:imagePaste",
            "alt+v": null,
          },
        },
      ],
    });
  });
});

// ----------------------------------------------------------------------------
// GitHub Copilot CLI
// ----------------------------------------------------------------------------

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
            "ctrl+a": null,
            "ctrl+e": null,
            home: null,
            end: null,
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
            "ctrl+a": null,
            "ctrl+e": null,
            home: null,
            end: null,
            "ctrl+x": "chat:externalEditor",
            "ctrl+v": "chat:imagePaste",
            "alt+v": null,
          },
        },
      ],
    });
  });
});

// ----------------------------------------------------------------------------
// Google Gemini CLI
// ----------------------------------------------------------------------------

describe("AI CLI keymap build — Google Gemini CLI", () => {
  it("produces the expected flat-array config for macOS (OS_KEY → cmd, no windows supplement)", async () => {
    const bindings = await getIndexFunction("_loadGeminiManagedKeybindings")(true);
    expect(bindings).toEqual([
      { command: "app.showFullTodos", key: "ctrl+t" },
      { command: "input.newline", key: "shift+enter" },
      { command: "input.newline", key: "ctrl+enter" },
      { command: "edit.undo", key: "cmd+z" },
      { command: "edit.clear", key: "cmd+l" },
      { command: "input.openExternalEditor", key: "ctrl+x" },
      { command: "input.paste", key: "ctrl+v" },
      { command: "cursor.home", key: "ctrl+a" },
      { command: "cursor.home", key: "home" },
      { command: "cursor.end", key: "ctrl+e" },
      { command: "cursor.end", key: "end" },
    ]);
  });

  it("produces the expected flat-array config for Windows/Linux (OS_KEY → alt, -input.paste alt+v appended)", async () => {
    const bindings = await getIndexFunction("_loadGeminiManagedKeybindings")(false);
    expect(bindings).toEqual([
      { command: "app.showFullTodos", key: "ctrl+t" },
      { command: "input.newline", key: "shift+enter" },
      { command: "input.newline", key: "ctrl+enter" },
      { command: "edit.undo", key: "alt+z" },
      { command: "edit.clear", key: "alt+l" },
      { command: "input.openExternalEditor", key: "ctrl+x" },
      { command: "input.paste", key: "ctrl+v" },
      { command: "cursor.home", key: "ctrl+a" },
      { command: "cursor.home", key: "home" },
      { command: "cursor.end", key: "ctrl+e" },
      { command: "cursor.end", key: "end" },
      { command: "-input.paste", key: "alt+v" },
    ]);
  });
});

// ----------------------------------------------------------------------------
// OpenCode
// ----------------------------------------------------------------------------

describe("AI CLI keymap build — OpenCode", () => {
  it("produces the expected keybinds map for macOS (OS_KEY → super)", async () => {
    const keybinds = await getIndexFunction("_loadOpencodeKeybinds")(true);
    expect(keybinds).toEqual({
      leader: "ctrl+o",
      editor_open: "ctrl+x,<leader>e",
      input_newline: "shift+return,ctrl+return,alt+return,ctrl+j",
      input_line_home: "ctrl+a,home",
      input_line_end: "ctrl+e,end",
      input_buffer_home: "ctrl+home",
      input_buffer_end: "ctrl+end",
      input_clear: "super+l,ctrl+l,ctrl+c",
      input_undo: "super+z,ctrl+-,super+z",
      input_paste: "ctrl+v",
      sidebar_toggle: "super+\\,<leader>b",
    });
  });

  it("produces the expected keybinds map for Windows/Linux (OS_KEY → alt)", async () => {
    const keybinds = await getIndexFunction("_loadOpencodeKeybinds")(false);
    expect(keybinds).toEqual({
      leader: "ctrl+o",
      editor_open: "ctrl+x,<leader>e",
      input_newline: "shift+return,ctrl+return,alt+return,ctrl+j",
      input_line_home: "ctrl+a,home",
      input_line_end: "ctrl+e,end",
      input_buffer_home: "ctrl+home",
      input_buffer_end: "ctrl+end",
      input_clear: "alt+l,ctrl+l,ctrl+c",
      input_undo: "alt+z,ctrl+-,super+z",
      input_paste: "ctrl+v",
      sidebar_toggle: "alt+\\,<leader>b",
    });
  });
});

// ----------------------------------------------------------------------------
// HOME/END parity sanity check
// ----------------------------------------------------------------------------
//
// All four tools should make the HOME key behave like Ctrl+A (jump to BOL)
// and END behave like Ctrl+E (jump to EOL). We assert this explicitly so a
// future edit that drops the parity (e.g. removing the cursor.home/home
// binding on Gemini, or the input_line_home/home alias on OpenCode) fails
// loudly with a clear test name.

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

  it("OpenCode: input_line_home includes both ctrl+a and home; input_line_end includes both ctrl+e and end", async () => {
    for (const isOsMac of [true, false]) {
      const keybinds = await getIndexFunction("_loadOpencodeKeybinds")(isOsMac);
      expect(keybinds.input_line_home.split(","), `OpenCode (mac=${isOsMac}): input_line_home chord set`).toEqual(["ctrl+a", "home"]);
      expect(keybinds.input_line_end.split(","), `OpenCode (mac=${isOsMac}): input_line_end chord set`).toEqual(["ctrl+e", "end"]);
    }
  });
});
