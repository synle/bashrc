import { describe, it, expect } from "vitest";

const {
  getCommentStyle,
  stripShebang,
  isFilePath,
  autoTransform,
  findMarkers,
  cleanBlock,
  replaceBlock,
  toJsonLiteral,
  processInlineMarkers,
  cleanInlineMarkers,
  COLOR_MAP,
  COMMENT_STYLES,
  DEFAULT_COMMENT_STYLE,
} = require("../build-include.cjs");

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
    expect(result).toBe("```bash\necho hi\necho bye\n```");
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

  it("should have all color values in uppercase 6-char hex format", () => {
    for (const theme of [COLOR_MAP.dark, COLOR_MAP.light]) {
      for (const [key, value] of Object.entries(theme)) {
        if (typeof value === "string" && value.startsWith("#")) {
          expect(value).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
  });
});
