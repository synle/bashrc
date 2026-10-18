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

describe("exitIfNotSudo", () => {
  it("should not throw when process.getuid is not a function", () => {
    // sandbox process doesn't have getuid
    expect(() => exitIfNotSudo()).not.toThrow();
  });

  it("should be the first line of doWork() in all .su.js scripts", () => {
    const scriptsDir = path.resolve("software/scripts");
    const suFiles = [];
    /** Recursively finds all .su.js files under a directory. */
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".su.js")) suFiles.push(full);
      }
    }
    walk(scriptsDir);
    expect(suFiles.length).toBeGreaterThan(0);

    const missing = [];
    for (const file of suFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const match = content.match(/(?:async\s+)?function\s+doWork\s*\([^)]*\)\s*\{([^}]*)/s);
      if (!match) {
        missing.push(`${path.relative(scriptsDir, file)}: no doWork() found`);
        continue;
      }
      const body = match[1].trim();
      if (!body.startsWith("exitIfNotSudo()")) {
        missing.push(`${path.relative(scriptsDir, file)}: doWork() does not start with exitIfNotSudo()`);
      }
    }
    expect(missing, `Scripts missing exitIfNotSudo() guard:\n${missing.join("\n")}`).toEqual([]);
  });
});
