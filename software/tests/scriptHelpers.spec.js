/** Tests for helper functions defined in individual script files. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import vm from "vm";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const clone = getIndexFunction("clone");
const code = getIndexFunction("code");
const trimLeftSpaces = getIndexFunction("trimLeftSpaces");
const EDITOR_CONFIGS = getIndexConstant("EDITOR_CONFIGS");

/**
 * Evaluates a script file in a VM sandbox with provided globals.
 * Replaces const/let with var so assignments land on the sandbox object.
 * @param {string} filePath - Path to the .js file.
 * @param {object} globals - Globals to inject into the sandbox.
 * @returns {object} The sandbox with all top-level vars accessible as properties.
 */
function loadScript(filePath, globals = {}) {
  const source = fs.readFileSync(filePath, "utf-8");
  const sandbox = { ...globals };
  vm.runInNewContext(source.replace(/^(const|let) /gm, "var "), sandbox);
  return sandbox;
}

// ---- chromium-browser-config.js helpers ----

describe("_deepMerge (chromium-browser-config.js)", () => {
  /** Loads just the _deepMerge function. */
  function getDeepMerge() {
    // _deepMerge is a standalone pure function; extract it directly
    const source = fs.readFileSync("software/scripts/chromium-browser-config.js", "utf-8");
    const match = source.match(/function _deepMerge[\s\S]*?^}/m);
    const sandbox = {};
    vm.runInNewContext(match[0], sandbox);
    return sandbox._deepMerge;
  }

  const _deepMerge = getDeepMerge();

  it("should merge flat properties", () => {
    const target = { a: 1 };
    const result = _deepMerge(target, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("should overwrite primitive values", () => {
    const result = _deepMerge({ a: 1 }, { a: 2 });
    expect(result.a).toBe(2);
  });

  it("should deep merge nested objects", () => {
    const target = { nested: { a: 1, b: 2 } };
    const result = _deepMerge(target, { nested: { b: 3, c: 4 } });
    expect(result.nested).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("should overwrite arrays instead of merging them", () => {
    const result = _deepMerge({ arr: [1, 2] }, { arr: [3] });
    expect(result.arr).toEqual([3]);
  });

  it("should overwrite object with array", () => {
    const result = _deepMerge({ a: { x: 1 } }, { a: [1, 2] });
    expect(result.a).toEqual([1, 2]);
  });

  it("should overwrite array with object", () => {
    const result = _deepMerge({ a: [1] }, { a: { x: 1 } });
    expect(result.a).toEqual({ x: 1 });
  });

  it("should return the target object (mutates in place)", () => {
    const target = { a: 1 };
    const result = _deepMerge(target, { b: 2 });
    expect(result).toBe(target);
  });
});

// ---- chromium-browser-config.js — _inferBrowserName ----

describe("_inferBrowserName (chromium-browser-config.js)", () => {
  /** Loads just the _inferBrowserName function. */
  function getInferBrowserName() {
    const source = fs.readFileSync("software/scripts/chromium-browser-config.js", "utf-8");
    const match = source.match(/function _inferBrowserName[\s\S]*?^}/m);
    const sandbox = { path: require("path") };
    vm.runInNewContext(match[0], sandbox);
    return sandbox._inferBrowserName;
  }

  const _inferBrowserName = getInferBrowserName();

  it("should extract Brave-Browser from macOS path", () => {
    expect(_inferBrowserName("/Users/syle/Library/Application Support/BraveSoftware/Brave-Browser/Default")).toBe("Brave-Browser");
  });

  it("should extract Chrome from Linux path", () => {
    expect(_inferBrowserName("/home/syle/.config/google-chrome/Default")).toBe("google-chrome");
  });

  it("should extract Microsoft Edge from Windows path with User Data", () => {
    expect(_inferBrowserName("/mnt/c/Users/syle/AppData/Local/Microsoft/Edge/User Data/Default")).toBe("Edge");
  });

  it("should extract Chrome from macOS path", () => {
    expect(_inferBrowserName("/Users/syle/Library/Application Support/Google/Chrome/Default")).toBe("Chrome");
  });

  it("should handle trailing slash", () => {
    expect(_inferBrowserName("/Users/syle/Library/Application Support/BraveSoftware/Brave-Browser/Default/")).toBe("Brave-Browser");
  });
});

// ---- chromium-browser-config.js — _resolveBrowserOsKey ----

describe("_resolveBrowserOsKey (chromium-browser-config.js)", () => {
  /** Loads the _resolveBrowserOsKey function with a given is_os_mac flag. */
  function getResolver(isMac) {
    const source = fs.readFileSync("software/scripts/chromium-browser-config.js", "utf-8");
    const match = source.match(/function _resolveBrowserOsKey[\s\S]*?^}/m);
    const sandbox = { is_os_mac: isMac };
    vm.runInNewContext(match[0], sandbox);
    return sandbox._resolveBrowserOsKey;
  }

  it("should resolve OS_KEY to Command on macOS", () => {
    const resolve = getResolver(true);
    const result = resolve({ 34014: ["OS_KEY+KeyT"] });
    expect(result[34014]).toEqual(["Command+KeyT"]);
  });

  it("should resolve OS_KEY to Alt on Windows/Linux", () => {
    const resolve = getResolver(false);
    const result = resolve({ 34014: ["OS_KEY+KeyT"] });
    expect(result[34014]).toEqual(["Alt+KeyT"]);
  });

  it("should resolve multiple OS_KEY in one entry", () => {
    const resolve = getResolver(false);
    const result = resolve({ 33007: ["F5", "OS_KEY+Shift+KeyR"] });
    expect(result[33007]).toEqual(["F5", "Alt+Shift+KeyR"]);
  });

  it("should leave entries without OS_KEY unchanged", () => {
    const resolve = getResolver(true);
    const result = resolve({ 34030: ["F11"] });
    expect(result[34030]).toEqual(["F11"]);
  });
});

// ---- fonts.js helpers ----

describe("_getFontDisplayName (fonts.js)", () => {
  const sb = loadScript("software/scripts/fonts.js", {
    log: () => {},
    trimLeftSpaces,
    code,
    fs: { existsSync: () => false },
    path: require("path"),
    BASE_HOMEDIR_LINUX: "/mock",
    is_os_mac: false,
    is_os_windows: false,
    FONTS_DOWNLOAD_URLS: [],
    isForceRefreshStale: () => false,
    deleteFolder: async () => {},
    downloadFile: async () => {},
    writeBuildArtifact: () => {},
  });
  const _getFontDisplayName = sb._getFontDisplayName;

  it("should convert hyphenated filenames to display names", () => {
    expect(_getFontDisplayName("FiraCode-Regular.ttf")).toBe("Fira Code Regular");
  });

  it("should convert underscores to spaces", () => {
    expect(_getFontDisplayName("Hack_Bold.otf")).toBe("Hack Bold");
  });

  it("should split camelCase", () => {
    expect(_getFontDisplayName("JetBrainsMono.ttf")).toBe("Jet Brains Mono");
  });

  it("should handle consecutive uppercase letters", () => {
    expect(_getFontDisplayName("IBMPlexMono.ttf")).toBe("IBM Plex Mono");
  });

  it("should strip .ttf and .otf extensions", () => {
    expect(_getFontDisplayName("Font.ttf")).toBe("Font");
    expect(_getFontDisplayName("Font.otf")).toBe("Font");
  });
});

// ---- git.js helpers ----

describe("_extractEmail (git.js)", () => {
  const sb = loadScript("software/scripts/git.js", {
    log: () => {},
    code,
    set: (strings, ...vals) => strings.reduce((r, s, i) => r + s + (vals[i] || ""), ""),
    json: (strings, ...vals) => JSON.stringify(strings.reduce((r, s, i) => r + s + (vals[i] || ""), "")),
    list: (strings, ...vals) => strings.reduce((r, s, i) => r + s + (vals[i] || ""), ""),
    readText: async () => "",
    fs: { existsSync: () => false, readFileSync: () => "" },
    path: require("path"),
    BASE_HOMEDIR_LINUX: "/mock",
    EDITOR_CONFIGS: EDITOR_CONFIGS,
    is_os_mac: false,
    is_os_windows: false,
    is_os_mingw64: false,
    execBash: async () => "",
    writeFile: () => {},
    writeBuildArtifact: () => {},
    registerWithBashSyleProfile: () => {},
  });
  const _extractEmail = sb._extractEmail;

  it("should extract email line from git config", () => {
    const config = "[user]\n\tname = Test\n\temail = test@example.com\n";
    expect(_extractEmail(config)).toBe("email = test@example.com");
  });

  it("should return empty string for config without email", () => {
    expect(_extractEmail("[user]\n\tname = Test\n")).toBe("");
  });

  it("should return empty string for empty config", () => {
    expect(_extractEmail("")).toBe("");
  });

  it("should handle email with spaces around equals", () => {
    const config = "email  =  user@domain.org";
    expect(_extractEmail(config)).toBe("email  =  user@domain.org");
  });
});

// ---- sublime-text.js helpers ----

describe("_convertIgnoredFilesAndFoldersForSublimeText (sublime-text.js)", () => {
  // This is a pure function; extract it directly
  function getConverter() {
    const source = fs.readFileSync("software/scripts/advanced/sublime-text.js", "utf-8");
    const match = source.match(/function _convertIgnoredFilesAndFoldersForSublimeText[\s\S]*?^}/m);
    const sandbox = {};
    vm.runInNewContext(match[0], sandbox);
    return sandbox._convertIgnoredFilesAndFoldersForSublimeText;
  }

  const convert = getConverter();

  it("should strip **/ prefix from VS Code globs", () => {
    expect(convert(["**/node_modules", "**/.git"])).toEqual(["node_modules", ".git"]);
  });

  it("should leave patterns without **/ prefix unchanged", () => {
    expect(convert(["*.pyc", ".DS_Store"])).toEqual(["*.pyc", ".DS_Store"]);
  });

  it("should handle empty array", () => {
    expect(convert([])).toEqual([]);
  });

  it("should handle undefined input", () => {
    expect(convert()).toEqual([]);
  });

  it("should handle mixed patterns", () => {
    expect(convert(["**/dist", "coverage", "**/__pycache__"])).toEqual(["dist", "coverage", "__pycache__"]);
  });
});

describe("_formatMouseKey (sublime-text.js)", () => {
  // Needs clone from index.js
  function getFormatMouseKey() {
    const source = fs.readFileSync("software/scripts/advanced/sublime-text.js", "utf-8");
    const match = source.match(/function _formatMouseKey[\s\S]*?^}/m);
    const sandbox = { clone };
    vm.runInNewContext(match[0], sandbox);
    return sandbox._formatMouseKey;
  }

  const _formatMouseKey = getFormatMouseKey();

  it("should replace OS_KEY in modifiers array", () => {
    const input = [{ modifiers: ["OS_KEY", "shift"] }];
    const result = _formatMouseKey(input, "alt");
    expect(result[0].modifiers).toEqual(["alt", "shift"]);
  });

  it("should not mutate the original input", () => {
    const input = [{ modifiers: ["OS_KEY"] }];
    _formatMouseKey(input, "super");
    expect(input[0].modifiers).toEqual(["OS_KEY"]);
  });

  it("should handle entries without modifiers", () => {
    const input = [{ button: "button1" }];
    const result = _formatMouseKey(input, "alt");
    expect(result[0].modifiers).toBeUndefined();
  });
});

// ---- ~cleanup.js helpers ----

describe("_getPrimaryOsName (~cleanup.js)", () => {
  it("should return the highest-priority active OS", () => {
    // Simulate OS_SCRIPT_PATHS with mac active
    const source = fs.readFileSync("software/scripts/~cleanup.js", "utf-8");
    const sandbox = {
      log: () => {},
      fs: { existsSync: () => false, readFileSync: () => "", writeFileSync: () => {} },
      path: require("path"),
      BASH_SYLE_PATH: "/mock/.bash_syle",
      BASE_HOMEDIR_LINUX: "/mock",
      replaceBlock: (c) => c,
      writeBuildArtifact: () => {},
      IS_DRY_RUN: false,
      writeFile: () => {},
      OS_SCRIPT_PATHS: [
        [true, "software/scripts/mac"],
        [false, "software/scripts/ubuntu"],
      ],
    };
    vm.runInNewContext(source.replace(/^(const|let) /gm, "var "), sandbox);
    expect(sandbox._getPrimaryOsName()).toBe("mac");
  });

  it("should return null when no OS is active", () => {
    const source = fs.readFileSync("software/scripts/~cleanup.js", "utf-8");
    const sandbox = {
      log: () => {},
      fs: { existsSync: () => false, readFileSync: () => "", writeFileSync: () => {} },
      path: require("path"),
      BASH_SYLE_PATH: "/mock/.bash_syle",
      BASE_HOMEDIR_LINUX: "/mock",
      replaceBlock: (c) => c,
      writeBuildArtifact: () => {},
      IS_DRY_RUN: false,
      writeFile: () => {},
      OS_SCRIPT_PATHS: [
        [false, "software/scripts/mac"],
        [false, "software/scripts/ubuntu"],
      ],
    };
    vm.runInNewContext(source.replace(/^(const|let) /gm, "var "), sandbox);
    expect(sandbox._getPrimaryOsName()).toBe(null);
  });

  it("should respect priority order (mac before ubuntu)", () => {
    const source = fs.readFileSync("software/scripts/~cleanup.js", "utf-8");
    const sandbox = {
      log: () => {},
      fs: { existsSync: () => false, readFileSync: () => "", writeFileSync: () => {} },
      path: require("path"),
      BASH_SYLE_PATH: "/mock/.bash_syle",
      BASE_HOMEDIR_LINUX: "/mock",
      replaceBlock: (c) => c,
      writeBuildArtifact: () => {},
      IS_DRY_RUN: false,
      writeFile: () => {},
      OS_SCRIPT_PATHS: [
        [true, "software/scripts/ubuntu"],
        [true, "software/scripts/mac"],
      ],
    };
    vm.runInNewContext(source.replace(/^(const|let) /gm, "var "), sandbox);
    // mac should win since _OS_PRIORITY lists it before ubuntu
    expect(sandbox._getPrimaryOsName()).toBe("mac");
  });
});
