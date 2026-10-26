import { describe, expect, it } from "vitest";

import { readBuildText, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

/** Stable Ghostty settings worth snapshotting separately from its repeated keybind entries.
 * @type {Set<string>}
 */
const GHOSTTY_SETTING_NAMES = new Set([
  "font-family",
  "font-size",
  "font-style",
  "font-style-italic",
  "font-thicken",
  "adjust-cell-height",
  "theme",
  "shell-integration",
  "shell-integration-features",
  "working-directory",
  "scrollback-limit",
  "notify-on-command-finish",
  "notify-on-command-finish-action",
  "notify-on-command-finish-after",
  "bell-features",
  "mouse-shift-capture",
  "copy-on-select",
  "confirm-close-surface",
  "window-save-state",
  "background-opacity",
  "background-opacity-cells",
  "window-theme",
  "resize-overlay",
  "custom-shader-animation",
  "unfocused-split-opacity",
  "unfocused-split-fill",
  "split-divider-color",
  "cursor-style",
  "cursor-style-blink",
  "cursor-opacity",
  "macos-option-as-alt",
  "macos-titlebar-style",
  "fullscreen",
  "quit-after-last-window-closed",
  "quick-terminal-animation-duration",
  "background-blur",
]);

/**
 * Selects stable key/value settings from Ghostty's repeated-key native config format.
 * @param {string} content - Ghostty config text.
 * @returns {string[]} Selected settings in artifact order.
 */
function selectGhosttySettings(content) {
  return content.split(/\r?\n/).filter((line) => {
    const separator = line.indexOf(" = ");
    return separator > 0 && GHOSTTY_SETTING_NAMES.has(line.slice(0, separator).trim());
  });
}

/**
 * Selects representative new-tab, quit, and clipboard keybindings.
 * @param {string[]} bindings - Ghostty keybind lines.
 * @returns {string[]} Representative keybind lines.
 */
function selectGhosttyKeybindExamples(bindings) {
  return bindings.filter((line) => /(?:alt|cmd)\+(?:t|q|c)=/.test(line));
}

describe(".build/ghostty-config-linux", () => {
  it("keeps Linux terminal settings and shortcuts", () => {
    const filename = "ghostty-config-linux";
    if (warnIfBuildArtifactMissing(filename)) return;

    const content = readBuildText(filename);
    const bindings = content.split(/\r?\n/).filter((line) => line.startsWith("keybind = "));
    expect(bindings.length).toBeGreaterThanOrEqual(36);
    expect(bindings.length).toBeLessThanOrEqual(110);
    expect(selectGhosttySettings(content)).toMatchInlineSnapshot(`
      [
        "font-family = Fira Code",
        "font-size = 16",
        "font-style = bold",
        "font-style-italic = bold italic",
        "font-thicken = true",
        "adjust-cell-height = 2",
        "theme = light:Sy Light,dark:Sy Dark",
        "shell-integration = detect",
        "shell-integration-features = no-cursor,no-sudo,no-title,ssh-env,ssh-terminfo,path",
        "working-directory = inherit",
        "scrollback-limit = 104857600",
        "notify-on-command-finish = unfocused",
        "notify-on-command-finish-action = bell,notify",
        "notify-on-command-finish-after = 30s",
        "bell-features = no-system,no-audio,attention,title,border",
        "mouse-shift-capture = false",
        "copy-on-select = false",
        "confirm-close-surface = false",
        "window-save-state = always",
        "background-opacity = 0.99",
        "background-opacity-cells = true",
        "window-theme = auto",
        "resize-overlay = never",
        "custom-shader-animation = false",
        "unfocused-split-opacity = 0.98",
        "unfocused-split-fill = #808080",
        "split-divider-color = #6e6e6e",
        "cursor-style = block",
        "cursor-style-blink = false",
        "cursor-opacity = 1",
      ]
    `);
    expect(selectGhosttyKeybindExamples(bindings)).toMatchInlineSnapshot(`
      [
        "keybind = alt+t=new_tab",
        "keybind = alt+q=quit",
        "keybind = alt+c=copy_to_clipboard:mixed",
      ]
    `);
  });
});

describe(".build/ghostty-config-mac", () => {
  it("keeps macOS terminal settings and shortcuts", () => {
    const filename = "ghostty-config-mac";
    if (warnIfBuildArtifactMissing(filename)) return;

    const content = readBuildText(filename);
    const bindings = content.split(/\r?\n/).filter((line) => line.startsWith("keybind = "));
    expect(bindings.length).toBeGreaterThanOrEqual(38);
    expect(bindings.length).toBeLessThanOrEqual(116);
    expect(selectGhosttySettings(content)).toMatchInlineSnapshot(`
      [
        "font-family = Fira Code",
        "font-size = 16",
        "font-style = bold",
        "font-style-italic = bold italic",
        "font-thicken = true",
        "adjust-cell-height = 2",
        "theme = light:Sy Light,dark:Sy Dark",
        "shell-integration = detect",
        "shell-integration-features = no-cursor,no-sudo,no-title,ssh-env,ssh-terminfo,path",
        "working-directory = inherit",
        "scrollback-limit = 104857600",
        "notify-on-command-finish = unfocused",
        "notify-on-command-finish-action = bell,notify",
        "notify-on-command-finish-after = 30s",
        "bell-features = no-system,no-audio,attention,title,border",
        "mouse-shift-capture = false",
        "copy-on-select = false",
        "confirm-close-surface = false",
        "window-save-state = always",
        "background-opacity = 0.99",
        "background-opacity-cells = true",
        "window-theme = auto",
        "resize-overlay = never",
        "custom-shader-animation = false",
        "unfocused-split-opacity = 0.98",
        "unfocused-split-fill = #808080",
        "split-divider-color = #6e6e6e",
        "cursor-style = block",
        "cursor-style-blink = false",
        "cursor-opacity = 1",
        "macos-option-as-alt = true",
        "macos-titlebar-style = tabs",
        "fullscreen = non-native-visible-menu",
        "quit-after-last-window-closed = true",
        "quick-terminal-animation-duration = 0",
        "background-blur = 20",
      ]
    `);
    expect(selectGhosttyKeybindExamples(bindings)).toMatchInlineSnapshot(`
      [
        "keybind = cmd+t=new_tab",
        "keybind = cmd+q=quit",
        "keybind = cmd+c=copy_to_clipboard:mixed",
      ]
    `);
  });
});

describe(".build/ghostty-theme-dark", () => {
  it("keeps the complete dark palette config", () => {
    const filename = "ghostty-theme-dark";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildText(filename).replace(/\u2014/g, "--")).toMatchInlineSnapshot(`
      "# Sy Dark -- generated by software/scripts/advanced/ghostty.js
      # Source: theme/sy/ghostty_dark.jsonc (bound to COLOR_MAP). Do not edit by hand.

      palette = 0=#6e6e6e
      palette = 1=#f67070
      palette = 2=#76a762
      palette = 3=#dcdcaa
      palette = 4=#5ca0d7
      palette = 5=#c586c0
      palette = 6=#4ec9b0
      palette = 7=#cccccc
      palette = 8=#a0a0a0
      palette = 9=#ff6e6e
      palette = 10=#69ff94
      palette = 11=#ffffa5
      palette = 12=#4fc1ff
      palette = 13=#ff92df
      palette = 14=#a4ffff
      palette = 15=#ffffff

      background = #0a0a0a
      foreground = #e8e8e8
      cursor-color = #5ca0d7
      cursor-text = #0a0a0a
      selection-background = #1b3c5e
      selection-foreground = #e8e8e8"
    `);
  });
});

describe(".build/ghostty-theme-light", () => {
  it("keeps the complete light palette config", () => {
    const filename = "ghostty-theme-light";
    if (warnIfBuildArtifactMissing(filename)) return;

    expect(readBuildText(filename).replace(/\u2014/g, "--")).toMatchInlineSnapshot(`
      "# Sy Light -- generated by software/scripts/advanced/ghostty.js
      # Source: theme/sy/ghostty_light.jsonc (bound to COLOR_MAP). Do not edit by hand.

      palette = 0=#000000
      palette = 1=#840000
      palette = 2=#004a15
      palette = 3=#775502
      palette = 4=#0033b3
      palette = 5=#6c0099
      palette = 6=#00416f
      palette = 7=#6d6d6d
      palette = 8=#4a4a4a
      palette = 9=#a12626
      palette = 10=#106145
      palette = 11=#7f6000
      palette = 12=#0051ae
      palette = 13=#8700c1
      palette = 14=#145e5e
      palette = 15=#8b8b8b

      background = #f8f8f8
      foreground = #1e1e1e
      cursor-color = #0451a5
      cursor-text = #f8f8f8
      selection-background = #96c6fa
      selection-foreground = #1e1e1e"
    `);
  });
});
