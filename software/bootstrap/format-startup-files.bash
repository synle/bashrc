#!/usr/bin/env bash
# Shared startup formatter; run.sh includes this source for local and downloaded runs.

# _format_startup_file <canonical-file>: format shell code, separate BEGIN comments, and trim file boundaries.
# Requires shfmt and Node. Returns their failure status; writes only changed spacing and preserves file permissions.
function _format_startup_file() {
  shfmt -w -i 2 -bn -sr "$1" || return
  node - "$1" << 'STARTUP_SPACING_JS'
/** Filesystem access keeps the existing file's permissions and ownership. */
const fs = require("fs");
/** The native parser distinguishes comments from quoted and heredoc data. */
const { execFileSync } = require("child_process");
/** Canonical eligible filename supplied by the runner. */
const target = process.argv[2];
/** Snapshot used both for parsing and the concurrent-writer check. */
const source = fs.readFileSync(target, "utf8");
/** Bound syntax-tree output for large generated profiles to 64 MiB. */
const maxSyntaxTreeBytes = 64 * 1024 * 1024;
/** Parsed syntax tree uses one-based comment line positions. */
const tree = JSON.parse(execFileSync("shfmt", ["--to-json"], {
  input: source,
  encoding: "utf8",
  timeout: 10000,
  maxBuffer: maxSyntaxTreeBytes,
}));
/** Zero-based lines containing real BEGIN comments, never shell string data. */
const beginLines = new Set();
/**
 * Collect BEGIN comment positions from the native syntax tree.
 * @param {unknown} node Current JSON value; primitives and absent fields are ignored.
 * @returns {void} Adds comment line indexes to beginLines without changing the tree.
 */
function collectBeginLines(node) {
  if (node === null || typeof node !== "object") return;
  if (node.Hash && typeof node.Text === "string" && /^[ \t]*BEGIN(?:[ \t]|$)/.test(node.Text)) {
    beginLines.add(node.Hash.Line - 1);
  }
  for (const child of Object.values(node)) collectBeginLines(child);
}
collectBeginLines(tree);
/** Preserve internal blank lines; trim only after inserting missing separators. */
const content = source.split("\n").map((line, index, lines) => {
  if (beginLines.has(index) && /^[ \t]*#/.test(line) && index > 0 && lines[index - 1].trim() !== "") {
    return "\n" + line;
  }
  return line;
}).join("\n").trim() + "\n";
if (content !== source) {
  if (fs.readFileSync(target, "utf8") !== source) {
    throw new Error("Startup file changed during spacing normalization; retry is safe");
  }
  fs.writeFileSync(target, content);
}
STARTUP_SPACING_JS
}
