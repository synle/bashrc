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
