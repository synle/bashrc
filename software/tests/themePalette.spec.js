/** Verifies foundation recipes, validation, and compatible generated color variants. */
import { describe, expect, it, onTestFinished } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import buildInclude from "../tools/build-include.js";

/** Creates owned JSONC input files and registers cleanup before writes; returns their folder. */
function foundations(dark, light = dark) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "theme-foundations-"));
  onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.writeFileSync(path.join(folder, "_palette_dark.jsonc"), dark);
  fs.writeFileSync(path.join(folder, "_palette_light.jsonc"), light);
  return folder;
}

describe("palette-derived semantic colors", () => {
  it("derives readable secondary text from the existing neutral ramp", () => {
    expect(buildInclude.COLOR_MAP.dark.textSecondary).toBe("#b2b2b2");
    expect(buildInclude.COLOR_MAP.light.textSecondary).toBe("#3f3f3f");
  });
  it("separates the terminal anchor from true black used by shadows", () => {
    expect(buildInclude.COLOR_MAP.dark.black).toBe("#000000");
    expect(buildInclude.COLOR_MAP.dark.terminalBlack).toBe("#6e6e6e");
    expect(buildInclude.COLOR_MAP.light.terminalBlack).toBe("#000000");
  });
  it("derives tested tints, shades, intermediate opacity, and RGB channels", () => {
    expect(buildInclude.COLOR_MAP.dark.blue_tint20).toBe("#7db3df");
    expect(buildInclude.COLOR_MAP.dark.blue_shade20).toBe("#4a80ac");
    expect(buildInclude.COLOR_MAP.dark.blue_alpha15).toBe("#5ca0d726");
    expect(buildInclude.COLOR_MAP.dark.background_alpha0).toBe("#0a0a0a00");
    expect(buildInclude.COLOR_MAP.dark.background_alpha100).toBe("#0a0a0aff");
    expect(buildInclude.COLOR_MAP.dark.black_R).toBe(0);
    expect(buildInclude.COLOR_MAP.dark.brightWhite_R).toBe(1);
  });
});

describe("foundation recipe resolution", () => {
  it("resolves forward references and case without mutating the foundation", () => {
    const input = {
      themeName: "Example",
      alias: { ref: "mixed" },
      mixed: { from: "white", over: "black", alpha: 0.5 },
      white: "#FFFFFF",
      black: "#000000",
    };
    expect(buildInclude.resolvePalette(input)).toMatchInlineSnapshot(`
      {
        "alias": "#808080",
        "black": "#000000",
        "mixed": "#808080",
        "themeName": "Example",
        "white": "#ffffff",
      }
    `);
    expect(input.white).toBe("#FFFFFF");
    expect(input.alias).toEqual({ ref: "mixed" });
  });
  it.each([
    [0, "#000000"],
    [1, "#ffffff"],
  ])("preserves alpha boundary %s", (alpha, expected) => {
    expect(buildInclude.resolvePalette({ themeName: "Example", color: { from: "#ffffff", over: "#000000", alpha } }).color).toBe(expected);
  });
  it.each([
    ["missing object", null],
    ["array", []],
    ["number", 0],
    ["missing name", {}],
    ["empty name", { themeName: " " }],
    ["invalid role", { themeName: "Example", "bad-role": "#000000" }],
    ["prototype role", { themeName: "Example", constructor: "#000000" }],
    ["bad hex", { themeName: "Example", color: "#fff" }],
    ["array recipe", { themeName: "Example", color: [] }],
    ["null recipe", { themeName: "Example", color: null }],
    ["missing reference", { themeName: "Example", color: { ref: "absent" } }],
    ["display-name reference", { themeName: "Example", color: { ref: "themeName" } }],
    ["non-string reference", { themeName: "Example", color: { ref: 0 } }],
    ["cycle", { themeName: "Example", first: { ref: "second" }, second: { ref: "first" } }],
    ["unknown recipe field", { themeName: "Example", color: { from: "#ffffff", over: "#000000", alpha: 0.5, extra: true } }],
    ["negative alpha", { themeName: "Example", color: { from: "#ffffff", over: "#000000", alpha: -0.1 } }],
    ["excessive alpha", { themeName: "Example", color: { from: "#ffffff", over: "#000000", alpha: 1.1 } }],
    ["string alpha", { themeName: "Example", color: { from: "#ffffff", over: "#000000", alpha: "0.5" } }],
    ["infinite alpha", { themeName: "Example", color: { from: "#ffffff", over: "#000000", alpha: Infinity } }],
  ])("rejects %s", (_name, input) => {
    expect(() => buildInclude.resolvePalette(input, "test-palette")).toThrow(/Invalid test-palette/);
  });
});

describe("JSONC foundation loading", () => {
  it("accepts comments and trailing commas and generates no name variants", () => {
    const folder = foundations('/* input */ {"themeName":"Example","black":"#000000",}');
    const colors = buildInclude.loadColorMap(folder);
    expect(colors.dark.black_alpha20).toBe("#00000033");
    expect(colors.light.black_shade20).toBe("#000000");
    expect(colors.dark.themeName_R).toBeUndefined();
  });
  it("rejects malformed JSONC", () => {
    expect(() => buildInclude.loadColorMap(foundations("{broken"))).toThrow(/Invalid .*_palette_dark.jsonc/);
  });
  it("rejects unequal appearance roles", () => {
    const folder = foundations('{"themeName":"Dark","black":"#000000"}', '{"themeName":"Light","white":"#ffffff"}');
    expect(() => buildInclude.loadColorMap(folder)).toThrow("dark and light roles must match");
  });
  it("propagates missing inputs rather than silently using another palette", () => {
    const folder = foundations('{"themeName":"Example","black":"#000000"}');
    fs.unlinkSync(path.join(folder, "_palette_light.jsonc"));
    expect(() => buildInclude.loadColorMap(folder)).toThrow(/_palette_light.jsonc/);
  });
});
