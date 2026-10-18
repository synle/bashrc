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
