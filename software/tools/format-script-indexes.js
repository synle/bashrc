/**
 * Generate the script list index at software/metadata/script-list.config.
 *
 * The config is the `remote_cache` source for `listRepoDir()` in software/index.js
 * (the bootstrap fallback when the GitHub tree API is unavailable) and backs the
 * "script to run" picker in webapp/index.jsx.
 *
 * This tool is the ONLY generator for that file — keep it that way. A second
 * generator that derives the list differently silently rewrites the config, and
 * the next `make format` flips it back.
 *
 * Test files are excluded wholesale: specs, the vitest sandbox harness, and the
 * smoke-test setup are none of them runnable scripts, so listing them only pads
 * the file fetched during bootstrap and pollutes the webapp picker with entries
 * that do nothing when selected.
 */
const fs = require("fs");
const path = require("path");

const OUT_FILE = "software/metadata/script-list.config";
const ROOT_DIR = "software";

/**
 * Folders never worth indexing — generated output, third-party code, and tests.
 * `types` holds generated .d.ts output; `tests` holds nothing runnable.
 */
const EXCLUDE_DIRS = new Set(["node_modules", ".build", "types", "tests"]);

/** Only runnable script types belong in the index. */
const INCLUDE_EXTS = new Set([".js", ".sh"]);

/**
 * True for test specs (`*.spec.js`), which are not runnable scripts.
 * Belt-and-braces alongside the `tests` folder exclusion — specs colocated
 * outside software/tests/ must not slip into the index either.
 * @param {string} name - Bare file name
 * @returns {boolean}
 */
function isSpecFile(name) {
  return name.includes(".spec.");
}

/**
 * Recursively collects indexable script paths under a folder.
 * @param {string} folder - Folder to walk
 * @param {string[]} results - Accumulator of matched paths
 * @returns {string[]} The accumulator
 */
function walk(folder, results) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const entryPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(entryPath, results);
      continue;
    }
    if (!INCLUDE_EXTS.has(path.extname(entry.name))) continue;
    if (isSpecFile(entry.name)) continue;
    results.push(entryPath);
  }
  return results;
}

const files = walk(ROOT_DIR, []).sort();
fs.writeFileSync(OUT_FILE, files.join("\n") + "\n");
console.log("Written " + files.length + " files to " + OUT_FILE);
