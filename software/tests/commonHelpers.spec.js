/** Tests for shared helpers in *.common.js files (autocomplete.common.js, editor.common.js). */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { getIndexFunction } from "./setup.js";

const clone = getIndexFunction("clone");

// ---- Load autocomplete.common.js functions ----
const autocompleteSource = fs.readFileSync("software/metadata/autocomplete.common.js", "utf-8");
const autocompleteSandbox = {};
vm.runInNewContext(autocompleteSource.replace(/^(const|let) /gm, "var "), autocompleteSandbox);
const { dedupeSpecLines, SPEC_COMMANDS, _resolveSpecFile } = autocompleteSandbox;

// ---- Load editor.common.js functions ----
const editorSource = fs.readFileSync("software/scripts/advanced/editor.common.js", "utf-8");

/** Evaluates editor.common.js with mocked globals. */
function loadEditorCommon(overrides = {}) {
  const sandbox = {
    is_os_mac: false,
    is_os_windows: false,
    is_gui: 1,
    clone,
    process: { env: { HOME: "/mock/home" } },
    fs: { existsSync: () => false },
    path: { join: (...args) => args.join("/"), resolve: (p) => p },
    findPath: () => null,
    log: () => {},
    getWindowAppDataRoamingUserPath: () => null,
    getOsxApplicationSupportCodeUserPath: () => "/mock/home/Library/Application Support",
    BASE_HOMEDIR_LINUX: "/mock/home",
    // Mirrors software/index.js: parseBoolean treats "true" (any case) and 1 as true.
    parseBoolean: (v) => String(v ?? "").toLowerCase() === "true" || Number.parseInt(v, 10) === 1,
    getRuntimeOption: (_key, parser) => (parser ? parser("") : ""),
    ...overrides,
  };
  vm.runInNewContext(editorSource.replace(/^(const|let) /gm, "var "), sandbox);
  return sandbox;
}

// ---- dedupeSpecLines ----

describe("dedupeSpecLines", () => {
  it("should dedupe lines with the same prefix, keeping the longer one", () => {
    const result = dedupeSpecLines(["foo|--a", "foo|--a,--b,--c"]);
    expect(result).toBe("foo|--a,--b,--c\n");
  });

  it("should sort output alphabetically by prefix", () => {
    const result = dedupeSpecLines(["zebra|--z", "alpha|--a", "middle|--m"]);
    expect(result).toBe("alpha|--a\nmiddle|--m\nzebra|--z\n");
  });

  it("should skip empty lines", () => {
    const result = dedupeSpecLines(["foo|--a", "", "  ", "bar|--b"]);
    expect(result).toBe("bar|--b\nfoo|--a\n");
  });

  it("should handle lines without pipe separator", () => {
    const result = dedupeSpecLines(["standalone"]);
    expect(result).toBe("standalone\n");
  });

  it("should handle empty input", () => {
    const result = dedupeSpecLines([]);
    expect(result).toBe("\n");
  });

  it("should keep first occurrence when lines are same length", () => {
    const result = dedupeSpecLines(["foo|--a", "foo|--b"]);
    // same prefix "foo", same length — first one stays (no replacement since not longer)
    expect(result).toBe("foo|--a\n");
  });
});

// ---- _resolveSpecFile ----

describe("_resolveSpecFile", () => {
  it("should return specFile directly when present", () => {
    const entry = { command: "git", specFile: "software/metadata/autocomplete-complete-spec/git" };
    expect(_resolveSpecFile(entry)).toBe("software/metadata/autocomplete-complete-spec/git");
  });

  it("should resolve specCommand proxy to target's specFile", () => {
    const entry = SPEC_COMMANDS.find((e) => e.specCommand);
    if (entry) {
      const resolved = _resolveSpecFile(entry);
      expect(resolved).toBeTruthy();
      expect(resolved).toContain("software/metadata/autocomplete-complete-spec/");
    }
  });

  it("should return undefined for non-existent specCommand target", () => {
    const result = _resolveSpecFile({ command: "fake", specCommand: "nonexistent_command_xyz" });
    expect(result).toBeUndefined();
  });

  it("should return undefined when neither specFile nor specCommand is set", () => {
    const result = _resolveSpecFile({ command: "bare" });
    expect(result).toBeUndefined();
  });
});

// ---- getEditorOsKey ----

describe("getEditorOsKey", () => {
  it("should return 'alt' on non-mac (Windows/Linux)", () => {
    const editor = loadEditorCommon({ is_os_mac: false });
    expect(editor.getEditorOsKey("sublime")).toBe("alt");
  });

  it("should return 'super' for sublime on mac", () => {
    const editor = loadEditorCommon({ is_os_mac: true });
    expect(editor.getEditorOsKey("sublime")).toBe("super");
  });

  it("should return 'cmd' for zed on mac", () => {
    const editor = loadEditorCommon({ is_os_mac: true });
    expect(editor.getEditorOsKey("zed")).toBe("cmd");
  });

  it("should fall back to 'super' for unknown editor on mac", () => {
    const editor = loadEditorCommon({ is_os_mac: true });
    expect(editor.getEditorOsKey("unknown_editor")).toBe("super");
  });

  it("should respect explicit isOsMac override", () => {
    const editor = loadEditorCommon({ is_os_mac: false });
    // Pass true as second arg to override the global
    expect(editor.getEditorOsKey("sublime", true)).toBe("super");
  });
});

// ---- formatEditorKeybindings ----

describe("formatEditorKeybindings", () => {
  it("should replace OS_KEY in keys array", () => {
    const input = [{ keys: ["OS_KEY+k"] }];
    const editor = loadEditorCommon();
    const result = editor.formatEditorKeybindings(input, "alt");
    expect(result[0].keys).toEqual(["alt+k"]);
  });

  it("should merge key into keys and remove key property", () => {
    const input = [{ key: "OS_KEY+s" }];
    const editor = loadEditorCommon();
    const result = editor.formatEditorKeybindings(input, "super");
    expect(result[0].keys).toEqual(["super+s"]);
    expect(result[0].key).toBeUndefined();
  });

  it("should handle both key and keys on the same binding", () => {
    const input = [{ key: "OS_KEY+a", keys: ["OS_KEY+b"] }];
    const editor = loadEditorCommon();
    const result = editor.formatEditorKeybindings(input, "cmd");
    expect(result[0].keys).toEqual(["cmd+b", "cmd+a"]);
  });

  it("should not mutate the original input", () => {
    const input = [{ keys: ["OS_KEY+x"] }];
    const editor = loadEditorCommon();
    editor.formatEditorKeybindings(input, "alt");
    expect(input[0].keys).toEqual(["OS_KEY+x"]);
  });

  it("should handle keybinding with no OS_KEY placeholder", () => {
    const input = [{ keys: ["ctrl+c"] }];
    const editor = loadEditorCommon();
    const result = editor.formatEditorKeybindings(input, "alt");
    expect(result[0].keys).toEqual(["ctrl+c"]);
  });
});

// ---- editor color scheme constants ----

describe("editor color scheme constants", () => {
  it("should have all Sublime color scheme constants defined", () => {
    const editor = loadEditorCommon();
    expect(editor.SUBLIME_DARK_COLOR_SCHEME).toBeTruthy();
    expect(editor.SUBLIME_LIGHT_COLOR_SCHEME).toBeTruthy();
    expect(editor.SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME).toBeTruthy();
    expect(editor.SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME).toBeTruthy();
  });

  it("should have all VS Code color theme constants defined", () => {
    const editor = loadEditorCommon();
    expect(editor.VSCODE_DARK_COLOR_THEME).toBeTruthy();
    expect(editor.VSCODE_LIGHT_COLOR_THEME).toBeTruthy();
  });

  it("should have all Zed color scheme constants defined", () => {
    const editor = loadEditorCommon();
    expect(editor.ZED_DARK_COLOR_SCHEME).toBeTruthy();
    expect(editor.ZED_LIGHT_COLOR_SCHEME).toBeTruthy();
    expect(editor.ZED_DARK_HIGH_CONTRAST_COLOR_SCHEME).toBeTruthy();
    expect(editor.ZED_LIGHT_HIGH_CONTRAST_COLOR_SCHEME).toBeTruthy();
  });

  it("should have editor path arrays as non-empty arrays", () => {
    const editor = loadEditorCommon();
    expect(editor._ZED_PATHS.length).toBeGreaterThan(0);
    expect(editor._SUBL_PATHS.length).toBeGreaterThan(0);
    expect(editor._SMERGE_PATHS.length).toBeGreaterThan(0);
    expect(editor._CODE_PATHS.length).toBeGreaterThan(0);
  });
});

// ---- shouldInstallCustomTheme ----

describe("shouldInstallCustomTheme", () => {
  /**
   * Builds a `getRuntimeOption` stub that returns `value` for the opt-out key only,
   * so the test exercises the same parse path the real helper uses.
   * @param {string} value - Raw value the runtime option should report.
   * @returns {Function} Stub matching getRuntimeOption's (key, parser) signature.
   */
  const runtimeOption = (value) => (key, parser) => (key === "IS_CUSTOM_THEME_DISABLED" ? parser(value) : parser(""));

  it("should be true with a GUI and no opt-out", () => {
    const editor = loadEditorCommon({ is_gui: 1 });
    expect(editor.shouldInstallCustomTheme()).toBe(true);
  });

  it("should be false without a GUI", () => {
    const editor = loadEditorCommon({ is_gui: 0 });
    expect(editor.shouldInstallCustomTheme()).toBe(false);
  });

  // A headless box has no editor or terminal UI to theme, so the GUI half of the gate
  // must win regardless of the opt-out's value.
  it("should be false without a GUI even when the opt-out is unset", () => {
    const editor = loadEditorCommon({ is_gui: 0, getRuntimeOption: runtimeOption("") });
    expect(editor.shouldInstallCustomTheme()).toBe(false);
  });

  for (const value of ["true", "TRUE", "True", "1", 1]) {
    it(`should be false when the opt-out is ${JSON.stringify(value)}`, () => {
      const editor = loadEditorCommon({ is_gui: 1, getRuntimeOption: runtimeOption(value) });
      expect(editor.shouldInstallCustomTheme()).toBe(false);
    });
  }

  for (const value of ["", "false", "0", "no"]) {
    it(`should stay true when the opt-out is ${JSON.stringify(value)}`, () => {
      const editor = loadEditorCommon({ is_gui: 1, getRuntimeOption: runtimeOption(value) });
      expect(editor.shouldInstallCustomTheme()).toBe(true);
    });
  }

  // Reading the option lazily is what keeps editor.common.js importable in contexts that
  // never define getRuntimeOption, and what makes the flag reflect the flags this run got.
  it("should read the runtime option on every call, not once at import", () => {
    const seen = [];
    const editor = loadEditorCommon({
      is_gui: 1,
      getRuntimeOption: (key, parser) => {
        seen.push(key);
        return parser("");
      },
    });
    expect(seen).toEqual([]);
    editor.shouldInstallCustomTheme();
    editor.shouldInstallCustomTheme();
    expect(seen).toEqual(["IS_CUSTOM_THEME_DISABLED", "IS_CUSTOM_THEME_DISABLED"]);
  });
});

// ---- APP_TO_THEMES_MAP / getTheme ----

describe("getTheme", () => {
  it("should return a dark and light theme for every registered app", () => {
    const editor = loadEditorCommon();
    const apps = Object.keys(editor.APP_TO_THEMES_MAP);
    expect(apps.length).toBeGreaterThan(0);

    for (const app of apps) {
      const { dark, light } = editor.getTheme(app);
      expect(dark, `${app} dark`).toBeTruthy();
      expect(light, `${app} light`).toBeTruthy();
      expect(typeof dark, `${app} dark`).toBe("string");
      expect(typeof light, `${app} light`).toBe("string");
    }
  });

  // The single-entry form exists so an app with no separate light scheme (vim) does not
  // have to be padded with a worse second pick.
  it("should reuse the only entry for both modes when one theme is listed", () => {
    const editor = loadEditorCommon();
    const single = Object.entries(editor.APP_TO_THEMES_MAP).find(([, themes]) => themes.length === 1);
    expect(single, "expected at least one single-entry app to exercise normalization").toBeTruthy();

    const [app, themes] = single;
    expect(editor.getTheme(app)).toEqual({ dark: themes[0], light: themes[0] });
  });

  it("should keep dark first and light second for two-entry apps", () => {
    const editor = loadEditorCommon();
    for (const [app, themes] of Object.entries(editor.APP_TO_THEMES_MAP)) {
      if (themes.length < 2) continue;
      expect(editor.getTheme(app), app).toEqual({ dark: themes[0], light: themes[1] });
    }
  });

  it("should throw on an unknown app rather than return an undefined theme name", () => {
    const editor = loadEditorCommon();
    expect(() => editor.getTheme("emacs")).toThrow(/No fallback theme registered for "emacs"/);
  });

  it("should throw when an app is registered with no themes", () => {
    const editor = loadEditorCommon();
    editor.APP_TO_THEMES_MAP.broken = [];
    expect(() => editor.getTheme("broken")).toThrow(/No fallback theme registered/);
  });

  // The fallback exists precisely so it works on a stock install; a value here that needs a
  // download would strand the machine with a theme name nothing resolves.
  it("should feed the fallback color scheme constants", () => {
    const editor = loadEditorCommon();
    expect(editor.SUBLIME_DARK_COLOR_SCHEME).toBe(editor.APP_TO_THEMES_MAP.sublime[0]);
    expect(editor.SUBLIME_LIGHT_COLOR_SCHEME).toBe(editor.APP_TO_THEMES_MAP.sublime[1]);
    expect(editor.VSCODE_DARK_COLOR_THEME).toBe(editor.APP_TO_THEMES_MAP.vscode[0]);
    expect(editor.VSCODE_LIGHT_COLOR_THEME).toBe(editor.APP_TO_THEMES_MAP.vscode[1]);
    expect(editor.ZED_DARK_COLOR_SCHEME).toBe(editor.APP_TO_THEMES_MAP.zed[0]);
    expect(editor.ZED_LIGHT_COLOR_SCHEME).toBe(editor.APP_TO_THEMES_MAP.zed[1]);
  });

  // Sublime resolves `color_scheme` by filename, so a bare theme name silently does nothing.
  it("should name Sublime schemes with their file extension", () => {
    const editor = loadEditorCommon();
    for (const theme of editor.APP_TO_THEMES_MAP.sublime) {
      expect(theme).toMatch(/\.sublime-color-scheme$/);
    }
  });
});

// ---- shouldInstallCustomTheme ----

describe("shouldInstallCustomTheme", () => {
  /**
   * Builds a `getRuntimeOption` stub that returns `value` for the opt-out key only,
   * so the test exercises the same parse path the real helper uses.
   * @param {string} value - Raw value the runtime option should report.
   * @returns {Function} Stub matching getRuntimeOption's (key, parser) signature.
   */
  const runtimeOption = (value) => (key, parser) => (key === "IS_CUSTOM_THEME_DISABLED" ? parser(value) : parser(""));

  it("should be true with a GUI and no opt-out", () => {
    const editor = loadEditorCommon({ is_gui: 1 });
    expect(editor.shouldInstallCustomTheme()).toBe(true);
  });

  it("should be false without a GUI", () => {
    const editor = loadEditorCommon({ is_gui: 0 });
    expect(editor.shouldInstallCustomTheme()).toBe(false);
  });

  // A headless box has no editor or terminal UI to theme, so the GUI half of the gate
  // must win regardless of the opt-out's value.
  it("should be false without a GUI even when the opt-out is unset", () => {
    const editor = loadEditorCommon({ is_gui: 0, getRuntimeOption: runtimeOption("") });
    expect(editor.shouldInstallCustomTheme()).toBe(false);
  });

  for (const value of ["true", "TRUE", "True", "1", 1]) {
    it(`should be false when the opt-out is ${JSON.stringify(value)}`, () => {
      const editor = loadEditorCommon({ is_gui: 1, getRuntimeOption: runtimeOption(value) });
      expect(editor.shouldInstallCustomTheme()).toBe(false);
    });
  }

  for (const value of ["", "false", "0", "no"]) {
    it(`should stay true when the opt-out is ${JSON.stringify(value)}`, () => {
      const editor = loadEditorCommon({ is_gui: 1, getRuntimeOption: runtimeOption(value) });
      expect(editor.shouldInstallCustomTheme()).toBe(true);
    });
  }

  // Reading the option lazily is what keeps editor.common.js importable in contexts that
  // never define getRuntimeOption, and what makes the flag reflect the flags this run got.
  it("should read the runtime option on every call, not once at import", () => {
    const seen = [];
    const editor = loadEditorCommon({
      is_gui: 1,
      getRuntimeOption: (key, parser) => {
        seen.push(key);
        return parser("");
      },
    });
    expect(seen).toEqual([]);
    editor.shouldInstallCustomTheme();
    editor.shouldInstallCustomTheme();
    expect(seen).toEqual(["IS_CUSTOM_THEME_DISABLED", "IS_CUSTOM_THEME_DISABLED"]);
  });
});

// ---- APP_TO_THEMES_MAP / getTheme ----

describe("getTheme", () => {
  it("should return a dark and light theme for every registered app", () => {
    const editor = loadEditorCommon();
    const apps = Object.keys(editor.APP_TO_THEMES_MAP);
    expect(apps.length).toBeGreaterThan(0);

    for (const app of apps) {
      const { dark, light } = editor.getTheme(app);
      expect(dark, `${app} dark`).toBeTruthy();
      expect(light, `${app} light`).toBeTruthy();
      expect(typeof dark, `${app} dark`).toBe("string");
      expect(typeof light, `${app} light`).toBe("string");
    }
  });

  // The single-entry form exists so an app with no separate light scheme (vim) does not
  // have to be padded with a worse second pick.
  it("should reuse the only entry for both modes when one theme is listed", () => {
    const editor = loadEditorCommon();
    const single = Object.entries(editor.APP_TO_THEMES_MAP).find(([, themes]) => themes.length === 1);
    expect(single, "expected at least one single-entry app to exercise normalization").toBeTruthy();

    const [app, themes] = single;
    expect(editor.getTheme(app)).toEqual({ dark: themes[0], light: themes[0] });
  });

  it("should keep dark first and light second for two-entry apps", () => {
    const editor = loadEditorCommon();
    for (const [app, themes] of Object.entries(editor.APP_TO_THEMES_MAP)) {
      if (themes.length < 2) continue;
      expect(editor.getTheme(app), app).toEqual({ dark: themes[0], light: themes[1] });
    }
  });

  it("should throw on an unknown app rather than return an undefined theme name", () => {
    const editor = loadEditorCommon();
    expect(() => editor.getTheme("emacs")).toThrow(/No fallback theme registered for "emacs"/);
  });

  it("should throw when an app is registered with no themes", () => {
    const editor = loadEditorCommon();
    editor.APP_TO_THEMES_MAP.broken = [];
    expect(() => editor.getTheme("broken")).toThrow(/No fallback theme registered/);
  });

  // The fallback exists precisely so it works on a stock install; a value here that needs a
  // download would strand the machine with a theme name nothing resolves.
  it("should feed the fallback color scheme constants", () => {
    const editor = loadEditorCommon();
    expect(editor.SUBLIME_DARK_COLOR_SCHEME).toBe(editor.APP_TO_THEMES_MAP.sublime[0]);
    expect(editor.SUBLIME_LIGHT_COLOR_SCHEME).toBe(editor.APP_TO_THEMES_MAP.sublime[1]);
    expect(editor.VSCODE_DARK_COLOR_THEME).toBe(editor.APP_TO_THEMES_MAP.vscode[0]);
    expect(editor.VSCODE_LIGHT_COLOR_THEME).toBe(editor.APP_TO_THEMES_MAP.vscode[1]);
    expect(editor.ZED_DARK_COLOR_SCHEME).toBe(editor.APP_TO_THEMES_MAP.zed[0]);
    expect(editor.ZED_LIGHT_COLOR_SCHEME).toBe(editor.APP_TO_THEMES_MAP.zed[1]);
  });

  // Sublime resolves `color_scheme` by filename, so a bare theme name silently does nothing.
  it("should name Sublime schemes with their file extension", () => {
    const editor = loadEditorCommon();
    for (const theme of editor.APP_TO_THEMES_MAP.sublime) {
      expect(theme).toMatch(/\.sublime-color-scheme$/);
    }
  });
});

// ---- _getVSCodePaths ----

/**
 * Loads editor.common.js with a real `findPath` implementation backed by
 * mocked directory entries, so regex matching is exercised end-to-end.
 * Returns the sandbox plus a helper to seed `<dir>` -> entry-name mappings.
 * @param {Record<string, string[]>} dirs - Map of directory path -> list of entry names (all treated as folders).
 * @param {object} [overrides] - Sandbox overrides forwarded to loadEditorCommon.
 * @returns {object} Sandbox with editor.common.js loaded.
 */
function loadEditorCommonWithDirs(dirs, overrides = {}) {
  // Treat both the parent dirs and every child entry as existing (folders).
  const existing = new Set(Object.keys(dirs));
  for (const [parent, names] of Object.entries(dirs)) {
    for (const name of names) {
      existing.add(path.posix.join(parent, name));
    }
  }
  const mockFs = {
    existsSync: (p) => existing.has(p),
    readdirSync: (p, opts) => {
      const names = dirs[p] || [];
      // Mimic `withFileTypes: true` — every entry is a folder for these tests.
      if (opts && opts.withFileTypes) {
        return names.map((name) => ({ name, isDirectory: () => true, isFile: () => false }));
      }
      return names;
    },
  };
  // Real findPath uses fs.readdirSync with withFileTypes; replicate the matcher logic.
  const realFindPath = (srcDir, targetMatch, options = {}) => {
    const { type = "any" } = options;
    const matcher = typeof targetMatch === "string" ? (n) => n === targetMatch : (n) => n.match(targetMatch);
    let entries;
    try {
      entries = mockFs.readdirSync(srcDir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (matcher(entry.name)) {
        if (type === "any" || (type === "folder" && entry.isDirectory()) || (type === "file" && entry.isFile())) {
          return path.posix.join(srcDir, entry.name);
        }
      }
    }
    return null;
  };
  return loadEditorCommon({
    fs: mockFs,
    path: path.posix,
    findPath: realFindPath,
    ...overrides,
  });
}

describe("_getVSCodePaths", () => {
  it("should not match opencode/ when scanning ~/.config (regression for /Code/i substring match)", () => {
    // Prior bug: /Code/i substring-matched the unrelated `opencode` directory created by
    // the opencode CLI, causing VS Code setup to write settings.json into ~/.config/opencode/User
    // and crash the script. The fix anchors the regex to /^Code( - Insiders)?$/i.
    const editor = loadEditorCommonWithDirs({
      "/mock/home/.config": ["opencode", "starship.toml", "Greenshot"],
    });
    expect(editor._getVSCodePaths()).toEqual([]);
  });

  it("should find Code in ~/.config (Linux)", () => {
    const editor = loadEditorCommonWithDirs({
      "/mock/home/.config": ["Code", "opencode"],
    });
    expect(editor._getVSCodePaths()).toEqual(["/mock/home/.config/Code"]);
  });

  it("should find Code - Insiders in ~/.config (Linux Insiders build)", () => {
    const editor = loadEditorCommonWithDirs({
      "/mock/home/.config": ["Code - Insiders", "opencode"],
    });
    expect(editor._getVSCodePaths()).toEqual(["/mock/home/.config/Code - Insiders"]);
  });

  it("should find Code in macOS Library/Application Support", () => {
    const editor = loadEditorCommonWithDirs({
      "/mock/home/Library/Application Support": ["Code", "Sublime Text", "opencode"],
    });
    expect(editor._getVSCodePaths()).toEqual(["/mock/home/Library/Application Support/Code"]);
  });

  it("should not match VSCodium or other Code-suffixed/prefixed folders", () => {
    const editor = loadEditorCommonWithDirs({
      "/mock/home/.config": ["VSCodium", "QRCode", "opencode", "code-server"],
    });
    expect(editor._getVSCodePaths()).toEqual([]);
  });
});
