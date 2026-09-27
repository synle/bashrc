/** Gate `make test_dryrun` on per-script statuses in run_timing.json instead of grepping log text. */
const fs = require("fs");
const path = require("path");

/** Status value index.js writes for a script that threw (anything else is success/skipped). */
const ERROR_STATUS = "error";

/**
 * Lists every script that ended in an error status, from both the per-script
 * `scripts` map (bundle timings) and the `results` array (resolution results).
 * @param {{ scripts?: Record<string, { status: string, error?: string }>, results?: { file: string, status: string, description?: string }[] }} timing - Parsed run_timing.json
 * @returns {{ file: string, detail: string }[]} One entry per failed script, deduped by file
 */
function findFailures(timing) {
  const failures = new Map();
  for (const [file, entry] of Object.entries(timing.scripts || {})) {
    if (entry && entry.status === ERROR_STATUS) failures.set(file, entry.error || "");
  }
  for (const r of timing.results || []) {
    if (r.status === ERROR_STATUS && !failures.has(r.file)) failures.set(r.file, r.description || "");
  }
  return [...failures].map(([file, detail]) => ({ file, detail }));
}

/**
 * Finds the newest run_timing.json under any candidate temp root written at or after `sinceMs`.
 * @param {string[]} roots - Candidate BASHRC_TEMP_ROOT_DIR folders
 * @param {number} sinceMs - Epoch ms the dry run started
 * @returns {string} Path to the timing file, or "" when none matches
 */
function findTimingFile(roots, sinceMs) {
  let best = "";
  let bestMtime = -1;
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch (err) {
      if (err.code === "ENOENT") continue;
      throw err;
    }
    for (const name of entries) {
      const candidate = path.join(root, name, "run_timing.json");
      let stat;
      try {
        stat = fs.statSync(candidate);
      } catch (err) {
        // ENOTDIR: sibling log files (e.g. bashrc_bg_brew_*.log) share the root with run folders.
        if (err.code === "ENOENT" || err.code === "ENOTDIR") continue;
        throw err;
      }
      if (stat.mtimeMs >= sinceMs && stat.mtimeMs > bestMtime) {
        best = candidate;
        bestMtime = stat.mtimeMs;
      }
    }
  }
  return best;
}

/**
 * CLI: `node check-dryrun-results.js <sinceMs> <root> [<root>...]`.
 * Exits 1 when no timing file is found or any script failed; prints failures to stderr.
 * @returns {void}
 */
function main() {
  const [sinceArg, ...roots] = process.argv.slice(2);
  const sinceMs = Number(sinceArg);
  if (!Number.isFinite(sinceMs) || roots.length === 0) {
    process.stderr.write("usage: check-dryrun-results.js <sinceMs> <root> [<root>...]\n");
    process.exit(2);
  }
  const timingFile = findTimingFile(roots, sinceMs);
  if (!timingFile) {
    process.stderr.write(`FAIL: no run_timing.json written since ${sinceMs} under: ${roots.join(", ")}\n`);
    process.exit(1);
  }
  const timing = JSON.parse(fs.readFileSync(timingFile, "utf8"));
  const failures = findFailures(timing);
  const total = Object.keys(timing.scripts || {}).length;
  if (failures.length > 0) {
    process.stderr.write(`FAIL: ${failures.length} script(s) errored in dry run (${timingFile}):\n`);
    for (const f of failures) process.stderr.write(`  - ${f.file}: ${f.detail}\n`);
    process.exit(1);
  }
  process.stderr.write(`>> Dry run clean: ${total} script(s) ran, 0 errors (${timingFile})\n`);
}

if (require.main === module) main();

module.exports = { findFailures, findTimingFile };
