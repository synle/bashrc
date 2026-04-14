import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const _looksLikePathOrUrl = getIndexFunction("_looksLikePathOrUrl");
const getFullUrl = getIndexFunction("getFullUrl");

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
