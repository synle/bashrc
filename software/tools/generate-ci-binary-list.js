#!/usr/bin/env node
/**
 * Generate the CI binary verification block in .github/actions/ci-build/action.yml
 * from software/metadata/ci-binaries.json. The block lives inside a YAML `run: |`
 * literal scalar, so every line (including the `# END` marker) must keep the
 * surrounding indentation — that's why this generator is dedicated rather than
 * routed through build-include.js (which doesn't preserve indent on END).
 *
 * Reads the BEGIN/END markers, infers their leading whitespace from the BEGIN
 * line, and rewrites the body + END marker with the same indent.
 *
 * Usage:
 *   node software/tools/generate-ci-binary-list.js          # write
 *   node software/tools/generate-ci-binary-list.js --check  # exit 1 if changes needed (CI)
 */
const fs = require("fs");
const path = require("path");

/** Path to the JSON manifest (source of truth). */
const JSON_PATH = path.resolve(__dirname, "../metadata/ci-binaries.json");
/** Path to the YAML target where the BEGIN/END block lives. */
const YAML_PATH = path.resolve(__dirname, "../../.github/actions/ci-build/action.yml");
/** Marker key used in the YAML BEGIN/END block. */
const KEY = "ci-binary-checks";

/**
 * Convert a list of entries (string shorthand or { name, version_cmd } objects)
 * into bash `<fn> <name> [<"version_cmd">]` lines.
 * @param {string} fn - Bash function name (e.g. "check_binary_required").
 * @param {Array<string | { name: string, version_cmd?: string }>} entries
 * @returns {string[]}
 */
function toLines(fn, entries) {
  return entries.map((e) => {
    const name = typeof e === "string" ? e : e.name;
    const vc = typeof e === "object" ? e.version_cmd : undefined;
    return vc ? `${fn} ${name} "${vc}"` : `${fn} ${name}`;
  });
}

/**
 * Build the rendered block body (no markers, no indentation applied).
 * @param {{ required: any[], warn: any[] }} data
 * @returns {string}
 */
function renderBody(data) {
  return [...toLines("check_binary_required", data.required), ...toLines("check_binary_warn", data.warn)].join("\n");
}

/**
 * Substitute the body between `# BEGIN <KEY>` and `# END <KEY>` markers in the
 * target YAML, preserving the BEGIN line's leading indentation on every body
 * line and on the END marker. Returns the new file content.
 * @param {string} yaml - Current file content.
 * @param {string} body - Rendered body (unindented, no markers).
 * @returns {string}
 */
function substitute(yaml, body) {
  const beginRegex = new RegExp(`^([ \\t]*)# BEGIN ${KEY}\\s*$`, "m");
  const endRegex = new RegExp(`^[ \\t]*# END ${KEY}\\s*$`, "m");
  const beginMatch = beginRegex.exec(yaml);
  if (!beginMatch) throw new Error(`BEGIN marker '# BEGIN ${KEY}' not found in ${YAML_PATH}`);
  const indent = beginMatch[1];
  const beginLineEnd = beginMatch.index + beginMatch[0].length;

  const endMatch = endRegex.exec(yaml.slice(beginLineEnd));
  if (!endMatch) throw new Error(`END marker '# END ${KEY}' not found after BEGIN in ${YAML_PATH}`);
  const endStart = beginLineEnd + endMatch.index;
  const endLineEnd = endStart + endMatch[0].length;

  const indentedBody = body
    .split("\n")
    .map((l) => (l.length ? indent + l : l))
    .join("\n");
  const replacement = `${indent}# BEGIN ${KEY}\n${indentedBody}\n${indent}# END ${KEY}`;
  return yaml.slice(0, beginMatch.index) + replacement + yaml.slice(endLineEnd);
}

/**
 * Main entry point. Reads JSON + YAML, computes the new YAML, writes (or checks).
 * @param {object} [opts]
 * @param {boolean} [opts.check=false] - If true, exit 1 when changes are needed.
 */
function main(opts = {}) {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  const yaml = fs.readFileSync(YAML_PATH, "utf-8");
  const body = renderBody(data);
  const next = substitute(yaml, body);
  if (next === yaml) {
    console.log(`>> ${path.basename(YAML_PATH)} (block: ${KEY}) — no changes`);
    return;
  }
  if (opts.check) {
    console.error(`>> ${path.basename(YAML_PATH)} (block: ${KEY}) is out of date — run: node ${path.relative(process.cwd(), __filename)}`);
    process.exit(1);
  }
  fs.writeFileSync(YAML_PATH, next);
  console.log(`>> ${path.basename(YAML_PATH)} (block: ${KEY}) — updated`);
}

if (require.main === module) {
  main({ check: process.argv.includes("--check") });
} else {
  module.exports = { renderBody, substitute, toLines };
}
