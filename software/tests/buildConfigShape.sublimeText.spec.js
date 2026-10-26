import { describe, expect, it } from "vitest";

import { readBuildJson, readBuildText, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

/** Removes insignificant trailing spaces from package-list comments before snapshotting. */
function normalizePackageList(content) {
  return content.replace(/[ \t]+$/gm, "");
}

describe(".build/sublime-text-config", () => {
  it("keeps editor, font, and appearance settings", () => {
    const filename = "sublime-text-config";
    if (warnIfBuildArtifactMissing(filename)) return;

    const config = readBuildJson(filename);
    expect({
      font_face: config.font_face,
      font_options: config.font_options,
      font_size: config.font_size,
      sidebar_font_size: config.sidebar_font_size,
      tab_size: config.tab_size,
      translate_tabs_to_spaces: config.translate_tabs_to_spaces,
      trim_trailing_white_space_on_save: config.trim_trailing_white_space_on_save,
    }).toMatchInlineSnapshot(`
      {
        "font_face": "Courier New",
        "font_options": [
          "gray_antialias",
          "subpixel_antialias",
          "bold",
        ],
        "font_size": 16,
        "sidebar_font_size": 16,
        "tab_size": 2,
        "translate_tabs_to_spaces": true,
        "trim_trailing_white_space_on_save": "all",
      }
    `);
    expect({
      color_scheme: config.color_scheme,
      dark_color_scheme: config.dark_color_scheme,
      light_color_scheme: config.light_color_scheme,
      theme: config.theme,
      dark_theme: config.dark_theme,
      light_theme: config.light_theme,
    }).toMatchInlineSnapshot(`
      {
        "color_scheme": "auto",
        "dark_color_scheme": "Mariana.sublime-color-scheme",
        "dark_theme": "Adaptive.sublime-theme",
        "light_color_scheme": "Breakers.sublime-color-scheme",
        "light_theme": "Adaptive.sublime-theme",
        "theme": "auto",
      }
    `);
    expect(config.file_exclude_patterns).toContain("*.bak_original");
  });
});

describe(".build/sublime-text-config-mac", () => {
  it("keeps macOS editor, font, and appearance settings", () => {
    const filename = "sublime-text-config-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    const config = readBuildJson(filename);
    expect({
      font_face: config.font_face,
      font_options: config.font_options,
      font_size: config.font_size,
      sidebar_font_size: config.sidebar_font_size,
      tab_size: config.tab_size,
      translate_tabs_to_spaces: config.translate_tabs_to_spaces,
      trim_trailing_white_space_on_save: config.trim_trailing_white_space_on_save,
    }).toMatchInlineSnapshot(`
      {
        "font_face": "Courier New",
        "font_options": [
          "gray_antialias",
          "subpixel_antialias",
          "bold",
        ],
        "font_size": 16,
        "sidebar_font_size": 16,
        "tab_size": 2,
        "translate_tabs_to_spaces": true,
        "trim_trailing_white_space_on_save": "all",
      }
    `);
    expect({
      color_scheme: config.color_scheme,
      dark_color_scheme: config.dark_color_scheme,
      light_color_scheme: config.light_color_scheme,
      theme: config.theme,
      dark_theme: config.dark_theme,
      light_theme: config.light_theme,
    }).toMatchInlineSnapshot(`
      {
        "color_scheme": "auto",
        "dark_color_scheme": "Mariana.sublime-color-scheme",
        "dark_theme": "Adaptive.sublime-theme",
        "light_color_scheme": "Breakers.sublime-color-scheme",
        "light_theme": "Adaptive.sublime-theme",
        "theme": "auto",
      }
    `);
    expect(config.file_exclude_patterns).toContain("*.bak_original");
  });
});

describe(".build/sublime-text-ext", () => {
  it("keeps the package installation list", () => {
    const filename = "sublime-text-ext";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(normalizePackageList(readBuildText(filename))).toMatchInlineSnapshot(`
      "# Use Preferences > Package Control > Package Control: Advanced Install Package.
      A File Icon,LSP,LSP-css,LSP-html,LSP-json,LSP-pyright,LSP-typescript,Sass,TypeScript,CodeFormatter,JsPrettier,Alignment,All Autocomplete,BracketHighlighter,Case Conversion,DocBlockr,SideBarEnhancements,SyncedSideBar,GitGutter,Compare Side-By-Side,MarkdownPreview,SublimeLinter"
    `);
  });
});

describe(".build/sublime-text-ext-lsp", () => {
  it("keeps the language-server package installation list", () => {
    const filename = "sublime-text-ext-lsp";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(normalizePackageList(readBuildText(filename))).toMatchInlineSnapshot(`
      "# Use Preferences > Package Control > Package Control: Advanced Install Package.
      LSP,LSP-SQL,LSP-bash,LSP-css,LSP-dockerfile,LSP-eslint,LSP-gopls,LSP-graphql,LSP-html,LSP-jdtls,LSP-json,LSP-marksman,LSP-prisma,LSP-pyright,LSP-rust-analyzer,LSP-tailwindcss,LSP-typescript,LSP-volar,LSP-yaml"
    `);
  });
});

describe(".build/sublime-text-keys-linux", () => {
  it("keeps Linux definition binding and a bounded inventory", () => {
    const filename = "sublime-text-keys-linux";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(46);
    expect(bindings.length).toBeLessThanOrEqual(138);
    expect(bindings.find(({ command }) => command === "goto_definition")).toMatchInlineSnapshot(`
      {
        "command": "goto_definition",
        "keys": [
          "alt+enter",
        ],
      }
    `);
  });
});

describe(".build/sublime-text-keys-mac", () => {
  it("keeps macOS definition binding and a bounded inventory", () => {
    const filename = "sublime-text-keys-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(24);
    expect(bindings.length).toBeLessThanOrEqual(72);
    expect(bindings.find(({ command }) => command === "goto_definition")).toMatchInlineSnapshot(`
      {
        "command": "goto_definition",
        "keys": [
          "super+enter",
        ],
      }
    `);
  });
});

describe(".build/sublime-text-keys-windows", () => {
  it("keeps Windows definition binding and a bounded inventory", () => {
    const filename = "sublime-text-keys-windows";
    if (warnIfBuildArtifactMissing(filename)) return;

    const bindings = readBuildJson(filename);
    expect(bindings.length).toBeGreaterThanOrEqual(46);
    expect(bindings.length).toBeLessThanOrEqual(138);
    expect(bindings.find(({ command }) => command === "goto_definition")).toMatchInlineSnapshot(`
      {
        "command": "goto_definition",
        "keys": [
          "alt+enter",
        ],
      }
    `);
  });
});

describe(".build/sublime-text-mouse", () => {
  it("keeps the non-macOS mouse map", () => {
    const filename = "sublime-text-mouse";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildJson(filename)).toMatchInlineSnapshot(`
      [
        {
          "button": "button1",
          "command": "goto_definition",
          "count": 1,
          "modifiers": [
            "alt",
          ],
          "press_command": "drag_select",
        },
        {
          "button": "button2",
          "command": "goto_reference",
          "count": 1,
          "modifiers": [
            "alt",
          ],
        },
        {
          "button": "button4",
          "command": "jump_back",
        },
        {
          "button": "button5",
          "command": "jump_forward",
        },
        {
          "args": {
            "to": "scope",
          },
          "button": "button1",
          "command": "expand_selection",
          "count": 3,
        },
      ]
    `);
  });
});

describe(".build/sublime-text-mouse-mac", () => {
  it("keeps the macOS mouse map", () => {
    const filename = "sublime-text-mouse-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildJson(filename)).toMatchInlineSnapshot(`
      [
        {
          "button": "button1",
          "command": "goto_definition",
          "count": 1,
          "modifiers": [
            "super",
          ],
          "press_command": "drag_select",
        },
        {
          "button": "button2",
          "command": "goto_reference",
          "count": 1,
          "modifiers": [
            "super",
          ],
        },
        {
          "button": "button4",
          "command": "jump_back",
        },
        {
          "button": "button5",
          "command": "jump_forward",
        },
        {
          "args": {
            "to": "scope",
          },
          "button": "button1",
          "command": "expand_selection",
          "count": 3,
        },
      ]
    `);
  });
});
