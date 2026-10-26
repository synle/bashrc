/** Verifies repeatable names/CSS markers, strict diagnostics, and preservation of style siblings. */
import { describe, expect, it } from "vitest";
import buildInclude from "../tools/build-include.js";

const palette = { dark: { themeName: "Sy Dark", background: "#0a0a0a", foreground: "#e8e8e8", blue: "#5ca0d7" } };

describe("theme marker replacement", () => {
  it("replaces the display name without requiring a hex literal", () => {
    expect(buildInclude.processInlineMarkers('"name": "Old name", // {{dark.themeName}}', palette, "test.jsonc").content).toBe(
      '"name": "Sy Dark", // {{dark.themeName}}',
    );
  });
  it("escapes arbitrary display names when rebuilding a cleared literal", () => {
    const colors = { dark: { themeName: 'Sy "quoted"' } };
    expect(buildInclude.processInlineMarkers('"name": "", // {{dark.themeName}}', colors, "test.jsonc").content).toBe(
      String.raw`"name": "Sy \"quoted\"", // {{dark.themeName}}`,
    );
  });
  it("rerenders every embedded CSS color after a later palette change", () => {
    const source = '"popup_css": "", // {{template: "html { color: {{dark.foreground}}; background: {{dark.background}}; }"}}';
    const first = buildInclude.processInlineMarkers(source, palette, "test.jsonc");
    expect(first.content).toContain('"popup_css": "html { color: #e8e8e8; background: #0a0a0a; }"');
    expect(first.content).toContain("// {{template:");
    const second = buildInclude.processInlineMarkers(first.content, { dark: { ...palette.dark, foreground: "#ffffff" } }, "test.jsonc");
    expect(second.content).toContain("color: #ffffff; background: #0a0a0a;");
    expect(second.changed).toBe(true);
    expect(buildInclude.processInlineMarkers(first.content, palette, "test.jsonc").changed).toBe(false);
  });
  it("keeps names and string recipes restorable through clean mode", () => {
    const source = ['"name": "Old", // {{dark.themeName}}', '"css": "", // {{template: "color: {{dark.blue}}"}}'].join("\n");
    const built = buildInclude.processInlineMarkers(source, palette, "test.jsonc").content;
    const clean = buildInclude.cleanInlineMarkers(built);
    expect(clean.content).toBe(['"name": "", // {{dark.themeName}}', '"css": "", // {{template: "color: {{dark.blue}}"}}'].join("\n"));
    expect(buildInclude.processInlineMarkers(clean.content, palette, "test.jsonc").content).toBe(built);
  });
  it("reports an unknown embedded role without partially changing its value", () => {
    const source = '"css": "kept", // {{template: "color: {{dark.blue}}; border: {{dark.absent}}"}}';
    const result = buildInclude.processInlineMarkers(source, palette, "test.jsonc");
    expect(result.content).toBe(source);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("dark.absent");
  });
  it("reports malformed recipe string escapes without swallowing the diagnostic", () => {
    const source = String.raw`"css": "kept", // {{template: "\q {{dark.blue}}"}}`;
    const result = buildInclude.processInlineMarkers(source, palette, "test.jsonc");
    expect(result.content).toBe(source);
    expect(result.warnings[0]).toContain("invalid JSON string template");
  });
  it("does not resolve inherited marker keys", () => {
    const inherited = { dark: Object.create({ blue: "#ffffff" }) };
    const result = buildInclude.processInlineMarkers('"color": "#000000", // {{dark.blue}}', inherited, "test.jsonc");
    expect(result.content).toBe('"color": "#000000", // {{dark.blue}}');
    expect(result.warnings).toHaveLength(1);
  });
  it("preserves color-looking documentation comments and non-color style siblings", () => {
    const source = '// "{{dark.foreground}}"\n{"foreground":"#000000", "fontStyle":"bold"}, // {{dark.blue}}';
    expect(buildInclude.processInlineMarkers(source, palette, "test.jsonc").content).toBe(source);
  });
  it("checks active bindings and native JSONC before a caller writes anything", () => {
    const source = '{\n  "foreground": "#000000" // {{dark.blue}}\n}';
    expect(buildInclude.compileThemeTemplate(source, palette, "active.jsonc")).toMatchInlineSnapshot(`
      {
        "changed": true,
        "content": "{
        "foreground": "#5ca0d7" // {{dark.blue}}
      }",
        "warnings": [],
      }
    `);
    expect(
      buildInclude.compileThemeTemplate('{"color":"#000000","fontStyle":"bold"} // {{dark.blue}}', palette, "active.jsonc").warnings[0],
    ).toContain("unbound theme marker");
    expect(buildInclude.compileThemeTemplate('{"color": // {{dark.blue}}\nbroken', palette, "active.jsonc").warnings.join(" ")).toContain(
      "invalid JSONC",
    );
  });

  it("does not interpret marker-looking text inside a native string as a comment", () => {
    const source = '{"note":"// {{dark.blue}}"}';
    expect(buildInclude.compileThemeTemplate(source, palette, "active.jsonc")).toMatchInlineSnapshot(`
      {
        "changed": false,
        "content": "{"note":"// {{dark.blue}}"}",
        "warnings": [],
      }
    `);
  });
});
