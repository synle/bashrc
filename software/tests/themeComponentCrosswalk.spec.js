/** Verifies a value-free, explicit active/reference component union rather than a hand-picked contrast-pair list. */
import { describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import crosswalk from "../tools/theme-component-crosswalk.js";

const { buildCrosswalk, componentKeys, statesFor } = crosswalk;

describe("native component identity", () => {
  it.each([
    [
      "vscode",
      {
        colors: { "editor.background": "#000000" },
        tokenColors: [{ scope: ["string", "comment"], settings: {} }],
        semanticTokenColors: { number: "#ffffff" },
      },
      ["scope/comment", "scope/string", "semantic/number", "workbench/editor.background"],
    ],
    [
      "vscode",
      {
        "workbench.colorCustomizations": { "editor.foreground": "#ffffff" },
        "editor.tokenColorCustomizations": { textMateRules: [{ scope: "string, comment" }, {}] },
        "editor.semanticTokenColorCustomizations": { rules: { string: "#ffffff" } },
      },
      ["scope/comment", "scope/string", "semantic/string", "workbench/editor.foreground"],
    ],
    [
      "sublime",
      { globals: { foreground: "#fff" }, rules: [{ scope: "string, comment" }, { scope: "comment" }] },
      ["globals/foreground", "scope/comment", "scope/string"],
    ],
    [
      "zed",
      {
        themes: [
          {
            style: { "editor.background": "#fff", syntax: { string: { color: "#fff", font_style: null } }, players: [{ cursor: "#fff" }] },
          },
        ],
      },
      ["style/editor.background", "style/players/0/cursor", "style/syntax/string/color", "style/syntax/string/font_style"],
    ],
    [
      "vim",
      { sourceText: 'hi clear\n" hi Ignored\nexe "hi! Normal"\nhighlight! link Child Normal\nlet g:terminal_ansi_colors = []' },
      [
        "highlights/Child",
        "highlights/Normal",
        "terminal/0",
        "terminal/1",
        "terminal/10",
        "terminal/11",
        "terminal/12",
        "terminal/13",
        "terminal/14",
        "terminal/15",
        "terminal/2",
        "terminal/3",
        "terminal/4",
        "terminal/5",
        "terminal/6",
        "terminal/7",
        "terminal/8",
        "terminal/9",
      ],
    ],
    [
      "vim",
      { highlights: { Normal: {} }, terminal: ["#000"], lightline: { normal: { left: [["#fff", "#000"]] } } },
      ["highlights/Normal", "lightline/normal/left/0/0", "lightline/normal/left/0/1", "terminal/0"],
    ],
    ["ghostty", { sourceText: "# comment\npalette = 2=#fff\nbackground = #000\n" }, ["background", "palette/2"]],
    ["termux", { sourceText: "# comment\ncolor2=#fff\nbackground=#000\n" }, ["background", "palette/2"]],
    ["ghostty", { background: "#000", palette: ["#fff"] }, ["background", "palette/0"]],
    ["pi", { colors: { accent: "#fff" }, vars: { ignored: "#000" } }, ["colors/accent"]],
    ["opencode", { theme: { accent: { dark: "#000", light: "#fff" } } }, ["theme/accent"]],
    ["claude", { name: "Example", overrides: { text: "#fff" } }, ["overrides/text"]],
    [
      "gemini",
      { format: "reference", palette: { Foreground: "#fff" }, syntax: { string: "#fff" } },
      ["reference_palette/Foreground", "reference_syntax/string"],
    ],
    ["gemini", { name: "Example", text: { primary: "#fff" }, ui: {} }, ["text/primary"]],
    ["windows_terminal", { name: "Example", foreground: "#fff", background: "#000" }, ["background", "foreground"]],
    ["copilot", { captureStatus: "unavailable", nativePalette: "native" }, []],
    ["claude", { captureStatus: "gap", reason: "unavailable" }, []],
    ["vim", { sourceText: "highlight Normal guifg=#fff\nhi default link Child Normal" }, ["highlights/Child", "highlights/Normal"]],
  ])("normalizes %s without copying palette values", (app, source, expected) => {
    expect(componentKeys(app, source)).toEqual(expected);
  });

  it.each(["vscode", "sublime", "zed", "vim", "pi", "opencode", "claude", "gemini", "windows_terminal"])(
    "accepts an empty %s component set",
    (app) => {
      expect(componentKeys(app, {})).toEqual([]);
    },
  );
  it.each([null, [], "bad", 0, false])("rejects malformed roots: %s", (source) => {
    expect(() => componentKeys("vscode", source)).toThrow("expected an object");
  });
  it("rejects an unknown application instead of inventing a shape", () => {
    expect(() => componentKeys("../escape", {})).toThrow("Unknown theme app");
  });
});

describe("named native states", () => {
  it.each([
    ["editor.foreground", ["default"]],
    ["tab.unfocusedActiveForeground", ["unfocused", "active"]],
    ["tab.inactiveForeground", ["unfocused", "dimmed"]],
    ["button.hoverBackground", ["hover"]],
    ["list.activeSelectionBackground", ["active", "selection"]],
    ["button.pressed", ["pressed"]],
    ["text.disabled", ["dimmed"]],
    ["SpellBad", ["diagnostic"]],
    ["diffAddedWord", ["diff"]],
    ["cursor-color", ["cursor"]],
  ])("labels %s without confusing inactive with active", (key, expected) => {
    expect(statesFor(key)).toEqual(expected);
  });
});

describe("complete bounded source union", () => {
  it("covers both appearances and leaves captured-only scopes explicit", () => {
    const report = buildCrosswalk();
    expect(report.entries).toHaveLength(24);
    expect(report.boundary).toContain("not every native schema");
    const dark = report.entries.find((entry) => entry.app === "vim" && entry.mode === "dark");
    expect(dark.components.find((entry) => entry.key === "highlights/CursorLineConceal")).toEqual({
      key: "highlights/CursorLineConceal",
      states: ["cursor"],
      active: false,
      capturedReference: true,
      disposition: "reference_only_requires_reachability_review",
    });
    const copilot = report.entries.find((entry) => entry.app === "copilot" && entry.mode === "dark");
    expect(copilot).toMatchObject({ capability: "capability_limit", reference: "unavailable", components: [] });
    expect(JSON.stringify(report)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(
      report.entries.flatMap((entry) => entry.components.filter((component) => !component.active && !component.capturedReference)),
    ).toEqual([]);
  });

  it("emits parseable CLI JSON with the same complete inventory", () => {
    const result = spawnSync(process.execPath, ["software/tools/theme-component-crosswalk.js"], { encoding: "utf8", timeout: 5000 });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(buildCrosswalk());
  });

  it("rejects malformed source JSONC without returning a partial crosswalk", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "theme crosswalk "));
    onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
    fs.mkdirSync(path.join(folder, "theme/sy"), { recursive: true });
    fs.writeFileSync(path.join(folder, "theme/sy/vscode_dark.jsonc"), "{ broken");
    expect(() => buildCrosswalk(folder)).toThrow("Invalid theme JSONC");
    expect(fs.readdirSync(path.join(folder, "theme/sy"))).toEqual(["vscode_dark.jsonc"]);
  });
});
