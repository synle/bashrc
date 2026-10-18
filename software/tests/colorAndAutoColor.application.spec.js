import { describe, it, expect } from "vitest";

import { getIndexFunction } from "./setup.js";

const color = getIndexFunction("color");

const _getAutoColor = getIndexFunction("_getAutoColor");

const _applyAutoColor = getIndexFunction("_applyAutoColor");

function getColorCode(text) {
  const fn = _getAutoColor(text);
  if (!fn) return null;
  // Apply the function to a probe string and extract the ANSI code
  const result = fn("X");
  const match = result.match(/\x1b\[([0-9;]+m)/);
  return match ? match[1] : null;
}

const CODES = {
  bgRed: "1;38;2;255;255;255;48;2;165;0;0m",
  bgYellow: "43;30m",
  bgOrange: "48;5;208;30m",
  bgCyan: "46;30m",
  bgMagenta: "45;97;1m",
  green: "32m",
  yellow: "33m",
  cyan: "36m",
  red: "1;31m",
  magenta: "35m",
  orange: "38;5;208m",
  blue: "34m",
  dim: "2m",
  boldYellow: "1;33m",
  boldCyan: "1;36m",
  boldMagenta: "1;35m",
};

describe("_applyAutoColor", () => {
  it("should colorize element that matches a keyword", () => {
    const result = _applyAutoColor(["done"]);
    expect(String(result[0])).toContain("\x1b[");
  });

  it("should leave non-matching elements unchanged", () => {
    const result = _applyAutoColor(["task"]);
    expect(result[0]).toBe("task");
  });

  it("should return data unchanged when no match", () => {
    const data = ["just", "some", "text"];
    const result = _applyAutoColor(data);
    expect(result).toEqual(data);
  });

  it("should preserve dim-colored elements", () => {
    const dimStr = "\x1b[2mdim text\x1b[0m";
    const result = _applyAutoColor([dimStr]);
    expect(result[0]).toBe(dimStr);
  });

  it("should dim path-like elements", () => {
    const result = _applyAutoColor([">> Register ProfileBlock", "/Users/syle/.bash_syle"]);
    const pathStr = String(result[1]);
    expect(pathStr).toContain("\x1b[2m");
    expect(pathStr).toContain("/Users/syle/.bash_syle");
  });

  it("should dim URL-like elements", () => {
    const result = _applyAutoColor([">> Fetching", "https://example.com/file.txt"]);
    const urlStr = String(result[1]);
    expect(urlStr).toContain("\x1b[2m");
    expect(urlStr).toContain("https://example.com/file.txt");
  });

  it("should not dim non-path elements", () => {
    const result = _applyAutoColor([">> Register ProfileBlock", "Editor Config"]);
    const textStr = String(result[1]);
    expect(textStr).not.toContain("\x1b[2m");
  });

  it("should color each element independently", () => {
    const result = _applyAutoColor(["> Installing", "done", "/usr/local/bin"]);
    // > marker → colored
    expect(String(result[0])).toContain("\x1b[");
    // "done" → green
    expect(String(result[1])).toContain("\x1b[32m");
    // path → dim
    expect(String(result[2])).toContain("\x1b[2m");
  });
});
