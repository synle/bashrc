/** Tests for shared helpers in *.common.js files (autocomplete.common.js, editor.common.js). */
import { describe, it, expect } from "vitest";
import fs from "fs";
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
    clone,
    process: { env: { HOME: "/mock/home" } },
    fs: { existsSync: () => false },
    path: { join: (...args) => args.join("/"), resolve: (p) => p },
    findPath: () => null,
    log: () => {},
    getWindowAppDataRoamingUserPath: () => null,
    getOsxApplicationSupportCodeUserPath: () => "/mock/home/Library/Application Support",
    BASE_HOMEDIR_LINUX: "/mock/home",
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
