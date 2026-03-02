/**
 * build-include.cjs - Generic BEGIN/END block substitution engine.
 *
 * Supports two modes:
 *
 * 1. Auto mode (file path markers) - no config needed:
 *    When the marker key looks like a file path (contains "/" or ends with a known extension),
 *    the content is read from that path automatically.
 *      # BEGIN path/to/file.sh
 *      # END path/to/file.sh
 *
 *    For markdown files, use HTML comments:
 *      <!-- BEGIN path/to/file.sh -->
 *      <!-- END path/to/file.sh -->
 *
 *    For JS/TS files, use double-slash comments:
 *      // BEGIN path/to/file.js

// END path/to/file.js
 *
 * 2. Config mode (INCLUSIONS array):
 *    For non-file-path keys or when transforms are needed.
 *
 * Comment prefix is auto-detected from the target file extension:
 *   .md   -> "<!--" (with " -->" suffix on END marker)
 *   .html -> "<!--" (with " -->" suffix on END marker)
 *   .js/.jsx/.ts/.tsx/.cjs/.mjs -> "//"
 *   *     -> "#"
 *
 * Scans all git-tracked *.sh, *.md, and *.js/.jsx/.ts/.tsx/.cjs/.mjs files for BEGIN/END markers automatically.
 * Optionally pass specific files as CLI args to process only those.
 *
 * Usage:
 *   node software/build-include.cjs                     # auto-scan tracked *.sh, *.md, and *.js/ts files
 *   node software/build-include.cjs build.sh run.sh     # process specific files only
 */
const fs = require("fs");
const { execSync } = require("child_process");
const {
  isFilePath,
  autoTransform,
  findMarkers,
  cleanBlock,
  replaceBlock,
  processInlineMarkers,
  COLOR_MAP,
} = require("./build-include.common.cjs");

/**
 * Explicit inclusions for keys that aren't file paths or need transforms.
 * Each entry: { targets, key, source, transform?, commentPrefix?, commentSuffix? }
 */
const INCLUSIONS = [
  // Example:
  // {
  //   targets: ['README.md'],
  //   key: 'some-key',
  //   source: 'path/to/source.sh',
  //   transform: (content) => content.trim(),
  // },
];

// Check for --clean mode
const isCleanMode = process.argv.includes("--clean");
const modeName = isCleanMode ? "clean-include" : "build-include";

// Build a lookup from key -> inclusion config
const inclusionsByKey = new Map();
for (const inc of INCLUSIONS) {
  inclusionsByKey.set(inc.key, inc);
}

// Determine target files: CLI args (excluding flags) or auto-scan git-tracked *.sh and *.md files
const cliTargets = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const trackedFiles = execSync('git ls-files "*.sh" "*.md" "*.js" "*.jsx" "*.ts" "*.tsx" "*.cjs" "*.mjs" "*.jsonc"', { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
const inclusionTargets = INCLUSIONS.flatMap((inc) => inc.targets);
const targetFiles = cliTargets.length > 0 ? cliTargets : [...new Set([...trackedFiles, ...inclusionTargets])];

let totalUpdated = 0;

for (const target of targetFiles) {
  if (!fs.existsSync(target)) {
    console.log(`>> File not found: ${target}, skipping`);
    continue;
  }

  let content = fs.readFileSync(target, "utf8");
  let changed = false;

  const markers = findMarkers(content, target);

  for (const { key, commentPrefix, commentSuffix } of markers) {
    let replaced;

    if (isCleanMode) {
      // Clean mode: replace block content with empty
      replaced = cleanBlock(content, key, commentPrefix, commentSuffix);
    } else {
      // Build mode: replace block content with source
      let sourceContent;

      const inc = inclusionsByKey.get(key);
      if (inc) {
        // Config mode: use explicit inclusion
        sourceContent = fs.readFileSync(inc.source, "utf8");
        if (inc.transform) sourceContent = inc.transform(sourceContent);
      } else if (isFilePath(key)) {
        // Auto mode: key is the file path
        if (!fs.existsSync(key)) {
          console.log(`>> Source file not found: ${key} (referenced in ${target}), skipping`);
          continue;
        }
        sourceContent = autoTransform(fs.readFileSync(key, "utf8"), key, target);
      } else {
        // Unknown key, not a file path, no config — skip
        continue;
      }

      sourceContent = sourceContent.trim();
      replaced = replaceBlock(content, key, sourceContent, commentPrefix, commentSuffix);
    }

    if (replaced && replaced !== content) {
      content = replaced;
      changed = true;
      console.log(`>> ${isCleanMode ? "Cleaned" : "Updated"} ${target} (block: ${key})`);
    } else {
      console.log(`>> No changes needed in ${target} (block: ${key})`);
    }
  }

  if (changed) {
    fs.writeFileSync(target, content);
    totalUpdated++;
  }
}

// --- Inline marker processing for JSONC and software/scripts/*.js files ---
if (!isCleanMode) {
  const colorMap = COLOR_MAP;
  const inlineMarkerFiles = targetFiles.filter((f) => f.endsWith(".jsonc") || (f.endsWith(".js") && f.startsWith("software/scripts/")));

  for (const target of inlineMarkerFiles) {
    if (!fs.existsSync(target)) continue;

    const content = fs.readFileSync(target, "utf8");
    const result = isCleanMode ? cleanInlineMarkers(content) : processInlineMarkers(content, COLOR_MAP, target);

    if (result.warnings) {
      for (const warning of result.warnings) {
        console.log(warning);
      }
    }

    if (result.changed) {
      fs.writeFileSync(target, result.content);
      totalUpdated++;
      console.log(`>> ${isCleanMode ? "Cleaned" : "Updated"} ${target} (inline markers)`);
    }
  }
}

console.log(`>> ${modeName}: ${totalUpdated} file(s) updated`);
