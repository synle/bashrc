import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const getRuntimeOption = getIndexFunction("getRuntimeOption");
const parseString = getIndexFunction("parseString");
const parseBoolean = getIndexFunction("parseBoolean");
const parseInteger = getIndexFunction("parseInteger");
const color = getIndexFunction("color");
const emitBash = getIndexFunction("emitBash");
const clone = getIndexFunction("clone");

// Constants
const REPO_PREFIX_URL = getIndexConstant("REPO_PREFIX_URL");
const TEMP_SCRIPT_PREFIX = getIndexConstant("TEMP_SCRIPT_PREFIX");
const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");
const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");
const LINE_BREAK_COUNT = getIndexConstant("LINE_BREAK_COUNT");
const LINE_BREAK_HASH = getIndexConstant("LINE_BREAK_HASH");
const LINE_BREAK_SLASH = getIndexConstant("LINE_BREAK_SLASH");
const LINE_BREAK_EQUAL = getIndexConstant("LINE_BREAK_EQUAL");
const BASH_SYLE_PATH = getIndexConstant("BASH_SYLE_PATH");
const IS_LOCAL_REPO = getIndexConstant("IS_LOCAL_REPO");
const fontFamily = getIndexConstant("fontFamily");
const fontSize = getIndexConstant("fontSize");
const tabSize = getIndexConstant("tabSize");
const EDITOR_CONFIGS = getIndexConstant("EDITOR_CONFIGS");
const LIMITED_SUPPORT_OSES = getIndexConstant("LIMITED_SUPPORT_OSES");
const POWERSHELL_SYLE_PATH = getIndexConstant("POWERSHELL_SYLE_PATH");
const CURRENT_USER = getIndexConstant("CURRENT_USER");
const DEFAULT_FONT_SIZE = getIndexConstant("DEFAULT_FONT_SIZE");
const NODE_JS_VERSION = getIndexConstant("NODE_JS_VERSION");
const PRINT_WIDTH_BREAK_COUNT = getIndexConstant("PRINT_WIDTH_BREAK_COUNT");
const IS_FORCE_REFRESH = getIndexConstant("IS_FORCE_REFRESH");
const IS_LIGHTWEIGHT_PROFILE_ENABLED = getIndexConstant("IS_LIGHTWEIGHT_PROFILE_ENABLED");
const IS_DEBUG = getIndexConstant("IS_DEBUG");
const IS_SETUP = getIndexConstant("IS_SETUP");
const IS_DRY_RUN = getIndexConstant("IS_DRY_RUN");
const IS_REMOVE_MODE = getIndexConstant("IS_REMOVE_MODE");
const OS_SCRIPT_PATHS = getIndexConstant("OS_SCRIPT_PATHS");

describe("getRuntimeOption", () => {
  it("should read from process.env", () => {
    const result = getRuntimeOption("REPO_BRANCH_NAME", parseString);
    expect(result).toBe("master");
  });

  it("should return parsed boolean from env", () => {
    const result = getRuntimeOption("NONEXISTENT_BOOL", parseBoolean);
    expect(result).toBe(false);
  });

  it("should return parsed integer from env", () => {
    const result = getRuntimeOption("LINE_BREAK_COUNT", parseInteger);
    expect(result).toBe(80);
  });

  it("should return empty string for missing env var with parseString", () => {
    const result = getRuntimeOption("NONEXISTENT_VAR", parseString);
    expect(result).toBe("");
  });

  it("should return false for missing env var with parseBoolean", () => {
    const result = getRuntimeOption("NONEXISTENT_VAR", parseBoolean);
    expect(result).toBe(false);
  });
});

describe("constants", () => {
  it("should have correct text block markers", () => {
    expect(TEXT_BLOCK_START_MARKER).toBe("BEGIN");
    expect(TEXT_BLOCK_END_MARKER).toBe("END");
  });

  it("should have LINE_BREAK_COUNT as a number", () => {
    expect(typeof LINE_BREAK_COUNT).toBe("number");
    expect(LINE_BREAK_COUNT).toBe(80);
  });

  it("should have LINE_BREAK_HASH as a string of # characters", () => {
    expect(LINE_BREAK_HASH).toMatch(/^#+$/);
    expect(LINE_BREAK_HASH.length).toBe(LINE_BREAK_COUNT);
  });

  it("should have LINE_BREAK_SLASH as a string of / characters", () => {
    expect(LINE_BREAK_SLASH).toMatch(/^\/+$/);
    expect(LINE_BREAK_SLASH.length).toBe(LINE_BREAK_COUNT);
  });

  it("should have LINE_BREAK_EQUAL as a string of = characters", () => {
    expect(LINE_BREAK_EQUAL).toMatch(/^=+$/);
    expect(LINE_BREAK_EQUAL.length).toBe(LINE_BREAK_COUNT);
  });

  it("should have REPO_PREFIX_URL containing github", () => {
    expect(REPO_PREFIX_URL).toContain("github");
    expect(REPO_PREFIX_URL).toContain("test/bashrc");
  });

  it("should have TEMP_SCRIPT_PREFIX starting with /tmp/", () => {
    expect(TEMP_SCRIPT_PREFIX).toContain("/tmp/");
  });

  it("should have BASH_SYLE_PATH", () => {
    expect(BASH_SYLE_PATH).toBe("/mock/home/.bash_syle");
  });

  it("should have BASE_HOMEDIR_LINUX from os.homedir() fallback when env var is not set", () => {
    const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");
    expect(BASE_HOMEDIR_LINUX).toBe("/mock/home");
  });

  it("should have IS_LOCAL_REPO as true", () => {
    expect(IS_LOCAL_REPO).toBe(true);
  });

  it("should have editor defaults", () => {
    expect(fontFamily).toBeTruthy();
    expect(fontSize).toBeGreaterThan(0);
    expect(tabSize).toBeGreaterThan(0);
  });

  it("should have EDITOR_CONFIGS with expected properties", () => {
    expect(EDITOR_CONFIGS).toBeDefined();
    expect(EDITOR_CONFIGS.fontFamily).toBeTruthy();
    expect(EDITOR_CONFIGS.fontSize).toBeGreaterThan(0);
    expect(EDITOR_CONFIGS.tabSize).toBeGreaterThan(0);
  });

  it("should have ignoredFoldersRegex as compilable regex strings with canonical entries", () => {
    expect(Array.isArray(EDITOR_CONFIGS.ignoredFoldersRegex)).toBe(true);
    expect(EDITOR_CONFIGS.ignoredFoldersRegex.length).toBeGreaterThan(20);
    for (const p of EDITOR_CONFIGS.ignoredFoldersRegex) {
      expect(typeof p).toBe("string");
      expect(() => new RegExp(p), `failed to compile: ${p}`).not.toThrow();
    }
    for (const r of ["\\.git/", "node_modules", "__pycache", "\\.next/", "\\.venv/", "/build/", "/dist/"]) {
      expect(EDITOR_CONFIGS.ignoredFoldersRegex, `missing required: ${r}`).toContain(r);
    }
  });

  it("should have ignoredFilesRegex as compilable regex strings with canonical entries", () => {
    expect(Array.isArray(EDITOR_CONFIGS.ignoredFilesRegex)).toBe(true);
    expect(EDITOR_CONFIGS.ignoredFilesRegex.length).toBeGreaterThan(10);
    for (const p of EDITOR_CONFIGS.ignoredFilesRegex) {
      expect(typeof p).toBe("string");
      expect(() => new RegExp(p), `failed to compile: ${p}`).not.toThrow();
    }
    for (const r of ["\\.DS_Store$", "Thumbs\\.db$", "\\.exe$", "\\.dll$", "\\.so$", "\\.pyc$"]) {
      expect(EDITOR_CONFIGS.ignoredFilesRegex, `missing required: ${r}`).toContain(r);
    }
  });

  it("should have textFilesRegex as compilable regex strings with canonical entries", () => {
    expect(Array.isArray(EDITOR_CONFIGS.textFilesRegex)).toBe(true);
    expect(EDITOR_CONFIGS.textFilesRegex.length).toBeGreaterThan(40);
    for (const p of EDITOR_CONFIGS.textFilesRegex) {
      expect(typeof p).toBe("string");
      expect(() => new RegExp(p), `failed to compile: ${p}`).not.toThrow();
    }
    for (const r of ["\\.js$", "\\.ts$", "\\.py$", "\\.md$", "Makefile$", "Dockerfile$", "\\.gitignore$"]) {
      expect(EDITOR_CONFIGS.textFilesRegex, `missing required: ${r}`).toContain(r);
    }
  });

  it("EDITOR_CONFIGS regex sets must match the bash-fzf.profile.bash hardcoded fallbacks (drift detector)", () => {
    // This catches silent drift: if someone changes EDITOR_CONFIGS regex but forgets to update the
    // bash-fzf fallback (or vice versa), the live and standalone-source paths diverge. Keep them in sync.
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.resolve("software/scripts/bash-fzf.profile.bash"), "utf-8");
    const extract = (varName) => {
      const m = src.match(new RegExp(`&&\\s+${varName}='([^']*)'`));
      expect(m, `${varName} not found in bash-fzf.profile.bash`).not.toBeNull();
      return JSON.parse(m[1]);
    };
    expect(extract("_IGNORED_FOLDERS_JSON")).toEqual(EDITOR_CONFIGS.ignoredFoldersRegex);
    expect(extract("_IGNORED_FILES_JSON")).toEqual(EDITOR_CONFIGS.ignoredFilesRegex);
    expect(extract("_FUZZY_TEXT_FILES_JSON")).toEqual(EDITOR_CONFIGS.textFilesRegex);
  });

  it("should have LIMITED_SUPPORT_OSES as an array", () => {
    expect(Array.isArray(LIMITED_SUPPORT_OSES)).toBe(true);
    expect(LIMITED_SUPPORT_OSES.length).toBeGreaterThan(0);
    expect(LIMITED_SUPPORT_OSES).toContain("is_os_android_termux");
  });
});

describe("color", () => {
  it("should wrap text with ANSI escape codes", () => {
    const result = color("hello", "32m");
    expect(result).toBe("\x1b[32mhello\x1b[0m");
  });

  it("should handle empty string", () => {
    const result = color("", "31m");
    expect(result).toBe("\x1b[31m\x1b[0m");
  });
});

describe("color helper via color()", () => {
  it("should produce valid ANSI green", () => {
    expect(color("ok", "32m")).toMatch(/^\x1b\[32mok\x1b\[0m$/);
  });

  it("should produce valid ANSI red", () => {
    expect(color("err", "31m")).toMatch(/^\x1b\[31merr\x1b\[0m$/);
  });

  it("should produce valid ANSI yellow", () => {
    expect(color("warn", "33m")).toMatch(/^\x1b\[33mwarn\x1b\[0m$/);
  });

  it("should produce valid ANSI dim", () => {
    expect(color("dim", "2m")).toMatch(/^\x1b\[2mdim\x1b\[0m$/);
  });

  it("should produce valid ANSI cyan", () => {
    expect(color("info", "36m")).toMatch(/^\x1b\[36minfo\x1b\[0m$/);
  });

  it("should produce valid ANSI background", () => {
    expect(color("bg", "41;97;1m")).toMatch(/^\x1b\[41;97;1mbg\x1b\[0m$/);
  });
});

describe("additional constants", () => {
  it("should have POWERSHELL_SYLE_PATH as a path string", () => {
    expect(typeof POWERSHELL_SYLE_PATH).toBe("string");
    expect(POWERSHELL_SYLE_PATH).toContain(".powershell_syle");
  });

  it("should have CURRENT_USER as a non-empty string", () => {
    expect(typeof CURRENT_USER).toBe("string");
  });

  it("should have DEFAULT_FONT_SIZE as a positive number", () => {
    expect(typeof DEFAULT_FONT_SIZE).toBe("number");
    expect(DEFAULT_FONT_SIZE).toBeGreaterThan(0);
  });

  it("should have NODE_JS_VERSION as a string", () => {
    expect(typeof NODE_JS_VERSION).toBe("string");
    expect(NODE_JS_VERSION).toBe("20");
  });

  it("should have PRINT_WIDTH_BREAK_COUNT as a positive number", () => {
    expect(typeof PRINT_WIDTH_BREAK_COUNT).toBe("number");
    expect(PRINT_WIDTH_BREAK_COUNT).toBeGreaterThan(0);
  });

  it("should have IS_FORCE_REFRESH as a boolean", () => {
    expect(typeof IS_FORCE_REFRESH).toBe("boolean");
  });

  it("should have IS_LIGHTWEIGHT_PROFILE_ENABLED as a boolean", () => {
    expect(typeof IS_LIGHTWEIGHT_PROFILE_ENABLED).toBe("boolean");
  });

  it("should have IS_DEBUG as a boolean", () => {
    expect(typeof IS_DEBUG).toBe("boolean");
  });

  it("should have IS_SETUP as a boolean", () => {
    expect(typeof IS_SETUP).toBe("boolean");
  });

  it("should have OS_SCRIPT_PATHS as an array", () => {
    expect(Array.isArray(OS_SCRIPT_PATHS)).toBe(true);
  });

  it("should have IS_DRY_RUN as a boolean", () => {
    expect(typeof IS_DRY_RUN).toBe("boolean");
  });

  it("should have IS_REMOVE_MODE as a boolean", () => {
    expect(typeof IS_REMOVE_MODE).toBe("boolean");
  });
});
