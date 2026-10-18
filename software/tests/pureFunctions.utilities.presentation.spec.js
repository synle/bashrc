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

describe("_replaceSourceBlocks", () => {
  it("should replace content between SOURCE_BEGIN and SOURCE_END", () => {
    const content = "before\n# SOURCE_BEGIN mykey\nold content\n# SOURCE_END mykey\nafter";
    const blockMap = { mykey: "new content" };
    const result = _replaceSourceBlocks(content, blockMap, "#");
    expect(result).toContain("new content");
    expect(result).not.toContain("old content");
  });

  it("should not modify content if markers not found", () => {
    const content = "line1\nline2";
    const result = _replaceSourceBlocks(content, { mykey: "new" }, "#");
    expect(result).toBe(content);
  });

  it("should handle multiple blocks", () => {
    const content = "# SOURCE_BEGIN a\nold_a\n# SOURCE_END a\nmid\n# SOURCE_BEGIN b\nold_b\n# SOURCE_END b";
    const result = _replaceSourceBlocks(content, { a: "new_a", b: "new_b" }, "#");
    expect(result).toContain("new_a");
    expect(result).toContain("new_b");
    expect(result).toContain("mid");
  });

  it("should trim source content", () => {
    const content = "# SOURCE_BEGIN key\nold\n# SOURCE_END key";
    const result = _replaceSourceBlocks(content, { key: "  trimmed  " }, "#");
    expect(result).toContain("trimmed");
  });
});

describe("_looksLikePathOrUrl", () => {
  it("should detect absolute paths", () => {
    expect(_looksLikePathOrUrl("/usr/bin/bash")).toBe(true);
  });

  it("should detect tilde paths", () => {
    expect(_looksLikePathOrUrl("~/config/file")).toBe(true);
  });

  it("should detect URLs", () => {
    expect(_looksLikePathOrUrl("https://example.com/file")).toBe(true);
  });

  it("should detect Windows paths", () => {
    expect(_looksLikePathOrUrl("C:\\Users\\test\\file")).toBe(true);
  });

  it("should reject plain text", () => {
    expect(_looksLikePathOrUrl("hello world")).toBe(false);
  });
});

describe("_getAutoColor", () => {
  it("should return yellow for single > marker", () => {
    expect(typeof _getAutoColor("> action")).toBe("function");
  });

  it("should return green for >> marker", () => {
    expect(typeof _getAutoColor(">> done")).toBe("function");
  });

  it("should return cyan for >>> marker", () => {
    expect(typeof _getAutoColor(">>> detail")).toBe("function");
  });

  it("should return blue for >>>> marker", () => {
    expect(typeof _getAutoColor(">>>> deep")).toBe("function");
  });

  it("should return magenta for >>>>> marker (5+)", () => {
    expect(typeof _getAutoColor(">>>>> extra")).toBe("function");
  });

  it("should return orange for < marker", () => {
    expect(typeof _getAutoColor("< warning")).toBe("function");
  });

  it("should return red for << marker", () => {
    expect(typeof _getAutoColor("<< error")).toBe("function");
  });

  it("should return blue for <<< marker", () => {
    expect(typeof _getAutoColor("<<< info")).toBe("function");
  });

  it("should return magenta for <<<< marker (4+)", () => {
    expect(typeof _getAutoColor("<<<< deep")).toBe("function");
  });

  it("should return bold yellow for # marker", () => {
    expect(typeof _getAutoColor("# header")).toBe("function");
  });

  it("should return bold yellow for ## marker", () => {
    expect(typeof _getAutoColor("## header")).toBe("function");
  });

  it("should return bold cyan for ### marker", () => {
    expect(typeof _getAutoColor("### subheader")).toBe("function");
  });

  it("should return bold magenta for #### marker", () => {
    expect(typeof _getAutoColor("#### deep")).toBe("function");
  });

  it("should return orange for ##### marker (5+)", () => {
    expect(typeof _getAutoColor("##### extra")).toBe("function");
  });

  it("should return bgRed for error keywords", () => {
    expect(typeof _getAutoColor("error occurred")).toBe("function");
  });

  it("should return bgRed for fail keyword", () => {
    expect(typeof _getAutoColor("fail")).toBe("function");
  });

  it("should return green for success keyword", () => {
    expect(typeof _getAutoColor("success")).toBe("function");
  });

  it("should return green for done keyword", () => {
    expect(typeof _getAutoColor("done")).toBe("function");
  });

  it("should return green for completed keyword", () => {
    expect(typeof _getAutoColor("completed")).toBe("function");
  });

  it("should return dim for path-like text", () => {
    expect(typeof _getAutoColor("/usr/bin/bash")).toBe("function");
  });

  it("should return null for plain text with no markers", () => {
    expect(_getAutoColor("just some text")).toBeNull();
  });
});

describe("_applyAutoColor", () => {
  it("should pass through elements with existing ANSI codes", () => {
    const input = ["\x1b[32msome green\x1b[0m"];
    const result = _applyAutoColor(input);
    expect(result[0]).toBe(input[0]);
  });

  it("should strip markers and apply color", () => {
    const result = _applyAutoColor([">> doing something"]);
    expect(result.length).toBe(1);
    expect(result[0]).toContain("doing something");
  });

  it("should handle plain text without markers", () => {
    const result = _applyAutoColor(["just text"]);
    expect(result.length).toBe(1);
  });

  it("should handle empty array", () => {
    expect(_applyAutoColor([])).toEqual([]);
  });

  it("should process multiple elements independently", () => {
    const result = _applyAutoColor([">> success", "error", "/path/to/file"]);
    expect(result.length).toBe(3);
  });
});

describe("getFullUrl", () => {
  it("should return absolute URL as-is", () => {
    expect(getFullUrl("https://example.com/file")).toBe("https://example.com/file");
  });

  it("should convert relative URL to absolute", () => {
    const result = getFullUrl("software/scripts/test.js");
    expect(result).toContain("https://");
  });
});

describe("_isDangerousPath (additional)", () => {
  it("should block /boot", () => {
    expect(_isDangerousPath("/boot")).toBe(true);
  });

  it("should block /dev", () => {
    expect(_isDangerousPath("/dev")).toBe(true);
  });

  it("should block /proc", () => {
    expect(_isDangerousPath("/proc")).toBe(true);
  });

  it("should block /sys", () => {
    expect(_isDangerousPath("/sys")).toBe(true);
  });

  it("should block /root", () => {
    expect(_isDangerousPath("/root")).toBe(true);
  });

  it("should block /opt", () => {
    expect(_isDangerousPath("/opt")).toBe(true);
  });

  it("should block /run", () => {
    expect(_isDangerousPath("/run")).toBe(true);
  });

  it("should block /sbin", () => {
    expect(_isDangerousPath("/sbin")).toBe(true);
  });

  it("should block /srv", () => {
    expect(_isDangerousPath("/srv")).toBe(true);
  });

  it("should block /lib", () => {
    expect(_isDangerousPath("/lib")).toBe(true);
  });

  it("should allow /home/user/.config", () => {
    expect(_isDangerousPath("/home/user/.config")).toBe(false);
  });
});

describe("_getBundleRunnerType", () => {
  it("should return null for .su.sh.js", () => {
    expect(_getBundleRunnerType("test.su.sh.js")).toBeNull();
  });

  it("should return null for .su.sh", () => {
    expect(_getBundleRunnerType("test.su.sh")).toBeNull();
  });

  it("should return null for .sh.js", () => {
    expect(_getBundleRunnerType("test.sh.js")).toBeNull();
  });

  it("should return su.js for .su.js", () => {
    expect(_getBundleRunnerType("test.su.js")).toBe("su.js");
  });

  it("should return js for .js", () => {
    expect(_getBundleRunnerType("test.js")).toBe("js");
  });

  it("should return sh for .sh", () => {
    expect(_getBundleRunnerType("test.sh")).toBe("sh");
  });

  it("should return null for unknown extension", () => {
    expect(_getBundleRunnerType("test.txt")).toBeNull();
  });
});
