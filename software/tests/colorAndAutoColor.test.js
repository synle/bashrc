import { describe, it, expect } from "vitest";
import { getIndexFunction } from "./setup.js";

const color = getIndexFunction("color");
const _getAutoColor = getIndexFunction("_getAutoColor");
const _applyAutoColor = getIndexFunction("_applyAutoColor");

// Helper: call the returned color function to check its ANSI code
function getColorCode(text) {
  const fn = _getAutoColor(text);
  if (!fn) return null;
  // Apply the function to a probe string and extract the ANSI code
  const result = fn("X");
  const match = result.match(/\x1b\[([0-9;]+m)/);
  return match ? match[1] : null;
}

// Known ANSI codes from index.js color helpers
const CODES = {
  bgRed: "41;97;1m",
  green: "32m",
  yellow: "33m",
  cyan: "36m",
  magenta: "35m",
  orange: "38;5;208m",
  blue: "34m",
  dim: "2m",
};

// ---- tests ----

describe("color", () => {
  it("should wrap string with ANSI escape codes", () => {
    const result = color("hello", "32m");
    expect(result).toBe("\x1b[32mhello\x1b[0m");
  });

  it("should handle empty string", () => {
    const result = color("", "31m");
    expect(result).toBe("\x1b[31m\x1b[0m");
  });
});

describe("_getAutoColor", () => {
  // ---- error keywords ----
  it("should return colorBgRed for 'error'", () => {
    expect(getColorCode("something error happened")).toBe(CODES.bgRed);
  });

  it("should return colorBgRed for 'fail'", () => {
    expect(getColorCode("build fail")).toBe(CODES.bgRed);
  });

  it("should return colorBgRed for 'failed'", () => {
    expect(getColorCode("task failed")).toBe(CODES.bgRed);
  });

  it("should return colorBgRed for 'err'", () => {
    expect(getColorCode("err something broke")).toBe(CODES.bgRed);
  });

  it("should return colorBgRed for 'failure'", () => {
    expect(getColorCode("build failure")).toBe(CODES.bgRed);
  });

  it("should return colorBgRed for 'failing'", () => {
    expect(getColorCode("test failing")).toBe(CODES.bgRed);
  });

  it("should return colorBgRed for 'errors'", () => {
    expect(getColorCode("found errors")).toBe(CODES.bgRed);
  });

  it("should return colorBgRed for 'failures'", () => {
    expect(getColorCode("3 failures")).toBe(CODES.bgRed);
  });

  it("should match error keyword at start of string", () => {
    expect(getColorCode("error at line 5")).toBe(CODES.bgRed);
  });

  it("should match error keyword at end of string", () => {
    expect(getColorCode("something error")).toBe(CODES.bgRed);
  });

  it("should be case-insensitive for error keywords", () => {
    expect(getColorCode("ERROR happened")).toBe(CODES.bgRed);
    expect(getColorCode("Failed build")).toBe(CODES.bgRed);
  });

  // ---- success keywords ----
  it("should return colorGreen for 'done'", () => {
    expect(getColorCode("task done")).toBe(CODES.green);
  });

  it("should return colorGreen for 'success'", () => {
    expect(getColorCode("build success")).toBe(CODES.green);
  });

  it("should return colorGreen for 'finished'", () => {
    expect(getColorCode("job finished")).toBe(CODES.green);
  });

  it("should return colorGreen for 'complete'", () => {
    expect(getColorCode("download complete")).toBe(CODES.green);
  });

  it("should return colorGreen for 'completed'", () => {
    expect(getColorCode("task completed")).toBe(CODES.green);
  });

  it("should return colorGreen for 'accept'", () => {
    expect(getColorCode("accept changes")).toBe(CODES.green);
  });

  it("should return colorGreen for 'accepted'", () => {
    expect(getColorCode("changes accepted")).toBe(CODES.green);
  });

  it("should return colorGreen for 'succeed'", () => {
    expect(getColorCode("tests succeed")).toBe(CODES.green);
  });

  it("should return colorGreen for 'succeeded'", () => {
    expect(getColorCode("build succeeded")).toBe(CODES.green);
  });

  it("should return colorGreen for 'succeeds'", () => {
    expect(getColorCode("test succeeds")).toBe(CODES.green);
  });

  it("should NOT match 'autocomplete' as success", () => {
    expect(getColorCode("setup autocomplete")).not.toBe(CODES.green);
  });

  it("should NOT match 'autocompleted' as success", () => {
    expect(getColorCode("autocompleted task")).not.toBe(CODES.green);
  });

  it("should match 'complete' at start of line", () => {
    expect(getColorCode("complete")).toBe(CODES.green);
  });

  it("should match 'done' at start of line", () => {
    expect(getColorCode("done building")).toBe(CODES.green);
  });

  it("should be case-insensitive for success keywords", () => {
    expect(getColorCode("DONE")).toBe(CODES.green);
    expect(getColorCode("Success")).toBe(CODES.green);
  });

  // ---- >> marker direction ----
  it("should return colorYellow for >> with 0 spaces", () => {
    expect(getColorCode(">> hello")).toBe(CODES.yellow);
  });

  it("should return colorYellow for >> with 2 spaces", () => {
    expect(getColorCode("  >> hello")).toBe(CODES.yellow);
  });

  it("should return colorCyan for >> with 4 spaces", () => {
    expect(getColorCode("    >> hello")).toBe(CODES.cyan);
  });

  it("should return colorCyan for >> with 6 spaces", () => {
    expect(getColorCode("      >> hello")).toBe(CODES.cyan);
  });

  it("should return colorMagenta for >> with 8+ spaces", () => {
    expect(getColorCode("        >> hello")).toBe(CODES.magenta);
  });

  // ---- << marker direction ----
  it("should return colorOrange for << with 0 spaces", () => {
    expect(getColorCode("<< hello")).toBe(CODES.orange);
  });

  it("should return colorOrange for << with 2 spaces", () => {
    expect(getColorCode("  << hello")).toBe(CODES.orange);
  });

  it("should return colorBlue for << with 4 spaces", () => {
    expect(getColorCode("    << hello")).toBe(CODES.blue);
  });

  it("should return colorBlue for << with 6 spaces", () => {
    expect(getColorCode("      << hello")).toBe(CODES.blue);
  });

  it("should return colorMagenta for << with 8+ spaces", () => {
    expect(getColorCode("        << hello")).toBe(CODES.magenta);
  });

  // ---- odd-space indent bucketing ----
  it("should bucket 1 space same as 2 spaces for >>", () => {
    expect(getColorCode(" >> hello")).toBe(CODES.yellow);
  });

  it("should bucket 3 spaces same as 4 spaces for >>", () => {
    expect(getColorCode("   >> hello")).toBe(CODES.cyan);
  });

  it("should bucket 5 spaces same as 6 spaces for >>", () => {
    expect(getColorCode("     >> hello")).toBe(CODES.cyan);
  });

  it("should bucket 7 spaces same as 8 spaces for >>", () => {
    expect(getColorCode("       >> hello")).toBe(CODES.magenta);
  });

  // ---- path/URL detection ----
  it("should return colorDim for absolute unix path", () => {
    expect(getColorCode("/usr/local/bin/node")).toBe(CODES.dim);
  });

  it("should return colorDim for home-relative path", () => {
    expect(getColorCode("~/.bash_syle")).toBe(CODES.dim);
  });

  it("should return colorDim for https URL", () => {
    expect(getColorCode("https://example.com/file.txt")).toBe(CODES.dim);
  });

  it("should return colorDim for http URL", () => {
    expect(getColorCode("http://example.com/api")).toBe(CODES.dim);
  });

  it("should return colorDim for Windows-style path", () => {
    expect(getColorCode("C:\\Users\\me\\file.txt")).toBe(CODES.dim);
  });

  it("should NOT return colorDim for mixed text with a path", () => {
    expect(getColorCode("installing to /usr/local/bin")).not.toBe(CODES.dim);
  });

  it("should NOT return colorDim for plain text", () => {
    expect(getColorCode("just some text")).toBeNull();
  });

  // ---- no match ----
  it("should return null for plain text", () => {
    expect(_getAutoColor("just some text")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(_getAutoColor("")).toBeNull();
  });
});

describe("_applyAutoColor", () => {
  it("should colorize elements when keyword matches", () => {
    const result = _applyAutoColor(["task", "done"]);
    expect(result.every((s) => String(s).includes("\x1b["))).toBe(true);
  });

  it("should return data unchanged when no match", () => {
    const data = ["just", "some", "text"];
    const result = _applyAutoColor(data);
    expect(result).toEqual(data);
  });

  it("should preserve dim-colored elements", () => {
    const dimStr = "\x1b[2mdim text\x1b[0m";
    const result = _applyAutoColor([">> hello", dimStr]);
    expect(result[1]).toBe(dimStr);
  });

  it("should strip existing ANSI codes before re-coloring", () => {
    const colored = "\x1b[31mred text\x1b[0m";
    const result = _applyAutoColor([">> hello", colored]);
    const str = String(result[1]);
    // should not contain the original red code
    expect(str).not.toContain("\x1b[31m");
    expect(str).toContain("red text");
  });

  it("should normalize odd leading spaces before markers", () => {
    const result = _applyAutoColor(["   >> hello"]);
    const str = String(result[0]);
    // 3 spaces → ceil(3/2)*2 = 4 spaces
    expect(str).toContain("    >> hello");
  });
});
