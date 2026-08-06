/**
 * Contrast and palette-binding tests for the *terminal* palettes, the companion to
 * editorThemes.spec.js.
 *
 * Editors were bound to `COLOR_MAP` from the start; terminals were not. Ghostty named two of
 * its ~460 bundled themes and Termux carried a hardcoded Dracula block, so neither tracked the
 * palette every other surface used. Both now render from JSONC sources with inline markers,
 * and this spec is what keeps them there.
 *
 * What it enforces:
 *  1. every `// {{theme.key}}` literal still equals its COLOR_MAP value (no silent drift),
 *  2. the ANSI ramp is legible and monotonic against its own background, and
 *  3. Ghostty's dark and light sources stay structurally identical.
 *
 * The floors below are the ones COLOR_MAP documents, not invented ones — see the role comments
 * in software/tools/build-include.js.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";

const { COLOR_MAP } = require("../tools/build-include.js");

/** Strip `//` comments and trailing commas so a JSONC source can be JSON.parse'd. */
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

/** WCAG contrast ratio between two opaque colors. */
function contrast(color, backdrop) {
  const [hi, lo] = [luminance(color), luminance(backdrop)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Assert every `// {{theme.key}}` marker in a file sits next to its COLOR_MAP value.
 * This is what stops a marker from going inert and its literal from drifting — the exact
 * failure mode that let the old Ghostty and Termux palettes fall out of sync.
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
    if (!new RegExp(`${expected}(?![0-9a-fA-F])`).test(line)) {
      drifted.push(`${file}:${index + 1} expected ${expected} for ${theme}.${key} -> ${line.trim()}`);
    }
  });
  expect(drifted).toEqual([]);
}

/**
 * ANSI ramp index -> COLOR_MAP key. Fixed by terminal convention: 0-7 normal, 8-15 bright.
 * @type {string[]}
 */
const ANSI_KEYS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "purple",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightPurple",
  "brightCyan",
  "brightWhite",
];

/**
 * Ramp anchors are pinned by terminal convention rather than tuned for contrast: `black` is
 * expected to be near-black and the `white` pair is expected to be near-white, so on a theme
 * whose background sits at the same end they cannot clear a text floor and are exempt.
 * @type {string[]}
 */
const RAMP_ANCHORS = ["black", "white", "brightWhite"];

/**
 * Hues held below the 7:1 AAA floor on purpose. COLOR_MAP documents the reason: a 7:1 yellow
 * on a white background reads as brown, so the warm light hues are tuned to >= 5.5:1 instead.
 * Encoded here so the exception is a named decision rather than a quietly weaker assertion.
 * @type {Record<string, string[]>}
 */
const WARM_HUE_EXCEPTIONS = { light: ["yellow", "brightYellow"], dark: [] };

/** Floor every non-anchor hue must clear against its own background. */
const HUE_FLOOR = 7;

/** Reduced floor for the documented warm-hue carve-out. */
const WARM_HUE_FLOOR = 5.5;

/**
 * Shared assertions for any 16-entry ANSI ramp rendered on `background`.
 *
 * @param {string[]} palette - Sixteen `#rrggbb` values in ANSI index order.
 * @param {string} background - The theme background the ramp is painted on.
 * @param {"dark"|"light"} mode - Which warm-hue carve-out applies.
 */
function expectRampLegible(palette, background, mode) {
  const weak = [];
  palette.forEach((hex, index) => {
    const key = ANSI_KEYS[index];
    if (RAMP_ANCHORS.includes(key)) return;
    const floor = WARM_HUE_EXCEPTIONS[mode].includes(key) ? WARM_HUE_FLOOR : HUE_FLOOR;
    const ratio = contrast(hex, background);
    if (ratio < floor) weak.push(`${key} (${hex}) is ${ratio.toFixed(2)}:1, needs ${floor}:1`);
  });
  expect(weak).toEqual([]);
}

/**
 * Every `brightX` must sit above its `X` in relative luminance, so a tool that dims by
 * dropping to the base color renders dimmer rather than brighter.
 */
function expectRampMonotonic(palette) {
  const inverted = [];
  for (let index = 0; index < 8; index++) {
    const base = luminance(palette[index]);
    const bright = luminance(palette[index + 8]);
    if (bright <= base)
      inverted.push(`${ANSI_KEYS[index + 8]} (${palette[index + 8]}) is not brighter than ${ANSI_KEYS[index]} (${palette[index]})`);
  }
  expect(inverted).toEqual([]);
}

// ---- Ghostty ----

describe("ghostty theme", () => {
  for (const mode of ["dark", "light"]) {
    describe(mode, () => {
      const file = `software/scripts/advanced/ghostty-color-${mode}.jsonc`;
      const spec = parseJsonc(file);

      it("should keep every marker bound to COLOR_MAP", () => expectMarkersBound(file));

      it("should carry a full 16-entry ANSI ramp", () => {
        expect(spec.palette).toHaveLength(16);
        for (const hex of spec.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      });

      it("should keep the whole ANSI ramp legible on its own background", () => expectRampLegible(spec.palette, spec.background, mode));

      it("should keep the ANSI ramp monotonic from base to bright", () => expectRampMonotonic(spec.palette));

      it("should keep the foreground well clear of the background", () => {
        expect(contrast(spec.foreground, spec.background)).toBeGreaterThanOrEqual(HUE_FLOOR);
      });

      // A selection whose text is unreadable is worse than no selection highlight at all.
      it("should keep selected text legible on the selection fill", () => {
        expect(contrast(spec["selection-foreground"], spec["selection-background"])).toBeGreaterThanOrEqual(HUE_FLOOR);
      });

      // The block cursor inverts the cell, so cursor-text lands on cursor-color.
      it("should keep the glyph under a block cursor legible", () => {
        expect(contrast(spec["cursor-text"], spec["cursor-color"])).toBeGreaterThanOrEqual(4.5);
      });

      it("should draw a selection fill that is visibly not the background", () => {
        expect(contrast(spec["selection-background"], spec.background)).toBeGreaterThanOrEqual(1.25);
      });
    });
  }

  it("should keep the dark and light sources structurally identical", () => {
    const shape = (mode) => {
      const spec = parseJsonc(`software/scripts/advanced/ghostty-color-${mode}.jsonc`);
      return { keys: Object.keys(spec).sort(), paletteLength: spec.palette.length };
    };
    expect(shape("dark")).toEqual(shape("light"));
  });

  // Ghostty resolves `theme = <name>` against ~/.config/ghostty/themes before its bundled
  // themes, so these names must match the filenames the script writes. If they drift apart
  // Ghostty silently falls back to a bundled theme of the same name, or to no theme at all.
  it("should reference the theme names it writes", () => {
    const source = fs.readFileSync("software/scripts/advanced/ghostty.js", "utf-8");
    expect(source).toMatch(/const GHOSTTY_DARK_THEME_NAME = "Sy Dark";/);
    expect(source).toMatch(/const GHOSTTY_LIGHT_THEME_NAME = "Sy Light";/);
    expect(source).toContain("theme = light:${lightThemeName},dark:${darkThemeName}");
    // The custom branch must resolve to the same constants used as themes/ filenames.
    // Whitespace-normalized so `make format` is free to rewrap the ternary.
    expect(source.replace(/\s+/g, " ")).toContain("{ dark: GHOSTTY_DARK_THEME_NAME, light: GHOSTTY_LIGHT_THEME_NAME }");
  });

  // Ghostty has no light:/dark: variant for split-divider-color, so one value has to clear the
  // 3:1 WCAG non-text floor against BOTH backgrounds.
  it("should draw a split divider visible in both modes", () => {
    const source = fs.readFileSync("software/scripts/advanced/ghostty.js", "utf-8");
    const divider = source.match(/const GHOSTTY_SPLIT_DIVIDER_COLOR = "(#[0-9a-f]{6})";/)?.[1];
    expect(divider, "GHOSTTY_SPLIT_DIVIDER_COLOR must be a hex literal").toBeTruthy();
    for (const mode of ["dark", "light"]) {
      const bg = COLOR_MAP[mode].background;
      const ratio = contrast(divider, bg);
      expect(ratio, `divider ${divider} on ${mode} background ${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });
});

// ---- Termux ----

describe("termux theme", () => {
  const file = "software/scripts/android_termux/termux-color-dark.jsonc";
  const spec = parseJsonc(file);

  it("should keep every marker bound to COLOR_MAP", () => expectMarkersBound(file));

  it("should carry a full 16-entry ANSI ramp", () => {
    expect(spec.palette).toHaveLength(16);
    for (const hex of spec.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("should keep the whole ANSI ramp legible on its own background", () => expectRampLegible(spec.palette, spec.background, "dark"));

  it("should keep the ANSI ramp monotonic from base to bright", () => expectRampMonotonic(spec.palette));

  it("should keep the foreground well clear of the background", () => {
    expect(contrast(spec.foreground, spec.background)).toBeGreaterThanOrEqual(HUE_FLOOR);
  });

  // The old hardcoded palette put color0 at 1.47:1 against its own background, which made
  // anything printed in ANSI black effectively invisible.
  it("should keep the black ramp anchor distinguishable from the background", () => {
    expect(contrast(spec.palette[0], spec.background)).toBeGreaterThanOrEqual(1.05);
  });

  // termux-config.sh owns termux.properties only. If a colors block reappears there it would
  // race this script for the same file, and only one of them tracks COLOR_MAP.
  it("should leave colors.properties entirely to termux-colors.js", () => {
    const config = fs.readFileSync("software/scripts/android_termux/termux-config.sh", "utf-8");
    const writes = config.split("\n").filter((line) => /colors\.properties/.test(line) && !line.trim().startsWith("#"));
    expect(writes).toEqual([]);
  });
});

// ---- Cross-surface ----

describe("terminal palettes", () => {
  // Windows Terminal, Ghostty and Termux all render the same COLOR_MAP dark ramp. If one of
  // them ever hardcodes a value again, this is what notices.
  it("should render the identical dark ramp on every terminal that has one", () => {
    const expected = ANSI_KEYS.map((key) => COLOR_MAP.dark[key]);
    expect(parseJsonc("software/scripts/advanced/ghostty-color-dark.jsonc").palette).toEqual(expected);
    expect(parseJsonc("software/scripts/android_termux/termux-color-dark.jsonc").palette).toEqual(expected);
  });

  it("should render the light ramp from COLOR_MAP", () => {
    const expected = ANSI_KEYS.map((key) => COLOR_MAP.light[key]);
    expect(parseJsonc("software/scripts/advanced/ghostty-color-light.jsonc").palette).toEqual(expected);
  });

  // The whole point of the consolidation: no terminal config may name a third-party theme or
  // carry a raw hex the palette does not own. The theme line is interpolated rather than
  // literal, so the check is that it names no theme directly and that the only non-COLOR_MAP
  // source it can resolve to is the shared fallback registry (used when theming is disabled).
  it("should not name a bundled third-party theme in the ghostty config", () => {
    const source = fs.readFileSync("software/scripts/advanced/ghostty.js", "utf-8");
    const themeLine = source.split("\n").find((line) => /^\s*theme = /.test(line));
    expect(themeLine).toContain("${lightThemeName}");
    expect(themeLine).toContain("${darkThemeName}");
    expect(themeLine).not.toMatch(/GitHub|Modus|Nvim|Dracula|Ayu|One Half/);
    // Every value those two names can take comes from either our constants or getTheme().
    // Whitespace-normalized so `make format` is free to rewrap the ternary.
    expect(source.replace(/\s+/g, " ")).toContain(
      'shouldInstallCustomTheme() ? { dark: GHOSTTY_DARK_THEME_NAME, light: GHOSTTY_LIGHT_THEME_NAME } : getTheme("ghostty")',
    );
  });
});
