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
    delete proc.env.IS_LIGHT_WEIGHT_MODE;
    delete proc.env.IS_SETUP;
    delete proc.env.IS_DEBUG;
    delete proc.env.IS_DRY_RUN;
    delete proc.env.IS_REMOVE_MODE;
    delete proc.env.NO_COLOR;
  });

  it("should return defaults when BASHRC_RAW_ARGS is empty", () => {
    proc.env.BASHRC_RAW_ARGS = "[]";
    const result = parseRawArgs();
    expect(result.files).toBe("");
    expect(result.forceRefresh).toBe(false);
    expect(result.debug).toBe(false);
    expect(result.dryrun).toBe(false);
    expect(result.remove).toBe(false);
    expect(result.lightweight).toBe(false);
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

  it("should parse --lightweight flag", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--lightweight"]);
    const result = parseRawArgs();
    expect(result.lightweight).toBe(true);
    expect(proc.env.IS_LIGHT_WEIGHT_MODE).toBe("1");
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
