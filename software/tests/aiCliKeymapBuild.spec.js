/** Verifies Claude Code keymap generation on macOS and Windows/Linux. */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileSystem, loadScriptHelpers, getIndexFunction, setSandboxGlobal } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/claude/setup.js");
});

beforeEach(async () => {
  fileSystem["software/scripts/advanced/llm/claude/claude-keys.common.jsonc"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/llm/claude/claude-keys.common.jsonc"),
    "utf-8",
  );
  fileSystem["software/scripts/advanced/llm/claude/claude-keys.windows.jsonc"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/llm/claude/claude-keys.windows.jsonc"),
    "utf-8",
  );

  // The live orchestrator loads these bindings before generating the merged config.
  const readJson = getIndexFunction("readJson");
  setSandboxGlobal("CLAUDE_COMMON_KEY_BINDINGS", await readJson`software/scripts/advanced/llm/claude/claude-keys.common.jsonc`);
  setSandboxGlobal("CLAUDE_WINDOWS_ONLY_KEY_BINDINGS", await readJson`software/scripts/advanced/llm/claude/claude-keys.windows.jsonc`);
});

describe("AI CLI keymap build - Claude Code", () => {
  it("produces the expected merged config for macOS (OS_KEY to meta)", () => {
    const config = getIndexFunction("_getKeyConfig")(true);
    expect(config).toMatchInlineSnapshot(`
      {
        "$docs": "https://code.claude.com/docs/en/keybindings",
        "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
        "bindings": [
          {
            "bindings": {
              "ctrl+end": "scroll:bottom",
              "ctrl+home": "scroll:top",
            },
            "context": "Scroll",
          },
          {
            "bindings": {
              "ctrl+t": "app:toggleTodos",
            },
            "context": "Global",
          },
          {
            "bindings": {
              "ctrl+a": null,
              "ctrl+e": null,
              "ctrl+enter": "chat:newline",
              "ctrl+g": "chat:externalEditor",
              "ctrl+l": "chat:clearInput",
              "ctrl+v": "chat:imagePaste",
              "ctrl+x": "chat:externalEditor",
              "end": null,
              "home": null,
              "meta+l": "chat:clearInput",
              "meta+z": "chat:undo",
              "shift+enter": "chat:newline",
            },
            "context": "Chat",
          },
        ],
      }
    `);
  });

  it("produces the expected merged config for Windows/Linux (OS_KEY to alt, alt+v nulled)", () => {
    const config = getIndexFunction("_getKeyConfig")(false);
    expect(config).toMatchInlineSnapshot(`
      {
        "$docs": "https://code.claude.com/docs/en/keybindings",
        "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
        "bindings": [
          {
            "bindings": {
              "ctrl+end": "scroll:bottom",
              "ctrl+home": "scroll:top",
            },
            "context": "Scroll",
          },
          {
            "bindings": {
              "ctrl+t": "app:toggleTodos",
            },
            "context": "Global",
          },
          {
            "bindings": {
              "alt+l": "chat:clearInput",
              "alt+v": null,
              "alt+z": "chat:undo",
              "ctrl+a": null,
              "ctrl+e": null,
              "ctrl+enter": "chat:newline",
              "ctrl+g": "chat:externalEditor",
              "ctrl+l": "chat:clearInput",
              "ctrl+v": "chat:imagePaste",
              "ctrl+x": "chat:externalEditor",
              "end": null,
              "home": null,
              "shift+enter": "chat:newline",
            },
            "context": "Chat",
          },
        ],
      }
    `);
  });
});
