/**
 * build-jsdocs.cjs - Manage JSDoc reference tags in JS files.
 *
 * Two modes:
 *   node software/build-jsdocs.cjs           # Build: prepend /// <reference> tags
 *   node software/build-jsdocs.cjs --clean   # Clean: remove /// <reference> tags
 */
const fs = require("fs");
const path = require("path");

const isCleanMode = process.argv.includes("--clean");
const modeName = isCleanMode ? "clean-jsdocs" : "build-jsdocs";

const scriptsDir = "software";
const baseScript = "software/index.js";

function getJsFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getJsFiles(full));
    else if (entry.name.endsWith(".js")) results.push(full);
  }
  return results;
}

let totalUpdated = 0;

for (const file of getJsFiles(scriptsDir)) {
  let content = fs.readFileSync(file, "utf8");

  // remove existing reference tag line
  const cleaned = content.replace(/^\/\/\/\s*<reference[^\n]*\n\n?/, "");

  if (isCleanMode) {
    if (cleaned !== content) {
      fs.writeFileSync(file, cleaned);
      totalUpdated++;
      console.log(`  >> Cleaned reference tag from ${file}`);
    }
  } else {
    const relPath = path.relative(path.dirname(file), baseScript);
    const refTag = '/// <reference path="' + relPath + '" />';
    const newContent = refTag + "\n\n" + cleaned.trim();

    if (newContent !== content) {
      fs.writeFileSync(file, newContent);
      totalUpdated++;
      console.log(`  >> Prepended reference tag to ${file}`);
    }
  }
}

console.log(`  >> ${modeName}: ${totalUpdated} file(s) updated`);
