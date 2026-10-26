import { describe, expect, it } from "vitest";

import { readBuildJson, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/vs-code-config", () => {
  it("keeps core editor, language, and remote settings", () => {
    const filename = "vs-code-config";
    if (warnIfBuildArtifactMissing(filename)) return;

    const config = readBuildJson(filename);
    expect(config["editor.codeActionsOnSave"]).toMatchInlineSnapshot(`
      {
        "source.fixAll": true,
        "source.fixAll.oxc": "always",
        "source.organizeImports": true,
      }
    `);
    expect(config["[javascript]"]).toMatchInlineSnapshot(`
      {
        "editor.defaultFormatter": "oxc.oxc-vscode",
      }
    `);
    expect(config["remote.SSH.remotePlatform"]).toMatchInlineSnapshot(`
      {
        "127.0.0.1": "linux",
      }
    `);
    expect(config["workbench.colorTheme"]).toMatchInlineSnapshot(`"Default High Contrast"`);
  });
});

describe(".build/vs-code-color-dark", () => {
  it("keeps dark workbench, semantic-token, and TextMate colors", () => {
    const filename = "vs-code-color-dark";
    if (warnIfBuildArtifactMissing(filename)) return;

    const config = readBuildJson(filename);
    const colors = config["workbench.colorCustomizations"];
    expect({
      "editor.background": colors["editor.background"],
      "editor.foreground": colors["editor.foreground"],
      "editorCursor.foreground": colors["editorCursor.foreground"],
      "editor.selectionBackground": colors["editor.selectionBackground"],
      "editorBracketHighlight.foreground1": colors["editorBracketHighlight.foreground1"],
    }).toMatchInlineSnapshot(`
      {
        "editor.background": "#0a0a0a",
        "editor.foreground": "#e8e8e8",
        "editor.selectionBackground": "#1b3c5e",
        "editorBracketHighlight.foreground1": "#dcdcaa",
        "editorCursor.foreground": "#5ca0d7",
      }
    `);
    expect(config["editor.semanticTokenColorCustomizations"]).toMatchInlineSnapshot(`
      {
        "enabled": true,
        "rules": {
          "customLiteral": "#dcdcaa",
          "newOperator": "#e8e8e8",
          "numberLiteral": "#b5cea8",
          "stringLiteral": "#ce9178",
        },
      }
    `);
    expect(config["editor.tokenColorCustomizations"].textMateRules.slice(0, 4)).toMatchInlineSnapshot(`
      [
        {
          "scope": [
            "comment",
            "punctuation.definition.comment",
          ],
          "settings": {
            "foreground": "#76a762",
          },
        },
        {
          "scope": [
            "string",
            "string.quoted",
          ],
          "settings": {
            "foreground": "#ce9178",
          },
        },
        {
          "scope": "constant.character.escape",
          "settings": {
            "foreground": "#d7ba7d",
          },
        },
        {
          "scope": "constant.numeric",
          "settings": {
            "foreground": "#b5cea8",
          },
        },
      ]
    `);
  });
});

describe(".build/vs-code-color-light", () => {
  it("keeps light workbench, semantic-token, and TextMate colors", () => {
    const filename = "vs-code-color-light";
    if (warnIfBuildArtifactMissing(filename)) return;

    const config = readBuildJson(filename);
    const colors = config["workbench.colorCustomizations"];
    expect({
      "editor.background": colors["editor.background"],
      "editor.foreground": colors["editor.foreground"],
      "editorCursor.foreground": colors["editorCursor.foreground"],
      "editor.selectionBackground": colors["editor.selectionBackground"],
      "editorBracketHighlight.foreground1": colors["editorBracketHighlight.foreground1"],
    }).toMatchInlineSnapshot(`
      {
        "editor.background": "#f8f8f8",
        "editor.foreground": "#1e1e1e",
        "editor.selectionBackground": "#96c6fa",
        "editorBracketHighlight.foreground1": "#6a5100",
        "editorCursor.foreground": "#0451a5",
      }
    `);
    expect(config["editor.semanticTokenColorCustomizations"]).toMatchInlineSnapshot(`
      {
        "enabled": true,
        "rules": {
          "customLiteral": "#6a5100",
          "newOperator": "#1e1e1e",
          "numberLiteral": "#03623a",
          "stringLiteral": "#a12626",
        },
      }
    `);
    expect(config["editor.tokenColorCustomizations"].textMateRules.slice(0, 4)).toMatchInlineSnapshot(`
      [
        {
          "scope": [
            "comment",
            "punctuation.definition.comment",
          ],
          "settings": {
            "foreground": "#004a15",
          },
        },
        {
          "scope": [
            "string",
            "string.quoted",
          ],
          "settings": {
            "foreground": "#a12626",
          },
        },
        {
          "scope": "constant.character.escape",
          "settings": {
            "foreground": "#734e06",
          },
        },
        {
          "scope": "constant.numeric",
          "settings": {
            "foreground": "#03623a",
          },
        },
      ]
    `);
  });
});

describe(".build/vs-code-keys-combined", () => {
  it("keeps the consumer-facing combined inventory bounded", () => {
    const filename = "vs-code-keys-combined";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(99);
    expect(bindings.length).toBeLessThanOrEqual(297);
  });
});

describe(".build/vs-code-keys-linux", () => {
  it("keeps the Linux sidebar shortcut and bounded inventory", () => {
    const filename = "vs-code-keys-linux";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(62);
    expect(bindings.length).toBeLessThanOrEqual(188);
    expect(bindings.find(({ command }) => command === "workbench.action.toggleSidebarVisibility")).toMatchInlineSnapshot(`
      {
        "command": "workbench.action.toggleSidebarVisibility",
        "key": "alt+\\",
      }
    `);
  });
});

describe(".build/vs-code-keys-mac", () => {
  it("keeps the macOS sidebar shortcut and bounded inventory", () => {
    const filename = "vs-code-keys-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(36);
    expect(bindings.length).toBeLessThanOrEqual(110);
    expect(bindings.find(({ command }) => command === "workbench.action.toggleSidebarVisibility")).toMatchInlineSnapshot(`
      {
        "command": "workbench.action.toggleSidebarVisibility",
        "key": "cmd+\\",
      }
    `);
  });
});

describe(".build/vs-code-keys-windows", () => {
  it("keeps the Windows sidebar shortcut and bounded inventory", () => {
    const filename = "vs-code-keys-windows";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(62);
    expect(bindings.length).toBeLessThanOrEqual(188);
    expect(bindings.find(({ command }) => command === "workbench.action.toggleSidebarVisibility")).toMatchInlineSnapshot(`
      {
        "command": "workbench.action.toggleSidebarVisibility",
        "key": "alt+\\",
      }
    `);
  });
});
