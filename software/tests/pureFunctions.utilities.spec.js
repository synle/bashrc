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

describe("getGitHubReleaseApiUrl", () => {
  it("should build latest release URL", () => {
    expect(getGitHubReleaseApiUrl("owner/repo")).toBe("https://api.github.com/repos/owner/repo/releases/latest");
  });

  it("should build tag-specific URL", () => {
    expect(getGitHubReleaseApiUrl("owner/repo/v1.0.0")).toBe("https://api.github.com/repos/owner/repo/releases/tags/v1.0.0");
  });
});

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

describe("getBinaryCacheUrl", () => {
  it("should build binary cache URL", () => {
    const result = getBinaryCacheUrl("sqlui-native", "sqlui_1.0.0_setup.dmg");
    expect(result).toContain("synle/bashrc");
    expect(result).toContain("binary-cache");
    expect(result).toContain("sqlui-native__");
    expect(result).not.toContain("1.0.0");
  });
});

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
