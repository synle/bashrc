import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant, mockFsExistence, mockFsDirEntries } from "./setup.js";

const _getFilePath = getIndexFunction("_getFilePath");
const filePathExist = getIndexFunction("filePathExist");
const findDirList = getIndexFunction("findDirList");
const findDirSingle = getIndexFunction("findDirSingle");
const findFileRecursive = getIndexFunction("findFileRecursive");
const findFirstDirFromList = getIndexFunction("findFirstDirFromList");
const getOsxApplicationSupportCodeUserPath = getIndexFunction("getOsxApplicationSupportCodeUserPath");

describe("_getFilePath", () => {
  it("should return filePath as-is when DEBUG_WRITE_TO_DIR is empty", () => {
    expect(_getFilePath("/some/path/file.txt")).toBe("/some/path/file.txt");
  });
});

describe("filePathExist", () => {
  it("should return true when path exists in mock", () => {
    mockFsExistence["/exists/file.txt"] = true;
    expect(filePathExist("/exists/file.txt")).toBe(true);
  });

  it("should return false when path does not exist in mock", () => {
    expect(filePathExist("/does/not/exist")).toBe(false);
  });
});

describe("findDirList", () => {
  it("should return matching directories", () => {
    mockFsDirEntries["/src"] = [
      { name: "node_modules", isDirectory: () => true, isFile: () => false },
      { name: "src", isDirectory: () => true, isFile: () => false },
      { name: "index.js", isDirectory: () => false, isFile: () => true },
    ];
    const result = findDirList("/src", /^src$/);
    expect(result).toEqual(["/src/src"]);
  });

  it("should return empty array when no directories match", () => {
    mockFsDirEntries["/src"] = [
      { name: "lib", isDirectory: () => true, isFile: () => false },
    ];
    const result = findDirList("/src", /^nothing$/);
    expect(result).toEqual([]);
  });

  it("should return empty array when directory does not exist", () => {
    const result = findDirList("/nonexistent", /test/);
    expect(result).toEqual([]);
  });

  it("should return first match when returnFirstMatch is true", () => {
    mockFsDirEntries["/src"] = [
      { name: "alpha", isDirectory: () => true, isFile: () => false },
      { name: "beta", isDirectory: () => true, isFile: () => false },
    ];
    const result = findDirList("/src", /.*/, true);
    expect(result).toBe("/src/alpha");
  });

  it("should return null when returnFirstMatch is true and nothing matches", () => {
    mockFsDirEntries["/src"] = [];
    const result = findDirList("/src", /nothing/, true);
    expect(result).toBeUndefined();
  });

  it("should return null when returnFirstMatch is true and dir does not exist", () => {
    const result = findDirList("/nonexistent", /test/, true);
    expect(result).toBeNull();
  });
});

describe("findDirSingle", () => {
  it("should return first matching directory", () => {
    mockFsDirEntries["/mnt"] = [
      { name: "c", isDirectory: () => true, isFile: () => false },
      { name: "d", isDirectory: () => true, isFile: () => false },
    ];
    expect(findDirSingle("/mnt", /^d$/)).toBe("/mnt/d");
  });

  it("should return null when nothing matches", () => {
    mockFsDirEntries["/mnt"] = [
      { name: "c", isDirectory: () => true, isFile: () => false },
    ];
    expect(findDirSingle("/mnt", /^z$/)).toBeUndefined();
  });
});

describe("findFileRecursive", () => {
  it("should find a file at top level", () => {
    mockFsDirEntries["/project"] = [
      { name: "readme.md", isDirectory: () => false, isFile: () => true },
    ];
    expect(findFileRecursive("/project", /readme/)).toBe("/project/readme.md");
  });

  it("should find a file in a subdirectory", () => {
    mockFsDirEntries["/project"] = [
      { name: "src", isDirectory: () => true, isFile: () => false },
    ];
    mockFsDirEntries["/project/src"] = [
      { name: "app.js", isDirectory: () => false, isFile: () => true },
    ];
    expect(findFileRecursive("/project", /app\.js/)).toBe("/project/src/app.js");
  });

  it("should return null when file not found", () => {
    mockFsDirEntries["/project"] = [
      { name: "lib", isDirectory: () => true, isFile: () => false },
    ];
    mockFsDirEntries["/project/lib"] = [];
    expect(findFileRecursive("/project", /missing/)).toBeNull();
  });

  it("should return null when directory does not exist", () => {
    expect(findFileRecursive("/nonexistent", /test/)).toBeNull();
  });
});

describe("findFirstDirFromList", () => {
  it("should return first matching directory from list of search props", () => {
    mockFsDirEntries["/opt"] = [
      { name: "homebrew", isDirectory: () => true, isFile: () => false },
    ];
    const result = findFirstDirFromList([
      ["/nonexistent", /test/],
      ["/opt", /homebrew/],
    ]);
    expect(result).toBe("/opt/homebrew");
  });

  it("should return undefined when nothing matches", () => {
    mockFsDirEntries["/opt"] = [];
    const result = findFirstDirFromList([
      ["/opt", /nothing/],
    ]);
    expect(result).toBeUndefined();
  });
});

describe("getOsxApplicationSupportCodeUserPath", () => {
  it("should return Library/Application Support path", () => {
    const result = getOsxApplicationSupportCodeUserPath();
    expect(result).toContain("Library/Application Support");
  });
});
