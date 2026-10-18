import { describe, it, expect } from "vitest";

import { getIndexFunction, fetchResponses } from "./setup.js";

const cleanupExtraWhitespaces = getIndexFunction("cleanupExtraWhitespaces");

const convertTextToList = getIndexFunction("convertTextToList");

const convertRawTextToList = getIndexFunction("convertRawTextToList");

const convertTextToHosts = getIndexFunction("convertTextToHosts");

const trimLeftSpaces = getIndexFunction("trimLeftSpaces");

const text = getIndexFunction("text");

const code = getIndexFunction("code");

const list = getIndexFunction("list");

const set = getIndexFunction("set");

const json = getIndexFunction("json");

const readText = getIndexFunction("readText");

const readJson = getIndexFunction("readJson");

const convertTextToSet = getIndexFunction("convertTextToSet");

const trimSpacesOnBothEnd = getIndexFunction("trimSpacesOnBothEnd");

const calculatePercentage = getIndexFunction("calculatePercentage");

const getRootDomainFrom = getIndexFunction("getRootDomainFrom");

const clone = getIndexFunction("clone");

const getFullUrl = getIndexFunction("getFullUrl");

describe("cleanupExtraWhitespaces", () => {
  it("should collapse 3+ consecutive newlines into double newlines", () => {
    expect(cleanupExtraWhitespaces("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("should preserve double newlines", () => {
    expect(cleanupExtraWhitespaces("a\n\nb")).toBe("a\n\nb");
  });

  it("should preserve single newlines", () => {
    expect(cleanupExtraWhitespaces("a\nb")).toBe("a\nb");
  });

  it("should trim leading/trailing whitespace", () => {
    expect(cleanupExtraWhitespaces("  hello  ")).toBe("hello");
  });

  it("should handle multiple runs of excess newlines", () => {
    expect(cleanupExtraWhitespaces("a\n\n\n\nb\n\n\n\nc")).toBe("a\n\nb\n\nc");
  });
});

describe("convertTextToList", () => {
  it("should split text into trimmed unique lines", () => {
    expect(convertTextToList("  a\n  b\n  c")).toEqual(["a", "b", "c"]);
  });

  it("should filter out empty lines", () => {
    expect(convertTextToList("a\n\n\nb")).toEqual(["a", "b"]);
  });

  it("should filter out comment lines starting with //", () => {
    expect(convertTextToList("a\n// comment\nb")).toEqual(["a", "b"]);
  });

  it("should filter out comment lines starting with #", () => {
    expect(convertTextToList("a\n# comment\nb")).toEqual(["a", "b"]);
  });

  it("should filter out comment lines starting with *", () => {
    expect(convertTextToList("a\n* comment\nb")).toEqual(["a", "b"]);
  });

  it("should not deduplicate lines", () => {
    expect(convertTextToList("a\nb\na")).toEqual(["a", "b", "a"]);
  });

  it("should accept multiple text arguments", () => {
    expect(convertTextToList("a\nb", "c\nd")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("convertRawTextToList", () => {
  it("should split text into trimmed unique lines", () => {
    expect(convertRawTextToList("  a \n  b \n  c ")).toEqual(["a", "b", "c"]);
  });

  it("should keep comment lines (unlike convertTextToList)", () => {
    const result = convertRawTextToList("a\n// comment\n# hash\nb");
    expect(result).toContain("// comment");
    expect(result).toContain("# hash");
  });

  it("should not deduplicate lines", () => {
    expect(convertRawTextToList("a\nb\na")).toEqual(["a", "b", "a"]);
  });

  it("should include empty string for empty lines", () => {
    const result = convertRawTextToList("a\n\nb");
    expect(result).toContain("");
  });
});

describe("convertTextToHosts", () => {
  it("should extract hostnames from hosts-file format", () => {
    expect(convertTextToHosts("127.0.0.1 localhost")).toEqual(["localhost"]);
  });

  it("should strip leading IP addresses", () => {
    expect(convertTextToHosts("0.0.0.0 ads.example.com")).toEqual(["ads.example.com"]);
  });

  it("should handle bare hostnames without IP", () => {
    expect(convertTextToHosts("example.com")).toEqual(["example.com"]);
  });

  it("should deduplicate hostnames", () => {
    expect(convertTextToHosts("0.0.0.0 example.com\n0.0.0.0 example.com")).toEqual(["example.com"]);
  });

  it("should filter out invalid hostnames", () => {
    const result = convertTextToHosts("0.0.0.0 valid.com\n# comment\n");
    expect(result).toEqual(["valid.com"]);
  });

  it("should handle multiple entries", () => {
    const result = convertTextToHosts("127.0.0.1 localhost\n0.0.0.0 ads.tracker.com\nexample.org");
    expect(result).toEqual(["localhost", "ads.tracker.com", "example.org"]);
  });
});

describe("trimLeftSpaces", () => {
  it("should auto-detect indentation from first non-empty line", () => {
    const input = "    line1\n    line2\n    line3";
    expect(trimLeftSpaces(input)).toBe("line1\nline2\nline3");
  });

  it("should preserve relative indentation", () => {
    const input = "    line1\n      line2\n    line3";
    expect(trimLeftSpaces(input)).toBe("line1\n  line2\nline3");
  });

  it("should accept explicit spaceToTrim", () => {
    const input = "    line1\n      line2";
    expect(trimLeftSpaces(input, 2)).toBe("  line1\n    line2");
  });

  it("should skip empty leading lines when detecting indent", () => {
    const input = "\n    line1\n    line2";
    expect(trimLeftSpaces(input)).toBe("\nline1\nline2");
  });

  it("should return text as-is if no leading spaces", () => {
    expect(trimLeftSpaces("no indent\nhere")).toBe("no indent\nhere");
  });

  it("should not remove more spaces than a line has", () => {
    const input = "      line1\n  line2";
    expect(trimLeftSpaces(input)).toBe("line1\nline2");
  });
});

describe("text", () => {
  it("should concatenate template parts", () => {
    const result = text`hello world`;
    expect(result).toBe("hello world");
  });

  it("should splice interpolated values", () => {
    const name = "world";
    const result = text`hello ${name}`;
    expect(result).toBe("hello world");
  });

  it("should treat null as empty string", () => {
    const result = text`hello ${null} world`;
    expect(result).toBe("hello  world");
  });

  it("should treat undefined as empty string", () => {
    const result = text`hello ${undefined} world`;
    expect(result).toBe("hello  world");
  });

  it("should unescape dollar-brace syntax", () => {
    const result = text`echo \${HOME}`;
    expect(result).toBe("echo ${HOME}");
  });

  it("should return empty string for empty template", () => {
    const result = text``;
    expect(result).toBe("");
  });

  it("should stringify non-string interpolated values", () => {
    const result = text`count=${42}`;
    expect(result).toBe("count=42");
  });

  it("should preserve whitespace and newlines as-is", () => {
    const result = text`  line1
  line2  `;
    expect(result).toBe("  line1\n  line2  ");
  });

  it("should handle multiple interpolated values", () => {
    const a = "foo";
    const b = "bar";
    const result = text`${a} and ${b}`;
    expect(result).toBe("foo and bar");
  });

  it("should unescape backticks and backslashes", () => {
    const result = text`echo \\\${HOME}`;
    expect(result).toBe("echo \\${HOME}");
  });
});

describe("code", () => {
  it("should dedent and trim the result", () => {
    const result = code`
      line1
      line2
    `;
    expect(result).toBe("line1\nline2");
  });

  it("should trim trailing whitespace from each line", () => {
    const result = code`
      line1${" "}
      line2${"   "}
    `;
    expect(result).toBe("line1\nline2");
  });

  it("should preserve dollar-brace syntax", () => {
    const result = code`echo \${HOME}`;
    expect(result).toBe("echo ${HOME}");
  });

  it("should splice interpolated values", () => {
    const tool = "starship";
    const result = code`
      if type -P ${tool} &>/dev/null; then
        eval "\$(${tool} init bash)"
      fi
    `;
    expect(result).toContain("if type -P starship &>/dev/null; then");
    expect(result).toContain('eval "$(starship init bash)"');
  });

  it("should return empty string for empty template", () => {
    const result = code``;
    expect(result).toBe("");
  });

  it("should handle single line", () => {
    const result = code`  echo hello  `;
    expect(result).toBe("echo hello");
  });

  it("should preserve relative indentation", () => {
    const result = code`
      function foo() {
        echo "hello"
      }
    `;
    expect(result).toBe('function foo() {\n  echo "hello"\n}');
  });
});
