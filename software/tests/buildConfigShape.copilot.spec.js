import { describe, expect, it } from "vitest";

import { readBuildJson, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/copilot-keys", () => {
  it("keeps generated Windows/Linux keybindings as JSON", () => {
    const filename = "copilot-keys";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildJson(filename)).toMatchInlineSnapshot(`
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

describe(".build/copilot-keys-mac", () => {
  it("keeps generated macOS keybindings as JSON", () => {
    const filename = "copilot-keys-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildJson(filename)).toMatchInlineSnapshot(`
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
});
