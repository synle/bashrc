/** Tests for zed.js helpers (keymap resolution, terminal-context mirroring). */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { getIndexFunction, expandSourceMarkers } from "./setup.js";

const clone = getIndexFunction("clone");

// ---- Load zed.js (with every SOURCE marker — editor.common.js + llm-common.js — inlined) ----
const zedRaw = fs.readFileSync("software/scripts/advanced/zed.js", "utf-8");
const zedSource = expandSourceMarkers(zedRaw);

/**
 * Evaluates zed.js with mocked globals so its internal helpers are reachable.
 * @param {object} [overrides] - Sandbox overrides (e.g. is_os_mac).
 * @returns {object} Sandbox containing the loaded module's top-level declarations.
 */
const stripJsoncComments = getIndexFunction("stripJsoncComments");

/** Relative luminance per WCAG 2.x, for a `#rrggbb` string. */
function themeLuminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` strings (1..21). */
function themeContrast(a, b) {
  const [l1, l2] = [themeLuminance(a), themeLuminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Composite a `#rrggbbaa` color over an opaque `#rrggbb` backdrop. Passes `#rrggbb` through unchanged. */
function flattenOverBackdrop(color, backdrop) {
  if (color.length === 7) return color;
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  const channels = [1, 3, 5].map((i) =>
    Math.round(parseInt(color.slice(i, i + 2), 16) * alpha + parseInt(backdrop.slice(i, i + 2), 16) * (1 - alpha)),
  );
  return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Editor-level fills that the plain editor foreground gets painted on. */
const EDITOR_FILL_KEYS = [
  "editor.active_line.background",
  "editor.highlighted_line.background",
  "search.match_background",
  "search.active_match_background",
  "editor.document_highlight.read_background",
  "editor.document_highlight.write_background",
];

/** Status keys whose `<key>.background` is the fill behind `<key>`-colored text. */
const STATUS_KEYS = [
  "conflict",
  "created",
  "deleted",
  "modified",
  "renamed",
  "error",
  "warning",
  "info",
  "hint",
  "success",
  "predictive",
  "unreachable",
  "hidden",
  "ignored",
];

/** ANSI base color names; each has a matching `bright_` variant in the terminal ramp. */
const ANSI_COLOR_NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

for (const [themeFile, appearance] of [
  ["software/scripts/advanced/zed-color-dark.jsonc", "dark"],
  ["software/scripts/advanced/zed-color-light.jsonc", "light"],
]) {
  describe(`zed theme contrast > ${appearance}`, () => {
    const theme = JSON.parse(stripJsoncComments(fs.readFileSync(themeFile, "utf-8")));
    const style = theme.themes[0].style;
    const editorBackground = style["editor.background"];
    const editorForeground = style["editor.foreground"];

    it("should declare a single theme matching the requested appearance", () => {
      expect(theme.themes).toHaveLength(1);
      expect(theme.themes[0].appearance).toBe(appearance);
    });

    it("should keep the editor foreground legible on every editor-level fill", () => {
      for (const key of EDITOR_FILL_KEYS) {
        expect(style, `${key} is missing`).toHaveProperty(key);
        const flattened = flattenOverBackdrop(style[key], editorBackground);
        const ratio = themeContrast(editorForeground, flattened);
        expect(ratio, `editor.foreground on ${key} (${style[key]} -> ${flattened}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
      }
    });

    it("should keep each status color legible on its own background fill", () => {
      for (const key of STATUS_KEYS) {
        const fillKey = `${key}.background`;
        expect(style, `${fillKey} is missing`).toHaveProperty(fillKey);
        const flattened = flattenOverBackdrop(style[fillKey], editorBackground);
        const ratio = themeContrast(style[key], flattened);
        expect(
          ratio,
          `${key} (${style[key]}) on ${fillKey} (${style[fillKey]} -> ${flattened}) is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    // `predictive` is inline-completion ghost text: it must stay readable but deliberately
    // dimmer than real code, otherwise a suggestion is indistinguishable from committed source.
    const DIM_BY_DESIGN_SCOPES = new Set(["predictive", "unreachable", "comment", "comment.doc"]);

    it("should keep every syntax color legible on the editor background", () => {
      for (const [scope, entry] of Object.entries(style.syntax)) {
        if (DIM_BY_DESIGN_SCOPES.has(scope)) continue;
        const ratio = themeContrast(entry.color, editorBackground);
        expect(ratio, `syntax.${scope} (${entry.color}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
      }
    });

    it("should keep dim-by-design syntax scopes readable but below regular code", () => {
      const floor = themeContrast(style.syntax.variable.color, editorBackground);
      for (const scope of DIM_BY_DESIGN_SCOPES) {
        if (!style.syntax[scope]) continue;
        const ratio = themeContrast(style.syntax[scope].color, editorBackground);
        expect(ratio, `syntax.${scope} (${style.syntax[scope].color}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        expect(ratio, `syntax.${scope} must read dimmer than syntax.variable`).toBeLessThan(floor);
      }
    });

    // Zed reads the local selection from players[0]; `selection.background` is not a real
    // theme key, so relying on it silently left the selection unstyled.
    it("should define players[0] so the cursor and selection are themed", () => {
      expect(style.players).toBeInstanceOf(Array);
      expect(style.players.length).toBeGreaterThan(0);
      const [player] = style.players;
      expect(player.cursor).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
      const flattened = flattenOverBackdrop(player.selection, editorBackground);
      const ratio = themeContrast(editorForeground, flattened);
      expect(ratio, `editor.foreground on players[0].selection (${player.selection}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
      expect(style["selection.background"], "selection.background is not a Zed theme key — use players[0].selection").toBeUndefined();
    });

    it("should lift the chrome off the editor background and keep borders visible", () => {
      // Chrome (tab bar, panels, status bar) uses `surface` so the editor pane reads as a distinct layer.
      expect(style["tab_bar.background"]).not.toBe(editorBackground);
      expect(style["panel.background"]).toBe(style["tab_bar.background"]);
      expect(style["tab.active_background"]).toBe(editorBackground);
      // WCAG non-text contrast floor for 1px UI strokes.
      expect(themeContrast(style.border, editorBackground)).toBeGreaterThanOrEqual(3);
    });

    // The ANSI ramp is the one place where a "correct" color (pure black / pure white) can be
    // invisible: the terminal background sits at either end of the lightness range. Both halves of
    // the ramp must stay readable, and each bright variant must stay lighter than its base so tools
    // that dim with the base color still render dimmer rather than brighter.
    it("should keep every terminal ANSI color visible on the terminal background", () => {
      const terminalBackground = style["terminal.background"];
      for (const name of ANSI_COLOR_NAMES) {
        for (const prefix of ["terminal.ansi.", "terminal.ansi.bright_"]) {
          const key = `${prefix}${name}`;
          const ratio = themeContrast(style[key], terminalBackground);
          expect(ratio, `${key} (${style[key]}) on ${terminalBackground} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it("should keep each bright ANSI color lighter than its base counterpart", () => {
      for (const name of ANSI_COLOR_NAMES) {
        const base = themeLuminance(style[`terminal.ansi.${name}`]);
        const bright = themeLuminance(style[`terminal.ansi.bright_${name}`]);
        expect(bright, `terminal.ansi.bright_${name} is not lighter than terminal.ansi.${name}`).toBeGreaterThan(base);
      }
    });

    // SGR 2 (dim) must read as a faded version of its base, never as a second bright variant.
    it("should keep each dim ANSI color fainter than its base but still visible", () => {
      const terminalBackground = style["terminal.background"];
      for (const name of ANSI_COLOR_NAMES) {
        const dim = flattenOverBackdrop(style[`terminal.ansi.dim_${name}`], terminalBackground);
        const dimRatio = themeContrast(dim, terminalBackground);
        const baseRatio = themeContrast(style[`terminal.ansi.${name}`], terminalBackground);
        expect(dimRatio, `terminal.ansi.dim_${name} renders at ${dimRatio.toFixed(2)}:1`).toBeGreaterThanOrEqual(2);
        expect(dimRatio, `terminal.ansi.dim_${name} is not fainter than terminal.ansi.${name}`).toBeLessThan(baseRatio);
      }
    });

    // Hover and active are the two states a user gets constant feedback from; when they collapse
    // into the base fill the UI feels dead. `element.hover` previously sat at 1.09:1 on `surface`.
    it("should separate every interactive element state from the base fill", () => {
      const base = style["element.background"];
      for (const prefix of ["element", "ghost_element"]) {
        for (const state of ["hover", "active"]) {
          const key = `${prefix}.${state}`;
          const ratio = themeContrast(flattenOverBackdrop(style[key], base), base);
          expect(ratio, `${key} (${style[key]}) vs element.background (${base}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.25);
        }
        // Disabled deliberately matches the base fill so it can never be mistaken for hover.
        expect(style[`${prefix}.disabled`], `${prefix}.disabled must not reuse a state fill`).toBe(base);
      }
      const hover = themeContrast(flattenOverBackdrop(style["element.hover"], base), base);
      const active = themeContrast(flattenOverBackdrop(style["element.active"], base), base);
      expect(active, "element.active must read stronger than element.hover").toBeGreaterThan(hover);
    });

    // Guides and invisibles are structural hints: readable at a glance, never loud enough to be
    // mistaken for text. `editor.wrap_guide` was previously a 20% tint at 1.19:1 — effectively gone.
    it("should keep guides and invisibles inside the faint-stroke band", () => {
      for (const key of ["editor.invisible", "editor.wrap_guide", "editor.indent_guide", "panel.indent_guide", "border.disabled"]) {
        const ratio = themeContrast(flattenOverBackdrop(style[key], editorBackground), editorBackground);
        expect(ratio, `${key} (${style[key]}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.7);
        expect(ratio, `${key} (${style[key]}) is ${ratio.toFixed(2)}:1 — too loud for a guide`).toBeLessThan(3);
      }
      // The active counterparts step up to the full border stroke.
      for (const [faint, active] of [
        ["editor.indent_guide", "editor.indent_guide_active"],
        ["editor.wrap_guide", "editor.active_wrap_guide"],
        ["panel.indent_guide", "panel.indent_guide_active"],
      ]) {
        const faintRatio = themeContrast(flattenOverBackdrop(style[faint], editorBackground), editorBackground);
        const activeRatio = themeContrast(flattenOverBackdrop(style[active], editorBackground), editorBackground);
        expect(activeRatio, `${active} must read stronger than ${faint}`).toBeGreaterThan(faintRatio);
      }
    });

    it("should define distinguishable accent colors", () => {
      expect(style.accents).toBeInstanceOf(Array);
      expect(style.accents.length).toBeGreaterThanOrEqual(5);
      expect(new Set(style.accents).size, "accents must not repeat").toBe(style.accents.length);
      for (const accent of style.accents) {
        const ratio = themeContrast(accent, editorBackground);
        expect(ratio, `accent ${accent} is ${ratio.toFixed(2)}:1 on the editor background`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("should use lowercase hex for every color value", () => {
      const uppercase = JSON.stringify(style).match(/#[0-9a-fA-F]{6,8}\b/g) || [];
      expect(uppercase.filter((c) => c !== c.toLowerCase())).toEqual([]);
    });
  });
}
