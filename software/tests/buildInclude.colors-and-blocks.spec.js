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

const FILL_KEYS = [
  "background",
  "surface",
  "activeLine",
  "gray",
  "pressed",
  "selection",
  "matchHighlight",
  "selectionSyntax",
  "matchHighlightSyntax",
  "activeMatchSyntax",
  "diffAddedBackground",
  "diffRemovedBackground",
  "diffAddedWordBackground",
  "diffRemovedWordBackground",
  "diffAddedMutedBackground",
  "diffRemovedMutedBackground",
  "warningBackground",
];

const FILL_LADDER = ["surface", "gray", "pressed"];

const STROKE_KEYS = ["brightGray", "guide"];

const FAINT_STROKE_BAND = { key: "guide", min: 1.7, max: 3 };

const CONTRAST_EXEMPT_KEYS = new Set([
  ...FILL_KEYS,
  ...STROKE_KEYS,
  "black",
  "terminalBlack", // ANSI anchor, tested separately against terminal surfaces rather than as a syntax foreground.
  "white",
  "brightWhite",
  "cursorColor",
  "textDisabled",
  "themeName",
]);

const WARM_HUE_KEYS = new Set(["yellow", "brightYellow"]);

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

describe("COLOR_MAP contrast", () => {
  for (const themeName of ["dark", "light"]) {
    const theme = COLOR_MAP[themeName];

    it(`should keep ${themeName} foreground legible on every fill key`, () => {
      for (const fillKey of FILL_KEYS) {
        expect(theme, `${themeName}.${fillKey} is missing`).toHaveProperty(fillKey);
        const ratio = contrastRatio(theme.foreground, theme[fillKey]);
        expect(
          ratio,
          `${themeName}.foreground on ${themeName}.${fillKey} (${theme[fillKey]}) is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(7);
      }
    });

    it(`should keep each ${themeName} interactive fill separated from the one below it`, () => {
      for (let i = 1; i < FILL_LADDER.length; i++) {
        const [below, above] = [FILL_LADDER[i - 1], FILL_LADDER[i]];
        const ratio = contrastRatio(theme[above], theme[below]);
        expect(
          ratio,
          `${themeName}.${above} (${theme[above]}) vs ${themeName}.${below} (${theme[below]}) is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(1.25);
      }
      // `activeLine` is tuned against the editor background, so it lands on `surface` almost
      // invisibly — it must never be borrowed for a chrome state.
      expect(contrastRatio(theme.activeLine, theme.background)).toBeGreaterThanOrEqual(1.25);
    });

    it(`should keep ${themeName} stroke keys above the 3:1 non-text floor`, () => {
      const ratio = contrastRatio(theme.brightGray, theme.background);
      expect(ratio, `${themeName}.brightGray (${theme.brightGray}) vs background is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });

    it(`should keep the ${themeName} faint stroke visible but below the text weight`, () => {
      const { key, min, max } = FAINT_STROKE_BAND;
      const ratio = contrastRatio(theme[key], theme.background);
      expect(ratio, `${themeName}.${key} (${theme[key]}) vs background is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      expect(ratio, `${themeName}.${key} (${theme[key]}) vs background is ${ratio.toFixed(2)}:1`).toBeLessThan(max);
    });

    it(`should keep ${themeName} textDisabled dimmer than muted text but still readable`, () => {
      const disabled = contrastRatio(theme.textDisabled, theme.background);
      const muted = contrastRatio(theme.brightBlack, theme.background);
      expect(disabled, `${themeName}.textDisabled (${theme.textDisabled}) is ${disabled.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      expect(disabled, `${themeName}.textDisabled must read dimmer than ${themeName}.brightBlack`).toBeLessThan(muted);
    });

    it(`should keep every ${themeName} foreground color readable on the background`, () => {
      for (const [key, value] of Object.entries(theme)) {
        if (key.includes("_") || CONTRAST_EXEMPT_KEYS.has(key) || typeof value !== "string" || !value.startsWith("#")) continue;
        const floor = themeName === "light" && WARM_HUE_KEYS.has(key) ? 5.5 : 7;
        const ratio = contrastRatio(value, theme.background);
        expect(ratio, `${themeName}.${key} (${value}) vs background is ${ratio.toFixed(2)}:1, needs ${floor}:1`).toBeGreaterThanOrEqual(
          floor,
        );
      }
    });
  }
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
