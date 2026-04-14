/** Tests for script bundling, resolution, and OS filtering utilities. */
import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant, mockFsExistence, setSandboxGlobal } from "./setup.js";

const _getBundleRunnerType = getIndexFunction("_getBundleRunnerType");
const _resolveScriptFile = getIndexFunction("_resolveScriptFile");
const _filterByOsFolders = getIndexFunction("_filterByOsFolders");
const _printScriptProcessingResultsDirect = getIndexFunction("_printScriptProcessingResultsDirect");
const ScriptSkipError = getIndexFunction("ScriptSkipError");
const exitIfNotSudo = getIndexFunction("exitIfNotSudo");

// ---- _getBundleRunnerType ----

describe("_getBundleRunnerType", () => {
  it('should return "js" for .js files', () => {
    expect(_getBundleRunnerType("software/scripts/git.js")).toBe("js");
  });

  it('should return "js" for .su.js files', () => {
    expect(_getBundleRunnerType("software/scripts/advanced/etc-hosts.su.js")).toBe("js");
  });

  it('should return "sh" for .sh files', () => {
    expect(_getBundleRunnerType("software/scripts/test.sh")).toBe("sh");
  });

  it("should return null for .sh.js files", () => {
    expect(_getBundleRunnerType("software/scripts/install.sh.js")).toBe(null);
  });

  it("should return null for .su.sh.js files", () => {
    expect(_getBundleRunnerType("software/scripts/fonts.su.sh.js")).toBe(null);
  });

  it("should return null for .su.sh files", () => {
    expect(_getBundleRunnerType("software/scripts/elevated.su.sh")).toBe(null);
  });

  it("should return null for unknown extensions", () => {
    expect(_getBundleRunnerType("software/scripts/readme.md")).toBe(null);
  });
});

// ---- _resolveScriptFile ----

describe("_resolveScriptFile", () => {
  it("should find exact match in allRepoFiles", () => {
    const allFiles = ["software/scripts/git.js", "software/scripts/fzf.js"];
    const result = _resolveScriptFile("software/scripts/git.js", "git.js", allFiles);
    expect(result.fileExists).toBe(true);
    expect(result.resolvedFile).toBe("software/scripts/git.js");
    expect(result.fileMatchState).toBeUndefined();
  });

  it("should remove matched file from allRepoFiles to prevent duplicates", () => {
    const allFiles = ["software/scripts/git.js", "software/scripts/fzf.js"];
    _resolveScriptFile("software/scripts/git.js", "git.js", allFiles);
    expect(allFiles).not.toContain("software/scripts/git.js");
    expect(allFiles).toContain("software/scripts/fzf.js");
  });

  it("should return fileExists=false for missing files", () => {
    const allFiles = ["software/scripts/git.js"];
    const result = _resolveScriptFile("software/scripts/missing.js", "missing.js", allFiles);
    expect(result.fileExists).toBe(false);
    expect(result.fileMatchState).toBe("not_found");
    expect(result.description).toContain("File not found");
  });

  it("should fuzzy match by basename in subdirectories of the same parent", () => {
    const allFiles = ["software/scripts/advanced/fzf.js"];
    const result = _resolveScriptFile("software/scripts/fzf.js", "fzf.js", allFiles);
    // basename fzf.js matches and advanced/fzf.js starts with software/scripts
    expect(result.fileExists).toBe(true);
    expect(result.resolvedFile).toBe("software/scripts/advanced/fzf.js");
    expect(result.fileMatchState).toBe("expanded_match");
  });

  it("should not fuzzy match when parent directory differs entirely", () => {
    const allFiles = ["other/path/fzf.js"];
    const result = _resolveScriptFile("software/scripts/fzf.js", "fzf.js", allFiles);
    expect(result.fileExists).toBe(false);
  });

  it("should set expanded_match state for case-insensitive match", () => {
    const allFiles = ["software/scripts/mac/FZF.js"];
    const result = _resolveScriptFile("software/scripts/mac/fzf.js", "fzf.js", allFiles);
    expect(result.fileExists).toBe(true);
    expect(result.fileMatchState).toBe("expanded_match");
    expect(result.description).toContain("Expanded");
  });
});

// ---- _filterByOsFolders ----

describe("_filterByOsFolders", () => {
  // OS_SCRIPT_PATHS is built at sandbox init from process.env is_os_* vars.
  // In the test sandbox, no is_os_* env vars are set to "1", so all OS folders
  // that have entries in OS_SCRIPT_PATHS are treated as inactive.

  it("should pass through files not in any OS folder", () => {
    const files = ["software/scripts/git.js", "software/scripts/fzf.js"];
    const result = _filterByOsFolders(files, "software/scripts");
    expect(result).toContain("software/scripts/git.js");
    expect(result).toContain("software/scripts/fzf.js");
  });

  it("should handle empty file list", () => {
    const result = _filterByOsFolders([], "software/scripts");
    expect(result).toEqual([]);
  });

  it("should handle files in folders not registered in OS_SCRIPT_PATHS", () => {
    const files = ["software/scripts/git.js", "software/scripts/common/shared.js"];
    const result = _filterByOsFolders(files, "software/scripts");
    // common/ is not an OS folder, so it passes through
    expect(result).toContain("software/scripts/common/shared.js");
  });

  it("should handle different basePath values", () => {
    const files = ["deps/mac/brew.sh", "deps/common/shared.sh"];
    const result = _filterByOsFolders(files, "deps");
    // The function checks basePath/<os_name>, so deps/mac/ would be filtered
    // if mac is an inactive OS
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---- _printScriptProcessingResultsDirect ----

describe("_printScriptProcessingResultsDirect", () => {
  it("should not throw with empty results", () => {
    expect(() => _printScriptProcessingResultsDirect([])).not.toThrow();
  });

  it("should not throw with success results", () => {
    const results = [{ file: "git.js", path: "software/scripts/git.js", status: "success", description: "", bundleLabel: "" }];
    expect(() => _printScriptProcessingResultsDirect(results)).not.toThrow();
  });

  it("should not throw with error results", () => {
    const results = [
      {
        file: "missing.js",
        path: "software/scripts/missing.js",
        status: "error",
        description: "File not found",
        tempFileCommand: "",
        bundleLabel: "",
      },
    ];
    expect(() => _printScriptProcessingResultsDirect(results)).not.toThrow();
  });

  it("should not throw with mixed bundle labels", () => {
    const results = [
      { file: "a.js", path: "a.js", status: "success", description: "", bundleLabel: "JS Bundle (2 scripts)" },
      { file: "b.js", path: "b.js", status: "success", description: "", bundleLabel: "JS Bundle (2 scripts)" },
      { file: "c.sh", path: "c.sh", status: "success", description: "", bundleLabel: "" },
    ];
    expect(() => _printScriptProcessingResultsDirect(results)).not.toThrow();
  });

  it("should not throw with fileMatchState present", () => {
    const results = [
      {
        file: "fzf.js",
        path: "software/scripts/advanced/fzf.js",
        status: "success",
        description: "Expanded",
        fileMatchState: "expanded_match",
        bundleLabel: "",
      },
    ];
    expect(() => _printScriptProcessingResultsDirect(results)).not.toThrow();
  });
});

// ---- _registerBundledScript ----

describe("_registerBundledScript", () => {
  const _registerBundledScript = getIndexFunction("_registerBundledScript");
  const _bundled_scripts = getIndexConstant("_bundled_scripts");

  it("should register a script with bundleLabel into _bundled_scripts", () => {
    const initialLength = _bundled_scripts.length;
    _registerBundledScript("test/file.js", false, "50.00", "Bundle #1 JS Bundle (3 scripts)", () => ({
      doWork: () => {},
    }));
    expect(_bundled_scripts.length).toBe(initialLength + 1);
    const entry = _bundled_scripts[_bundled_scripts.length - 1];
    expect(entry.file).toBe("test/file.js");
    expect(entry.bundleLabel).toBe("Bundle #1 JS Bundle (3 scripts)");
    expect(entry.pct).toBe("50.00");
    expect(entry.isRefresh).toBe(false);
  });

  it("should register with empty bundleLabel for single-script bundles", () => {
    const initialLength = _bundled_scripts.length;
    _registerBundledScript("test/single.js", false, "100.00", "", () => ({
      doWork: () => {},
    }));
    const entry = _bundled_scripts[_bundled_scripts.length - 1];
    expect(entry.bundleLabel).toBe("");
  });
});

// ---- exitIfNotSudo ----

describe("exitIfNotSudo", () => {
  it("should not throw when process.getuid is not a function", () => {
    // sandbox process doesn't have getuid
    expect(() => exitIfNotSudo()).not.toThrow();
  });
});
