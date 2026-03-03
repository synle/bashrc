/**
 * Debug runner for VS Code: loads index.js globals then executes a script file.
 * Usage: node software/.debug-runner.js software/scripts/url-porter.js
 *
 * This concatenates index.js + the target script into a temp file and requires it,
 * mimicking the production pipeline: `cat index.js && cat script.js | node`
 *
 * The IIFE at the bottom of index.js detects the doWork() function defined by
 * the script file and calls it automatically.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Module = require("module");

const scriptFile = process.argv[2];
if (!scriptFile) {
  console.error("Usage: node software/.debug-runner.js <script-file>");
  process.exit(1);
}

const scriptPath = path.resolve(scriptFile);
if (!fs.existsSync(scriptPath)) {
  console.error(`Script not found: ${scriptPath}`);
  process.exit(1);
}

const indexPath = path.resolve(__dirname, "index.js");
if (!fs.existsSync(indexPath)) {
  console.error(`index.js not found: ${indexPath}`);
  process.exit(1);
}

// Read both files
const indexCode = fs.readFileSync(indexPath, "utf-8");
const scriptCode = fs.readFileSync(scriptPath, "utf-8");

// Concatenate: index.js defines globals + IIFE at bottom checks for doWork()
// The script file defines doWork() which the IIFE will find and call
const combined = indexCode + "\n" + scriptCode;

// Write combined file to tmp so we can require it (allows Node to handle it normally)
const tmpDir = path.join(require("os").tmpdir(), "bashrc_debug");
fs.mkdirSync(tmpDir, { recursive: true });
const tmpFile = path.join(tmpDir, "combined.js");
fs.writeFileSync(tmpFile, combined);

console.log(`[debug-runner] Script: ${scriptFile}`);
console.log(`[debug-runner] Combined file: ${tmpFile}`);
console.log(`[debug-runner] Starting...\n`);

// Execute via require so Node handles it as a proper module
require(tmpFile);
