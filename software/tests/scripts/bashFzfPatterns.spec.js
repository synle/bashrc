/** Pattern contract tests for software/scripts/bash-fzf.profile.bash. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/** Absolute path to the bash-fzf profile partial. */
const FZF_PATH = path.resolve("software/scripts/bash-fzf.profile.bash");

/**
 * Extracts the JSON value bound to a `_FUZZY_*_JSON='[...]'` assignment.
 * Tolerates either:
 *   - top-level literal: `VAR='...'`
 *   - guarded fallback (post-refactor): `[ -z "${VAR+x}" ] && VAR='...'`
 * @param {string} src - bash-fzf.profile.bash file content.
 * @param {string} varName - Name of the bash variable.
 * @returns {string[]} Parsed regex pattern array.
 */
function extractFuzzyJson(src, varName) {
  const direct = new RegExp(`^${varName}='([^']*)'`, "m");
  const guarded = new RegExp(`&&\\s+${varName}='([^']*)'`);
  const m = src.match(direct) || src.match(guarded);
  expect(m, `${varName} not found in bash-fzf.profile.bash`).not.toBeNull();
  return JSON.parse(m[1]);
}

/**
 * Extracts the bash array literal bound to filter_unwanted's fallback `patterns=(...)`.
 * @param {string} src - bash-fzf.profile.bash file content.
 * @returns {string[]} Pattern strings (regex source, single-quoted in bash).
 */
function extractFilterUnwantedFallback(src) {
  const m = src.match(/patterns=\(\n([\s\S]*?)\n\s*\)/);
  expect(m, "filter_unwanted fallback patterns array not found").not.toBeNull();
  return m[1]
    .split("\n")
    .map((l) => l.trim().replace(/^'|'$/g, ""))
    .filter((l) => l.length > 0);
}

describe("bash-fzf.profile.bash pattern contract", () => {
  /** @type {string} */
  let src;

  it("file exists and is readable", () => {
    src = fs.readFileSync(FZF_PATH, "utf-8");
    expect(src.length).toBeGreaterThan(1000);
  });

  // ---- _FUZZY_IGNORED_FOLDERS_JSON ----

  describe("_FUZZY_IGNORED_FOLDERS_JSON", () => {
    /** @type {string[]} */
    let folders;

    it("parses as a non-empty JSON array of strings", () => {
      src = fs.readFileSync(FZF_PATH, "utf-8");
      folders = extractFuzzyJson(src, "_FUZZY_IGNORED_FOLDERS_JSON");
      expect(Array.isArray(folders)).toBe(true);
      expect(folders.length).toBeGreaterThan(20);
      for (const p of folders) expect(typeof p).toBe("string");
    });

    it("each entry compiles as a valid JS regex", () => {
      src = fs.readFileSync(FZF_PATH, "utf-8");
      folders = extractFuzzyJson(src, "_FUZZY_IGNORED_FOLDERS_JSON");
      for (const p of folders) {
        expect(() => new RegExp(p), `failed to compile: ${p}`).not.toThrow();
      }
    });

    it("contains canonical folder ignores", () => {
      src = fs.readFileSync(FZF_PATH, "utf-8");
      folders = extractFuzzyJson(src, "_FUZZY_IGNORED_FOLDERS_JSON");
      // Sample a stable subset that must always be filtered.
      const required = ["\\.git/", "node_modules", "__pycache", "\\.next/", "\\.venv/", "/build/", "/dist/", "/coverage/"];
      for (const r of required) {
        expect(folders, `missing required folder pattern: ${r}`).toContain(r);
      }
    });
  });

  // ---- _FUZZY_IGNORED_FILES_JSON ----

  describe("_FUZZY_IGNORED_FILES_JSON", () => {
    it("parses, compiles, and contains anchored binary-file ignores", () => {
      src = fs.readFileSync(FZF_PATH, "utf-8");
      const files = extractFuzzyJson(src, "_FUZZY_IGNORED_FILES_JSON");
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(10);
      for (const p of files) {
        expect(typeof p).toBe("string");
        expect(() => new RegExp(p), `failed to compile: ${p}`).not.toThrow();
        // Sanity: file ignores should be `$`-anchored (they're filename suffix matchers).
        expect(p.endsWith("$") || p.includes("\\."), `expected anchored or escaped pattern: ${p}`).toBe(true);
      }
      const required = ["\\.DS_Store$", "Thumbs\\.db$", "\\.exe$", "\\.dll$", "\\.so$", "\\.pyc$"];
      for (const r of required) {
        expect(files, `missing required file pattern: ${r}`).toContain(r);
      }
    });
  });

  // ---- _FUZZY_TEXT_FILES_JSON ----

  describe("_FUZZY_TEXT_FILES_JSON", () => {
    it("parses, compiles, and contains common text-file extensions", () => {
      src = fs.readFileSync(FZF_PATH, "utf-8");
      const text = extractFuzzyJson(src, "_FUZZY_TEXT_FILES_JSON");
      expect(Array.isArray(text)).toBe(true);
      expect(text.length).toBeGreaterThan(40);
      for (const p of text) {
        expect(typeof p).toBe("string");
        expect(() => new RegExp(p), `failed to compile: ${p}`).not.toThrow();
      }
      const required = ["\\.js$", "\\.ts$", "\\.py$", "\\.md$", "\\.json$", "Makefile$", "Dockerfile$", "\\.gitignore$"];
      for (const r of required) {
        expect(text, `missing required text-file pattern: ${r}`).toContain(r);
      }
    });
  });

  // ---- filter_unwanted fallback ----

  describe("filter_unwanted fallback patterns", () => {
    it("fallback array contains canonical folder ignores", () => {
      src = fs.readFileSync(FZF_PATH, "utf-8");
      const patterns = extractFilterUnwantedFallback(src);
      expect(patterns.length).toBeGreaterThan(20);
      const required = ["\\.git/", "node_modules", "__pycache", "\\.next/", "\\.venv/", "/build/", "/dist/"];
      for (const r of required) {
        expect(patterns, `missing required filter_unwanted pattern: ${r}`).toContain(r);
      }
    });
  });
});
