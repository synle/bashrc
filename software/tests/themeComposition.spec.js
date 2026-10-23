/** Screens actual dimming stacks; native antialiasing and Display P3 still require visual verification. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import ts from "typescript";
import { fileSystem, getIndexFunction, loadScriptHelpers } from "./setup.js";

/** Parses native JSONC input; malformed sources fail before any pair is measured. */
function read(file) {
  const parsed = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, "utf8"));
  if (parsed.error) throw new Error(`Invalid JSONC: ${file}`);
  return parsed.config;
}
/** Decodes an sRGB channel for independent linear-light screening. */
function linear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
/** Encodes a linear-light channel back into sRGB. */
function encoded(value) {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}
/** Returns normalized RGB channels from a native six/eight-digit color. */
function rgb(color) {
  return [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
}
/** Composes normalized RGB in the named space without intermediate byte rounding. */
function over(foreground, background, opacity, space = "srgb") {
  return foreground.map((value, index) =>
    space === "linear"
      ? encoded(linear(value) * opacity + linear(background[index]) * (1 - opacity))
      : value * opacity + background[index] * (1 - opacity),
  );
}
/** Returns WCAG contrast for composed RGB; this is a screen, not a native-rendering certification. */
function contrast(a, b) {
  const luminance = (color) => color.map(linear).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
/** Reads a scalar from the emitted Ghostty config rather than a duplicated settings fixture. */
function setting(config, key) {
  const match = config.match(new RegExp(`^${key} = (.+)$`, "m"));
  if (!match) throw new Error(`Missing Ghostty setting: ${key}`);
  return match[1];
}

beforeAll(() => loadScriptHelpers("software/scripts/advanced/ghostty.js"));
beforeEach(() => {
  fileSystem["software/scripts/advanced/ghostty-keys.common.jsonc"] = fs.readFileSync(
    "software/scripts/advanced/ghostty-keys.common.jsonc",
    "utf8",
  );
});

// Black and white bound every opaque desktop backdrop channel; gray exercises an interior value.
describe.each(["dark", "light"])("%s composed readability", (mode) => {
  it.each(["srgb", "linear"])("keeps active/inactive Ghostty text readable with %s composition", async (space) => {
    const config = await getIndexFunction("_buildConfigContent")(true, { is_prebuilt_config: true });
    const theme = read(`theme/sy/ghostty_${mode}.jsonc`);
    const opacity = Number(setting(config, "background-opacity"));
    const splitOpacity = Number(setting(config, "unfocused-split-opacity"));
    const fill = rgb(setting(config, "unfocused-split-fill"));
    const weak = ["#000000", "#808080", "#ffffff"].flatMap((desktop) => {
      const background = over(rgb(theme.background), rgb(desktop), opacity, space);
      const inactive = over(fill, background, 1 - splitOpacity, space);
      return [theme.foreground, ...theme.palette].flatMap((color, index) => {
        // ANSI black/white are documented ramp anchors; black retains the existing 3:1 floor.
        if (index === 8 || index === 16) return [];
        const floor = index === 1 ? 3 : 4.5;
        return [
          { desktop, color, state: "active", ratio: contrast(rgb(color), background), floor },
          { desktop, color, state: "inactive", ratio: contrast(over(fill, rgb(color), 1 - splitOpacity, space), inactive), floor },
        ].filter((pair) => pair.ratio < pair.floor);
      });
    });
    expect(weak).toEqual([]);
  });

  it("keeps selected text and the block cursor readable after background/cursor opacity", async () => {
    const config = await getIndexFunction("_buildConfigContent")(false, { is_prebuilt_config: true });
    const theme = read(`theme/sy/ghostty_${mode}.jsonc`);
    const opacity = Number(setting(config, "background-opacity"));
    const cellOpacity = setting(config, "background-opacity-cells") === "true" ? opacity : 1;
    const cursorOpacity = Number(setting(config, "cursor-opacity"));
    const splitOpacity = Number(setting(config, "unfocused-split-opacity"));
    const fill = rgb(setting(config, "unfocused-split-fill"));
    const weak = ["#000000", "#ffffff"].flatMap((desktop) => {
      const background = over(rgb(theme.background), rgb(desktop), opacity);
      const selection = over(rgb(theme["selection-background"]), rgb(desktop), cellOpacity);
      const cursor = over(rgb(theme["cursor-color"]), background, cursorOpacity);
      return [
        { state: "selection", foreground: rgb(theme["selection-foreground"]), background: selection },
        { state: "cursor", foreground: rgb(theme["cursor-text"]), background: cursor },
      ]
        .flatMap((pair) => [
          { state: pair.state, ratio: contrast(pair.foreground, pair.background) },
          {
            state: `inactive ${pair.state}`,
            ratio: contrast(over(fill, pair.foreground, 1 - splitOpacity), over(fill, pair.background, 1 - splitOpacity)),
          },
        ])
        .filter((pair) => pair.ratio < 4.5);
    });
    expect(weak).toEqual([]);
  });

  it("keeps unnecessary Zed code readable over editor, active-line, search and selection fills", () => {
    const style = read(`theme/sy/zed_${mode}.jsonc`).themes[0].style;
    const fade = read("software/scripts/advanced/zed-config.jsonc").unnecessary_code_fade;
    const fills = [
      style["editor.background"],
      style["editor.active_line.background"],
      style["search.match_background"],
      style["search.active_match_background"],
      style.players[0].selection,
    ];
    const weak = fills.flatMap((color) => {
      const background = over(rgb(color), rgb(style["editor.background"]), color.length === 9 ? parseInt(color.slice(7), 16) / 255 : 1);
      return Object.entries(style.syntax)
        .filter(([, entry]) => entry.color)
        .map(([token, entry]) => ({
          token,
          color,
          ratio: contrast(over(rgb(entry.color), background, 1 - fade), background),
        }))
        .filter((pair) => pair.ratio < 4.5);
    });
    expect(weak).toEqual([]);
  });
});
