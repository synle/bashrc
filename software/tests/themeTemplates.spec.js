/** Checks active native-shaped templates, repeatable bindings, and the audited readable state pairs. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import ts from "typescript";
import buildInclude from "../tools/build-include.js";

/** Parses a committed JSONC template through the same syntax contract as application JSONC. */
function read(file) {
  const parsed = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, "utf8"));
  if (parsed.error) throw new Error(`Invalid template ${file}`);
  return parsed.config;
}
/** Returns the alpha-composited color used for static state-pair checks. */
function flatten(color, background) {
  if (color.length === 7) return color;
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  return (
    "#" +
    [1, 3, 5]
      .map((index) =>
        Math.round(parseInt(color.slice(index, index + 2), 16) * alpha + parseInt(background.slice(index, index + 2), 16) * (1 - alpha))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
/** Computes independent sRGB relative luminance for opaque six-digit colors. */
function luminance(color) {
  return [1, 3, 5]
    .map((index) => parseInt(color.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
/** Returns WCAG contrast for two opaque colors, used only as a source-pair screen. */
function contrast(a, b) {
  return (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
}

const apps = ["vscode", "sublime", "zed", "vim", "ghostty", "windows_terminal", "termux", "claude", "pi", "opencode", "gemini"];

it("stores native Vim spelling diagnostics for both appearances", () => {
  expect({
    dark: read("theme/sy/vim_dark.jsonc").highlights.SpellBad,
    light: read("theme/sy/vim_light.jsonc").highlights.SpellBad,
  }).toMatchInlineSnapshot(`
    {
      "dark": {
        "background": "NONE",
        "foreground": "NONE",
        "special": "#f67070",
        "style": "undercurl",
      },
      "light": {
        "background": "NONE",
        "foreground": "NONE",
        "special": "#840000",
        "style": "undercurl",
      },
    }
  `);
});

describe.each(["dark", "light"])("active %s templates", (mode) => {
  it.each(apps)("keeps %s as a native-shaped, fully rendered marker template", (app) => {
    const file = `theme/sy/${app}_${mode}.jsonc`;
    const raw = fs.readFileSync(file, "utf8");
    const native = read(file);
    expect(native).not.toHaveProperty("definition");
    expect(raw).toContain(`{{${mode}.`);
    const { changed, warnings } = buildInclude.processInlineMarkers(raw, buildInclude.COLOR_MAP, file);
    expect({ changed, warnings }).toMatchInlineSnapshot(`
      {
        "changed": false,
        "warnings": [],
      }
    `);
  });

  it("makes actual Sublime find foreground readable, not just its unrelated variable", () => {
    const source = read(`theme/sy/sublime_${mode}.jsonc`);
    expect(source.globals.find_highlight_foreground).toBe(buildInclude.COLOR_MAP[mode].foreground);
    expect(contrast(source.globals.find_highlight_foreground, source.variables.match)).toBeGreaterThanOrEqual(7);
    expect(source.globals.popup_css).not.toContain("{{");
  });

  it("keeps VS Code placeholder and inlay text readable on their actual fills", () => {
    const colors = read(`theme/sy/vscode_${mode}.jsonc`)["workbench.colorCustomizations"];
    expect(contrast(colors["input.placeholderForeground"], colors["input.background"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors["editorInlayHint.foreground"], colors["editorInlayHint.background"])).toBeGreaterThanOrEqual(4.5);
    expect(colors["editor.findMatchForeground"]).toBe(buildInclude.COLOR_MAP[mode].foreground);
    expect(colors["chat.requestBackground"]).toBe(buildInclude.COLOR_MAP[mode].surface);
  });

  it("keeps retained Zed syntax readable over all local editor states", () => {
    const style = read(`theme/sy/zed_${mode}.jsonc`).themes[0].style;
    const fills = [
      style.players[0].selection,
      style["editor.active_line.background"],
      style["search.match_background"],
      style["search.active_match_background"],
    ];
    const weak = fills.flatMap((fill) =>
      Object.entries(style.syntax)
        .filter(([, entry]) => entry.color)
        .map(([key, entry]) => ({ key, ratio: contrast(entry.color, flatten(fill, style["editor.background"])) }))
        .filter((pair) => pair.ratio < 4.5),
    );
    expect(weak).toEqual([]);
    expect(style.players).toHaveLength(8);
    expect(new Set(style.players.map((player) => player.cursor)).size).toBe(8);
  });

  it("uses terminal-specific black without changing shadow black", () => {
    const ghostty = read(`theme/sy/ghostty_${mode}.jsonc`);
    const termux = read(`theme/sy/termux_${mode}.jsonc`);
    expect(ghostty.palette[0]).toBe(buildInclude.COLOR_MAP[mode].terminalBlack);
    expect(termux.palette).toEqual(ghostty.palette);
    expect(contrast(ghostty.palette[0], ghostty.background)).toBeGreaterThanOrEqual(3);
    expect(buildInclude.COLOR_MAP[mode].black).toBe("#000000");
  });

  it("maps the complete captured Pi and OpenCode native role sets", () => {
    expect(Object.keys(read(`theme/sy/pi_${mode}.jsonc`).colors).sort()).toEqual(
      Object.keys(read(`theme/baseline/pi_${mode}.jsonc`).definition.colors).sort(),
    );
    expect(Object.keys(read(`theme/sy/opencode_${mode}.jsonc`).theme).sort()).toEqual(
      Object.keys(read(`theme/baseline/opencode_${mode}.jsonc`).definition.theme).sort(),
    );
    expect(read(`theme/sy/pi_${mode}.jsonc`).colors.toolSuccessBg).toBe(buildInclude.COLOR_MAP[mode].diffAddedBackground);
    expect(read(`theme/sy/claude_${mode}.jsonc`).overrides.diffAddedWord).toBe(buildInclude.COLOR_MAP[mode].diffAddedWordBackground);
  });

  // Native session/tree selectors retain accent/dim/status foregrounds after applying selectedBg to the whole row.
  it.each(["accent", "dim", "muted", "warning", "error"])("keeps Pi selector %s text readable on its actual selected row", (role) => {
    const colors = read(`theme/sy/pi_${mode}.jsonc`).colors;
    expect(contrast(colors[role], colors.selectedBg)).toBeGreaterThanOrEqual(4.5);
  });

  // All decorative whitespace markers reuse one existing neutral per appearance, separate from normal-text contrast requirements.
  it.each(["SpecialKey", "NonText"])("uses shared neutral grey for Vim %s without bold or underline", (group) => {
    const { highlights } = read(`theme/sy/vim_${mode}.jsonc`);
    expect(highlights[group].foreground).toBe({ dark: "#2b2b2b", light: "#cacaca" }[mode]);
    expect(highlights[group].background).toBe("NONE");
    expect(highlights[group].style).toBe("NONE");
    expect(contrast(highlights[group].foreground, highlights.Normal.background)).toBeLessThan(
      contrast(highlights.Normal.foreground, highlights.Normal.background),
    );
  });

  it("stores Vim groups, terminal colors, and status-line modes in its template", () => {
    const vim = read(`theme/sy/vim_${mode}.jsonc`);
    expect(vim.highlights.MatchParen.foreground).toBe(buildInclude.COLOR_MAP[mode].foreground);
    expect(vim.terminal).toHaveLength(16);
    expect(vim.lightline).toHaveProperty("insert");
  });
});
