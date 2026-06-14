/**
 * Repo-wide lint test: blocks the legacy `////// Title //////` section marker
 * style from re-appearing in JS / JSONC / TS files.
 *
 * Canonical style per CLAUDE.md is `// --- Title ---`. A one-off sweep cleaned
 * software/index.js — this test prevents regression (paste-from-old-branch,
 * unconverted copy-paste, etc.).
 *
 * Detection rule: a line that is solely 3-or-more `/` characters (after trim)
 * is the unmistakable signature of the old fence style. Comments like
 * `// some text` and JSDoc blocks (`/**`) start with `/*` or `//` followed by
 * non-`/` content, so they don't match.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Directories the test refuses to descend into. */
const SKIP_DIRS = new Set([".git", "node_modules", ".build", "dist", "assets", "coverage", ".vscode", ".claude", ".github", "docs"]);

/** File extensions the rule covers (JS / TS / JSONC). */
const SCAN_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".jsonc"]);

/**
 * Walks the repo and returns every file matching SCAN_EXTS, skipping SKIP_DIRS.
 * @param {string} dir - Directory to recurse into
 * @param {string[]} out - Accumulator (mutated)
 * @returns {string[]} List of absolute file paths
 */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (SCAN_EXTS.has(path.extname(entry.name))) {
      out.push(p);
    }
  }
  return out;
}

describe("section marker style", () => {
  it("rejects legacy `//////` section-marker fences in JS/TS/JSONC", () => {
    const files = walk(ROOT_DIR);
    /** @type {string[]} */
    const offenders = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        // A line that, when trimmed, is solely 3+ forward slashes — the old fence
        // pattern (`//////////////////////////////////////////////////////`). Normal
        // `//` comments have non-`/` content after the prefix, so they pass.
        if (/^\/{3,}\s*$/.test(lines[i])) {
          offenders.push(`${path.relative(ROOT_DIR, file)}:${i + 1}`);
        }
      }
    }
    expect(
      offenders,
      `Found legacy '//////' section fences. Convert to '// --- Title ---' per CLAUDE.md.\n` + offenders.map((o) => `  ${o}`).join("\n"),
    ).toEqual([]);
  });
});
