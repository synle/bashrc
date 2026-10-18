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
