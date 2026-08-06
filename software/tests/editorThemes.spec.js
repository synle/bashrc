/**
 * Contrast and palette-binding tests for the editor themes that are not covered elsewhere:
 * Sublime Text, VS Code, Windows Terminal and the webapp stylesheet.
 *
 * Every one of these files is generated from `COLOR_MAP` in `software/tools/build-include.js`
 * via inline `// {{theme.key}}` markers, so the checks here are twofold:
 *  1. the literal next to each marker still equals its `COLOR_MAP` value (no silent drift), and
 *  2. the resulting colors clear the contrast floors the themes claim to hit.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

const { COLOR_MAP } = require("../tools/build-include.js");

/**
 * Strip `//` comments and trailing commas so a JSONC theme file can be JSON.parse'd.
 *
 * Quoted strings are matched first so that a `"$schema": "https://..."` value is preserved
 * instead of being truncated at its `//`.
 */
function parseJsonc(file) {
  const raw = fs.readFileSync(file, "utf-8");
  const stripped = raw.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (m) => (m.startsWith("//") ? "" : m));
  return JSON.parse(stripped.replace(/,(\s*[}\]])/g, "$1"));
}

/** Relative luminance of an opaque `#rrggbb` color, per WCAG 2.1. */
function luminance(hex) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Composite a `#rrggbbaa` color over an opaque backdrop. Passes `#rrggbb` through unchanged. */
function flatten(color, backdrop) {
  if (color.length === 7) return color;
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  const channels = [1, 3, 5].map((i) =>
    Math.round(parseInt(color.slice(i, i + 2), 16) * alpha + parseInt(backdrop.slice(i, i + 2), 16) * (1 - alpha)),
  );
  return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG contrast ratio, compositing `color` over `backdrop` first when it carries alpha. */
function contrast(color, backdrop) {
  const [hi, lo] = [luminance(flatten(color, backdrop)), luminance(backdrop)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Assert every `// {{theme.key}}` marker in a file sits next to its COLOR_MAP value.
 * This is what stops a marker from going inert and its literal from drifting.
 *
 * The value may be a few lines above the marker when the marker trails a multi-line object,
 * and it is unquoted in SCSS, so the search covers a small window and matches the bare hex.
 */
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

// ---- Sublime Text ----

describe("sublime text theme", () => {
  for (const theme of ["dark", "light"]) {
    describe(theme, () => {
      const file = `software/scripts/advanced/sublime-text-color-${theme}.jsonc`;
      const scheme = parseJsonc(file);
      const vars = scheme.variables;
      const globals = scheme.globals;
      const palette = COLOR_MAP[theme];
      const resolve = (value) => {
        const ref = value.match(/^var\((\w+)\)$/);
        return ref ? vars[ref[1]] : value;
      };

      it("should keep every marker bound to COLOR_MAP", () => expectMarkersBound(file));

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
      const scheme = parseJsonc(`software/scripts/advanced/sublime-text-color-${theme}.jsonc`);
      return {
        variables: Object.keys(scheme.variables),
        globals: Object.keys(scheme.globals),
        scopes: scheme.rules.map((rule) => rule.scope),
      };
    };
    expect(shape("dark")).toEqual(shape("light"));
  });
});

// ---- VS Code ----

/** Interactive-state pairs that must never resolve to the same color. */
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
});

// ---- Windows Terminal & webapp ----

describe("windows terminal theme", () => {
  const source = "software/scripts/windows-terminal.js";

  it("should keep every marker bound to COLOR_MAP", () => expectMarkersBound(source));

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

/**
 * `INLINE_MARKER_REGEX` binds a marker to the last JSON literal preceding it, and that literal
 * may be a string OR a number. So in an inline object like
 * `{ "color": "#5ca0d7", "font_weight": 700 }, // {{dark.blue}}` the marker binds `700`, not
 * `"color"`, and the rewrite silently destroys the font weight.
 *
 * This regressed once already: ten `font_style`/`font_weight` values across the Zed themes were
 * overwritten with hex colors. The structural fix is to keep the color property LAST in any
 * inline object that carries a trailing marker; these tests lock that invariant in.
 */
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
