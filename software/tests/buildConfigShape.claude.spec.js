import { describe, expect, it } from "vitest";

import { readBuildJson, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/claude-keys", () => {
  it("keeps generated Windows/Linux keybindings as JSON", () => {
    const filename = "claude-keys";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildJson(filename)).toMatchInlineSnapshot(`
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

describe(".build/claude-keys-mac", () => {
  it("keeps generated macOS keybindings as JSON", () => {
    const filename = "claude-keys-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildJson(filename)).toMatchInlineSnapshot(`
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
});
