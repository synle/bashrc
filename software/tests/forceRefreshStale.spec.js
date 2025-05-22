import { describe, it, expect, beforeEach } from "vitest";
import { mockFsExistence, getIndexFunction, getIndexConstant } from "./setup.js";

const isPathStale = getIndexFunction("isPathStale");
const isForceRefreshStale = getIndexFunction("isForceRefreshStale");
const DEFAULT_STALE_SECONDS = getIndexConstant("DEFAULT_STALE_SECONDS");

// ---- tests ----

describe("DEFAULT_STALE_SECONDS", () => {
  it("should be 2 weeks in seconds", () => {
    expect(DEFAULT_STALE_SECONDS).toBe(1209600);
  });
});

describe("isPathStale", () => {
  beforeEach(() => {
    Object.keys(mockFsExistence).forEach((k) => delete mockFsExistence[k]);
  });

  it("should return true for non-existent path", () => {
    expect(isPathStale("/mock/missing")).toBe(true);
  });

  it("should return false for a recently modified path", () => {
    mockFsExistence["/mock/fresh"] = { type: "dir", mtimeMs: Date.now() - 1000 };
    expect(isPathStale("/mock/fresh")).toBe(false);
  });

  it("should return true for a path older than 2 weeks", () => {
    const threeWeeksAgo = Date.now() - 1209600 * 1000 - 1000;
    mockFsExistence["/mock/old"] = { type: "dir", mtimeMs: threeWeeksAgo };
    expect(isPathStale("/mock/old")).toBe(true);
  });

  it("should return false for a path within the 2-week boundary", () => {
    const justUnder = Date.now() - 1209600 * 1000 + 60000;
    mockFsExistence["/mock/boundary"] = { type: "file", mtimeMs: justUnder };
    expect(isPathStale("/mock/boundary")).toBe(false);
  });

  it("should support a custom max age", () => {
    const oneHourAgo = Date.now() - 3600 * 1000 - 1000;
    mockFsExistence["/mock/custom"] = { type: "file", mtimeMs: oneHourAgo };
    expect(isPathStale("/mock/custom", 3600)).toBe(true);
    expect(isPathStale("/mock/custom", 7200)).toBe(false);
  });
});

describe("isForceRefreshStale", () => {
  beforeEach(() => {
    Object.keys(mockFsExistence).forEach((k) => delete mockFsExistence[k]);
  });

  it("should return false when IS_FORCE_REFRESH is false", () => {
    expect(isForceRefreshStale("/mock/anything")).toBe(false);
  });

  it("should return false for non-existent path when IS_FORCE_REFRESH is false", () => {
    expect(isForceRefreshStale("/mock/missing")).toBe(false);
  });

  it("should return false for a recently modified path when IS_FORCE_REFRESH is false", () => {
    mockFsExistence["/mock/fresh"] = { type: "dir", mtimeMs: Date.now() - 1000 };
    expect(isForceRefreshStale("/mock/fresh")).toBe(false);
  });

  it("should return false for a stale path when IS_FORCE_REFRESH is false", () => {
    const threeWeeksAgo = Date.now() - 1209600 * 1000 - 1000;
    mockFsExistence["/mock/old"] = { type: "dir", mtimeMs: threeWeeksAgo };
    expect(isForceRefreshStale("/mock/old")).toBe(false);
  });
});
