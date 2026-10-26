/** Verifies GitHub Copilot CLI keymap generation on macOS and Windows/Linux. */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileSystem, loadScriptHelpers, getIndexFunction, setSandboxGlobal } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/copilot/setup.js");
});

beforeEach(async () => {
  fileSystem["software/scripts/advanced/llm/copilot/copilot-keys.common.jsonc"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/llm/copilot/copilot-keys.common.jsonc"),
    "utf-8",
  );
  fileSystem["software/scripts/advanced/llm/copilot/copilot-keys.windows.jsonc"] = fs.readFileSync(
    path.resolve("software/scripts/advanced/llm/copilot/copilot-keys.windows.jsonc"),
    "utf-8",
  );

  // The live orchestrator loads these bindings before generating the merged config.
  const readJson = getIndexFunction("readJson");
  setSandboxGlobal("COPILOT_COMMON_KEY_BINDINGS", await readJson`software/scripts/advanced/llm/copilot/copilot-keys.common.jsonc`);
  setSandboxGlobal("COPILOT_WINDOWS_ONLY_KEY_BINDINGS", await readJson`software/scripts/advanced/llm/copilot/copilot-keys.windows.jsonc`);
});

describe("AI CLI keymap build - GitHub Copilot CLI", () => {
  it("produces the expected merged config for macOS (OS_KEY to meta)", () => {
    const config = getIndexFunction("_getCopilotKeyConfig")(true);
    expect(config).toMatchInlineSnapshot(`
      {
        "$docs": "https://docs.github.com/copilot/concepts/agents/about-copilot-cli",
        "$schema": "https://example.invalid/copilot-cli-keybindings.json",
        "bindings": [
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
    const config = getIndexFunction("_getCopilotKeyConfig")(false);
    expect(config).toMatchInlineSnapshot(`
      {
        "$docs": "https://docs.github.com/copilot/concepts/agents/about-copilot-cli",
        "$schema": "https://example.invalid/copilot-cli-keybindings.json",
        "bindings": [
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
