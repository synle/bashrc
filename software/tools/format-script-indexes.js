/** Generate script list indexes for software/metadata/script-list.config. */
const fs = require("fs");
const path = require("path");
const out = "software/metadata/script-list.config";
const excludeDirs = new Set(["node_modules", ".build"]);
const excludeExts = new Set([".d.ts"]);
const includeExts = new Set([".js", ".sh"]);
function walk(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludeDirs.has(entry.name)) walk(path.join(dir, entry.name), results);
    } else {
      const name = entry.name;
      const ext = name.endsWith(".d.ts") ? ".d.ts" : path.extname(name);
      if (includeExts.has(ext) && !excludeExts.has(ext)) results.push(path.join(dir, name));
    }
  }
  return results;
}
const files = walk("software", []).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
fs.writeFileSync(out, files.join("\n") + "\n");
console.log("Written " + files.length + " files to " + out);
