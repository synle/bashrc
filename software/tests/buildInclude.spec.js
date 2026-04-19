import { describe, it, expect } from "vitest";

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
} = require("../tools/build-include.js");

// ---- tests ----

describe("getCommentStyle", () => {
  it("should return HTML comment style for .md files", () => {
    expect(getCommentStyle("README.md")).toEqual({ prefix: "<!--", suffix: " -->" });
  });

  it("should return // style for .js files", () => {
    expect(getCommentStyle("index.js")).toEqual({ prefix: "//", suffix: "" });
  });

  it("should return // style for .jsonc files", () => {
    expect(getCommentStyle("theme.jsonc")).toEqual({ prefix: "//", suffix: "" });
  });

  it("should return # style for unknown extensions", () => {
    expect(getCommentStyle("script.sh")).toEqual(DEFAULT_COMMENT_STYLE);
  });
});

describe("stripShebang", () => {
  it("should remove shebang line", () => {
    expect(stripShebang("#!/usr/bin/env bash\necho hello")).toBe("echo hello");
  });

  it("should leave content without shebang unchanged", () => {
    expect(stripShebang("echo hello")).toBe("echo hello");
  });
});

describe("isFilePath", () => {
  it("should return true for paths with /", () => {
    expect(isFilePath("path/to/file")).toBe(true);
  });

  it("should return true for paths with .", () => {
    expect(isFilePath("file.sh")).toBe(true);
  });

  it("should return false for plain keys", () => {
    expect(isFilePath("some-key")).toBe(false);
  });
});

describe("autoTransform", () => {
  it("should strip shebang from shell scripts", () => {
    const result = autoTransform("#!/bin/bash\necho hi", "test.sh", "target.sh");
    expect(result).toBe("echo hi");
  });

  it("should wrap shell content in code fence for markdown targets", () => {
    const result = autoTransform("echo hi\necho bye", "test.sh", "README.md");
    expect(result).toBe("\n```bash\necho hi\necho bye\n```\n");
  });

  it("should pass through non-shell content for non-markdown targets", () => {
    const result = autoTransform("const x = 1;", "test.js", "target.js");
    expect(result).toBe("const x = 1;");
  });
});

describe("findMarkers", () => {
  it("should find # BEGIN markers in .sh files", () => {
    const content = "# BEGIN path/to/file.sh\nsome content\n# END path/to/file.sh";
    const markers = findMarkers(content, "target.sh");
    expect(markers).toHaveLength(1);
    expect(markers[0].key).toBe("path/to/file.sh");
    expect(markers[0].commentPrefix).toBe("#");
  });

  it("should find <!-- BEGIN --> markers in .md files", () => {
    const content = "<!-- BEGIN path/to/file.sh -->\nsome content\n<!-- END path/to/file.sh -->";
    const markers = findMarkers(content, "README.md");
    expect(markers).toHaveLength(1);
    expect(markers[0].key).toBe("path/to/file.sh");
  });

  it("should find // BEGIN markers in .jsonc files", () => {
    const content = "// BEGIN some/file.js\nstuff\n// END some/file.js";
    const markers = findMarkers(content, "theme.jsonc");
    expect(markers).toHaveLength(1);
    expect(markers[0].key).toBe("some/file.js");
  });

  it("should return empty array when no markers found", () => {
    expect(findMarkers("no markers here", "file.sh")).toEqual([]);
  });

  it("should not match SOURCE markers (runtime-only, ignored by build-include)", () => {
    const content = "# SOURCE software/scripts/foo.bash\n# BEGIN path/to/file.sh\ncontent\n# END path/to/file.sh";
    const markers = findMarkers(content, "target.sh");
    expect(markers).toHaveLength(1);
    expect(markers[0].key).toBe("path/to/file.sh");
  });

  it("should not match SOURCE_BEGIN/SOURCE_END markers (runtime-only, ignored by build-include)", () => {
    const content =
      "# SOURCE_BEGIN software/scripts/foo.bash\ncontent\n# SOURCE_END software/scripts/foo.bash\n# BEGIN path/to/file.sh\ncontent\n# END path/to/file.sh";
    const markers = findMarkers(content, "target.sh");
    expect(markers).toHaveLength(1);
    expect(markers[0].key).toBe("path/to/file.sh");
  });
});

describe("replaceBlock", () => {
  it("should replace content between BEGIN/END markers", () => {
    const content = "# BEGIN key\nold content\n# END key";
    const result = replaceBlock(content, "key", "new content", "#", "");
    expect(result).toBe("# BEGIN key\nnew content\n# END key");
  });

  it("should return original content when markers not found", () => {
    expect(replaceBlock("no markers", "key", "content", "#", "")).toBe("no markers");
  });

  it("should preserve content before and after markers", () => {
    const content = "before\n# BEGIN key\nold\n# END key\nafter";
    const result = replaceBlock(content, "key", "new", "#", "");
    expect(result).toBe("before\n# BEGIN key\nnew\n# END key\nafter");
  });

  it("should expand short-form BEGIN/END marker and replace", () => {
    const content = "# BEGIN/END key";
    const result = replaceBlock(content, "key", "new content", "#", "");
    expect(result).toBe("# BEGIN key\nnew content\n# END key");
  });

  it("should expand short-form with dash separator", () => {
    const content = "# BEGIN/END - key";
    const result = replaceBlock(content, "key", "new content", "#", "");
    expect(result).toBe("# BEGIN key\nnew content\n# END key");
  });
});

describe("cleanBlock", () => {
  it("should empty content between markers", () => {
    const content = "# BEGIN key\nold content\n# END key";
    const result = cleanBlock(content, "key", "#", "");
    expect(result).toBe("# BEGIN key\n\n# END key");
  });

  it("should empty content with HTML comment markers", () => {
    const content = "<!-- BEGIN key -->\nold content\n<!-- END key -->";
    const result = cleanBlock(content, "key", "<!--", " -->");
    expect(result).toBe("<!-- BEGIN key -->\n\n<!-- END key -->");
  });

  it("should empty content with // markers", () => {
    const content = "// BEGIN key\nold content\n// END key";
    const result = cleanBlock(content, "key", "//", "");
    expect(result).toBe("// BEGIN key\n\n// END key");
  });

  it("should preserve surrounding content when cleaning", () => {
    const content = "header\n# BEGIN key\nold content\n# END key\nfooter";
    const result = cleanBlock(content, "key", "#", "");
    expect(result).toBe("header\n# BEGIN key\n\n# END key\nfooter");
  });

  it("should return original content when markers not found", () => {
    expect(cleanBlock("no markers", "key", "#", "")).toBe("no markers");
  });
});

describe("cleanInlineMarkers", () => {
  it("should replace double-quoted strings with empty string", () => {
    const input = '"background": "#000000", // {{dark.background}}';
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe('"background": "", // {{dark.background}}');
  });

  it("should replace single-quoted strings with empty string preserving quotes", () => {
    const input = "const bg = '#000000'; // {{dark.background}}";
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe("const bg = ''; // {{dark.background}}");
  });

  it("should replace booleans with false", () => {
    const input = '"enabled": true, // {{config.enabled}}';
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe('"enabled": false, // {{config.enabled}}');
  });

  it("should not mark changed when boolean is already false", () => {
    const input = '"enabled": false, // {{config.enabled}}';
    const { changed } = cleanInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should replace numbers with 0", () => {
    const input = '"count": 42, // {{config.count}}';
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe('"count": 0, // {{config.count}}');
  });

  it("should not mark changed when number is already 0", () => {
    const input = '"count": 0, // {{config.count}}';
    const { changed } = cleanInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should keep null as null", () => {
    const input = '"value": null, // {{config.value}}';
    const { changed } = cleanInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should not mark changed when string is already empty", () => {
    const input = '"background": "", // {{dark.background}}';
    const { changed } = cleanInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should clean multiple markers in one content block", () => {
    const input = [
      '"background": "#000000", // {{dark.background}}',
      '"enabled": true, // {{config.enabled}}',
      '"count": 42, // {{config.count}}',
    ].join("\n");
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toContain('"", // {{dark.background}}');
    expect(content).toContain("false, // {{config.enabled}}");
    expect(content).toContain("0, // {{config.count}}");
  });

  it("should preserve trailing punctuation and whitespace", () => {
    const input = '"background": "#000000",  // {{dark.background}}';
    const { content } = cleanInlineMarkers(input);
    expect(content).toBe('"background": "",  // {{dark.background}}');
  });
});

describe("cleanInlineMarkers", () => {
  it("should replace double-quoted strings with empty string", () => {
    const input = '"background": "#000000", // {{dark.background}}';
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe('"background": "", // {{dark.background}}');
  });

  it("should replace single-quoted strings with empty string preserving quotes", () => {
    const input = "const bg = '#000000'; // {{dark.background}}";
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe("const bg = ''; // {{dark.background}}");
  });

  it("should replace booleans with false", () => {
    const input = '"enabled": true, // {{config.enabled}}';
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe('"enabled": false, // {{config.enabled}}');
  });

  it("should not mark changed when boolean is already false", () => {
    const input = '"enabled": false, // {{config.enabled}}';
    const { changed } = cleanInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should replace numbers with 0", () => {
    const input = '"count": 42, // {{config.count}}';
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe('"count": 0, // {{config.count}}');
  });

  it("should not mark changed when number is already 0", () => {
    const input = '"count": 0, // {{config.count}}';
    const { changed } = cleanInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should keep null as null", () => {
    const input = '"value": null, // {{config.value}}';
    const { changed } = cleanInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should not mark changed when string is already empty", () => {
    const input = '"background": "", // {{dark.background}}';
    const { changed } = cleanInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should clean multiple markers in one content block", () => {
    const input = [
      '"background": "#000000", // {{dark.background}}',
      '"enabled": true, // {{config.enabled}}',
      '"count": 42, // {{config.count}}',
    ].join("\n");
    const { content, changed } = cleanInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toContain('"", // {{dark.background}}');
    expect(content).toContain("false, // {{config.enabled}}");
    expect(content).toContain("0, // {{config.count}}");
  });

  it("should preserve trailing punctuation and whitespace", () => {
    const input = '"background": "#000000",  // {{dark.background}}';
    const { content } = cleanInlineMarkers(input);
    expect(content).toBe('"background": "",  // {{dark.background}}');
  });
});

describe("toJsonLiteral", () => {
  it("should wrap strings in quotes", () => {
    expect(toJsonLiteral("#FF0000")).toBe('"#FF0000"');
    expect(toJsonLiteral("hello")).toBe('"hello"');
  });

  it("should serialize booleans without quotes", () => {
    expect(toJsonLiteral(true)).toBe("true");
    expect(toJsonLiteral(false)).toBe("false");
  });

  it("should serialize null without quotes", () => {
    expect(toJsonLiteral(null)).toBe("null");
  });

  it("should serialize integers without quotes", () => {
    expect(toJsonLiteral(42)).toBe("42");
    expect(toJsonLiteral(-7)).toBe("-7");
    expect(toJsonLiteral(0)).toBe("0");
  });

  it("should serialize floats without quotes", () => {
    expect(toJsonLiteral(3.14)).toBe("3.14");
    expect(toJsonLiteral(-0.5)).toBe("-0.5");
  });

  it("should use single quotes when quoteChar is single quote", () => {
    expect(toJsonLiteral("#FF0000", "'")).toBe("'#FF0000'");
    expect(toJsonLiteral("hello", "'")).toBe("'hello'");
  });

  it("should default to double quotes when quoteChar is omitted", () => {
    expect(toJsonLiteral("test")).toBe('"test"');
    expect(toJsonLiteral("test", '"')).toBe('"test"');
  });

  it("should ignore quoteChar for non-string values", () => {
    expect(toJsonLiteral(true, "'")).toBe("true");
    expect(toJsonLiteral(42, "'")).toBe("42");
    expect(toJsonLiteral(null, "'")).toBe("null");
  });
});

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
    const input = '"empty": "something", // {{dark.empty}}';
    const { content, changed } = processInlineMarkers(input, testMap, "test.jsonc");
    expect(content).toBe('"empty": null, // {{dark.empty}}');
    expect(changed).toBe(true);
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

describe("COLOR_MAP", () => {
  it("should have dark and light themes", () => {
    expect(COLOR_MAP).toHaveProperty("dark");
    expect(COLOR_MAP).toHaveProperty("light");
  });

  it("should have standard terminal color keys in dark theme", () => {
    const keys = Object.keys(COLOR_MAP.dark);
    expect(keys).toContain("background");
    expect(keys).toContain("foreground");
    expect(keys).toContain("blue");
    expect(keys).toContain("red");
    expect(keys).toContain("green");
  });

  it("should have themeName in both themes", () => {
    expect(COLOR_MAP.dark.themeName).toBe("Sy Dark");
    expect(COLOR_MAP.light.themeName).toBe("Sy Light");
  });

  it("should have all color values in lowercase 6-char hex format", () => {
    for (const theme of [COLOR_MAP.dark, COLOR_MAP.light]) {
      for (const [key, value] of Object.entries(theme)) {
        if (typeof value === "string" && value.startsWith("#")) {
          expect(value).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
        }
      }
    }
  });

  it("should have float RGB variants for hex colors", () => {
    // background is a hex color, so it should have _R, _G, _B variants
    expect(COLOR_MAP.dark).toHaveProperty("background_R");
    expect(COLOR_MAP.dark).toHaveProperty("background_G");
    expect(COLOR_MAP.dark).toHaveProperty("background_B");
    expect(typeof COLOR_MAP.dark.background_R).toBe("number");
    expect(typeof COLOR_MAP.dark.background_G).toBe("number");
    expect(typeof COLOR_MAP.dark.background_B).toBe("number");
    // Values should be in 0-1 range
    expect(COLOR_MAP.dark.background_R).toBeGreaterThanOrEqual(0);
    expect(COLOR_MAP.dark.background_R).toBeLessThanOrEqual(1);
  });

  it("should have alpha hex variants for hex colors", () => {
    expect(COLOR_MAP.dark).toHaveProperty("background_alpha0");
    expect(COLOR_MAP.dark).toHaveProperty("background_alpha20");
    expect(COLOR_MAP.dark).toHaveProperty("background_alpha40");
    expect(COLOR_MAP.dark).toHaveProperty("background_alpha60");
    expect(COLOR_MAP.dark).toHaveProperty("background_alpha80");
    expect(COLOR_MAP.dark).toHaveProperty("background_alpha100");
    // Alpha variants should be hex + 2 hex digits
    expect(COLOR_MAP.dark.background_alpha0).toMatch(/^#[0-9A-Fa-f]{8}$/);
    expect(COLOR_MAP.dark.background_alpha100).toMatch(/^#[0-9A-Fa-f]{8}$/);
  });

  it("should not generate variants for non-hex values like themeName", () => {
    expect(COLOR_MAP.dark).not.toHaveProperty("themeName_R");
    expect(COLOR_MAP.dark).not.toHaveProperty("themeName_alpha0");
  });

  it("should have matching keys between dark and light themes", () => {
    const darkBaseKeys = Object.keys(COLOR_MAP.dark).filter((k) => !k.includes("_"));
    const lightBaseKeys = Object.keys(COLOR_MAP.light).filter((k) => !k.includes("_"));
    expect(darkBaseKeys.sort()).toEqual(lightBaseKeys.sort());
  });
});

describe("getRawBlockContent", () => {
  it("should extract content between BEGIN/END markers", () => {
    const content = "# BEGIN mykey\nhello world\n# END mykey";
    const result = getRawBlockContent(content, "mykey", "#", "");
    expect(result).toBe("hello world");
  });

  it("should return null when markers are not found", () => {
    const result = getRawBlockContent("no markers here", "mykey", "#", "");
    expect(result).toBeNull();
  });

  it("should return null when only BEGIN marker exists", () => {
    const result = getRawBlockContent("# BEGIN mykey\ncontent", "mykey", "#", "");
    expect(result).toBeNull();
  });

  it("should return null when only END marker exists", () => {
    const result = getRawBlockContent("content\n# END mykey", "mykey", "#", "");
    expect(result).toBeNull();
  });

  it("should handle HTML comment markers", () => {
    const content = "<!-- BEGIN mykey -->\nhello\n<!-- END mykey -->";
    const result = getRawBlockContent(content, "mykey", "<!--", " -->");
    expect(result).toBe("hello");
  });

  it("should handle // comment markers", () => {
    const content = "// BEGIN mykey\nconst x = 1;\n// END mykey";
    const result = getRawBlockContent(content, "mykey", "//", "");
    expect(result).toBe("const x = 1;");
  });

  it("should handle empty content between markers", () => {
    const content = "# BEGIN mykey\n\n# END mykey";
    const result = getRawBlockContent(content, "mykey", "#", "");
    expect(result).toBe("");
  });

  it("should handle multiline content between markers", () => {
    const content = "# BEGIN mykey\nline1\nline2\nline3\n# END mykey";
    const result = getRawBlockContent(content, "mykey", "#", "");
    expect(result).toBe("line1\nline2\nline3");
  });
});

describe("processSCSSInlineMarkers", () => {
  const testMap = {
    dark: { background: "#000000", foreground: "#FFFFFF" },
    light: { background: "#F8F8F8" },
  };

  it("should replace CSS property values from map", () => {
    const input = "  color: red; // {{dark.background}}";
    const { content, changed } = processSCSSInlineMarkers(input, testMap, "test.scss");
    expect(changed).toBe(true);
    expect(content).toBe("  color: #000000; // {{dark.background}}");
  });

  it("should not mark changed when value already matches", () => {
    const input = "  color: #000000; // {{dark.background}}";
    const { changed } = processSCSSInlineMarkers(input, testMap, "test.scss");
    expect(changed).toBe(false);
  });

  it("should handle multiple markers in one content block", () => {
    const input = ["  bg: red; // {{dark.background}}", "  fg: blue; // {{dark.foreground}}"].join("\n");
    const { content, changed } = processSCSSInlineMarkers(input, testMap, "test.scss");
    expect(changed).toBe(true);
    expect(content).toContain("#000000; // {{dark.background}}");
    expect(content).toContain("#FFFFFF; // {{dark.foreground}}");
  });

  it("should warn on unknown map name", () => {
    const input = "  color: red; // {{unknown.key}}";
    const { content, changed, warnings } = processSCSSInlineMarkers(input, testMap, "test.scss");
    expect(changed).toBe(false);
    expect(content).toBe(input);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("unknown.key");
  });

  it("should warn on unknown key in valid map", () => {
    const input = "  color: red; // {{dark.nonexistent}}";
    const { warnings } = processSCSSInlineMarkers(input, testMap, "test.scss");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("dark.nonexistent");
  });

  it("should handle different theme maps in same content", () => {
    const input = ["  bg: red; // {{dark.background}}", "  bg: blue; // {{light.background}}"].join("\n");
    const { content } = processSCSSInlineMarkers(input, testMap, "test.scss");
    expect(content).toContain("#000000; // {{dark.background}}");
    expect(content).toContain("#F8F8F8; // {{light.background}}");
  });
});

describe("cleanSCSSInlineMarkers", () => {
  it("should replace CSS property values with empty", () => {
    const input = "  color: #000000; // {{dark.background}}";
    const { content, changed } = cleanSCSSInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toBe("  color:; // {{dark.background}}");
  });

  it("should not mark changed when value is already empty", () => {
    const input = "  color:; // {{dark.background}}";
    const { changed } = cleanSCSSInlineMarkers(input);
    expect(changed).toBe(false);
  });

  it("should clean multiple markers in one content block", () => {
    const input = ["  bg: #000000; // {{dark.background}}", "  fg: #FFFFFF; // {{dark.foreground}}"].join("\n");
    const { content, changed } = cleanSCSSInlineMarkers(input);
    expect(changed).toBe(true);
    expect(content).toContain(":; // {{dark.background}}");
    expect(content).toContain(":; // {{dark.foreground}}");
  });
});

describe("SCSS e2e: compile, clean, recompile flow", () => {
  const testMap = {
    dark: { background: "#000000", foreground: "#FFFFFF" },
  };

  it("should compile, clean, and recompile SCSS markers correctly", () => {
    const original = "  bg: red; // {{dark.background}}";

    // Step 1: Compile
    const compiled = processSCSSInlineMarkers(original, testMap, "test.scss");
    expect(compiled.changed).toBe(true);
    expect(compiled.content).toContain("#000000");

    // Step 2: Recompile (idempotent)
    const recompiled = processSCSSInlineMarkers(compiled.content, testMap, "test.scss");
    expect(recompiled.changed).toBe(false);

    // Step 3: Clean
    const cleaned = cleanSCSSInlineMarkers(compiled.content);
    expect(cleaned.changed).toBe(true);
    expect(cleaned.content).toContain(":; // {{dark.background}}");

    // Step 4: Recompile from clean
    const restored = processSCSSInlineMarkers(cleaned.content, testMap, "test.scss");
    expect(restored.changed).toBe(true);
    expect(restored.content).toBe(compiled.content);
  });
});

describe("CODE_FENCE_LANGUAGES", () => {
  it("should map .sh to bash", () => {
    expect(CODE_FENCE_LANGUAGES[".sh"]).toBe("bash");
  });

  it("should map .bash to bash", () => {
    expect(CODE_FENCE_LANGUAGES[".bash"]).toBe("bash");
  });

  it("should map .zsh to bash", () => {
    expect(CODE_FENCE_LANGUAGES[".zsh"]).toBe("bash");
  });

  it("should map .ps1 to powershell", () => {
    expect(CODE_FENCE_LANGUAGES[".ps1"]).toBe("powershell");
  });

  it("should not have .js mapping", () => {
    expect(CODE_FENCE_LANGUAGES[".js"]).toBeUndefined();
  });
});

describe("INLINE_MARKER_REGEX", () => {
  it("should match double-quoted string with marker", () => {
    const match = '"#000000", // {{dark.background}}'.match(INLINE_MARKER_REGEX);
    expect(match).not.toBeNull();
  });

  it("should match single-quoted string with marker", () => {
    const match = "'#000000'; // {{dark.background}}".match(INLINE_MARKER_REGEX);
    expect(match).not.toBeNull();
  });

  it("should match boolean with marker", () => {
    const match = "true, // {{config.enabled}}".match(INLINE_MARKER_REGEX);
    expect(match).not.toBeNull();
  });

  it("should match null with marker", () => {
    const match = "null, // {{config.value}}".match(INLINE_MARKER_REGEX);
    expect(match).not.toBeNull();
  });

  it("should match integer with marker", () => {
    const match = "42, // {{config.count}}".match(INLINE_MARKER_REGEX);
    expect(match).not.toBeNull();
  });

  it("should match negative number with marker", () => {
    const match = "-7, // {{config.count}}".match(INLINE_MARKER_REGEX);
    expect(match).not.toBeNull();
  });

  it("should match float with marker", () => {
    const match = "3.14, // {{config.ratio}}".match(INLINE_MARKER_REGEX);
    expect(match).not.toBeNull();
  });

  it("should not match text without marker comment", () => {
    INLINE_MARKER_REGEX.lastIndex = 0;
    const match = INLINE_MARKER_REGEX.exec('"#000000"');
    expect(match).toBeNull();
  });
});

describe("SCSS_INLINE_MARKER_REGEX", () => {
  it("should match CSS property value with marker", () => {
    const match = "  color: #000000; // {{dark.background}}".match(SCSS_INLINE_MARKER_REGEX);
    expect(match).not.toBeNull();
  });

  it("should not match without semicolon", () => {
    SCSS_INLINE_MARKER_REGEX.lastIndex = 0;
    const match = SCSS_INLINE_MARKER_REGEX.exec("  color: #000000 // {{dark.background}}");
    expect(match).toBeNull();
  });
});

// ---- sourceMetadataHeader tests ----

describe("sourceMetadataHeader", () => {
  const { sourceMetadataHeader } = require("../tools/build-include.js");
  const fs = require("fs");
  const path = require("path");

  it("should return metadata string with path, md5, and size", () => {
    const testFile = path.resolve("software/scripts/bash-keys.profile.bash");
    const content = fs.readFileSync(testFile, "utf8");
    const result = sourceMetadataHeader(testFile, content);

    expect(result).toMatch(/^# .+\|.+\|.+$/);
    expect(result).toContain(testFile);
    expect(result).toMatch(/[a-f0-9]{32}/); // md5 hash
    expect(result).toMatch(/\d+\.\d+ KB|\d+ B/); // file size
  });

  it("should return empty string for non-existent file", () => {
    const result = sourceMetadataHeader("/tmp/does-not-exist-12345.sh", "content");
    expect(result).toBe("");
  });
});
