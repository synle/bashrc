/** Tests for parseRawArgs and related CLI argument parsing. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, getSandboxProcess } from "./setup.js";

const parseRawArgs = getIndexFunction("parseRawArgs");

describe("parseRawArgs", () => {
  let proc;

  beforeEach(() => {
    proc = getSandboxProcess();
    // reset env vars that parseRawArgs sets
    delete proc.env.TEST_SCRIPT_FILES;
    delete proc.env.REFRESH_FILES;
    delete proc.env.IS_FORCE_REFRESH;
    delete proc.env.IS_SETUP;
    delete proc.env.IS_DEBUG;
    delete proc.env.IS_DRY_RUN;
    delete proc.env.IS_REMOVE_MODE;
    delete proc.env.NO_COLOR;
    delete proc.env.PRESETS_JSON;
  });

  it("should return defaults when BASHRC_RAW_ARGS is empty", () => {
    proc.env.BASHRC_RAW_ARGS = "[]";
    const result = parseRawArgs();
    expect(result.files).toBe("");
    expect(result.forceRefresh).toBe(false);
    expect(result.debug).toBe(false);
    expect(result.dryrun).toBe(false);
    expect(result.remove).toBe(false);
    expect(result.presets).toEqual([]);
    expect(result.setup).toBe(false);
  });

  it("should parse --files= flag", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--files=git.js"]);
    const result = parseRawArgs();
    expect(result.files).toBe("git.js");
    expect(proc.env.TEST_SCRIPT_FILES).toBe("git.js");
  });

  it("should parse -files= flag (single dash)", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["-files=fzf.js"]);
    const result = parseRawArgs();
    expect(result.files).toBe("fzf.js");
  });

  it("should accumulate multiple --files= flags", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--files=a.js", "--files=b.js"]);
    const result = parseRawArgs();
    expect(result.files).toBe("a.js,b.js");
  });

  it("should parse --force-refresh flag", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--force-refresh"]);
    const result = parseRawArgs();
    expect(result.forceRefresh).toBe(true);
    expect(proc.env.IS_FORCE_REFRESH).toBe("1");
  });

  it("should parse --force shorthand", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--force"]);
    const result = parseRawArgs();
    expect(result.forceRefresh).toBe(true);
  });

  it("should parse -f shorthand", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["-f"]);
    const result = parseRawArgs();
    expect(result.forceRefresh).toBe(true);
  });

  it("should parse --refresh= flag and set both files and forceRefresh", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--refresh=fzf.js,fonts.js"]);
    const result = parseRawArgs();
    expect(result.files).toBe("fzf.js,fonts.js");
    expect(result.refreshFiles).toBe("fzf.js,fonts.js");
    expect(result.forceRefresh).toBe(true);
    expect(proc.env.REFRESH_FILES).toBe("fzf.js,fonts.js");
  });

  it("should expand --preset=lightweight into its file list", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      lightweight: { files: ["git.js", "vim.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=lightweight"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["lightweight"]);
    expect(result.files).toBe("git.js,vim.js");
    expect(proc.env.TEST_SCRIPT_FILES).toBe("git.js,vim.js");
  });

  it("should accept --presets= alias (plural)", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      lightweight: { files: ["git.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--presets=lightweight"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["lightweight"]);
    expect(result.files).toBe("git.js");
  });

  it("should compose multiple presets (files union)", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      a: { files: ["a.js"] },
      b: { files: ["b.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=a,b"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["a", "b"]);
    expect(result.files).toBe("a.js,b.js");
  });

  it("should compose --preset with explicit --files=", () => {
    proc.env.PRESETS_JSON = JSON.stringify({ lightweight: { files: ["a.js"] } });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--files=extra.js", "--preset=lightweight"]);
    const result = parseRawArgs();
    expect(result.files).toBe("extra.js,a.js");
  });

  it("should throw on unknown preset name", () => {
    proc.env.PRESETS_JSON = JSON.stringify({ lightweight: { files: ["a.js"] } });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=does-not-exist"]);
    expect(() => parseRawArgs()).toThrow(/Unknown preset "does-not-exist"/);
  });

  it("should auto-resolve a partial preset name with exactly one match", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["a.js"] },
      browsers: { files: ["b.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=editor"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["editors"]);
    expect(result.files).toBe("a.js");
  });

  it("should auto-resolve a case-insensitive partial match", () => {
    proc.env.PRESETS_JSON = JSON.stringify({ Lightweight: { files: ["a.js"] } });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=LIGHT"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["Lightweight"]);
  });

  it("should throw with a copy-paste suggestion list when partial match is ambiguous", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["a.js"] },
      "editor-pro": { files: ["b.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=editor"]);
    expect(() => parseRawArgs()).toThrow(/ambiguous — matched 2: editors, editor-pro/);
    expect(() => parseRawArgs()).toThrow(/bash run\.sh --preset=editors/);
    expect(() => parseRawArgs()).toThrow(/bash run\.sh --preset=editor-pro/);
  });

  it("should prefer public (non-underscore) names over underscore-prefixed building blocks in fuzzy matching", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      _editors: { files: ["internal.js"] },
      "editors-emulators-and-apps": { files: ["public.js"] },
    });
    // "editors" is a substring of both names. Public name wins — `_editors` is excluded.
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=editors"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["editors-emulators-and-apps"]);
    expect(result.files).toBe("public.js");
  });

  it("should fall back to underscore-prefixed matches when no public name matches the substring", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      _llm: { files: ["llm.js"] },
      browsers: { files: ["browser.js"] },
    });
    // "llm" only matches `_llm`. With no public match available, the underscore
    // building block is selected so common shorthands like --preset=llm still work.
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=llm"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["_llm"]);
    expect(result.files).toBe("llm.js");
  });

  it("should still allow underscore-prefixed presets via EXACT name", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      _editors: { files: ["internal.js"] },
      "editors-emulators-and-apps": { files: ["public.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=_editors"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["_editors"]);
    expect(result.files).toBe("internal.js");
  });

  it("should prefer exact match over partial when both exist", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      // "edit" is an exact match; "editors" would also be a partial match.
      edit: { files: ["exact.js"] },
      editors: { files: ["partial.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=edit"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["edit"]);
    expect(result.files).toBe("exact.js");
  });

  it("should recursively expand a preset that references other presets via presets:[]", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["vim.js", "vs-code.js"] },
      emulators: { files: ["ghostty.js"] },
      "editors-emulators-and-apps": { presets: ["editors", "emulators"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=editors-emulators-and-apps"]);
    const result = parseRawArgs();
    expect(result.files).toBe("vim.js,vs-code.js,ghostty.js");
  });

  it("should expand nested preset references multiple levels deep", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      leaf: { files: ["leaf.js"] },
      mid: { presets: ["leaf"], files: ["mid.js"] },
      root: { presets: ["mid"], files: ["root.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=root"]);
    const result = parseRawArgs();
    // Referenced presets contribute first, this preset's own files appended after.
    expect(result.files).toBe("leaf.js,mid.js,root.js");
  });

  it("should dedup files within a single preset expansion (shared sub-preset files run once)", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      a: { files: ["shared.js", "a.js"] },
      b: { files: ["shared.js", "b.js"] },
      combo: { presets: ["a", "b"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=combo"]);
    const result = parseRawArgs();
    expect(result.files).toBe("shared.js,a.js,b.js");
  });

  it("should detect a direct self-reference cycle", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      loop: { presets: ["loop"], files: ["a.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=loop"]);
    expect(() => parseRawArgs()).toThrow(/Preset cycle detected/);
    expect(() => parseRawArgs()).toThrow(/loop -> loop/);
  });

  it("should detect a transitive cycle (A -> B -> A)", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      a: { presets: ["b"] },
      b: { presets: ["a"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=a"]);
    expect(() => parseRawArgs()).toThrow(/Preset cycle detected/);
    expect(() => parseRawArgs()).toThrow(/a -> b -> a/);
  });

  it("should detect a deeper transitive cycle (A -> B -> C -> A)", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      a: { presets: ["b"] },
      b: { presets: ["c"] },
      c: { presets: ["a"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=a"]);
    expect(() => parseRawArgs()).toThrow(/a -> b -> c -> a/);
  });

  it("should throw when a sub-preset references an unknown preset name", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      a: { presets: ["does-not-exist"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=a"]);
    expect(() => parseRawArgs()).toThrow(/Unknown preset "does-not-exist".*referenced from "a"/);
  });

  it("should treat empty --preset= value as a no-op", () => {
    proc.env.PRESETS_JSON = JSON.stringify({ lightweight: { files: ["a.js"] } });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset="]);
    const result = parseRawArgs();
    expect(result.presets).toEqual([]);
    expect(result.files).toBe("");
  });

  it("should handle missing PRESETS_JSON env var by treating any preset as unknown", () => {
    delete proc.env.PRESETS_JSON;
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=lightweight"]);
    expect(() => parseRawArgs()).toThrow(/Unknown preset "lightweight"/);
  });

  it("should tolerate malformed PRESETS_JSON without crashing parse", () => {
    proc.env.PRESETS_JSON = "{not valid json";
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=lightweight"]);
    // malformed JSON falls back to {}; preset is then unknown
    expect(() => parseRawArgs()).toThrow(/Unknown preset "lightweight"/);
  });

  it("should ignore presets when no --preset= flag is passed", () => {
    proc.env.PRESETS_JSON = JSON.stringify({ lightweight: { files: ["a.js"] } });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--files=git.js"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual([]);
    expect(result.files).toBe("git.js");
  });

  it("should parse --setup flag", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--setup"]);
    const result = parseRawArgs();
    expect(result.setup).toBe(true);
    expect(proc.env.IS_SETUP).toBe("1");
  });

  it("should parse --is-setup alias", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--is-setup"]);
    const result = parseRawArgs();
    expect(result.setup).toBe(true);
  });

  it("should parse --debug flag", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--debug"]);
    const result = parseRawArgs();
    expect(result.debug).toBe(true);
    expect(proc.env.IS_DEBUG).toBe("1");
  });

  it("should parse -D shorthand for debug", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["-D"]);
    const result = parseRawArgs();
    expect(result.debug).toBe(true);
  });

  it("should parse --dryrun flag", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--dryrun"]);
    const result = parseRawArgs();
    expect(result.dryrun).toBe(true);
    expect(proc.env.IS_DRY_RUN).toBe("1");
  });

  it("should parse --dry-run alias", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--dry-run"]);
    const result = parseRawArgs();
    expect(result.dryrun).toBe(true);
  });

  it("should parse --remove flag", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--remove"]);
    const result = parseRawArgs();
    expect(result.remove).toBe(true);
    expect(proc.env.IS_REMOVE_MODE).toBe("1");
  });

  it("should parse --no-color flag", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--no-color"]);
    parseRawArgs();
    expect(proc.env.NO_COLOR).toBe("1");
  });

  it("should treat bare args as file names", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["git.js", "vim-config.js"]);
    const result = parseRawArgs();
    expect(result.files).toBe("git.js,vim-config.js");
  });

  it("should handle invalid JSON gracefully", () => {
    proc.env.BASHRC_RAW_ARGS = "not valid json";
    const result = parseRawArgs();
    expect(result.files).toBe("");
  });

  it("should handle combined flags and files", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--debug", "--files=git.js", "fzf.js"]);
    const result = parseRawArgs();
    expect(result.debug).toBe(true);
    expect(result.files).toBe("git.js,fzf.js");
  });

  it("should skip empty --files= value", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--files="]);
    const result = parseRawArgs();
    expect(result.files).toBe("");
  });

  it("should skip empty --refresh= value but still set forceRefresh", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--refresh="]);
    const result = parseRawArgs();
    expect(result.forceRefresh).toBe(true);
    expect(result.files).toBe("");
    expect(result.refreshFiles).toBe("");
  });
});
