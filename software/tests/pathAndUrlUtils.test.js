import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const _looksLikePathOrUrl = getIndexFunction("_looksLikePathOrUrl");
const _getTempFilePath = getIndexFunction("_getTempFilePath");
const getFullUrl = getIndexFunction("getFullUrl");
const TEMP_SCRIPT_PREFIX = getIndexConstant("TEMP_SCRIPT_PREFIX");

describe("_looksLikePathOrUrl", () => {
  it("should match absolute Unix paths", () => {
    expect(_looksLikePathOrUrl("/usr/local/bin/node")).toBe(true);
    expect(_looksLikePathOrUrl("/etc/hosts")).toBe(true);
    expect(_looksLikePathOrUrl("/home/user/.bashrc")).toBe(true);
  });

  it("should match home-relative paths", () => {
    expect(_looksLikePathOrUrl("~/Documents/file.txt")).toBe(true);
    expect(_looksLikePathOrUrl("~/.config/settings")).toBe(true);
  });

  it("should match URLs", () => {
    expect(_looksLikePathOrUrl("https://example.com/path")).toBe(true);
    expect(_looksLikePathOrUrl("http://localhost:3000")).toBe(true);
  });

  it("should match Windows paths", () => {
    expect(_looksLikePathOrUrl("C:\\Users\\test\\file.txt")).toBe(true);
  });

  it("should not match plain words", () => {
    expect(_looksLikePathOrUrl("hello")).toBe(false);
    expect(_looksLikePathOrUrl("some text here")).toBe(false);
  });

  it("should not match empty string", () => {
    expect(_looksLikePathOrUrl("")).toBe(false);
  });

  it("should not match keywords", () => {
    expect(_looksLikePathOrUrl("error")).toBe(false);
    expect(_looksLikePathOrUrl("success")).toBe(false);
  });
});

describe("_getTempFilePath", () => {
  it("should start with TEMP_SCRIPT_PREFIX", () => {
    const result = _getTempFilePath("software/scripts/git.js");
    expect(result.startsWith(TEMP_SCRIPT_PREFIX)).toBe(true);
  });

  it("should contain sanitized file name", () => {
    const result = _getTempFilePath("software/scripts/git.js");
    expect(result).toContain("git.js");
  });

  it("should contain timestamp-like pattern", () => {
    const result = _getTempFilePath("test.js");
    // YYYY_MM_DD_HH_MM_SS
    expect(result).toMatch(/\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}/);
  });

  it("should sanitize special characters in filename", () => {
    const result = _getTempFilePath("weird (file) name.js");
    expect(result).not.toContain("(");
    expect(result).not.toContain(")");
    expect(result).not.toContain(" ");
  });
});

describe("getFullUrl", () => {
  it("should return absolute URLs unchanged", () => {
    expect(getFullUrl("https://example.com/file.js")).toBe("https://example.com/file.js");
    expect(getFullUrl("http://localhost/test")).toBe("http://localhost/test");
  });

  it("should prepend REPO_PREFIX_URL for relative paths", () => {
    const result = getFullUrl("software/scripts/git.js");
    expect(result).toContain("https://");
    expect(result).toContain("software/scripts/git.js");
  });
});
