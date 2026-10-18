import { describe, it, expect } from "vitest";

import fs from "fs";

const { COLOR_MAP } = require("../tools/build-include.js");

function parseJsonc(file) {
  const raw = fs.readFileSync(file, "utf-8");
  const stripped = raw.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (m) => (m.startsWith("//") ? "" : m));
  return JSON.parse(stripped.replace(/,(\s*[}\]])/g, "$1"));
}

function luminance(hex) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function flatten(color, backdrop) {
  if (color.length === 7) return color;
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  const channels = [1, 3, 5].map((i) =>
    Math.round(parseInt(color.slice(i, i + 2), 16) * alpha + parseInt(backdrop.slice(i, i + 2), 16) * (1 - alpha)),
  );
  return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function contrast(color, backdrop) {
  const [hi, lo] = [luminance(flatten(color, backdrop)), luminance(backdrop)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

function expectMarkersBound(file) {
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  const drifted = [];
  lines.forEach((line, index) => {
    const marker = line.match(/\/\/ \{\{(\w+)\.(\w+)\}\}\s*$/);
    if (!marker) return;
    const [, theme, key] = marker;
    const expected = COLOR_MAP[theme]?.[key];
    if (expected === undefined) {
      drifted.push(`${file}:${index + 1} references unknown key ${theme}.${key}`);
      return;
    }
    const window = lines.slice(Math.max(0, index - 3), index + 1).join("\n");
    const literal = typeof expected === "string" ? expected : String(expected);
    const found = literal.startsWith("#") ? new RegExp(`${literal}(?![0-9a-fA-F])`).test(window) : window.includes(literal);
    if (!found) drifted.push(`${file}:${index + 1} expected ${expected} for ${theme}.${key} -> ${line.trim()}`);
  });
  expect(drifted).toEqual([]);
}

const SUBLIME_COLOR_GLOBALS = new Set([
  "accent",
  "active_guide",
  "background",
  "block_caret",
  "block_caret_border",
  "block_caret_underline",
  "brackets_foreground",
  "bracket_contents_foreground",
  "caret",
  "find_highlight",
  "find_highlight_foreground",
  "fold_marker",
  "foreground",
  "guide",
  "gutter",
  "gutter_foreground",
  "gutter_foreground_highlight",
  "highlight",
  "inactive_selection",
  "inactive_selection_border",
  "inactive_selection_foreground",
  "invisibles",
  "line_diff_added",
  "line_diff_deleted",
  "line_diff_modified",
  "line_highlight",
  "minimap_border",
  "misspelling",
  "rulers",
  "scroll_highlight",
  "scroll_selected_highlight",
  "selection",
  "selection_border",
  "selection_foreground",
  "shadow",
  "stack_guide",
  "tags_foreground",
]);

const SUBLIME_NUMBER_GLOBALS = new Set([
  "block_caret_corner_radius",
  "line_diff_width",
  "line_padding_bottom",
  "line_padding_top",
  "selection_border_width",
  "shadow_width",
]);

const MAX_VAR_DEPTH = 8;

function isSublimeColor(value, vars, depth = 0) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  const ref = trimmed.match(/^var\((\w+)\)$/);
  if (ref) return depth < MAX_VAR_DEPTH && isSublimeColor(vars[ref[1]], vars, depth + 1);
  if (/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) return true;
  if (/^(?:rgba?|hsla?|hwb|color)\(/.test(trimmed)) return true;
  // A CSS color name is alphabetic; the shape that fails to parse is a bare number.
  return /^[a-z]+$/i.test(trimmed);
}

const VS_CODE_STATE_PAIRS = [
  ["list.hoverBackground", "list.activeSelectionBackground"],
  ["list.hoverBackground", "list.inactiveSelectionBackground"],
  ["titleBar.activeBackground", "titleBar.inactiveBackground"],
  ["tab.inactiveBackground", "tab.unfocusedActiveBackground"],
  ["tab.activeBackground", "tab.inactiveBackground"],
  ["editor.wordHighlightBackground", "editor.wordHighlightStrongBackground"],
  ["button.background", "button.hoverBackground"],
  ["button.secondaryBackground", "button.secondaryHoverBackground"],
  ["scrollbarSlider.background", "scrollbarSlider.hoverBackground"],
  ["scrollbarSlider.hoverBackground", "scrollbarSlider.activeBackground"],
];

const VS_CODE_ANSI_NAMES = ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White"];

describe("vs code theme", () => {
  for (const theme of ["dark", "light"]) {
    describe(theme, () => {
      const file = `software/scripts/advanced/vs-code-color-${theme}.jsonc`;
      const parsed = parseJsonc(file);
      const colors = parsed["workbench.colorCustomizations"];
      const rules = parsed["editor.tokenColorCustomizations"].textMateRules;
      const bg = colors["editor.background"];
      const surface = colors["sideBar.background"];

      it("should keep every marker bound to COLOR_MAP", () => expectMarkersBound(file));

      it("should keep every syntax color legible on the editor background", () => {
        for (const rule of rules) {
          if (!rule.settings.foreground) continue;
          const ratio = contrast(rule.settings.foreground, bg);
          expect(ratio, `${JSON.stringify(rule.scope)} (${rule.settings.foreground}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("should keep every text color legible on the surface it sits on", () => {
        const pairs = [
          ["editor.foreground", bg],
          ["sideBar.foreground", surface],
          ["statusBar.foreground", surface],
          ["tab.activeForeground", bg],
          ["tab.inactiveForeground", colors["tab.inactiveBackground"]],
          ["input.foreground", colors["input.background"]],
          ["button.foreground", colors["button.background"]],
          ["badge.foreground", colors["badge.background"]],
          ["list.activeSelectionForeground", colors["list.activeSelectionBackground"]],
          ["editorLineNumber.foreground", bg],
          ["editorSuggestWidget.highlightForeground", colors["editorSuggestWidget.background"]],
          ["notificationLink.foreground", colors["notifications.background"]],
          ["textLink.foreground", bg],
          ["editorError.foreground", bg],
          ["editorWarning.foreground", bg],
          ["editorInfo.foreground", bg],
        ];
        for (const [key, backdrop] of pairs) {
          const ratio = contrast(colors[key], backdrop);
          expect(ratio, `${key} (${colors[key]}) on ${backdrop} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("should keep bracket pair colors distinct and legible", () => {
        const brackets = [1, 2, 3, 4, 5, 6].map((n) => colors[`editorBracketHighlight.foreground${n}`]);
        expect(new Set(brackets).size, "bracket pair colors must all differ").toBe(brackets.length);
        for (const color of brackets) {
          const ratio = contrast(color, bg);
          expect(ratio, `bracket color ${color} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("should separate every interactive state", () => {
        // Collect every collision rather than throwing on the first — a bare loop of expects
        // aborts at pair 1 and hides the rest, which is exactly how a reverted titleBar pair
        // stayed invisible behind a failing list pair.
        const collisions = VS_CODE_STATE_PAIRS.filter(([a, b]) => colors[a] === colors[b]).map(([a, b]) => `${a} === ${b} (${colors[a]})`);
        expect(collisions, "interactive states must be visually distinct").toEqual([]);
        const hoverRatio = contrast(colors["list.hoverBackground"], surface);
        expect(hoverRatio, `list.hoverBackground is ${hoverRatio.toFixed(2)}:1 against the sidebar`).toBeGreaterThanOrEqual(1.2);
      });

      it("should ladder the scrollbar slider from rest to active", () => {
        const steps = ["scrollbarSlider.background", "scrollbarSlider.hoverBackground", "scrollbarSlider.activeBackground"].map((key) =>
          contrast(colors[key], bg),
        );
        expect(steps[0], `slider rest -> hover: ${steps[0].toFixed(2)} -> ${steps[1].toFixed(2)}`).toBeLessThan(steps[1]);
        expect(steps[1], `slider hover -> active: ${steps[1].toFixed(2)} -> ${steps[2].toFixed(2)}`).toBeLessThan(steps[2]);
      });

      it("should keep guides faint and their active counterpart stronger", () => {
        for (const key of [
          "editorWhitespace.foreground",
          "editorIndentGuide.background1",
          "tree.indentGuidesStroke",
          "editorRuler.foreground",
        ]) {
          const ratio = contrast(colors[key], bg);
          expect(ratio, `${key} (${colors[key]}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.7);
          expect(ratio, `${key} (${colors[key]}) is ${ratio.toFixed(2)}:1 — too loud for a guide`).toBeLessThan(3.2);
        }
        expect(contrast(colors["editorIndentGuide.activeBackground1"], bg)).toBeGreaterThan(
          contrast(colors["editorIndentGuide.background1"], bg),
        );
      });

      it("should draw visible borders on every chrome surface", () => {
        for (const key of ["sideBar.border", "panel.border", "statusBar.border", "tab.border", "input.border", "editorWidget.border"]) {
          const ratio = contrast(colors[key], surface);
          expect(ratio, `${key} (${colors[key]}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
        }
      });

      it("should keep the current find match distinct from the other matches", () => {
        const others = flatten(colors["editor.findMatchHighlightBackground"], bg);
        const ratio = contrast(colors["editor.findMatchBackground"], others);
        expect(ratio, `find match vs other matches is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.2);
      });

      it("should keep the whole ANSI ramp visible and monotonic", () => {
        const terminalBackground = colors["terminal.background"];
        for (const name of VS_CODE_ANSI_NAMES) {
          const base = colors[`terminal.ansi${name}`];
          const bright = colors[`terminal.ansiBright${name}`];
          expect(contrast(base, terminalBackground), `terminal.ansi${name} (${base}) is invisible`).toBeGreaterThanOrEqual(3);
          expect(contrast(bright, terminalBackground), `terminal.ansiBright${name} (${bright}) is invisible`).toBeGreaterThanOrEqual(3);
          expect(luminance(bright), `terminal.ansiBright${name} is not lighter than terminal.ansi${name}`).toBeGreaterThan(luminance(base));
        }
      });
    });
  }

  it("should keep the dark and light themes structurally identical", () => {
    const shape = (theme) => {
      const parsed = parseJsonc(`software/scripts/advanced/vs-code-color-${theme}.jsonc`);
      return {
        colors: Object.keys(parsed["workbench.colorCustomizations"]),
        scopes: parsed["editor.tokenColorCustomizations"].textMateRules.map((rule) => JSON.stringify(rule.scope)),
      };
    };
    expect(shape("dark")).toEqual(shape("light"));
  });

  /**
   * `editor.tokenColorCustomizations` is a MERGE onto the base theme, not a replacement.
   * Any TextMate scope we do not name keeps the base theme's foreground while rendering on
   * our `editor.background` — a pairing the base theme was never tuned against. That is how
   * `meta.diff.header` ended up at 1.24:1 (`#000080` on `#0a0a0a`) and the regexp character
   * class at 3.33:1 on light.
   *
   * This re-derives the leak set from the *installed* VS Code every run, so a future VS Code
   * release that introduces a new low-contrast scope fails here instead of silently shipping.
   * Skipped when VS Code is not installed (CI, headless boxes) — the "structurally identical"
   * test above still holds the two override lists in sync.
   */
  const VS_CODE_BASE_THEMES = "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/theme-defaults/themes";

  for (const [theme, baseFile] of [
    ["dark", "hc_black.json"],
    ["light", "hc_light.json"],
  ]) {
    const basePath = `${VS_CODE_BASE_THEMES}/${baseFile}`;

    it.skipIf(!fs.existsSync(basePath))(`should leave no ${theme} base-theme scope under 7:1 on our background`, () => {
      const parsed = parseJsonc(`software/scripts/advanced/vs-code-color-${theme}.jsonc`);
      const background = parsed["workbench.colorCustomizations"]["editor.background"];

      const owned = new Set();
      for (const rule of parsed["editor.tokenColorCustomizations"].textMateRules) {
        for (const scope of [].concat(rule.scope)) owned.add(scope);
      }

      const leaks = [];
      for (const tokenColor of parseJsonc(basePath).tokenColors || []) {
        const foreground = tokenColor.settings && tokenColor.settings.foreground;
        if (!foreground || !/^#[0-9a-f]{6}$/i.test(foreground)) continue;
        for (const scope of [].concat(tokenColor.scope || [])) {
          if (owned.has(scope)) continue;
          const ratio = contrast(foreground.toLowerCase(), background.toLowerCase());
          if (ratio < 7) leaks.push(`${scope} (${foreground}) is ${ratio.toFixed(2)}:1`);
        }
      }

      expect(leaks, `base theme scopes leaking through onto ${background}`).toEqual([]);
    });
  }
});
