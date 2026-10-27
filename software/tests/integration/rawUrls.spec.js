/** Smoke test that scans source files for getGitHubRawUrl / get_github_raw_url calls and verifies each resolved URL is reachable. */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const BASE_URL = "https://github.com/synle/bashrc/blob/HEAD";
const TIMEOUT = 15000;
const THIS_FILE = "software/tests/smokeTestRawUrls.spec.js";

/** Recursively lists all files under a directory matching given extensions. */
function listFiles(dir, extensions) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory() && entry !== "node_modules" && entry !== ".build") {
          results.push(...listFiles(full, extensions));
        } else if (stat.isFile() && extensions.some((ext) => full.endsWith(ext))) {
          results.push(full);
        }
      } catch {
        /* skip unreadable entries */
      }
    }
  } catch {
    /* skip unreadable dirs */
  }
  return results;
}

/**
 * Returns true if the path should be skipped from reachability checks.
 * Skips: doc placeholders, .build/ paths (CI-generated), and test fixture paths.
 */
function shouldSkip(filePath) {
  if (/[<>]/.test(filePath)) return true;
  if (filePath.startsWith(".build/")) return true;
  return false;
}

/** Scans source files for getGitHubRawUrl / get_github_raw_url calls and extracts resolved URLs. */
function extractRawUrls() {
  const entries = [];
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

  const jsFiles = [...listFiles(join(rootDir, "software"), [".js", ".jsx"]), ...listFiles(join(rootDir, "webapp"), [".js", ".jsx"])];

  for (const file of jsFiles) {
    const relFile = relative(rootDir, file);
    if (relFile === THIS_FILE) continue;

    const content = readFileSync(file, "utf-8");

    // Match getGitHubRawUrl("path") or getGitHubRawUrl('path')
    for (const m of content.matchAll(/getGitHubRawUrl\(["']([^"']+)["']\)/g)) {
      if (!shouldSkip(m[1])) {
        entries.push({ file: relFile, path: m[1] });
      }
    }
  }

  const shFiles = [...listFiles(join(rootDir, "software"), [".sh", ".bash"])];

  for (const file of shFiles) {
    const content = readFileSync(file, "utf-8");
    const relFile = relative(rootDir, file);

    // Match get_github_raw_url <path> (with or without quotes)
    for (const m of content.matchAll(/get_github_raw_url\s+["']?([^\s"')]+)["']?\)?/g)) {
      if (!m[1].includes("$") && !shouldSkip(m[1])) {
        entries.push({ file: relFile, path: m[1] });
      }
    }
  }

  // Deduplicate by resolved path, keep first occurrence
  const seen = new Set();
  return entries.filter((e) => {
    if (seen.has(e.path)) return false;
    seen.add(e.path);
    return true;
  });
}

const urls = extractRawUrls();

describe("raw content url check", () => {
  it("should find at least one URL to test", () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  for (const entry of urls) {
    const resolvedUrl = `${BASE_URL}/${entry.path}?raw=1`;

    it(
      `${entry.file} > ${resolvedUrl}`,
      async () => {
        const res = await fetch(resolvedUrl, { method: "HEAD", redirect: "follow" });
        expect(res.status, `expected 200 for ${resolvedUrl}`).toBe(200);
      },
      TIMEOUT,
    );
  }
});

/**
 * Webapp GitHub URL CORS format check.
 *
 * Browser fetch() calls must use this exact form (has Access-Control-Allow-Origin: *):
 *   https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}
 *
 * These forms will cause CORS errors in the browser:
 *   Form 1 (blob):  https://github.com/{owner}/{repo}/blob/HEAD/{path}?raw=1   — 302 redirect, no CORS headers
 *   Form 3 (API):   https://api.github.com/repos/{owner}/{repo}/contents/{path} — requires auth token for CORS
 */

/** @type {RegExp} Matches Form 1: github.com blob URLs. */
const FORM1_BLOB_RE = /https:\/\/github\.com\/[^/]+\/[^/]+\/blob\//;
/** @type {RegExp} Matches Form 2: raw.githubusercontent.com URLs (correct form). */
const FORM2_RAW_RE = /https:\/\/raw\.githubusercontent\.com\//;
/** @type {RegExp} Matches Form 2 with /HEAD/ branch. Allows template expressions (${...}) in owner/repo positions. */
const FORM2_RAW_HEAD_RE = /https:\/\/raw\.githubusercontent\.com\/.*\/HEAD[/"'`]/;
/** @type {RegExp} Matches Form 3: api.github.com contents URLs. */
const FORM3_API_RE = /https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//;

/**
 * Scans webapp source files for GitHub raw content URLs and categorizes them.
 * Returns entries with file, line number, matched URL, form type, and whether /HEAD/ is used.
 */
function extractWebappGitHubUrls() {
  const entries = [];
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const webappFiles = listFiles(join(rootDir, "webapp"), [".js", ".jsx", ".ts", ".tsx"]);

  for (const file of webappFiles) {
    const relFile = relative(rootDir, file);
    const lines = readFileSync(file, "utf-8").split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Skip comment-only lines
      if (/^\s*(\/\/|\*|\/\*\*)/.test(line)) continue;

      let form = null;
      let match = null;
      let usesHead = false;

      if (FORM1_BLOB_RE.test(line)) {
        form = 1;
        match = line.match(FORM1_BLOB_RE)[0];
      } else if (FORM3_API_RE.test(line)) {
        form = 3;
        match = line.match(FORM3_API_RE)[0];
      } else if (FORM2_RAW_RE.test(line)) {
        form = 2;
        match = line.match(FORM2_RAW_RE)[0];
        usesHead = FORM2_RAW_HEAD_RE.test(line);
      }

      if (form !== null) {
        entries.push({ file: relFile, lineNum, form, match, usesHead, line: line.trim() });
      }
    }
  }

  return entries;
}

const webappUrls = extractWebappGitHubUrls();

describe("webapp github url CORS format check", () => {
  it("should find at least one GitHub URL in webapp", () => {
    expect(webappUrls.length).toBeGreaterThan(0);
  });

  for (const entry of webappUrls) {
    it(`${entry.file}:${entry.lineNum}`, () => {
      // Must use raw.githubusercontent.com (Form 2) — Forms 1 and 3 cause CORS errors
      expect(
        entry.form,
        `CORS error: must use https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}\n` +
          `  Found: ${entry.line}\n` +
          `  Form 1 (github.com/blob/) returns 302 redirect without CORS headers.\n` +
          `  Form 3 (api.github.com/contents/) requires auth token for CORS.`,
      ).toBe(2);

      // Must use /HEAD/ branch, not /master/ or /main/
      expect(
        entry.usesHead,
        `Wrong branch: must use /HEAD/ in raw.githubusercontent.com URL\n` +
          `  Found: ${entry.line}\n` +
          `  Expected: https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}`,
      ).toBe(true);
    });
  }
});
