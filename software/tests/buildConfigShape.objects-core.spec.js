import { describe, it, expect } from "vitest";

import fs from "fs";

import path from "path";

function parseJsonc(text) {
  const stripped = text.replace(/^\s*\/\/.*$/gm, "").trim();
  return JSON.parse(stripped);
}

function readBuildConfigKeys(filename) {
  const filePath = path.resolve(".build", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const data = parseJsonc(content);
  return Object.keys(data).sort();
}

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

function readBuildFileSize(filename) {
  const filePath = path.resolve(".build", filename);
  return fs.statSync(filePath).size;
}

const MIN_FILE_SIZES = {
  "sublime-merge": 200,
  "sublime-merge-keys-mac": 1400,
  "sublime-merge-keys-windows": 2300,
  "sublime-text-config": 4000,
  "sublime-text-config-mac": 4000,
  "vs-code-color-dark": 8000,
  "vs-code-color-light": 8000,
  "vs-code-config": 28100,
  "vs-code-config-mac": 35400,
  "zed-color-dark": 7100,
  "zed-color-light": 7100,
  "zed-config": 3600,
  "sublime-text-keys-linux": 8200,
  "sublime-text-keys-mac": 4000,
  "sublime-text-keys-windows": 8200,
  "sublime-text-mouse": 500,
  "sublime-text-mouse-mac": 500,
  "vs-code-keys-combined": 17700,
  "zed-keys": 2700,
  "zed-keys-linux": 380,
  "zed-keys-windows": 5600,
  "ip-address.config.hostnamesFlattened": 1800,
};

describe("build config shape - objects", () => {
it("vs-code-config", () => {
    if (!fs.existsSync(path.resolve(".build", "vs-code-config"))) {
      console.warn("  [WARNING] .build/vs-code-config not found — skipping (not generated in this environment)");
      return;
    }
    expect(readBuildConfigKeys("vs-code-config")).toMatchInlineSnapshot(`
      [
        "[Default High Contrast Light]",
        "[Default High Contrast]",
        "[css]",
        "[go]",
        "[graphql]",
        "[html]",
        "[java]",
        "[javascript]",
        "[javascriptreact]",
        "[json]",
        "[jsonc]",
        "[less]",
        "[markdown]",
        "[python]",
        "[rust]",
        "[scss]",
        "[typescript]",
        "[typescriptreact]",
        "[vue]",
        "[xml]",
        "[yaml]",
        "breadcrumbs.enabled",
        "chat.agent.enabled",
        "chat.mcp.enabled",
        "claudeCode.allowDangerouslySkipPermissions",
        "editor.accessibilitySupport",
        "editor.bracketPairColorization.enabled",
        "editor.codeActionsOnSave",
        "editor.codeLens",
        "editor.copyWithSyntaxHighlighting",
        "editor.cursorBlinking",
        "editor.defaultFormatter",
        "editor.dragAndDrop",
        "editor.emptySelectionClipboard",
        "editor.fastScrollSensitivity",
        "editor.folding",
        "editor.fontFamily",
        "editor.fontLigatures",
        "editor.fontSize",
        "editor.fontWeight",
        "editor.formatOnPaste",
        "editor.formatOnSave",
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
        "editor.rulers",
        "editor.selectionHighlight",
        "editor.showUnused",
        "editor.smoothScrolling",
        "editor.snippetSuggestions",
        "editor.suggest.snippetsPreventQuickSuggestions",
        "editor.suggestSelection",
        "editor.tabSize",
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
        "search.exclude",
        "search.followSymlinks",
        "search.useIgnoreFiles",
        "security.workspace.trust.banner",
        "security.workspace.trust.emptyWindow",
        "security.workspace.trust.enabled",
        "security.workspace.trust.startupPrompt",
        "security.workspace.trust.untrustedFiles",
        "telemetry.telemetryLevel",
        "terminal.integrated.commandsToSkipShell",
        "terminal.integrated.defaultLocation",
        "terminal.integrated.defaultProfile.linux",
        "terminal.integrated.defaultProfile.osx",
        "terminal.integrated.enablePersistentSessions",
        "terminal.integrated.experimentalImageSupport",
        "terminal.integrated.fontFamily",
        "terminal.integrated.fontSize",
        "terminal.integrated.gpuAcceleration",
        "terminal.integrated.rescaleOverlappingGlyphs",
        "terminal.integrated.scrollback",
        "terminal.integrated.smoothScrolling",
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
});
