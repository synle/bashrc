/** Shape tests for generated JSON/JSONC config files in .build/. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/** Strip JSONC comments (// ... lines) and parse JSON. */
function parseJsonc(text) {
  const stripped = text.replace(/^\s*\/\/.*$/gm, "").trim();
  return JSON.parse(stripped);
}

/** Read and parse a .build config file, returning sorted top-level keys. */
function readBuildConfigKeys(filename) {
  const filePath = path.resolve(".build", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const data = parseJsonc(content);
  return Object.keys(data).sort();
}

/** Read and parse a .build array config file, returning length and first-element keys. */
function readBuildArrayShape(filename) {
  const filePath = path.resolve(".build", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const data = parseJsonc(content);
  const shape = { length: data.length };
  if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    shape.firstElementKeys = Object.keys(data[0]).sort();
  }
  return shape;
}

/** Get file size in bytes for a .build config file. */
function readBuildFileSize(filename) {
  const filePath = path.resolve(".build", filename);
  return fs.statSync(filePath).size;
}

// ---- minimum file size thresholds (approximately 95% of current size, rounded) ----

const MIN_FILE_SIZES = {
  "sublime-merge": 200,
  "sublime-merge-keys-mac": 1400,
  "sublime-merge-keys-windows": 2300,
  "sublime-text-config": 4000,
  "sublime-text-config-mac": 4000,
  "vs-code-color-dark": 8000,
  "vs-code-color-light": 8000,
  "vs-code-config": 35300,
  "vs-code-config-mac": 35400,
  "zed-editor-color-dark": 7100,
  "zed-editor-color-light": 7100,
  "zed-editor-config": 4500,
  "zed-editor-config-mac": 4500,
  "sublime-text-keys-linux": 8200,
  "sublime-text-keys-mac": 4000,
  "sublime-text-keys-windows": 8200,
  "sublime-text-mouse": 500,
  "sublime-text-mouse-mac": 500,
  "vs-code-keys-combined": 17700,
  "zed-editor-keys": 2700,
  "zed-editor-keys-linux": 5600,
  "zed-editor-keys-windows": 5600,
  "ip-address.config.hostnamesFlattened": 1800,
};

// ---- file size threshold tests ----

describe("build config file size thresholds", () => {
  for (const [name, minSize] of Object.entries(MIN_FILE_SIZES)) {
    const filePath = path.resolve(".build", name);
    const fileExists = fs.existsSync(filePath);

    it.skipIf(!fileExists)(`${name} should be at least ${minSize} bytes`, () => {
      const size = readBuildFileSize(name);
      expect(size).toBeGreaterThanOrEqual(minSize);
    });
  }
});

// ---- object config tests ----

describe("build config shape - objects", () => {
  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-merge")))("sublime-merge", () => {
    expect(readBuildConfigKeys("sublime-merge")).toMatchInlineSnapshot(`
      [
        "dark_theme",
        "draw_white_space",
        "expand_merge_commits_by_default",
        "font_face",
        "font_size",
        "hardware_acceleration",
        "hide_menu",
        "light_theme",
        "scroll_speed",
        "side_bar_layout",
        "tab_size",
        "theme",
        "translate_tabs_to_spaces",
        "update_check",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-text-config")))("sublime-text-config", () => {
    expect(readBuildConfigKeys("sublime-text-config")).toMatchInlineSnapshot(`
      [
        "alignment_chars",
        "animation_enabled",
        "atomic_save",
        "auto_complete_commit_on_tab",
        "auto_hide_menu",
        "bold_folder_labels",
        "close_windows_when_empty",
        "color_scheme",
        "dark_color_scheme",
        "dark_theme",
        "default_line_ending",
        "draw_white_space",
        "ensure_newline_at_eof_on_save",
        "fade_fold_buttons",
        "file_exclude_patterns",
        "folder_exclude_patterns",
        "font_face",
        "font_options",
        "font_size",
        "gpu_window_buffer",
        "hardware_acceleration",
        "highlight_line",
        "highlight_modified_tabs",
        "hot_exit",
        "ignored_packages",
        "index_exclude_gitignore",
        "index_exclude_patterns",
        "index_workers",
        "inlay_hints_enabled",
        "light_color_scheme",
        "light_theme",
        "line_padding_top",
        "mini_diff",
        "open_externally_patterns",
        "preview_on_click",
        "remember_open_files",
        "rulers",
        "scroll_speed",
        "show_definitions",
        "show_folding_buttons",
        "show_git_status",
        "show_line_endings",
        "show_tab_close_buttons",
        "sidebar_font_size",
        "spell_check",
        "tab_size",
        "theme",
        "translate_tabs_to_spaces",
        "tree_animation_enabled",
        "trim_trailing_white_space_on_save",
        "update_check",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-text-config-mac")))("sublime-text-config-mac", () => {
    expect(readBuildConfigKeys("sublime-text-config-mac")).toMatchInlineSnapshot(`
      [
        "alignment_chars",
        "animation_enabled",
        "atomic_save",
        "auto_complete_commit_on_tab",
        "auto_hide_menu",
        "bold_folder_labels",
        "close_windows_when_empty",
        "color_scheme",
        "dark_color_scheme",
        "dark_theme",
        "default_line_ending",
        "draw_white_space",
        "ensure_newline_at_eof_on_save",
        "fade_fold_buttons",
        "file_exclude_patterns",
        "folder_exclude_patterns",
        "font_face",
        "font_options",
        "font_size",
        "gpu_window_buffer",
        "hardware_acceleration",
        "highlight_line",
        "highlight_modified_tabs",
        "hot_exit",
        "ignored_packages",
        "index_exclude_gitignore",
        "index_exclude_patterns",
        "index_workers",
        "inlay_hints_enabled",
        "light_color_scheme",
        "light_theme",
        "line_padding_top",
        "mini_diff",
        "open_externally_patterns",
        "preview_on_click",
        "remember_open_files",
        "rulers",
        "scroll_speed",
        "show_definitions",
        "show_folding_buttons",
        "show_git_status",
        "show_line_endings",
        "show_tab_close_buttons",
        "sidebar_font_size",
        "spell_check",
        "tab_size",
        "theme",
        "translate_tabs_to_spaces",
        "tree_animation_enabled",
        "trim_trailing_white_space_on_save",
        "update_check",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "vs-code-color-dark")))("vs-code-color-dark", () => {
    expect(readBuildConfigKeys("vs-code-color-dark")).toMatchInlineSnapshot(`
      [
        "editor.tokenColorCustomizations",
        "workbench.colorCustomizations",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "vs-code-color-light")))("vs-code-color-light", () => {
    expect(readBuildConfigKeys("vs-code-color-light")).toMatchInlineSnapshot(`
      [
        "editor.tokenColorCustomizations",
        "workbench.colorCustomizations",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "vs-code-config")))("vs-code-config", () => {
    expect(readBuildConfigKeys("vs-code-config")).toMatchInlineSnapshot(`
      [
        "[graphql]",
        "[handlebars]",
        "[html]",
        "[javascript]",
        "[javascriptreact]",
        "[json]",
        "[markdown]",
        "[plaintext]",
        "[typescript]",
        "[typescriptreact]",
        "[xml]",
        "[yaml]",
        "breadcrumbs.enabled",
        "chat.agent.enabled",
        "chat.editor.fontSize",
        "chat.mcp.enabled",
        "editor.accessibilitySupport",
        "editor.bracketPairColorization.enabled",
        "editor.codeActionsOnSave",
        "editor.codeLens",
        "editor.copyWithSyntaxHighlighting",
        "editor.cursorBlinking",
        "editor.dragAndDrop",
        "editor.emptySelectionClipboard",
        "editor.fastScrollSensitivity",
        "editor.folding",
        "editor.fontFamily",
        "editor.fontLigatures",
        "editor.fontSize",
        "editor.fontWeight",
        "editor.formatOnPaste",
        "editor.guides.indentation",
        "editor.hover.delay",
        "editor.hover.enabled",
        "editor.lightbulb.enabled",
        "editor.linkedEditing",
        "editor.links",
        "editor.matchBrackets",
        "editor.maxTokenizationLineLength",
        "editor.minimap.enabled",
        "editor.mouseWheelScrollSensitivity",
        "editor.multiCursorModifier",
        "editor.occurrencesHighlight",
        "editor.quickSuggestionsDelay",
        "editor.renderControlCharacters",
        "editor.renderLineHighlight",
        "editor.renderWhitespace",
        "editor.selectionHighlight",
        "editor.showUnused",
        "editor.smoothScrolling",
        "editor.snippetSuggestions",
        "editor.suggest.snippetsPreventQuickSuggestions",
        "editor.suggestSelection",
        "editor.tabSize",
        "editor.tokenColorCustomizations",
        "editor.unicodeHighlight.ambiguousCharacters",
        "editor.unicodeHighlight.invisibleCharacters",
        "editor.wordWrap",
        "editor.wordWrapColumn",
        "explorer.copyRelativePathSeparator",
        "extensions.autoCheckUpdates",
        "extensions.autoUpdate",
        "extensions.ignoreRecommendations",
        "files.eol",
        "files.exclude",
        "files.hotExit",
        "files.insertFinalNewline",
        "files.trimTrailingWhitespace",
        "files.watcherExclude",
        "git.autofetch",
        "git.autorefresh",
        "git.decorations.enabled",
        "git.enabled",
        "git.ignoreLimitWarning",
        "github.codespaces.showStatusbar",
        "github.copilot.enable",
        "javascript.inlayHints.variableTypes.enabled",
        "javascript.suggestionActions.enabled",
        "javascript.updateImportsOnFileMove.enabled",
        "remote.SSH.connectTimeout",
        "remote.SSH.localServerDownload",
        "remote.SSH.remotePlatform",
        "scm.diffDecorations",
        "scm.inputFontSize",
        "search.exclude",
        "search.followSymlinks",
        "search.useIgnoreFiles",
        "security.workspace.trust.enabled",
        "telemetry.telemetryLevel",
        "terminal.integrated.defaultProfile.linux",
        "terminal.integrated.defaultProfile.osx",
        "terminal.integrated.enablePersistentSessions",
        "terminal.integrated.fontSize",
        "terminal.integrated.gpuAcceleration",
        "typescript.inlayHints.variableTypes.enabled",
        "typescript.suggestionActions.enabled",
        "typescript.updateImportsOnFileMove.enabled",
        "update.mode",
        "update.showReleaseNotes",
        "window.autoDetectColorScheme",
        "window.newWindowDimensions",
        "window.restoreWindows",
        "window.zoomLevel",
        "workbench.activityBar.location",
        "workbench.colorCustomizations",
        "workbench.colorTheme",
        "workbench.editor.enablePreview",
        "workbench.editor.limit.enabled",
        "workbench.editor.limit.perEditorGroup",
        "workbench.editor.limit.value",
        "workbench.editor.showTabs",
        "workbench.enableExperiments",
        "workbench.iconTheme",
        "workbench.list.smoothScrolling",
        "workbench.preferredDarkColorTheme",
        "workbench.preferredLightColorTheme",
        "workbench.settings.enableNaturalLanguageSearch",
        "workbench.startupEditor",
        "workbench.tree.indent",
        "workbench.tree.renderIndentGuides",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "vs-code-config-mac")))("vs-code-config-mac", () => {
    expect(readBuildConfigKeys("vs-code-config-mac")).toMatchInlineSnapshot(`
      [
        "[graphql]",
        "[handlebars]",
        "[html]",
        "[javascript]",
        "[javascriptreact]",
        "[json]",
        "[markdown]",
        "[plaintext]",
        "[typescript]",
        "[typescriptreact]",
        "[xml]",
        "[yaml]",
        "breadcrumbs.enabled",
        "chat.agent.enabled",
        "chat.editor.fontSize",
        "chat.mcp.enabled",
        "editor.accessibilitySupport",
        "editor.bracketPairColorization.enabled",
        "editor.codeActionsOnSave",
        "editor.codeLens",
        "editor.copyWithSyntaxHighlighting",
        "editor.cursorBlinking",
        "editor.dragAndDrop",
        "editor.emptySelectionClipboard",
        "editor.fastScrollSensitivity",
        "editor.folding",
        "editor.fontFamily",
        "editor.fontLigatures",
        "editor.fontSize",
        "editor.fontWeight",
        "editor.formatOnPaste",
        "editor.guides.indentation",
        "editor.hover.delay",
        "editor.hover.enabled",
        "editor.lightbulb.enabled",
        "editor.linkedEditing",
        "editor.links",
        "editor.matchBrackets",
        "editor.maxTokenizationLineLength",
        "editor.minimap.enabled",
        "editor.mouseWheelScrollSensitivity",
        "editor.multiCursorModifier",
        "editor.occurrencesHighlight",
        "editor.quickSuggestionsDelay",
        "editor.renderControlCharacters",
        "editor.renderLineHighlight",
        "editor.renderWhitespace",
        "editor.selectionHighlight",
        "editor.showUnused",
        "editor.smoothScrolling",
        "editor.snippetSuggestions",
        "editor.suggest.snippetsPreventQuickSuggestions",
        "editor.suggestSelection",
        "editor.tabSize",
        "editor.tokenColorCustomizations",
        "editor.unicodeHighlight.ambiguousCharacters",
        "editor.unicodeHighlight.invisibleCharacters",
        "editor.wordWrap",
        "editor.wordWrapColumn",
        "explorer.copyRelativePathSeparator",
        "extensions.autoCheckUpdates",
        "extensions.autoUpdate",
        "extensions.ignoreRecommendations",
        "files.eol",
        "files.exclude",
        "files.hotExit",
        "files.insertFinalNewline",
        "files.trimTrailingWhitespace",
        "files.watcherExclude",
        "git.autofetch",
        "git.autorefresh",
        "git.decorations.enabled",
        "git.enabled",
        "git.ignoreLimitWarning",
        "github.codespaces.showStatusbar",
        "github.copilot.enable",
        "javascript.inlayHints.variableTypes.enabled",
        "javascript.suggestionActions.enabled",
        "javascript.updateImportsOnFileMove.enabled",
        "remote.SSH.connectTimeout",
        "remote.SSH.localServerDownload",
        "remote.SSH.remotePlatform",
        "scm.diffDecorations",
        "scm.inputFontSize",
        "search.exclude",
        "search.followSymlinks",
        "search.useIgnoreFiles",
        "security.workspace.trust.enabled",
        "telemetry.telemetryLevel",
        "terminal.integrated.defaultProfile.linux",
        "terminal.integrated.defaultProfile.osx",
        "terminal.integrated.enablePersistentSessions",
        "terminal.integrated.fontSize",
        "terminal.integrated.gpuAcceleration",
        "typescript.inlayHints.variableTypes.enabled",
        "typescript.suggestionActions.enabled",
        "typescript.updateImportsOnFileMove.enabled",
        "update.mode",
        "update.showReleaseNotes",
        "window.autoDetectColorScheme",
        "window.newWindowDimensions",
        "window.restoreWindows",
        "window.zoomLevel",
        "workbench.activityBar.location",
        "workbench.colorCustomizations",
        "workbench.colorTheme",
        "workbench.editor.enablePreview",
        "workbench.editor.limit.enabled",
        "workbench.editor.limit.perEditorGroup",
        "workbench.editor.limit.value",
        "workbench.editor.showTabs",
        "workbench.enableExperiments",
        "workbench.fontAliasing",
        "workbench.iconTheme",
        "workbench.list.smoothScrolling",
        "workbench.preferredDarkColorTheme",
        "workbench.preferredLightColorTheme",
        "workbench.settings.enableNaturalLanguageSearch",
        "workbench.startupEditor",
        "workbench.tree.indent",
        "workbench.tree.renderIndentGuides",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "zed-editor-color-dark")))("zed-editor-color-dark", () => {
    expect(readBuildConfigKeys("zed-editor-color-dark")).toMatchInlineSnapshot(`
      [
        "$schema",
        "author",
        "name",
        "themes",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "zed-editor-color-light")))("zed-editor-color-light", () => {
    expect(readBuildConfigKeys("zed-editor-color-light")).toMatchInlineSnapshot(`
      [
        "$schema",
        "author",
        "name",
        "themes",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "zed-editor-config")))("zed-editor-config", () => {
    expect(readBuildConfigKeys("zed-editor-config")).toMatchInlineSnapshot(`
      [
        "auto_indent_on_paste",
        "auto_install_extensions",
        "auto_update",
        "buffer_font_family",
        "buffer_font_size",
        "buffer_font_weight",
        "colorize_brackets",
        "cursor_blink",
        "ensure_final_newline_on_save",
        "file_scan_exclusions",
        "format_on_save",
        "git",
        "gutter",
        "hard_tabs",
        "icon_theme",
        "indent_guides",
        "languages",
        "linked_edits",
        "minimap",
        "multi_cursor_modifier",
        "preferred_line_length",
        "remove_trailing_whitespace_on_save",
        "scrollbar",
        "search",
        "session",
        "show_whitespaces",
        "soft_wrap",
        "tab_size",
        "tabs",
        "telemetry",
        "terminal",
        "theme",
        "toolbar",
        "ui_font_size",
        "vim_mode",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "zed-editor-config-mac")))("zed-editor-config-mac", () => {
    expect(readBuildConfigKeys("zed-editor-config-mac")).toMatchInlineSnapshot(`
      [
        "auto_indent_on_paste",
        "auto_install_extensions",
        "auto_update",
        "buffer_font_family",
        "buffer_font_size",
        "buffer_font_weight",
        "colorize_brackets",
        "cursor_blink",
        "ensure_final_newline_on_save",
        "file_scan_exclusions",
        "format_on_save",
        "git",
        "gutter",
        "hard_tabs",
        "icon_theme",
        "indent_guides",
        "languages",
        "linked_edits",
        "minimap",
        "multi_cursor_modifier",
        "preferred_line_length",
        "remove_trailing_whitespace_on_save",
        "scrollbar",
        "search",
        "session",
        "show_whitespaces",
        "soft_wrap",
        "tab_size",
        "tabs",
        "telemetry",
        "terminal",
        "theme",
        "toolbar",
        "ui_font_size",
        "vim_mode",
      ]
    `);
  });
});

// ---- array config tests ----

describe("build config shape - arrays", () => {
  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-merge-keys-mac")))("sublime-merge-keys-mac", () => {
    const shape = readBuildArrayShape("sublime-merge-keys-mac");
    expect(shape.length).toBeGreaterThanOrEqual(10);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-merge-keys-windows")))("sublime-merge-keys-windows", () => {
    const shape = readBuildArrayShape("sublime-merge-keys-windows");
    expect(shape.length).toBeGreaterThanOrEqual(20);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-text-keys-linux")))("sublime-text-keys-linux", () => {
    const shape = readBuildArrayShape("sublime-text-keys-linux");
    expect(shape.length).toBeGreaterThanOrEqual(70);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-text-keys-mac")))("sublime-text-keys-mac", () => {
    const shape = readBuildArrayShape("sublime-text-keys-mac");
    expect(shape.length).toMatchInlineSnapshot("31");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-text-keys-windows")))("sublime-text-keys-windows", () => {
    const shape = readBuildArrayShape("sublime-text-keys-windows");
    expect(shape.length).toBeGreaterThanOrEqual(70);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "keys",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-text-mouse")))("sublime-text-mouse", () => {
    const shape = readBuildArrayShape("sublime-text-mouse");
    expect(shape.length).toMatchInlineSnapshot("5");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "button",
        "command",
        "count",
        "modifiers",
        "press_command",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "sublime-text-mouse-mac")))("sublime-text-mouse-mac", () => {
    const shape = readBuildArrayShape("sublime-text-mouse-mac");
    expect(shape.length).toMatchInlineSnapshot("5");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "button",
        "command",
        "count",
        "modifiers",
        "press_command",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "vs-code-keys-combined")))("vs-code-keys-combined", () => {
    const shape = readBuildArrayShape("vs-code-keys-combined");
    expect(shape.length).toBeGreaterThanOrEqual(150);
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "command",
        "key",
        "when",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "zed-editor-keys")))("zed-editor-keys", () => {
    const shape = readBuildArrayShape("zed-editor-keys");
    expect(shape.length).toMatchInlineSnapshot("2");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "bindings",
        "context",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "zed-editor-keys-linux")))("zed-editor-keys-linux", () => {
    const shape = readBuildArrayShape("zed-editor-keys-linux");
    expect(shape.length).toMatchInlineSnapshot("2");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "bindings",
        "context",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "zed-editor-keys-windows")))("zed-editor-keys-windows", () => {
    const shape = readBuildArrayShape("zed-editor-keys-windows");
    expect(shape.length).toMatchInlineSnapshot("2");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "bindings",
        "context",
      ]
    `);
  });

  it.skipIf(!fs.existsSync(path.resolve(".build", "ip-address.config.hostnamesFlattened")))("ip-address.config.hostnamesFlattened", () => {
    const shape = readBuildArrayShape("ip-address.config.hostnamesFlattened");
    expect(shape.length).toMatchInlineSnapshot("11");
    expect(shape.firstElementKeys).toMatchInlineSnapshot(`
      [
        "0",
        "1",
        "2",
      ]
    `);
  });
});
