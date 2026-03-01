import { describe, it, expect } from "vitest";
import { getIndexFunction } from "./setup.js";

const cleanupExtraWhitespaces = getIndexFunction("cleanupExtraWhitespaces");
const convertTextToList = getIndexFunction("convertTextToList");
const convertRawTextToList = getIndexFunction("convertRawTextToList");
const convertTextToHosts = getIndexFunction("convertTextToHosts");
const trimLeftSpaces = getIndexFunction("trimLeftSpaces");
const trimSpacesOnBothEnd = getIndexFunction("trimSpacesOnBothEnd");
const calculatePercentage = getIndexFunction("calculatePercentage");
const getRootDomainFrom = getIndexFunction("getRootDomainFrom");
const clone = getIndexFunction("clone");
const getFullUrl = getIndexFunction("getFullUrl");

// ---- tests ----

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

  it("should deduplicate lines", () => {
    expect(convertTextToList("a\nb\na")).toEqual(["a", "b"]);
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

  it("should deduplicate lines", () => {
    expect(convertRawTextToList("a\nb\na")).toEqual(["a", "b"]);
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

describe("trimSpacesOnBothEnd", () => {
  it("should trim each line", () => {
    expect(trimSpacesOnBothEnd("  a  \n  b  ")).toBe("a\nb");
  });

  it("should handle null/undefined", () => {
    expect(trimSpacesOnBothEnd(null)).toBe("");
    expect(trimSpacesOnBothEnd(undefined)).toBe("");
  });

  it("should handle empty string", () => {
    expect(trimSpacesOnBothEnd("")).toBe("");
  });
});

describe("calculatePercentage", () => {
  it("should calculate percentage to 2 decimal places", () => {
    expect(calculatePercentage(75, 100)).toBe("75.00");
  });

  it("should handle fractional percentages", () => {
    expect(calculatePercentage(1, 3)).toBe("33.33");
  });

  it("should handle 100%", () => {
    expect(calculatePercentage(10, 10)).toBe("100.00");
  });

  it("should handle 0%", () => {
    expect(calculatePercentage(0, 100)).toBe("0.00");
  });
});

describe("getRootDomainFrom", () => {
  it("should extract root domain from subdomain", () => {
    expect(getRootDomainFrom("www.example.com")).toBe("example.com");
  });

  it("should extract root domain from deep subdomain", () => {
    expect(getRootDomainFrom("a.b.c.example.com")).toBe("example.com");
  });

  it("should handle bare domain", () => {
    expect(getRootDomainFrom("example.com")).toBe("example.com");
  });
});

describe("clone", () => {
  it("should deep clone an object", () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = clone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
  });

  it("should deep clone an array", () => {
    const original = [1, [2, 3]];
    const cloned = clone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });
});

describe("getFullUrl", () => {
  it("should return absolute URLs as-is", () => {
    expect(getFullUrl("https://example.com/file")).toBe("https://example.com/file");
  });

  it("should return http URLs as-is", () => {
    expect(getFullUrl("http://example.com/file")).toBe("http://example.com/file");
  });

  it("should prepend REPO_PREFIX_URL for relative paths", () => {
    const result = getFullUrl("software/scripts/git.js");
    expect(result).toContain("software/scripts/git.js");
    expect(result.startsWith("http")).toBe(true);
  });
});
