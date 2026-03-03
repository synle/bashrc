/**
 * Debug runner for VS Code: loads index.js as a library, then runs a script file
 * with its original filename so VS Code breakpoints work.
 *
 * Usage: node software/.debug-runner.cjs software/scripts/fonts.js
 *
 * How it works:
 * 1. Reads index.js and strips the IIFE entry point at the bottom
 * 2. Runs the library portion in a vm context to define all globals
 * 3. Runs the script file in the SAME context but with its real filename
 *    (this is what makes breakpoints work — the debugger sees the original file)
 * 4. Calls doWork() defined by the script, mimicking what the IIFE would do
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const scriptFile = process.argv[2];
if (!scriptFile) {
  console.error("Usage: node software/.debug-runner.cjs <script-file>");
  process.exit(1);
}

const scriptPath = path.resolve(scriptFile);
if (!fs.existsSync(scriptPath)) {
  console.error(`Script not found: ${scriptPath}`);
  process.exit(1);
}

// Guard: reject non-script files (e.g. old combined.js temp files, launch.json, etc.)
if (!scriptPath.includes("software/scripts/")) {
  console.error(`[debug-runner] Error: expected a file under software/scripts/, got: ${scriptPath}`);
  console.error(`[debug-runner] Open a script file (e.g. software/scripts/fonts.js) in the editor, then press F5.`);
  process.exit(1);
}

const indexPath = path.resolve(__dirname, "index.js");
if (!fs.existsSync(indexPath)) {
  console.error(`index.js not found: ${indexPath}`);
  process.exit(1);
}

// Read index.js and strip the IIFE entry point so it doesn't auto-execute
const indexSource = fs.readFileSync(indexPath, "utf-8");
const iifeStart = indexSource.indexOf("\n(async function () {");
const librarySource = iifeStart > 0 ? indexSource.substring(0, iifeStart) : indexSource;

// Replace const/let with var so declarations become context properties
// (same technique used in software/tests/setup.js)
const varSource = librarySource.replace(/^(const|let) /gm, "var ");

// Read the script file
const scriptSource = fs.readFileSync(scriptPath, "utf-8");
const varScriptSource = scriptSource.replace(/^(const|let) /gm, "var ");

// Create a sandbox context with real modules (not mocked like tests)
const context = vm.createContext({
  require,
  process,
  console,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  Buffer,
  global: globalThis,
  globalThis,
  __filename: scriptPath,
  __dirname: path.dirname(scriptPath),
});

console.log(`[debug-runner] Script: ${scriptFile}`);
console.log(`[debug-runner] Starting...\n`);

// Step 1: Run index.js library code to define all globals/utilities
vm.runInContext(varSource, context, {
  filename: indexPath,
  breakOnSigint: true,
});

// Step 2: Run the script file with its REAL filename (enables breakpoints)
vm.runInContext(varScriptSource, context, {
  filename: scriptPath,
  breakOnSigint: true,
});

// Step 3: Call doWork() like the IIFE would, with the same bootstrap logic
(async function () {
  // Replicate the IIFE bootstrap setup
  try {
    context.HOME_HOST_NAMES = [];
  } catch (err) {}

  // Error handlers
  process
    .on("unhandledRejection", (reason, p) => {
      console.error(`[Error] unhandledRejection`, reason);
      process.exit(1);
    })
    .on("uncaughtException", (err) => {
      console.error(`[Error] uncaughtException`, err);
      process.exit(1);
    });

  // Call doWork from the script
  try {
    if (typeof context.doWork === "function") {
      await context.doWork();
    } else {
      console.error("[debug-runner] No doWork() function found in script file");
      process.exit(1);
    }
  } catch (err) {
    console.error(`[debug-runner] Error:`, err);
  }
})();
