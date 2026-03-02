import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const getRuntimeOption = getIndexFunction("getRuntimeOption");
const parseString = getIndexFunction("parseString");
const parseBoolean = getIndexFunction("parseBoolean");
const parseInteger = getIndexFunction("parseInteger");
const color = getIndexFunction("color");
const emitBash = getIndexFunction("emitBash");
const clone = getIndexFunction("clone");

// Constants
const REPO_PREFIX_URL = getIndexConstant("REPO_PREFIX_URL");
const TEMP_SCRIPT_PREFIX = getIndexConstant("TEMP_SCRIPT_PREFIX");
const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");
const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");
const LINE_BREAK_COUNT = getIndexConstant("LINE_BREAK_COUNT");
const LINE_BREAK_HASH = getIndexConstant("LINE_BREAK_HASH");
const LINE_BREAK_SLASH = getIndexConstant("LINE_BREAK_SLASH");
const LINE_BREAK_EQUAL = getIndexConstant("LINE_BREAK_EQUAL");
const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");
const IS_TEST_SCRIPT_MODE = getIndexConstant("IS_TEST_SCRIPT_MODE");
const fontFamily = getIndexConstant("fontFamily");
const fontSize = getIndexConstant("fontSize");
const tabSize = getIndexConstant("tabSize");
const EDITOR_CONFIGS = getIndexConstant("EDITOR_CONFIGS");
const LIMITED_SUPPORT_OSES = getIndexConstant("LIMITED_SUPPORT_OSES");

describe("getRuntimeOption", () => {
  it("should read from process.env", () => {
    const result = getRuntimeOption("REPO_BRANCH_NAME", parseString);
    expect(result).toBe("master");
  });

  it("should return parsed boolean from env", () => {
    const result = getRuntimeOption("IS_TEST_SCRIPT_MODE", parseBoolean);
    expect(result).toBe(true);
  });

  it("should return parsed integer from env", () => {
    const result = getRuntimeOption("LINE_BREAK_COUNT", parseInteger);
    expect(result).toBe(80);
  });

  it("should return empty string for missing env var with parseString", () => {
    const result = getRuntimeOption("NONEXISTENT_VAR", parseString);
    expect(result).toBe("");
  });

  it("should return false for missing env var with parseBoolean", () => {
    const result = getRuntimeOption("NONEXISTENT_VAR", parseBoolean);
    expect(result).toBe(false);
  });
});

describe("constants", () => {
  it("should have correct text block markers", () => {
    expect(TEXT_BLOCK_START_MARKER).toBe("BEGIN_CONTENT");
    expect(TEXT_BLOCK_END_MARKER).toBe("END_CONTENT");
  });

  it("should have LINE_BREAK_COUNT as a number", () => {
    expect(typeof LINE_BREAK_COUNT).toBe("number");
    expect(LINE_BREAK_COUNT).toBe(80);
  });

  it("should have LINE_BREAK_HASH as a string of # characters", () => {
    expect(LINE_BREAK_HASH).toMatch(/^#+$/);
    expect(LINE_BREAK_HASH.length).toBe(LINE_BREAK_COUNT);
  });

  it("should have LINE_BREAK_SLASH as a string of / characters", () => {
    expect(LINE_BREAK_SLASH).toMatch(/^\/+$/);
    expect(LINE_BREAK_SLASH.length).toBe(LINE_BREAK_COUNT);
  });

  it("should have LINE_BREAK_EQUAL as a string of = characters", () => {
    expect(LINE_BREAK_EQUAL).toMatch(/^=+$/);
    expect(LINE_BREAK_EQUAL.length).toBe(LINE_BREAK_COUNT);
  });

  it("should have REPO_PREFIX_URL containing github", () => {
    expect(REPO_PREFIX_URL).toContain("github");
    expect(REPO_PREFIX_URL).toContain("test/bashrc");
  });

  it("should have TEMP_SCRIPT_PREFIX starting with /tmp/", () => {
    expect(TEMP_SCRIPT_PREFIX).toContain("/tmp/");
  });

  it("should have BASH_SYLE_PATH", () => {
    expect(BASH_SYLE_PATH).toBe("/mock/home/.bash_syle");
  });

  it("should have IS_TEST_SCRIPT_MODE as true", () => {
    expect(IS_TEST_SCRIPT_MODE).toBe(true);
  });

  it("should have editor defaults", () => {
    expect(fontFamily).toBe("Fira Code");
    expect(fontSize).toBe(14);
    expect(tabSize).toBe(2);
  });

  it("should have EDITOR_CONFIGS with expected properties", () => {
    expect(EDITOR_CONFIGS).toBeDefined();
    expect(EDITOR_CONFIGS.fontFamily).toBe("Fira Code");
    expect(EDITOR_CONFIGS.fontSize).toBe(14);
    expect(EDITOR_CONFIGS.tabSize).toBe(2);
  });

  it("should have LIMITED_SUPPORT_OSES as an array", () => {
    expect(Array.isArray(LIMITED_SUPPORT_OSES)).toBe(true);
    expect(LIMITED_SUPPORT_OSES.length).toBeGreaterThan(0);
    expect(LIMITED_SUPPORT_OSES).toContain("is_os_android_termux");
  });
});

describe("color", () => {
  it("should wrap text with ANSI escape codes", () => {
    const result = color("hello", "32m");
    expect(result).toBe("\x1b[32mhello\x1b[0m");
  });

  it("should handle empty string", () => {
    const result = color("", "31m");
    expect(result).toBe("\x1b[31m\x1b[0m");
  });
});

describe("color helper via color()", () => {
  it("should produce valid ANSI green", () => {
    expect(color("ok", "32m")).toMatch(/^\x1b\[32mok\x1b\[0m$/);
  });

  it("should produce valid ANSI red", () => {
    expect(color("err", "31m")).toMatch(/^\x1b\[31merr\x1b\[0m$/);
  });

  it("should produce valid ANSI yellow", () => {
    expect(color("warn", "33m")).toMatch(/^\x1b\[33mwarn\x1b\[0m$/);
  });

  it("should produce valid ANSI dim", () => {
    expect(color("dim", "2m")).toMatch(/^\x1b\[2mdim\x1b\[0m$/);
  });

  it("should produce valid ANSI cyan", () => {
    expect(color("info", "36m")).toMatch(/^\x1b\[36minfo\x1b\[0m$/);
  });

  it("should produce valid ANSI background", () => {
    expect(color("bg", "41;97;1m")).toMatch(/^\x1b\[41;97;1mbg\x1b\[0m$/);
  });
});
