import { describe, expect, it } from "vitest";

import { readBuildJson, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/zed-config", () => {
  it("keeps prebuilt agent, AI, terminal, and theme settings", () => {
    const filename = "zed-config";
    if (warnIfBuildArtifactMissing(filename)) return;

    const config = readBuildJson(filename);
    expect(config.agent).toMatchInlineSnapshot(`
      {
        "dock": "right",
        "threads_sidebar": {
          "position": "right",
        },
        "tool_permissions": {
          "default": "allow",
        },
      }
    `);
    expect(config.edit_predictions).toMatchInlineSnapshot(`
      {
        "disabled_globs": [
          "**/*",
        ],
      }
    `);
    expect(config.terminal).toMatchInlineSnapshot(`
      {
        "max_scroll_history_lines": 200000,
        "minimum_contrast": 45,
        "option_as_meta": false,
        "shell": {
          "program": "bash",
        },
      }
    `);
    expect(config.theme).toMatchInlineSnapshot(`
      {
        "dark": "Sy Dark",
        "light": "Sy Light",
        "mode": "system",
      }
    `);
  });
});

describe(".build/zed-color-dark", () => {
  it("keeps the dark editor and selection colors", () => {
    const filename = "zed-color-dark";
    if (warnIfBuildArtifactMissing(filename)) return;

    const theme = readBuildJson(filename);
    const style = theme.themes[0].style;
    expect({
      name: theme.name,
      appearance: theme.themes[0].appearance,
      background: style.background,
      editorBackground: style["editor.background"],
      editorForeground: style["editor.foreground"],
      selectedElement: style["element.selected"],
      textAccent: style["text.accent"],
    }).toMatchInlineSnapshot(`
      {
        "appearance": "dark",
        "background": "#161616",
        "editorBackground": "#0a0a0a",
        "editorForeground": "#e8e8e8",
        "name": "Sy Dark",
        "selectedElement": "#1b3c5e",
        "textAccent": "#5ca0d7",
      }
    `);
  });
});

describe(".build/zed-color-light", () => {
  it("keeps the light editor and selection colors", () => {
    const filename = "zed-color-light";
    if (warnIfBuildArtifactMissing(filename)) return;

    const theme = readBuildJson(filename);
    const style = theme.themes[0].style;
    expect({
      name: theme.name,
      appearance: theme.themes[0].appearance,
      background: style.background,
      editorBackground: style["editor.background"],
      editorForeground: style["editor.foreground"],
      selectedElement: style["element.selected"],
      textAccent: style["text.accent"],
    }).toMatchInlineSnapshot(`
      {
        "appearance": "light",
        "background": "#ececec",
        "editorBackground": "#f8f8f8",
        "editorForeground": "#1e1e1e",
        "name": "Sy Light",
        "selectedElement": "#96c6fa",
        "textAccent": "#0033b3",
      }
    `);
  });
});

describe(".build/zed-keys-linux", () => {
  it("keeps Linux quit and terminal-copy shortcuts with bounded context groups", () => {
    const filename = "zed-keys-linux";
    if (warnIfBuildArtifactMissing(filename)) return;

    const keymap = readBuildJson(filename);
    expect(keymap.length).toBeGreaterThanOrEqual(2);
    expect(keymap.length).toBeLessThanOrEqual(8);
    expect(keymap[0].bindings["alt-q"]).toMatchInlineSnapshot(`"zed::Quit"`);
    expect(keymap[1].bindings["alt-c"]).toMatchInlineSnapshot(`"terminal::Copy"`);
  });
});

describe(".build/zed-keys-mac", () => {
  it("keeps macOS quit and terminal-copy shortcuts with bounded context groups", () => {
    const filename = "zed-keys-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    const keymap = readBuildJson(filename);
    expect(keymap.length).toBeGreaterThanOrEqual(2);
    expect(keymap.length).toBeLessThanOrEqual(8);
    expect(keymap[0].bindings["cmd-q"]).toMatchInlineSnapshot(`"zed::Quit"`);
    expect(keymap[1].bindings["cmd-c"]).toMatchInlineSnapshot(`"terminal::Copy"`);
  });
});

describe(".build/zed-lsp-config", () => {
  it("keeps the generated language-server binary overrides", () => {
    const filename = "zed-lsp-config";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildJson(filename).lsp).toMatchInlineSnapshot(`
      {
        "bash-language-server": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "bash-language-server",
          },
        },
        "eslint": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "vscode-eslint-language-server",
          },
        },
        "gopls": {
          "binary": {
            "arguments": [],
            "path": "gopls",
          },
        },
        "pyright": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "pyright-langserver",
          },
        },
        "rust-analyzer": {
          "binary": {
            "arguments": [],
            "path": "rust-analyzer",
          },
        },
        "tailwindcss-language-server": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "tailwindcss-language-server",
          },
        },
        "typescript-language-server": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "typescript-language-server",
          },
        },
        "vscode-css-language-server": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "vscode-css-language-server",
          },
        },
        "vscode-json-language-server": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "vscode-json-language-server",
          },
        },
        "vue-language-server": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "vue-language-server",
          },
        },
        "yaml-language-server": {
          "binary": {
            "arguments": [
              "--stdio",
            ],
            "path": "yaml-language-server",
          },
        },
      }
    `);
  });
});
