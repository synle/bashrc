/** Validates glob path arrays in *.common.js files are safe to embed in the generated bash profile. */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import { globSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Every *.common.js file under software/scripts/advanced/ may contain _X_PATHS glob arrays. */
const commonFiles = globSync(path.join(ROOT_DIR, "software/scripts/advanced/*.common.js"));

/**
 * Loads a *.common.js file in a Node vm sandbox and returns every exported `_NAME_PATHS` constant.
 * Converts top-level `const`/`let` to `var` so the bindings become sandbox properties we can read back.
 * @param {string} sourcePath - absolute path to the .common.js file
 * @returns {Record<string, string[]>} map of constant name -> string array
 */
function extractPathArrays(sourcePath) {
  const source = readFileSync(sourcePath, "utf-8");
  const varSource = source.replace(/^(const|let) /gm, "var ");
  const sandbox = { module: { exports: {} }, require: () => ({}) };
  vm.createContext(sandbox);
  vm.runInContext(varSource, sandbox);
  /** @type {Record<string, string[]>} */
  const result = {};
  for (const key of Object.keys(sandbox)) {
    if (/^_[A-Z0-9_]+_PATHS$/.test(key) && Array.isArray(sandbox[key])) {
      result[key] = sandbox[key];
    }
  }
  return result;
}

/**
 * Bash-hazard patterns to flag inside path string literals.
 * Extglob patterns like *(...), +(...), ?(...), @(...), !(...) can break on old bash 3.2
 * even when they appear inside double-quoted strings, because some builds parse them
 * as pattern operators while tokenizing arrays.
 */
const HAZARD_PATTERNS = [
  {
    pattern: /[*+?@!]\(/,
    label: "extglob-like prefix (e.g. *(...), +(...)) — breaks on old bash 3.2 even inside quotes",
  },
  { pattern: /\0/, label: "null byte" },
  { pattern: /[\r\n\t]/, label: "control character (CR/LF/TAB)" },
];

describe("common.js path array validation", () => {
  it("should find *.common.js files", () => {
    expect(commonFiles.length).toBeGreaterThan(0);
  });

  commonFiles.forEach((file) => {
    const relPath = path.relative(ROOT_DIR, file);
    const arrays = extractPathArrays(file);
    const names = Object.keys(arrays).sort();

    if (names.length === 0) return; // file has no path arrays — nothing to validate

    describe(relPath, () => {
      names.forEach((name) => {
        const paths = arrays[name];

        it(`${name} - is a non-empty string array`, () => {
          expect(Array.isArray(paths)).toBe(true);
          expect(paths.length).toBeGreaterThan(0);
          paths.forEach((p) => expect(typeof p).toBe("string"));
        });

        it(`${name} - every entry starts with /, ~, or a drive letter`, () => {
          const bad = paths.filter((p) => !/^(\/|~|[A-Za-z]:)/.test(p));
          expect(bad, `invalid path roots:\n${bad.map((p) => `  "${p}"`).join("\n")}`).toEqual([]);
        });

        it(`${name} - no bash-hazardous patterns`, () => {
          const issues = [];
          for (const p of paths) {
            for (const { pattern, label } of HAZARD_PATTERNS) {
              if (pattern.test(p)) issues.push(`  "${p}" — ${label}`);
            }
          }
          if (issues.length > 0) {
            expect.fail(`Hazardous paths in ${name}:\n${issues.join("\n")}`);
          }
        });

        it(`${name} - parses as a bash array under extglob mode`, () => {
          // Render as a bash array with double-quoted entries (how run_browser/run_editor pass them to find_path).
          // Run under `shopt -s extglob` because some bash builds enable extglob implicitly at profile-source time.
          const bashArray = `a=(\n${paths.map((p) => `  "${p.replace(/"/g, '\\"')}"`).join("\n")}\n)`;
          const script = `shopt -s extglob\n${bashArray}\n`;
          const tmpFile = `/tmp/_bashrc_path_array_${process.pid}_${name}.sh`;
          writeFileSync(tmpFile, script);
          try {
            execSync(`bash -n "${tmpFile}"`, { stdio: "pipe" });
          } catch (err) {
            const stderr = (err.stderr || err.message || "unknown error").toString().trim();
            expect.fail(`Bash parse error in ${name}:\n${stderr}`);
          } finally {
            try {
              unlinkSync(tmpFile);
            } catch {}
          }
        });
      });
    });
  });
});
