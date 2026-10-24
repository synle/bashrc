import { describe, it, expect } from "vitest";

import fs from "fs";

import path from "path";

import { getIndexFunction, getIndexConstant, mockFsExistence, setSandboxGlobal } from "./setup.js";

const _getBundleRunnerType = getIndexFunction("_getBundleRunnerType");

const _resolveScriptFile = getIndexFunction("_resolveScriptFile");

const _expandWildcardScriptFiles = getIndexFunction("_expandWildcardScriptFiles");

const _filterByOsFolders = getIndexFunction("_filterByOsFolders");

const getAllRepoSoftwareFiles = getIndexFunction("getAllRepoSoftwareFiles");

const _printScriptProcessingResultsDirect = getIndexFunction("_printScriptProcessingResultsDirect");

const ScriptSkipError = getIndexFunction("ScriptSkipError");

const exitIfNotSudo = getIndexFunction("exitIfNotSudo");

describe("_getBundleRunnerType", () => {
  it('should return "js" for .js files', () => {
    expect(_getBundleRunnerType("software/scripts/git.js")).toBe("js");
  });

  it('should return "su.js" for .su.js files', () => {
    expect(_getBundleRunnerType("software/scripts/advanced/etc-hosts.su.js")).toBe("su.js");
  });

  it('should return "sh" for .sh files', () => {
    expect(_getBundleRunnerType("software/scripts/test.sh")).toBe("sh");
  });

  it("keeps profile-qualified scripts in their language bundles", () => {
    expect(_getBundleRunnerType("software/scripts/tool.personal.js")).toBe("js");
    expect(_getBundleRunnerType("software/scripts/tool.work.js")).toBe("js");
    expect(_getBundleRunnerType("software/scripts/tool.personal.sh")).toBe("sh");
    expect(_getBundleRunnerType("software/scripts/tool.work.sh")).toBe("sh");
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

  it("should return ambiguous error with copy-paste suggestions when partial match has 2+ hits", () => {
    const allFiles = ["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh"];
    // bare "vim" gets prefixed to "software/scripts/vim" by the caller; basename "vim"
    // matches both via the partial-regex tier.
    const result = _resolveScriptFile("software/scripts/vim", "vim", allFiles);
    expect(result.fileExists).toBe(false);
    expect(result.fileMatchState).toBe("ambiguous");
    expect(result.description).toContain("Ambiguous");
    expect(result.description).toContain("matched 2");
    expect(result.description).toContain("./run --files=vim-config.js");
    expect(result.description).toContain("./run --files=vim-jetpack.sh");
  });

  it("should still resolve when partial match yields exactly one hit", () => {
    const allFiles = ["software/scripts/vim-config.js", "software/scripts/git.js"];
    const result = _resolveScriptFile("software/scripts/vim", "vim", allFiles);
    expect(result.fileExists).toBe(true);
    expect(result.resolvedFile).toBe("software/scripts/vim-config.js");
  });
});

describe("_expandWildcardScriptFiles", () => {
  it("should expand a trailing wildcard into all matching scripts", () => {
    const allFiles = ["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh", "software/scripts/git.js"];

    const result = _expandWildcardScriptFiles(["vim*"], allFiles);

    expect(result).toEqual(["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh"]);
  });

  it("should leave unmatched wildcard entries unchanged", () => {
    const allFiles = ["software/scripts/git.js"];
    const result = _expandWildcardScriptFiles(["nope*"], allFiles);
    expect(result).toEqual(["nope*"]);
  });

  it("should dedupe overlapping wildcard and explicit entries", () => {
    const allFiles = ["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh"];
    const result = _expandWildcardScriptFiles(["vim*", "software/scripts/vim-config.js"], allFiles);
    expect(result).toEqual(["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh"]);
  });
});

describe("_expandWildcardScriptFiles", () => {
  it("should expand a trailing wildcard into all matching scripts", () => {
    const allFiles = ["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh", "software/scripts/git.js"];

    const result = _expandWildcardScriptFiles(["vim*"], allFiles);

    expect(result).toEqual(["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh"]);
  });

  it("should leave unmatched wildcard entries unchanged", () => {
    const allFiles = ["software/scripts/git.js"];
    const result = _expandWildcardScriptFiles(["nope*"], allFiles);
    expect(result).toEqual(["nope*"]);
  });

  it("should dedupe overlapping wildcard and explicit entries", () => {
    const allFiles = ["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh"];
    const result = _expandWildcardScriptFiles(["vim*", "software/scripts/vim-config.js"], allFiles);
    expect(result).toEqual(["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh"]);
  });
});

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

  it("should log accepted and ignored files when IS_DEBUG is enabled", () => {
    setSandboxGlobal("IS_DEBUG", true);
    try {
      // sandbox.echo is stubbed to () => {}; the point is exercising the IS_DEBUG branches
      // for both the ignored (OS folder) and accepted (outside any OS folder) paths.
      expect(() => {
        _filterByOsFolders(["software/scripts/git.js", "software/scripts/mac/iterm.js"], "software/scripts");
      }).not.toThrow();
    } finally {
      setSandboxGlobal("IS_DEBUG", false);
    }
  });
});

describe("getAllRepoSoftwareFiles", () => {
  it("falls back to the remote tree when IS_LOCAL_REPO is false, passing fallthrough", async () => {
    setSandboxGlobal("IS_LOCAL_REPO", false);
    const calls = [];
    setSandboxGlobal("listRepoDir", async (...args) => {
      calls.push(args);
      return ["software/scripts/git.js", "software/metadata/script-list.config", "software/tools/build-include.js"];
    });
    try {
      const result = await getAllRepoSoftwareFiles();
      expect(calls).toEqual([["local", true]]);
      expect(result).toEqual(["software/scripts/git.js"]);
    } finally {
      setSandboxGlobal("IS_LOCAL_REPO", true);
      setSandboxGlobal("listRepoDir", undefined);
    }
  });
});

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
