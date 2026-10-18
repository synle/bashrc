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

describe("windows terminal theme", () => {
  const source = "software/scripts/windows-terminal.js";
  const keybindingsSource = "software/scripts/windows-terminal-keys.jsonc";

  it("should keep every marker bound to COLOR_MAP", () => expectMarkersBound(source));

  it("should keep Windows Terminal keybinding overrides for ctrl+v and shift+enter", () => {
    const contents = fs.readFileSync(keybindingsSource, "utf-8");
    expect(contents).toContain('"id": "unbound"');
    expect(contents).toContain('"keys": "ctrl+v"');
    expect(contents).toContain('{ "command": "tabSearch", "keys": "alt+p" }');
    expect(contents).toContain('{ "command": "quakeMode", "keys": "alt+escape" }');
    expect(contents).toContain('"id": "User.sendInput.ShiftEnterCustom"');
    expect(contents).toContain('"input": "\\u001b[13;2u"');
    expect(contents).toContain('"keys": "shift+enter"');
  });

  for (const theme of ["dark", "light"]) {
    it(`should keep the ${theme} ANSI ramp visible and monotonic`, () => {
      const palette = COLOR_MAP[theme];
      const names = ["black", "red", "green", "yellow", "blue", "purple", "cyan", "white"];
      const scheme = fs.readFileSync(source, "utf-8");
      // The dark scheme deliberately lifts `black` off the background so SGR 30 is not invisible.
      const blackValue = scheme.match(new RegExp(`"black": "(#[0-9a-f]{6})", // \\{\\{${theme}\\.`))[1];
      expect(contrast(blackValue, palette.background), `${theme} ansi black is invisible`).toBeGreaterThanOrEqual(3);
      for (const name of names) {
        const bright = `bright${name[0].toUpperCase()}${name.slice(1)}`;
        const base = name === "black" ? blackValue : palette[name];
        expect(contrast(base, palette.background), `${theme} ${name} is invisible`).toBeGreaterThanOrEqual(3);
        expect(contrast(palette[bright], palette.background), `${theme} ${bright} is invisible`).toBeGreaterThanOrEqual(3);
        expect(luminance(palette[bright]), `${theme} ${bright} is not lighter than ${name}`).toBeGreaterThan(luminance(base));
      }
    });
  }
});

describe("webapp stylesheet", () => {
  const source = "webapp/common.scss";

  it("should keep every marker bound to COLOR_MAP", () => expectMarkersBound(source));

  for (const theme of ["dark", "light"]) {
    it(`should keep ${theme} text and syntax colors legible`, () => {
      const palette = COLOR_MAP[theme];
      const block = fs.readFileSync(source, "utf-8").split(`{{${theme}.background}}`)[1].split("@mixin")[0];
      const declared = [...block.matchAll(/(--\w+): (#[0-9a-f]{6,8}); \/\/ \{\{\w+\.(\w+)\}\}/g)];
      expect(declared.length, `no ${theme} variables parsed`).toBeGreaterThan(10);
      for (const [, name, value] of declared) {
        if (name.startsWith("--colorBg") || name === "--prismBg" || name === "--colorShadow") continue;
        const backdrop = name.startsWith("--prism") ? palette.surface : palette.background;
        const min = name === "--colorBorderSecondary" ? 1.7 : 4.5;
        const ratio = contrast(value, backdrop);
        expect(ratio, `${name} (${value}) on ${backdrop} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      }
    });

    it(`should keep the ${theme} hover fill distinct from both surfaces`, () => {
      const palette = COLOR_MAP[theme];
      expect(contrast(palette.gray, palette.background), "hover fill vs page background").toBeGreaterThanOrEqual(1.25);
      expect(contrast(palette.gray, palette.surface), "hover fill vs secondary surface").toBeGreaterThanOrEqual(1.15);
    });
  }
});

describe("inline marker binding safety", () => {
  const MARKER_FILES = fs
    .readdirSync("software/scripts/advanced")
    .filter((f) => /-color-(dark|light)\.jsonc$/.test(f))
    .map((f) => `software/scripts/advanced/${f}`);

  it("covers every generated color theme file", () => {
    // 8 = VS Code, Sublime and Zed (2 each) plus the Ghostty terminal palettes, which
    // joined COLOR_MAP when Ghostty stopped naming a bundled third-party theme.
    // Termux's palette lives in software/scripts/android_termux/ and is covered by
    // software/tests/terminalThemes.spec.js instead.
    expect(MARKER_FILES.length).toBe(8);
  });

  for (const file of MARKER_FILES) {
    const lines = fs.readFileSync(file, "utf-8").split("\n");
    const name = file.split("/").pop();

    it(`${name}: no style property holds a hex color`, () => {
      // font_style/fontStyle take keywords, font_weight takes a number. A hex in either means
      // the marker rewrite clobbered the wrong property.
      const clobbered = lines.filter((l) => /"(font_style|fontStyle|font_weight|fontStyle)":\s*"#[0-9a-fA-F]{3,8}"/.test(l));
      expect(clobbered, `clobbered style values in ${name}`).toEqual([]);
    });

    it(`${name}: color is the last property in every marker-bearing inline object`, () => {
      const offenders = lines.filter((line) => {
        if (!/\/\/ \{\{\w+\.\w+\}\}\s*$/.test(line)) return false;
        const obj = line.match(/\{[^{}]*\}/);
        if (!obj) return false;
        const props = [...obj[0].matchAll(/"([\w.]+)"\s*:/g)].map((m) => m[1]);
        if (props.length < 2) return false;
        return !/^(color|foreground|background)$/.test(props[props.length - 1]);
      });
      expect(offenders, `marker would rewrite a non-color property in ${name}`).toEqual([]);
    });
  }
});
