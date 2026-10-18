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
