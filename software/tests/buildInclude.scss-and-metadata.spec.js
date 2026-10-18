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

describe("sourceMetadataHeader", () => {
  const { sourceMetadataHeader } = buildIncludeModule;
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
