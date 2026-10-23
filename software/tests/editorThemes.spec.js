import { describe, it, expect } from "vitest";

import fs from "fs";

const { COLOR_MAP } = require("../tools/build-include.js");

function parseJsonc(file) {
  const raw = fs.readFileSync(file, "utf-8");
  const stripped = raw.replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m.startsWith("/") ? "" : m));
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

describe("sublime text theme", () => {
  for (const theme of ["dark", "light"]) {
    describe(theme, () => {
      const file = `theme/sy/sublime_${theme}.jsonc`;
      const scheme = parseJsonc(file);
      const vars = scheme.variables;
      const globals = scheme.globals;
      const palette = COLOR_MAP[theme];
      const resolve = (value) => {
        const ref = value.match(/^var\((\w+)\)$/);
        return ref ? vars[ref[1]] : value;
      };

      it("should keep every marker bound to COLOR_MAP", () => expectMarkersBound(file));

      it("should give every typed global a value of its declared type", () => {
        const wrongColor = [];
        for (const [key, value] of Object.entries(globals)) {
          if (SUBLIME_COLOR_GLOBALS.has(key) && !isSublimeColor(value, vars)) {
            wrongColor.push(`globals.${key} = ${JSON.stringify(value)} is not a color`);
          }
        }
        const wrongNumber = [];
        for (const [key, value] of Object.entries(globals)) {
          if (SUBLIME_NUMBER_GLOBALS.has(key) && !/^-?[0-9]+(\.[0-9]+)?$/.test(String(value))) {
            wrongNumber.push(`globals.${key} = ${JSON.stringify(value)} is not a number`);
          }
        }
        expect([...wrongColor, ...wrongNumber]).toEqual([]);
      });

      it("should resolve every var() reference in globals and rules", () => {
        const unresolved = [];
        for (const [key, value] of Object.entries(globals)) {
          const ref = value.match(/^var\((\w+)\)$/);
          if (ref && !(ref[1] in vars)) unresolved.push(`globals.${key} -> var(${ref[1]})`);
        }
        for (const rule of scheme.rules) {
          const ref = (rule.foreground || "").match(/^var\((\w+)\)$/);
          if (ref && !(ref[1] in vars)) unresolved.push(`${rule.scope} -> var(${ref[1]})`);
        }
        expect(unresolved).toEqual([]);
      });

      it("should keep every syntax color legible on the editor background", () => {
        for (const rule of scheme.rules) {
          if (!rule.foreground) continue;
          const ratio = contrast(resolve(rule.foreground), vars.bg);
          expect(ratio, `${rule.scope} (${resolve(rule.foreground)}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("should keep text legible on every fill it can land on", () => {
        for (const fill of ["selection", "line_highlight", "word_highlight", "match"]) {
          const ratio = contrast(vars.fg, vars[fill]);
          expect(ratio, `foreground on ${fill} (${vars[fill]}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
        }
      });

      it("should separate the fills from the editor background and from each other", () => {
        for (const fill of ["selection", "line_highlight", "word_highlight", "match"]) {
          const ratio = contrast(vars[fill], vars.bg);
          expect(ratio, `${fill} (${vars[fill]}) vs background is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.25);
        }
        // The current find match must stand apart from the selection it may sit inside.
        expect(vars.match).not.toBe(vars.selection);
        expect(vars.line_highlight).not.toBe(vars.word_highlight);
      });

      // A selection border the same color as the selection fill is not a border at all.
      it("should draw a visible selection border", () => {
        const ratio = contrast(
          globals.selection_border.startsWith("var(") ? resolve(globals.selection_border) : globals.selection_border,
          vars.selection,
        );
        expect(ratio, `selection_border is ${ratio.toFixed(2)}:1 against the selection fill`).toBeGreaterThanOrEqual(1.5);
      });

      it("should keep guides faint and ladder them up to the active guide", () => {
        const guide = contrast(vars.guide, vars.bg);
        const active = contrast(vars.guide_active, vars.bg);
        expect(guide, `guide (${vars.guide}) is ${guide.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.7);
        expect(guide, `guide (${vars.guide}) is ${guide.toFixed(2)}:1 — too loud`).toBeLessThan(3.2);
        expect(active, "active_guide must read stronger than guide").toBeGreaterThan(guide);
      });

      it("should keep gutter numbers readable but dimmer than the editor text", () => {
        const gutter = contrast(vars.gutter_fg, vars.bg);
        expect(gutter, `gutter_fg is ${gutter.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        expect(gutter, "gutter_fg must be dimmer than the editor foreground").toBeLessThan(contrast(vars.fg, vars.bg));
      });

      // popup_css cannot use scheme variables, so its literals are the one place drift can hide.
      it("should keep popup_css in sync with the palette", () => {
        const link = theme === "dark" ? palette.blue : palette.linkBlue;
        expect(globals.popup_css).toBe(
          `html { background-color: ${palette.surface}; color: ${palette.foreground}; border: 1px solid ${palette.brightGray}; } a { color: ${link}; }`,
        );
        expect(contrast(palette.foreground, palette.surface)).toBeGreaterThanOrEqual(7);
        expect(contrast(link, palette.surface)).toBeGreaterThanOrEqual(4.5);
      });
    });
  }

  it("should keep the dark and light schemes structurally identical", () => {
    const shape = (theme) => {
      const scheme = parseJsonc(`theme/sy/sublime_${theme}.jsonc`);
      return {
        variables: Object.keys(scheme.variables),
        globals: Object.keys(scheme.globals),
        scopes: scheme.rules.map((rule) => rule.scope),
      };
    };
    expect(shape("dark")).toEqual(shape("light"));
  });
});
