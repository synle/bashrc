import { describe, it, expect } from "vitest";

import fs from "fs";

import path from "path";

import vm from "vm";

import { getIndexFunction } from "./setup.js";

const clone = getIndexFunction("clone");

const autocompleteSource = fs.readFileSync("software/metadata/autocomplete.common.js", "utf-8");

const autocompleteSandbox = {};

vm.runInNewContext(autocompleteSource.replace(/^(const|let) /gm, "var "), autocompleteSandbox);

const { dedupeSpecLines, SPEC_COMMANDS, _resolveSpecFile } = autocompleteSandbox;

const editorSource = fs.readFileSync("software/scripts/advanced/editor.common.js", "utf-8");

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
