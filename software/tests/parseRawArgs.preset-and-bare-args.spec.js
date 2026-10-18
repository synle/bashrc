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

  it("should track plain bare args separately in bareArgs[] for downstream fallback", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["git.js", "editors"]);
    const result = parseRawArgs();
    expect(result.bareArgs).toEqual(["git.js", "editors"]);
    expect(proc.env.BASHRC_BARE_ARGS).toBe("git.js,editors");
  });

  it("should NOT track --files= entries as bare args (explicit flag is strict)", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--files=git.js", "vim-config.js"]);
    const result = parseRawArgs();
    expect(result.bareArgs).toEqual(["vim-config.js"]);
    expect(result.files).toBe("git.js,vim-config.js");
  });

  it("should treat @xxx bare arg as a strict preset request (skip script search)", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      llm: { files: ["claude.js", "copilot.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["@llm"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["llm"]);
    expect(result.files).toBe("claude.js,copilot.js");
    // @xxx is NOT a bare-arg-eligible candidate; it routed directly to the preset path.
    expect(result.bareArgs).toEqual([]);
  });

  it("should apply fuzzy substring matching to @xxx bare arg", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["vim.js"] },
      browsers: { files: ["brave.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["@edit"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["editors"]);
    expect(result.files).toBe("vim.js");
  });

  it("should strip leading @ from --preset=@xxx (symmetry with bare @xxx)", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      llm: { files: ["claude.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=@llm"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual(["llm"]);
    expect(result.files).toBe("claude.js");
  });

  it("should error with @-formatted suggestions when @xxx fuzzy match is ambiguous", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["a.js"] },
      "editor-pro": { files: ["b.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["@editor"]);
    // Ambiguous fuzzy match uses the @ suggestion-flag because the entry-point was @xxx.
    expect(() => parseRawArgs()).toThrow(/ambiguous — matched 2: editors, editor-pro/);
    expect(() => parseRawArgs()).toThrow(/bash run\.sh @editors/);
    expect(() => parseRawArgs()).toThrow(/bash run\.sh @editor-pro/);
  });

  it("should treat lone @ as a no-op (empty preset name)", () => {
    proc.env.PRESETS_JSON = JSON.stringify({ lightweight: { files: ["a.js"] } });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["@"]);
    const result = parseRawArgs();
    expect(result.presets).toEqual([]);
    expect(result.files).toBe("");
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

  it("should append --refresh= values to already-set files and refreshFiles", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--refresh=a.js", "--refresh=b.js"]);
    const result = parseRawArgs();
    expect(result.files).toBe("a.js,b.js");
    expect(result.refreshFiles).toBe("a.js,b.js");
    expect(result.forceRefresh).toBe(true);
  });

  it("should silently ignore unknown dash-prefixed flags", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--not-a-real-flag"]);
    const result = parseRawArgs();
    expect(result.files).toBe("");
    expect(result.bareArgs).toEqual([]);
  });

  it("should skip non-string preset references and empty file entries during expansion", () => {
    proc.env.PRESETS_JSON = JSON.stringify({
      a: { presets: [123, "b"] },
      b: { files: ["", "b.js"] },
    });
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--preset=a"]);
    const result = parseRawArgs();
    expect(result.files).toBe("b.js");
  });
});
