/** Tests for printRunInfo — prints the run configuration summary to stderr. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const printRunInfo = getIndexFunction("printRunInfo");
const _parsedArgs = getIndexConstant("_parsedArgs");

describe("printRunInfo", () => {
  beforeEach(() => {
    // Reset preset state so each test starts clean
    _parsedArgs.presets = [];
    _parsedArgs.files = "";
    _parsedArgs.refreshFiles = "";
    _parsedArgs.forceRefresh = false;
    _parsedArgs.debug = false;
    _parsedArgs.dryrun = false;
    _parsedArgs.remove = false;
    _parsedArgs.setup = false;
  });

  it("does not throw with an empty preset list", () => {
    expect(() => printRunInfo()).not.toThrow();
  });

  it("does not throw when a known preset is selected (exercises preset-detail branch)", () => {
    _parsedArgs.presets = ["lightweight"];
    expect(() => printRunInfo()).not.toThrow();
  });

  it("does not throw when multiple presets are selected", () => {
    _parsedArgs.presets = ["lightweight", "terminal"];
    expect(() => printRunInfo()).not.toThrow();
  });

  it("does not throw when an unknown preset is selected (fallback path)", () => {
    _parsedArgs.presets = ["__nonexistent_preset_for_test__"];
    expect(() => printRunInfo()).not.toThrow();
  });

  it("does not throw when files is non-empty (covers fallback branch for files label)", () => {
    _parsedArgs.files = "git.js,vim-config.js";
    expect(() => printRunInfo()).not.toThrow();
  });

  it("does not throw when refreshFiles is non-empty", () => {
    _parsedArgs.refreshFiles = "fzf.js";
    expect(() => printRunInfo()).not.toThrow();
  });

  it("does not throw when active OS flags are set on process.env", () => {
    process.env.is_os_mac = "1";
    try {
      expect(() => printRunInfo()).not.toThrow();
    } finally {
      delete process.env.is_os_mac;
    }
  });
});
