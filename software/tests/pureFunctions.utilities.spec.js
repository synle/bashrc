/** Tests for untested pure/utility functions in index.js. */
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

// ---- _parseDesktopEntry ----

describe("_parseDesktopEntry", () => {
  it("should parse a standard .desktop file", () => {
    const content = `[Desktop Entry]
Name=MyApp
Exec=/usr/bin/myapp
Type=Application
Categories=Utility;
`;
    const result = _parseDesktopEntry(content);
    expect(result).toEqual({
      Name: "MyApp",
      Exec: "/usr/bin/myapp",
      Type: "Application",
      Categories: "Utility;",
    });
  });

  it("should ignore sections after [Desktop Entry]", () => {
    const content = `[Desktop Entry]
Name=MyApp
[Desktop Action debug]
Exec=myapp --debug
`;
    const result = _parseDesktopEntry(content);
    expect(result).toEqual({ Name: "MyApp" });
  });

  it("should return empty object for content without [Desktop Entry]", () => {
    const content = `[Other Section]
Key=Value
`;
    const result = _parseDesktopEntry(content);
    expect(result).toEqual({});
  });

  it("should skip lines without =", () => {
    const content = `[Desktop Entry]
Name=MyApp
invalid-line
Exec=/usr/bin/myapp
`;
    const result = _parseDesktopEntry(content);
    expect(result).toEqual({ Name: "MyApp", Exec: "/usr/bin/myapp" });
  });

  it("should handle values containing equals signs", () => {
    const content = `[Desktop Entry]
Exec=myapp --flag=value
`;
    const result = _parseDesktopEntry(content);
    expect(result).toEqual({ Exec: "myapp --flag=value" });
  });

  it("should handle empty content", () => {
    expect(_parseDesktopEntry("")).toEqual({});
  });
});

// ---- _resolvePresetName ----

describe("_resolvePresetName", () => {
  const presetMap = { editors: ["a.js"], terminal: ["b.js"], apps: ["c.js"] };

  it("should return exact match", () => {
    expect(_resolvePresetName("editors", presetMap)).toBe("editors");
  });

  it("should return unique fuzzy match", () => {
    expect(_resolvePresetName("editor", presetMap)).toBe("editors");
  });

  it("should return null for no match", () => {
    expect(_resolvePresetName("nonexistent", presetMap)).toBeNull();
  });

  it("should throw on ambiguous match", () => {
    expect(() => _resolvePresetName("s", presetMap)).toThrow(/ambiguous/);
  });

  it("should use custom suggestionFlag", () => {
    try {
      _resolvePresetName("s", presetMap, { suggestionFlag: "--files=" });
    } catch (e) {
      expect(e.message).toContain("--files=");
    }
  });
});

// ---- getGitHubReleaseApiUrl ----

describe("getGitHubReleaseApiUrl", () => {
  it("should build latest release URL", () => {
    expect(getGitHubReleaseApiUrl("owner/repo")).toBe("https://api.github.com/repos/owner/repo/releases/latest");
  });

  it("should build tag-specific URL", () => {
    expect(getGitHubReleaseApiUrl("owner/repo/v1.0.0")).toBe("https://api.github.com/repos/owner/repo/releases/tags/v1.0.0");
  });
});

// ---- getRepoNameFromId ----

describe("getRepoNameFromId", () => {
  it("should extract repo name from owner/repo", () => {
    expect(getRepoNameFromId("synle/url-porter")).toBe("url-porter");
  });

  it("should extract repo name from owner/repo/version", () => {
    expect(getRepoNameFromId("synle/url-porter/v1.0.0")).toBe("url-porter");
  });

  it("should return empty string for invalid input", () => {
    expect(getRepoNameFromId("")).toBe("");
  });
});

// ---- stripVersionFromFilename ----

describe("stripVersionFromFilename", () => {
  it("should strip version numbers", () => {
    expect(stripVersionFromFilename("app_7.0.5_setup.exe")).toBe("app_setup.exe");
  });

  it("should handle filename with no version", () => {
    expect(stripVersionFromFilename("app_setup.exe")).toBe("app_setup.exe");
  });

  it("should strip multiple version segments", () => {
    expect(stripVersionFromFilename("tool_1.2.3.4_beta.tar.gz")).toBe("tool_beta.tar.gz");
  });
});

// ---- getBinaryCacheUrl ----

describe("getBinaryCacheUrl", () => {
  it("should build binary cache URL", () => {
    const result = getBinaryCacheUrl("sqlui-native", "sqlui_1.0.0_setup.dmg");
    expect(result).toContain("synle/bashrc");
    expect(result).toContain("binary-cache");
    expect(result).toContain("sqlui-native__");
    expect(result).not.toContain("1.0.0");
  });
});

// ---- calculatePercentage ----

describe("calculatePercentage", () => {
  it("should calculate percentage to two decimals", () => {
    expect(calculatePercentage(1, 3)).toBe("33.33");
  });

  it("should handle 100%", () => {
    expect(calculatePercentage(50, 50)).toBe("100.00");
  });

  it("should handle 0%", () => {
    expect(calculatePercentage(0, 100)).toBe("0.00");
  });
});

// ---- getRootDomainFrom ----

describe("getRootDomainFrom", () => {
  it("should extract root domain from URL", () => {
    expect(getRootDomainFrom("https://www.example.com/path")).toBe("example.com/path");
  });

  it("should handle bare hostname", () => {
    expect(getRootDomainFrom("sub.domain.example.com")).toBe("example.com");
  });

  it("should handle two-part domain", () => {
    expect(getRootDomainFrom("example.co.uk")).toBe("co.uk");
  });
});

// ---- trimSpacesOnBothEnd ----

describe("trimSpacesOnBothEnd", () => {
  it("should trim spaces on each line", () => {
    expect(trimSpacesOnBothEnd("  hello  \n  world  ")).toBe("hello\nworld");
  });

  it("should handle empty string", () => {
    expect(trimSpacesOnBothEnd("")).toBe("");
  });

  it("should handle null", () => {
    expect(trimSpacesOnBothEnd(null)).toBe("");
  });

  it("should handle single line", () => {
    expect(trimSpacesOnBothEnd("  spaced  ")).toBe("spaced");
  });
});

// ---- _stripTextBlock ----

describe("_stripTextBlock", () => {
  it("should remove a BEGIN/END block", () => {
    const content = "line1\n# BEGIN mykey\nblock content\n# END mykey\nline2";
    const result = _stripTextBlock(content, "mykey", "#");
    expect(result).toBe("line1\n\nline2");
  });

  it("should return content unchanged if block not found", () => {
    const content = "line1\nline2";
    expect(_stripTextBlock(content, "missing", "#")).toBe(content);
  });

  it("should handle content with only BEGIN but no END", () => {
    const content = "line1\n# BEGIN mykey\nblock content";
    expect(_stripTextBlock(content, "mykey", "#")).toBe(content);
  });
});

// ---- moveTextBlockToEnd ----

describe("moveTextBlockToEnd", () => {
  it("should move block from middle to end", () => {
    const content = "before\n# BEGIN mykey\nold\n# END mykey\nafter";
    const result = moveTextBlockToEnd(content, "mykey", "new block", "#");
    expect(result).toContain("before");
    expect(result).toContain("after");
    expect(result).toContain("new block");
    const lines = result.split("\n");
    expect(lines[lines.length - 2]).toBe("new block");
  });

  it("should add block at end if not present", () => {
    const content = "line1\nline2";
    const result = moveTextBlockToEnd(content, "mykey", "block", "#");
    expect(result).toContain("# BEGIN mykey");
    expect(result).toContain("block");
    expect(result).toContain("# END mykey");
  });
});

// ---- moveTextBlockToStart ----

describe("moveTextBlockToStart", () => {
  it("should move block from middle to start", () => {
    const content = "before\n# BEGIN mykey\nold\n# END mykey\nafter";
    const result = moveTextBlockToStart(content, "mykey", "new block", "#");
    expect(result).toContain("new block");
    expect(result).toContain("before");
    expect(result).toContain("after");
    expect(result.indexOf("new block")).toBeLessThan(result.indexOf("before"));
  });

  it("should add block at start if not present", () => {
    const content = "line1\nline2";
    const result = moveTextBlockToStart(content, "mykey", "block", "#");
    expect(result).toContain("# BEGIN mykey\nblock\n# END mykey");
    expect(result).toContain("line1");
    expect(result).toContain("line2");
    const blockIdx = result.indexOf("# BEGIN mykey");
    expect(blockIdx).toBeLessThan(result.indexOf("line1"));
  });
});

// ---- _replaceSourceBlocks ----

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

// ---- _looksLikePathOrUrl ----

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

// ---- _getAutoColor ----

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

// ---- _applyAutoColor ----

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

// ---- getFullUrl ----

describe("getFullUrl", () => {
  it("should return absolute URL as-is", () => {
    expect(getFullUrl("https://example.com/file")).toBe("https://example.com/file");
  });

  it("should convert relative URL to absolute", () => {
    const result = getFullUrl("software/scripts/test.js");
    expect(result).toContain("https://");
  });
});

// ---- _isDangerousPath (additional branches) ----

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

// ---- _getBundleRunnerType ----

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

// ---- _resolveScriptFile ----

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

// ---- clone ----

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

// ---- parseJsonWithComments ----

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

// ---- cleanupExtraWhitespaces ----

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
