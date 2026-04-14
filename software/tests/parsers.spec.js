import { describe, it, expect } from "vitest";
import { getIndexFunction } from "./setup.js";

const parseString = getIndexFunction("parseString");
const parseInteger = getIndexFunction("parseInteger");
const parseBoolean = getIndexFunction("parseBoolean");

// ---- tests ----

describe("parseString", () => {
  it("should return trimmed string", () => {
    expect(parseString("  hello  ")).toBe("hello");
  });

  it("should return empty string for null/undefined", () => {
    expect(parseString(null)).toBe("");
    expect(parseString(undefined)).toBe("");
  });

  it("should convert numbers to string", () => {
    expect(parseString("42")).toBe("42");
  });

  it("should return empty string for empty string", () => {
    expect(parseString("")).toBe("");
  });
});

describe("parseInteger", () => {
  it("should parse a numeric string", () => {
    expect(parseInteger("42")).toBe(42);
  });

  it("should return default when parsing fails", () => {
    expect(parseInteger("abc", 10)).toBe(10);
  });

  it("should return default for empty string", () => {
    expect(parseInteger("", 5)).toBe(5);
  });

  it("should clamp to min/max with 3 arguments", () => {
    expect(parseInteger("1", 5, 20)).toBe(5);
    expect(parseInteger("50", 5, 20)).toBe(20);
    expect(parseInteger("10", 5, 20)).toBe(10);
  });

  it("should use minValue as default when value is NaN with 3 args", () => {
    expect(parseInteger("abc", 5, 20)).toBe(5);
  });

  it("should handle negative numbers", () => {
    expect(parseInteger("-3", 0)).toBe(-3);
  });

  it("should parse leading numeric portion of mixed string", () => {
    expect(parseInteger("42abc", 0)).toBe(42);
  });
});

describe("parseBoolean", () => {
  it('should return true for "true"', () => {
    expect(parseBoolean("true")).toBe(true);
  });

  it('should return true for "TRUE" (case-insensitive)', () => {
    expect(parseBoolean("TRUE")).toBe(true);
  });

  it('should return true for "1"', () => {
    expect(parseBoolean("1")).toBe(true);
  });

  it('should return false for "false"', () => {
    expect(parseBoolean("false")).toBe(false);
  });

  it('should return false for "0"', () => {
    expect(parseBoolean("0")).toBe(false);
  });

  it("should return false for empty/null", () => {
    expect(parseBoolean("")).toBe(false);
    expect(parseBoolean(null)).toBe(false);
  });

  it("should return false for random strings", () => {
    expect(parseBoolean("yes")).toBe(false);
    expect(parseBoolean("no")).toBe(false);
  });
});
