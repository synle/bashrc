import { describe, it, expect } from "vitest";

import { getIndexFunction, getIndexConstant } from "./setup.js";

const _parseDesktopEntry = getIndexFunction("_parseDesktopEntry");

const _resolvePresetName = getIndexFunction("_resolvePresetName");

const getGitHubReleaseApiUrl = getIndexFunction("getGitHubReleaseApiUrl");

const getRepoNameFromId = getIndexFunction("getRepoNameFromId");

const stripVersionFromFilename = getIndexFunction("stripVersionFromFilename");

const getBinaryCacheUrl = getIndexFunction("getBinaryCacheUrl");

const calculatePercentage = getIndexFunction("calculatePercentage");

const getRootDomainFrom = getIndexFunction("getRootDomainFrom");

const trimSpacesOnBothEnd = getIndexFunction("trimSpacesOnBothEnd");

const _stripTextBlock = getIndexFunction("_stripTextBlock");

const moveTextBlockToEnd = getIndexFunction("moveTextBlockToEnd");

const moveTextBlockToStart = getIndexFunction("moveTextBlockToStart");

const _replaceSourceBlocks = getIndexFunction("_replaceSourceBlocks");

const _looksLikePathOrUrl = getIndexFunction("_looksLikePathOrUrl");

const _getAutoColor = getIndexFunction("_getAutoColor");

const _applyAutoColor = getIndexFunction("_applyAutoColor");

const _isDangerousPath = getIndexFunction("_isDangerousPath");

const getFullUrl = getIndexFunction("getFullUrl");

const _getBundleRunnerType = getIndexFunction("_getBundleRunnerType");

const _resolveScriptFile = getIndexFunction("_resolveScriptFile");

const clone = getIndexFunction("clone");

const parseJsonWithComments = getIndexFunction("parseJsonWithComments");

const cleanupExtraWhitespaces = getIndexFunction("cleanupExtraWhitespaces");

describe("_resolveScriptFile", () => {
  const repoFiles = [
    "software/scripts/git.js",
    "software/scripts/vim-config.js",
    "software/scripts/fzf.js",
    "software/scripts/advanced/llm-common.js",
    "software/scripts/linux/_full-setup.sh",
    "software/scripts/mac/_full-setup.sh",
  ];

  it("should match exact path", () => {
    const result = _resolveScriptFile("software/scripts/git.js", "git.js", [...repoFiles]);
    expect(result.resolvedFile).toBe("software/scripts/git.js");
    expect(result.fileExists).toBe(true);
    expect(result.fileMatchState).toBeUndefined();
  });

  it("should match by basename without extension", () => {
    const result = _resolveScriptFile("software/scripts/git", "git", [...repoFiles]);
    expect(result.resolvedFile).toBe("software/scripts/git.js");
    expect(result.fileExists).toBe(true);
    expect(result.fileMatchState).toBe("expanded_match");
  });

  it("should match by partial regex on basename", () => {
    const result = _resolveScriptFile("software/scripts/vim", "vim", [...repoFiles]);
    expect(result.resolvedFile).toBe("software/scripts/vim-config.js");
    expect(result.fileExists).toBe(true);
    expect(result.fileMatchState).toBe("expanded_match");
  });

  it("should return ambiguous for multiple partial matches", () => {
    const files = ["software/scripts/setup_a.js", "software/scripts/setup_b.js", "software/scripts/git.js"];
    const result = _resolveScriptFile("software/scripts/setup", "setup", files);
    expect(result.fileExists).toBe(false);
    expect(result.fileMatchState).toBe("ambiguous");
    expect(result.description).toContain("Ambiguous");
  });

  it("should return not_found for nonexistent file", () => {
    const result = _resolveScriptFile("software/scripts/nonexistent", "nonexistent", [...repoFiles]);
    expect(result.fileExists).toBe(false);
    expect(result.fileMatchState).toBe("not_found");
  });

  it("should purge matched file to prevent duplicates", () => {
    const files = [...repoFiles];
    _resolveScriptFile("software/scripts/git.js", "git.js", files);
    expect(files).not.toContain("software/scripts/git.js");
  });
});

describe("clone", () => {
  it("should deep clone an object", () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = clone(original);
    expect(cloned).toEqual(original);
    cloned.b.c = 99;
    expect(original.b.c).toBe(2);
  });

  it("should clone arrays", () => {
    const original = [1, [2, 3]];
    const cloned = clone(original);
    expect(cloned).toEqual(original);
    cloned[1][0] = 99;
    expect(original[1][0]).toBe(2);
  });
});

describe("parseJsonWithComments", () => {
  it("should parse valid JSON", () => {
    expect(parseJsonWithComments('{"a": 1}')).toEqual({ a: 1 });
  });

  it("should strip single-line comments", () => {
    expect(parseJsonWithComments('{\n// comment\n"a": 1\n}')).toEqual({ a: 1 });
  });

  it("should strip block comments", () => {
    expect(parseJsonWithComments('{"a": /* comment */ 1}')).toEqual({ a: 1 });
  });

  it("should strip trailing commas", () => {
    expect(parseJsonWithComments('{"a": 1,\n}')).toEqual({ a: 1 });
  });

  it("should handle empty input by throwing", () => {
    expect(() => parseJsonWithComments("")).toThrow("empty input");
  });

  it("should handle null input by throwing", () => {
    expect(() => parseJsonWithComments(null)).toThrow("empty input");
  });

  it("should fall back to Function constructor for unquoted keys", () => {
    expect(parseJsonWithComments("{a: 1}")).toEqual({ a: 1 });
  });

  it("should throw on completely invalid input", () => {
    expect(() => parseJsonWithComments("not json at all !@#$%")).toThrow("failed to parse");
  });
});

describe("cleanupExtraWhitespaces", () => {
  it("should collapse multiple blank lines to single", () => {
    const input = "line1\n\n\n\nline2";
    const result = cleanupExtraWhitespaces(input);
    expect(result).not.toContain("\n\n\n");
  });

  it("should trim leading and trailing whitespace", () => {
    const result = cleanupExtraWhitespaces("\n\nline1\nline2\n\n");
    expect(result.startsWith("line")).toBe(true);
    expect(result.endsWith("line2")).toBe(true);
  });

  it("should handle empty string", () => {
    expect(cleanupExtraWhitespaces("")).toBe("");
  });
});
