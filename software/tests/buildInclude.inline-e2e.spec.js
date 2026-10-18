import { describe, it, expect } from "vitest";

import buildIncludeModule from "../tools/build-include.js";

const {
  getCommentStyle,
  stripShebang,
  isFilePath,
  autoTransform,
  findMarkers,
  cleanBlock,
  replaceBlock,
  getRawBlockContent,
  toJsonLiteral,
  processInlineMarkers,
  cleanInlineMarkers,
  processSCSSInlineMarkers,
  cleanSCSSInlineMarkers,
  COLOR_MAP,
  COMMENT_STYLES,
  DEFAULT_COMMENT_STYLE,
  CODE_FENCE_LANGUAGES,
  INLINE_MARKER_REGEX,
  SCSS_INLINE_MARKER_REGEX,
} = buildIncludeModule;

function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const FILL_KEYS = ["background", "surface", "activeLine", "gray", "pressed", "selection", "matchHighlight"];

const FILL_LADDER = ["surface", "gray", "pressed"];

const STROKE_KEYS = ["brightGray", "guide"];

const FAINT_STROKE_BAND = { key: "guide", min: 1.7, max: 3 };

const CONTRAST_EXEMPT_KEYS = new Set([
  ...FILL_KEYS,
  ...STROKE_KEYS,
  "black",
  "white",
  "brightWhite",
  "cursorColor",
  "textDisabled",
  "themeName",
]);

const WARM_HUE_KEYS = new Set(["yellow", "brightYellow"]);

describe("processInlineMarkers", () => {
  const testMap = {
    dark: { background: "#000000", foreground: "#FFFFFF", enabled: true, count: 42, ratio: 3.14, empty: null },
    light: { background: "#FFFFFF", foreground: "#000000" },
  };

  it("should replace string values from map", () => {
    const input = '"background": "#AAAAAA", // {{dark.background}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('"background": "#000000", // {{dark.background}}');
    expect(changed).toBe(true);
  });

  it("should not mark changed when value already matches", () => {
    const input = '"background": "#000000", // {{dark.background}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe(input);
    expect(changed).toBe(false);
  });

  it("should replace boolean values", () => {
    const input = '"enabled": false, // {{dark.enabled}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('"enabled": true, // {{dark.enabled}}');
    expect(changed).toBe(true);
  });

  it("should not mark changed when boolean already matches", () => {
    const input = '"enabled": true, // {{dark.enabled}}';
    const { changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(changed).toBe(false);
  });

  it("should replace number values", () => {
    const input = '"count": 99, // {{dark.count}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('"count": 42, // {{dark.count}}');
    expect(changed).toBe(true);
  });

  it("should replace float values", () => {
    const input = '"ratio": 1.0, // {{dark.ratio}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('"ratio": 3.14, // {{dark.ratio}}');
    expect(changed).toBe(true);
  });

  it("should replace null values", () => {
    const input = '"empty": "#123456", // {{dark.empty}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('"empty": null, // {{dark.empty}}');
    expect(changed).toBe(true);
  });

  // A marker sitting after the closing braces of an inline object still binds to the value
  // inside it. Without this, every `textMateRules` marker went inert and its hex silently
  // drifted away from COLOR_MAP.
  it("should bind a marker that trails a nested inline object", () => {
    const input = '{ "scope": "comment", "settings": { "foreground": "#111111" } }, // {{dark.background}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('{ "scope": "comment", "settings": { "foreground": "#000000" } }, // {{dark.background}}');
    expect(changed).toBe(true);
  });

  it("should bind a marker that trails a multi-line object", () => {
    const input = ["{", '  "scope": ["a", "b"],', '  "settings": { "foreground": "#111111" },', "}, // {{dark.background}}"].join("\n");
    const { content } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toContain('"foreground": "#000000"');
  });

  // The marker must never reach past a non-color sibling and overwrite it — an earlier
  // version of the regex rewrote `"fontStyle": "bold"` into a hex color.
  it("should not bind a marker to a non-color sibling value", () => {
    const input = '{ "settings": { "foreground": "#111111", "fontStyle": "bold" } }, // {{dark.background}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe(input);
    expect(changed).toBe(false);
  });

  it("should handle multiple markers in one content block", () => {
    const input = ['"background": "#AAAAAA", // {{dark.background}}', '"foreground": "#BBBBBB", // {{dark.foreground}}'].join("\n");
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(changed).toBe(true);
    expect(content).toContain('"#000000", // {{dark.background}}');
    expect(content).toContain('"#FFFFFF", // {{dark.foreground}}');
  });

  it("should handle different theme maps in same content", () => {
    const input = ['"bg": "#111111", // {{dark.background}}', '"bg": "#222222", // {{light.background}}'].join("\n");
    const { content } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toContain('"#000000", // {{dark.background}}');
    expect(content).toContain('"#FFFFFF", // {{light.background}}');
  });

  it("should warn on unknown map name", () => {
    const input = '"val": "#000000", // {{unknown.key}}';
    const { content, changed, warnings } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(changed).toBe(false);
    expect(content).toBe(input);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("unknown.key");
  });

  it("should warn on unknown key in valid map", () => {
    const input = '"val": "#000000", // {{dark.nonexistent}}';
    const { warnings } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("dark.nonexistent");
  });

  it("should preserve trailing comma and whitespace", () => {
    const input = '"background": "#AAAAAA",  // {{dark.background}}';
    const { content } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('"background": "#000000",  // {{dark.background}}');
  });

  it("should handle value without trailing comma", () => {
    const input = '"background": "#AAAAAA" // {{dark.background}}';
    const { content } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('"background": "#000000" // {{dark.background}}');
  });

  it("should replace single-quoted string values and preserve quotes", () => {
    const input = "const bg = '#AAAAAA'; // {{dark.background}}";
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(changed).toBe(true);
    expect(content).toBe("const bg = '#000000'; // {{dark.background}}");
  });

  it("should not mark changed when single-quoted value already matches", () => {
    const input = "const bg = '#000000'; // {{dark.background}}";
    const { changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(changed).toBe(false);
  });

  it("should handle mixed double and single quotes in same content", () => {
    const input = ['"background": "#AAAAAA", // {{dark.background}}', "const fg = '#BBBBBB'; // {{dark.foreground}}"].join("\n");
    const { content } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toContain('"#000000", // {{dark.background}}');
    expect(content).toContain("'#FFFFFF'; // {{dark.foreground}}");
  });
});

describe("e2e: compile, clean, recompile flow", () => {
  const testMap = {
    dark: { background: "#000000", foreground: "#FFFFFF" },
  };

  it("should compile inline markers, clean preserves markers, recompile restores values", () => {
    // Step 1: Start with drifted values and compile
    const original = [
      "{",
      '  "background": "#AAAAAA", // {{dark.background}}',
      '  "foreground": "#BBBBBB", // {{dark.foreground}}',
      "}",
    ].join("\n");

    const compiled = processInlineMarkers(original, testMap, "test.jsonc");
    expect(compiled.changed).toBe(true);
    expect(compiled.content).toContain('"#000000", // {{dark.background}}');
    expect(compiled.content).toContain('"#FFFFFF", // {{dark.foreground}}');

    // Step 2: Recompile already-correct content (no changes)
    const recompiled = processInlineMarkers(compiled.content, testMap, "test.jsonc");
    expect(recompiled.changed).toBe(false);
    expect(recompiled.content).toBe(compiled.content);
  });

  it("should compile BEGIN/END blocks, clean them, then recompile", () => {
    const original = "# BEGIN mykey\nold content\n# END mykey";
    const newContent = "new content";

    // Step 1: Compile - replace block content
    const compiled = replaceBlock(original, "mykey", newContent, "#", "");
    expect(compiled).toBe("# BEGIN mykey\nnew content\n# END mykey");

    // Step 2: Clean - empty the block
    const cleaned = cleanBlock(compiled, "mykey", "#", "");
    expect(cleaned).toBe("# BEGIN mykey\n\n# END mykey");

    // Step 3: Recompile - fill it back in
    const recompiled = replaceBlock(cleaned, "mykey", newContent, "#", "");
    expect(recompiled).toBe("# BEGIN mykey\nnew content\n# END mykey");
    expect(recompiled).toBe(compiled);
  });

  it("should handle mixed BEGIN/END blocks and inline markers in full flow", () => {
    const original = ["# BEGIN header", "old header", "# END header", "{", '  "background": "#AAAAAA", // {{dark.background}}', "}"].join(
      "\n",
    );

    // Step 1: Process BEGIN/END block
    const afterBlock = replaceBlock(original, "header", "new header", "#", "");
    expect(afterBlock).toContain("new header");

    // Step 2: Process inline markers
    const afterInline = processInlineMarkers(afterBlock, testMap, "test.jsonc");
    expect(afterInline.changed).toBe(true);
    expect(afterInline.content).toContain('"#000000", // {{dark.background}}');
    expect(afterInline.content).toContain("new header");

    // Step 3: Clean BEGIN/END block
    const cleaned = cleanBlock(afterInline.content, "header", "#", "");
    expect(cleaned).toContain("# BEGIN header\n\n# END header");
    // Inline markers are untouched by clean (they're self-contained)
    expect(cleaned).toContain('"#000000", // {{dark.background}}');

    // Step 4: Recompile BEGIN/END block
    const recompiled = replaceBlock(cleaned, "header", "new header", "#", "");
    expect(recompiled).toBe(afterInline.content);
  });

  it("should update values when color map changes between compiles", () => {
    const input = '"background": "#000000", // {{dark.background}}';

    // Compile with original map
    const first = processInlineMarkers(input, testMap, "test.jsonc");
    expect(first.changed).toBe(false);

    // Simulate color map change
    const updatedMap = { dark: { background: "#111111" } };
    const second = processInlineMarkers(first.content, updatedMap, "test.jsonc");
    expect(second.changed).toBe(true);
    expect(second.content).toBe('"background": "#111111", // {{dark.background}}');

    // Compile again with same updated map (idempotent)
    const third = processInlineMarkers(second.content, updatedMap, "test.jsonc");
    expect(third.changed).toBe(false);
    expect(third.content).toBe(second.content);
  });
});
