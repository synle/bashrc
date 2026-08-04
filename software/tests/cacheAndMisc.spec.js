/** Tests for cacheInMemory, getCachedValue, and miscellaneous under-tested functions. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, getIndexConstant, fileSystem, fetchResponses, mockFsExistence } from "./setup.js";

const cacheInMemory = getIndexFunction("cacheInMemory");
const getCachedValue = getIndexFunction("getCachedValue");
const consolidateHosts = getIndexFunction("consolidateHosts");
const _isDangerousPath = getIndexFunction("_isDangerousPath");
const _isRefreshTarget = getIndexFunction("_isRefreshTarget");
const readList = getIndexFunction("readList");
const readSet = getIndexFunction("readSet");
const isBashSyleStale = getIndexFunction("isBashSyleStale");
const writeConfigToFile = getIndexFunction("writeConfigToFile");
const parseRawArgs = getIndexFunction("parseRawArgs");
const emitBash = getIndexFunction("emitBash");
const echo = getIndexFunction("echo");
const execBashSync = getIndexFunction("execBashSync");

// ---- cacheInMemory / getCachedValue ----

describe("cacheInMemory", () => {
  it("should cache and return the result of the async callback", async () => {
    const key = `test-cache-${Date.now()}`;
    const result = await cacheInMemory(key, async () => "cached-value");
    expect(result).toBe("cached-value");
  });

  it("should return the cached value on subsequent calls", async () => {
    const key = `test-cache-repeat-${Date.now()}`;
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return "result";
    };
    await cacheInMemory(key, fn);
    await cacheInMemory(key, fn);
    expect(callCount).toBe(1);
  });

  it("should return fallback on error and clear cache for retry", async () => {
    const key = `test-cache-error-${Date.now()}`;
    const result = await cacheInMemory(
      key,
      async () => {
        throw new Error("fail");
      },
      "fallback-value",
    );
    expect(result).toBe("fallback-value");
  });

  it("should retry after a failed call", async () => {
    const key = `test-cache-retry-${Date.now()}`;
    let attempt = 0;
    const fn = async () => {
      attempt++;
      if (attempt === 1) throw new Error("first call fails");
      return "success-on-retry";
    };
    await cacheInMemory(key, fn, "fallback");
    const result = await cacheInMemory(key, fn, "fallback");
    expect(result).toBe("success-on-retry");
  });
});

describe("getCachedValue", () => {
  it("should return undefined for uncached key", () => {
    expect(getCachedValue(`nonexistent-key-${Date.now()}`)).toBeUndefined();
  });

  it("should return the resolved value after cacheInMemory completes", async () => {
    const key = `test-sync-cache-${Date.now()}`;
    await cacheInMemory(key, async () => "sync-value");
    expect(getCachedValue(key)).toBe("sync-value");
  });
});

// ---- consolidateHosts ----

describe("consolidateHosts", () => {
  it("should add www-prefixed variants", () => {
    const result = consolidateHosts(["example.com"]);
    expect(result).toContain("example.com");
    expect(result).toContain("www.example.com");
  });

  it("should not add www prefix if already present", () => {
    const result = consolidateHosts(["www.example.com"]);
    expect(result).toContain("www.example.com");
    // should not have www.www.example.com
    expect(result).not.toContain("www.www.example.com");
  });

  it("should lowercase all hosts", () => {
    const result = consolidateHosts(["Example.COM"]);
    expect(result).toContain("example.com");
    expect(result).toContain("www.example.com");
  });

  it("should deduplicate hosts", () => {
    const result = consolidateHosts(["example.com", "example.com"]);
    const count = result.filter((h) => h === "example.com").length;
    expect(count).toBe(1);
  });

  it("should handle empty array", () => {
    expect(consolidateHosts([])).toEqual([]);
  });

  it("should handle multiple hosts", () => {
    const result = consolidateHosts(["a.com", "b.org"]);
    expect(result).toContain("a.com");
    expect(result).toContain("www.a.com");
    expect(result).toContain("b.org");
    expect(result).toContain("www.b.org");
  });
});

// ---- _isDangerousPath ----

describe("_isDangerousPath", () => {
  it("should return true for root path", () => {
    expect(_isDangerousPath("/")).toBe(true);
  });

  it("should return true for system directories", () => {
    expect(_isDangerousPath("/bin")).toBe(true);
    expect(_isDangerousPath("/etc")).toBe(true);
    expect(_isDangerousPath("/usr")).toBe(true);
    expect(_isDangerousPath("/var")).toBe(true);
    expect(_isDangerousPath("/tmp")).toBe(true);
    expect(_isDangerousPath("/home")).toBe(true);
  });

  it("should return true for home directory itself", () => {
    expect(_isDangerousPath("/mock/home")).toBe(true);
  });

  it("should return false for subdirectories of home", () => {
    expect(_isDangerousPath("/mock/home/.config")).toBe(false);
  });

  it("should return true for null or empty", () => {
    expect(_isDangerousPath(null)).toBe(true);
    expect(_isDangerousPath("")).toBe(true);
    expect(_isDangerousPath(undefined)).toBe(true);
  });

  it("should return true for dot paths", () => {
    expect(_isDangerousPath(".")).toBe(true);
    expect(_isDangerousPath("..")).toBe(true);
  });

  it("should return true for shallow paths with fewer than 3 segments", () => {
    expect(_isDangerousPath("/mnt/c")).toBe(true);
  });

  it("should return false for deep enough paths", () => {
    expect(_isDangerousPath("/mnt/c/Users")).toBe(false);
  });

  it("should strip trailing slashes", () => {
    expect(_isDangerousPath("/bin/")).toBe(true);
    expect(_isDangerousPath("/mnt/c/Users/")).toBe(false);
  });
});

// ---- readList / readSet ----

describe("readList", () => {
  it("should read a file and return a list of lines", async () => {
    fetchResponses["software/scripts/list-test.txt"] = "alpha\nbeta\ncharlie";
    const result = await readList`software/scripts/list-test.txt`;
    expect(result).toEqual(["alpha", "beta", "charlie"]);
  });

  it("should filter out comment lines", async () => {
    fetchResponses["software/scripts/list-comments.txt"] = "alpha\n# comment\nbeta\n// another";
    const result = await readList`software/scripts/list-comments.txt`;
    expect(result).toEqual(["alpha", "beta"]);
  });

  it("should return empty array for missing file", async () => {
    const result = await readList`software/scripts/nonexistent-list.txt`;
    expect(result).toEqual([]);
  });
});

describe("readSet", () => {
  it("should read a file and return a deduplicated list", async () => {
    fetchResponses["software/scripts/set-test.txt"] = "alpha\nbeta\nalpha\ncharlie";
    const result = await readSet`software/scripts/set-test.txt`;
    expect(result).toEqual(["alpha", "beta", "charlie"]);
  });

  it("should filter out comment lines", async () => {
    fetchResponses["software/scripts/set-comments.txt"] = "alpha\n# comment\nbeta";
    const result = await readSet`software/scripts/set-comments.txt`;
    expect(result).toEqual(["alpha", "beta"]);
  });

  it("should return empty array for missing file", async () => {
    const result = await readSet`software/scripts/nonexistent-set.txt`;
    expect(result).toEqual([]);
  });
});

// ---- _isRefreshTarget ----

describe("_isRefreshTarget", () => {
  // Note: REFRESH_FILES is empty in the test sandbox (no --refresh= flag),
  // so _isRefreshTarget should always return false by default
  it("should return false when REFRESH_FILES is empty", () => {
    expect(_isRefreshTarget("fzf.js")).toBe(false);
    expect(_isRefreshTarget("software/scripts/fzf.js")).toBe(false);
  });
});

// ---- writeConfigToFile ----

describe("writeConfigToFile", () => {
  it("should write JSON config to basePath/fileName", async () => {
    const basePath = "/mock/home/.config";
    const fileName = "settings.json";
    const data = { editor: "vim", tabSize: 2 };
    await writeConfigToFile(basePath, fileName, data);
    const result = JSON.parse(fileSystem[`${basePath}/${fileName}`]);
    expect(result.editor).toBe("vim");
    expect(result.tabSize).toBe(2);
  });

  it("should write plain text when isJson is false", async () => {
    const basePath = "/mock/home/.config";
    const fileName = "rc.conf";
    await writeConfigToFile(basePath, fileName, "some text content", false);
    expect(fileSystem[`${basePath}/${fileName}`]).toBe("some text content");
  });
});

// ---- echo / emitBash ----

describe("echo", () => {
  it("should not throw", () => {
    expect(() => echo("test message")).not.toThrow();
  });

  it("should not throw with multiple args", () => {
    expect(() => echo("hello", "world")).not.toThrow();
  });
});

describe("emitBash", () => {
  it("should not throw", () => {
    expect(() => emitBash("echo hello")).not.toThrow();
  });
});

// ---- execBashSync ----

describe("execBashSync", () => {
  it("should not throw when executing a command", () => {
    expect(() => execBashSync("echo hello")).not.toThrow();
  });
});

// ---- isBashSyleStale ----

describe("isBashSyleStale", () => {
  it("should return true when BASH_SYLE_PATH does not exist", () => {
    // BASH_SYLE_PATH = /mock/home/.bash_syle — not in mockFsExistence by default
    expect(isBashSyleStale()).toBe(true);
  });

  it("should return false when BASH_SYLE_PATH exists and is recent", () => {
    mockFsExistence["/mock/home/.bash_syle"] = { type: "file", mtimeMs: Date.now() - 1000 };
    expect(isBashSyleStale()).toBe(false);
  });

  it("should return true when BASH_SYLE_PATH is older than 2 weeks", () => {
    const threeWeeksAgo = Date.now() - 1209600 * 1000 - 1000;
    mockFsExistence["/mock/home/.bash_syle"] = { type: "file", mtimeMs: threeWeeksAgo };
    expect(isBashSyleStale()).toBe(true);
  });
});
