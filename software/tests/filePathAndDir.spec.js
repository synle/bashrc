import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant, mockFsExistence, mockFsDirEntries } from "./setup.js";

const findPathList = getIndexFunction("findPathList");
const findPath = getIndexFunction("findPath");
const findPathFromList = getIndexFunction("findPathFromList");
const pathExists = getIndexFunction("pathExists");
const getOsxApplicationSupportCodeUserPath = getIndexFunction("getOsxApplicationSupportCodeUserPath");

// deprecated wrappers — kept to verify backward compatibility
const findDirList = getIndexFunction("findDirList");
const findDirSingle = getIndexFunction("findDirSingle");
const findFileRecursive = getIndexFunction("findFileRecursive");
const findFirstDirFromList = getIndexFunction("findFirstDirFromList");

describe("findPathList", () => {
  it("should return matching directories with type folder", () => {
    mockFsDirEntries["/src"] = [
      { name: "node_modules", isDirectory: () => true, isFile: () => false },
      { name: "src", isDirectory: () => true, isFile: () => false },
      { name: "index.js", isDirectory: () => false, isFile: () => true },
    ];
    const result = findPathList("/src", /^src$/, { type: "folder" });
    expect(result).toEqual(["/src/src"]);
  });

  it("should return matching files with type file", () => {
    mockFsDirEntries["/src"] = [
      { name: "node_modules", isDirectory: () => true, isFile: () => false },
      { name: "index.js", isDirectory: () => false, isFile: () => true },
      { name: "app.js", isDirectory: () => false, isFile: () => true },
    ];
    const result = findPathList("/src", /\.js$/, { type: "file" });
    expect(result).toEqual(["/src/index.js", "/src/app.js"]);
  });

  it("should return all entry types with type any", () => {
    mockFsDirEntries["/mixed"] = [
      { name: "target", isDirectory: () => true, isFile: () => false },
      { name: "target.js", isDirectory: () => false, isFile: () => true },
    ];
    const result = findPathList("/mixed", /target/);
    expect(result).toEqual(["/mixed/target", "/mixed/target.js"]);
  });

  it("should return empty array when no entries match", () => {
    mockFsDirEntries["/src"] = [{ name: "lib", isDirectory: () => true, isFile: () => false }];
    const result = findPathList("/src", /^nothing$/, { type: "folder" });
    expect(result).toEqual([]);
  });

  it("should return empty array when directory does not exist", () => {
    const result = findPathList("/nonexistent", /test/);
    expect(result).toEqual([]);
  });

  it("should support string matcher", () => {
    mockFsDirEntries["/opt"] = [
      { name: "homebrew", isDirectory: () => true, isFile: () => false },
      { name: "local", isDirectory: () => true, isFile: () => false },
    ];
    const result = findPathList("/opt", "homebrew", { type: "folder" });
    expect(result).toEqual(["/opt/homebrew"]);
  });

  it("should find files recursively", () => {
    mockFsDirEntries["/project"] = [
      { name: "src", isDirectory: () => true, isFile: () => false },
      { name: "readme.md", isDirectory: () => false, isFile: () => true },
    ];
    mockFsDirEntries["/project/src"] = [{ name: "app.js", isDirectory: () => false, isFile: () => true }];
    const result = findPathList("/project", /\.js$/, { type: "file", recursive: true });
    expect(result).toEqual(["/project/src/app.js"]);
  });
});

describe("findPath", () => {
  it("should return first matching directory", () => {
    mockFsDirEntries["/mnt"] = [
      { name: "c", isDirectory: () => true, isFile: () => false },
      { name: "d", isDirectory: () => true, isFile: () => false },
    ];
    expect(findPath("/mnt", /^d$/, { type: "folder" })).toBe("/mnt/d");
  });

  it("should return null when nothing matches", () => {
    mockFsDirEntries["/mnt"] = [{ name: "c", isDirectory: () => true, isFile: () => false }];
    expect(findPath("/mnt", /^z$/, { type: "folder" })).toBeNull();
  });

  it("should return null when directory does not exist", () => {
    expect(findPath("/nonexistent", /test/)).toBeNull();
  });

  it("should find file recursively", () => {
    mockFsDirEntries["/project"] = [{ name: "src", isDirectory: () => true, isFile: () => false }];
    mockFsDirEntries["/project/src"] = [{ name: "app.js", isDirectory: () => false, isFile: () => true }];
    expect(findPath("/project", /app\.js/, { type: "file", recursive: true })).toBe("/project/src/app.js");
  });

  it("should return null for recursive search when file not found", () => {
    mockFsDirEntries["/project"] = [{ name: "lib", isDirectory: () => true, isFile: () => false }];
    mockFsDirEntries["/project/lib"] = [];
    expect(findPath("/project", /missing/, { type: "file", recursive: true })).toBeNull();
  });
});

describe("findPathFromList", () => {
  it("should return first matching path from list of search props", () => {
    mockFsDirEntries["/opt"] = [{ name: "homebrew", isDirectory: () => true, isFile: () => false }];
    const result = findPathFromList(
      [
        ["/nonexistent", /test/],
        ["/opt", /homebrew/],
      ],
      { type: "folder" },
    );
    expect(result).toBe("/opt/homebrew");
  });

  it("should return null when nothing matches", () => {
    mockFsDirEntries["/opt"] = [];
    const result = findPathFromList([["/opt", /nothing/]], { type: "folder" });
    expect(result).toBeNull();
  });
});

describe("pathExists", () => {
  it("should return true when a matching entry exists", () => {
    mockFsDirEntries["/apps"] = [{ name: "Chrome.app", isDirectory: () => true, isFile: () => false }];
    expect(pathExists("/apps", /^Chrome\.app$/)).toBe(true);
  });

  it("should return false when no entry matches", () => {
    mockFsDirEntries["/apps"] = [{ name: "Safari.app", isDirectory: () => true, isFile: () => false }];
    expect(pathExists("/apps", /^Chrome\.app$/)).toBe(false);
  });

  it("should return false when directory does not exist", () => {
    expect(pathExists("/nonexistent", /test/)).toBe(false);
  });

  it("should match only files when type is file", () => {
    mockFsDirEntries["/bin"] = [
      { name: "chrome", isDirectory: () => false, isFile: () => true },
      { name: "chrome-dir", isDirectory: () => true, isFile: () => false },
    ];
    expect(pathExists("/bin", /^chrome$/, "file")).toBe(true);
    expect(pathExists("/bin", /^chrome-dir$/, "file")).toBe(false);
  });

  it("should match only folders when type is folder", () => {
    mockFsDirEntries["/apps"] = [
      { name: "Brave.app", isDirectory: () => true, isFile: () => false },
      { name: "brave-bin", isDirectory: () => false, isFile: () => true },
    ];
    expect(pathExists("/apps", /^Brave\.app$/, "folder")).toBe(true);
    expect(pathExists("/apps", /^brave-bin$/, "folder")).toBe(false);
  });

  it("should match either file or folder when type is omitted", () => {
    mockFsDirEntries["/mixed"] = [{ name: "target", isDirectory: () => false, isFile: () => true }];
    expect(pathExists("/mixed", /^target$/)).toBe(true);

    mockFsDirEntries["/mixed"] = [{ name: "target", isDirectory: () => true, isFile: () => false }];
    expect(pathExists("/mixed", /^target$/)).toBe(true);
  });

  it("should check simple path existence without targetMatch", () => {
    mockFsExistence["/exists/file.txt"] = true;
    expect(pathExists("/exists/file.txt")).toBe(true);
  });

  it("should return false for non-existent simple path", () => {
    expect(pathExists("/does/not/exist")).toBe(false);
  });
});

describe("deprecated wrappers", () => {
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

    it("should return first match when returnFirstMatch is true", () => {
      mockFsDirEntries["/src"] = [
        { name: "alpha", isDirectory: () => true, isFile: () => false },
        { name: "beta", isDirectory: () => true, isFile: () => false },
      ];
      const result = findDirList("/src", /.*/, true);
      expect(result).toBe("/src/alpha");
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
  });

  describe("findFileRecursive", () => {
    it("should find a file in a subdirectory", () => {
      mockFsDirEntries["/project"] = [{ name: "src", isDirectory: () => true, isFile: () => false }];
      mockFsDirEntries["/project/src"] = [{ name: "app.js", isDirectory: () => false, isFile: () => true }];
      expect(findFileRecursive("/project", /app\.js/)).toBe("/project/src/app.js");
    });
  });

  describe("findFirstDirFromList", () => {
    it("should return first matching directory from list", () => {
      mockFsDirEntries["/opt"] = [{ name: "homebrew", isDirectory: () => true, isFile: () => false }];
      const result = findFirstDirFromList([
        ["/nonexistent", /test/],
        ["/opt", /homebrew/],
      ]);
      expect(result).toBe("/opt/homebrew");
    });
  });
});

describe("getOsxApplicationSupportCodeUserPath", () => {
  it("should return Library/Application Support path", () => {
    const result = getOsxApplicationSupportCodeUserPath();
    expect(result).toContain("Library/Application Support");
  });
});
