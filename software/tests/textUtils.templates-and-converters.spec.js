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

describe("list", () => {
  it("should return unique non-empty lines", () => {
    const result = list`
      alpha
      bravo
      charlie
    `;
    expect(result).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("should filter comment lines", () => {
    const result = list`
      # this is a comment
      alpha
      // another comment
      bravo
    `;
    expect(result).toEqual(["alpha", "bravo"]);
  });

  it("should not deduplicate lines", () => {
    const result = list`
      alpha
      bravo
      alpha
    `;
    expect(result).toEqual(["alpha", "bravo", "alpha"]);
  });

  it("should handle interpolated values", () => {
    const extra = "delta";
    const result = list`
      alpha
      bravo
      ${extra}
    `;
    expect(result).toEqual(["alpha", "bravo", "delta"]);
  });

  it("should return empty array for empty template", () => {
    const result = list``;
    expect(result).toEqual([]);
  });
});

describe("convertTextToSet", () => {
  it("should return a deduplicated array of unique non-empty lines", () => {
    const result = convertTextToSet("alpha\nbravo\ncharlie");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("should filter comment lines", () => {
    const result = convertTextToSet("# comment\nalpha\n// another\nbravo");
    expect(result).toEqual(["alpha", "bravo"]);
  });

  it("should deduplicate lines", () => {
    const result = convertTextToSet("alpha\nbravo\nalpha");
    expect(result).toEqual(["alpha", "bravo"]);
  });

  it("should accept multiple text arguments", () => {
    const result = convertTextToSet("alpha\nbravo", "charlie\nalpha");
    expect(result).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("should return empty array for empty input", () => {
    const result = convertTextToSet("");
    expect(result).toEqual([]);
  });
});

describe("set", () => {
  it("should return a deduplicated array of unique non-empty lines", () => {
    const result = set`
      alpha
      bravo
      charlie
    `;
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("should filter comment lines", () => {
    const result = set`
      # this is a comment
      alpha
      // another comment
      bravo
    `;
    expect(result).toEqual(["alpha", "bravo"]);
  });

  it("should deduplicate lines", () => {
    const result = set`
      alpha
      bravo
      alpha
    `;
    expect(result).toEqual(["alpha", "bravo"]);
  });

  it("should handle interpolated values", () => {
    const extra = "delta";
    const result = set`
      alpha
      bravo
      ${extra}
    `;
    expect(result).toEqual(["alpha", "bravo", "delta"]);
  });

  it("should return empty array for empty template", () => {
    const result = set``;
    expect(result).toEqual([]);
  });
});

describe("json", () => {
  it("should parse a simple JSON object", () => {
    const result = json`
      {
        "name": "test",
        "value": 42
      }
    `;
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("should strip single-line comments", () => {
    const result = json`
      {
        // this is a comment
        "key": "value"
      }
    `;
    expect(result).toEqual({ key: "value" });
  });

  it("should strip trailing commas", () => {
    const result = json`
      {
        "a": 1,
        "b": 2,
      }
    `;
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("should parse a JSON array", () => {
    const result = json`
      [
        { "key": "cmd+k" },
        { "key": "cmd+j" },
      ]
    `;
    expect(result).toEqual([{ key: "cmd+k" }, { key: "cmd+j" }]);
  });

  it("should handle interpolated values", () => {
    const color = "#ff0000";
    const result = json`
      {
        "background": "${color}"
      }
    `;
    expect(result).toEqual({ background: "#ff0000" });
  });

  it("should return empty object on empty input", () => {
    expect(json``).toEqual({});
  });
});

describe("readText", () => {
  it("should load a file as string", async () => {
    fetchResponses["software/scripts/test-file.txt"] = "hello world";
    const result = await readText`software/scripts/test-file.txt`;
    expect(result).toBe("hello world");
  });

  it("should handle interpolated path", async () => {
    const fileName = "test-file.txt";
    fetchResponses[`software/scripts/${fileName}`] = "dynamic content";
    const result = await readText`software/scripts/${fileName}`;
    expect(result).toBe("dynamic content");
  });

  it("should return empty string for missing file", async () => {
    const result = await readText`software/scripts/nonexistent.txt`;
    expect(result).toBe("");
  });
});

describe("readJson", () => {
  it("should load and parse a JSON file", async () => {
    fetchResponses["software/scripts/test.json"] = '{"key": "value"}';
    const result = await readJson`software/scripts/test.json`;
    expect(result).toEqual({ key: "value" });
  });

  it("should handle interpolated path", async () => {
    const name = "test.json";
    fetchResponses[`software/scripts/${name}`] = '{"a": 1}';
    const result = await readJson`software/scripts/${name}`;
    expect(result).toEqual({ a: 1 });
  });

  it("should parse a JSON array", async () => {
    fetchResponses["software/scripts/test-array.json"] = '[{"key": "cmd+k"}, {"key": "cmd+j"}]';
    const result = await readJson`software/scripts/test-array.json`;
    expect(result).toEqual([{ key: "cmd+k" }, { key: "cmd+j" }]);
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
