/**
 * build-include.js - Generic BEGIN/END block substitution engine.
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
 *   .js/.jsx/.ts/.tsx/.mjs -> "//"
 *   *     -> "#"
 *
 * Scans all git-tracked *.sh, *.md, and *.js/.jsx/.ts/.tsx/.mjs files for BEGIN/END markers automatically.
 * Optionally pass specific files as CLI args to process only those.
 *
 * Usage:
 *   make format_build_include                                  # auto-scan tracked *.sh, *.md, and *.js/ts files
 *   make clean_include                                         # clean BEGIN/END block inclusions
 */
const fs = require("fs");
const path = require("path");
const { TEXT_BLOCK_START_MARKER, TEXT_BLOCK_END_MARKER, replaceBlock } = require("../common.js");

/** Comment style per file extension */
const COMMENT_STYLES = {
  ".md": { prefix: "<!--", suffix: " -->" },
  ".html": { prefix: "<!--", suffix: " -->" },
  ".xml": { prefix: "<!--", suffix: " -->" },
  ".js": { prefix: "//", suffix: "" },
  ".jsx": { prefix: "//", suffix: "" },
  ".ts": { prefix: "//", suffix: "" },
  ".tsx": { prefix: "//", suffix: "" },
  ".mjs": { prefix: "//", suffix: "" },
  ".jsonc": { prefix: "//", suffix: "" },
  ".scss": { prefix: "//", suffix: "" },
};
/** @type {{prefix: string, suffix: string}} Default comment style used for files without a recognized extension */
const DEFAULT_COMMENT_STYLE = { prefix: "#", suffix: "" };

/** Get comment style for a target file */
function getCommentStyle(targetFile) {
  const ext = path.extname(targetFile).toLowerCase();
  return COMMENT_STYLES[ext] || DEFAULT_COMMENT_STYLE;
}

/** Strip shebang line from shell scripts */
function stripShebang(content) {
  return content.replace(/^#!.*\n/, "");
}

/** Check if a key looks like a file path */
function isFilePath(key) {
  return key.includes("/") || key.includes(".");
}

/** Map source file extensions to markdown code fence languages */
const CODE_FENCE_LANGUAGES = {
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".ps1": "powershell",
};

/**
 * Auto-transform source content based on the source file extension
 * and what makes sense in the target context.
 */
function autoTransform(sourceContent, sourceFile, targetFile) {
  const sourceExt = path.extname(sourceFile).toLowerCase();
  const targetExt = path.extname(targetFile).toLowerCase();

  // Strip shebang from shell scripts
  if ([".sh", ".bash", ".zsh"].includes(sourceExt)) {
    sourceContent = stripShebang(sourceContent);
  }

  // When including in markdown, wrap code files in a fenced code block
  const codeLang = CODE_FENCE_LANGUAGES[sourceExt];
  if (targetExt === ".md" && codeLang) {
    const code = sourceContent
      .split("\n")
      .filter((line) => !line.startsWith("#") && line.trim() !== "")
      .join("\n")
      .trim();
    return "\n```" + codeLang + "\n" + code + "\n```\n";
  }

  return sourceContent;
}

/**
 * Generate a metadata comment for inlined source files: path | md5 | size.
 * @param {string} sourceFile - Path to the source file.
 * @param {string} content - The file content (used for md5 hash).
 */
function sourceMetadataHeader(sourceFile, content) {
  try {
    const stat = fs.statSync(sourceFile);
    const md5 = require("crypto").createHash("md5").update(content).digest("hex");
    const size = stat.size < 1024 ? `${stat.size} B` : `${(stat.size / 1024).toFixed(1)} KB`;
    return `# ${sourceFile} | ${md5} | ${size}`;
  } catch (_) {
    return "";
  }
}

/**
 * Scan a file for all BEGIN markers and return { key, commentPrefix, commentSuffix } for each.
 */
function findMarkers(content, targetFile) {
  const { prefix, suffix } = getCommentStyle(targetFile);
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSuffix = suffix.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match: prefix BEGIN key suffix (suffix is optional with possible whitespace)
  const pattern = escapedSuffix
    ? `${escapedPrefix} ${TEXT_BLOCK_START_MARKER} (.+?)\\s*${escapedSuffix}`
    : `${escapedPrefix} ${TEXT_BLOCK_START_MARKER} (.+)`;

  const regex = new RegExp(pattern, "g");
  const markers = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    markers.push({
      key: match[1].trim(),
      commentPrefix: prefix,
      commentSuffix: suffix,
    });
  }
  return markers;
}

/**
 * Remove content between BEGIN/END markers, leaving the markers with empty content.
 */
function cleanBlock(content, key, commentPrefix, commentSuffix) {
  return replaceBlock(content, key, "", commentPrefix, commentSuffix);
}

/**
 * Get the raw content between BEGIN/END markers without modifying it.
 * Returns null if markers are not found.
 * @param {string} content - The full text content
 * @param {string} key - The marker key
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} commentSuffix - Comment suffix (e.g. ' -->', '')
 * @returns {string|null} The content between the markers, or null if markers not found
 */
function getRawBlockContent(content, key, commentPrefix, commentSuffix) {
  const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
  const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;

  const beginIdx = content.indexOf(BEGIN);
  const endIdx = content.indexOf(END);

  if (beginIdx === -1 || endIdx === -1) return null;

  return content.slice(beginIdx + BEGIN.length + 1, endIdx).trim();
}

/** Convert a hex color (#RRGGBB) to float RGB components (0-1 range) for iTerm plist format */
function _hexToFloatRgb(hex) {
  return {
    R: parseInt(hex.slice(1, 3), 16) / 255,
    G: parseInt(hex.slice(3, 5), 16) / 255,
    B: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

/** Generate derived color variants for all hex colors in a theme object.
 * - Float RGB: _R, _G, _B (for iTerm plist format)
 * - Alpha hex: _alpha0 through _alpha100 in 20% steps (for VS Code, etc.)
 */
function _generateColorVariants(theme) {
  const alphaSteps = { _alpha0: "00", _alpha20: "33", _alpha40: "66", _alpha60: "99", _alpha80: "CC", _alpha100: "FF" };
  const variants = {};
  for (const [key, value] of Object.entries(theme)) {
    if (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)) {
      const { R, G, B } = _hexToFloatRgb(value);
      variants[`${key}_R`] = R;
      variants[`${key}_G`] = G;
      variants[`${key}_B`] = B;
      for (const [suffix, hex] of Object.entries(alphaSteps)) {
        variants[`${key}${suffix}`] = `${value}${hex}`;
      }
    }
  }
  return variants;
}

/**
 * Central color map for dark and light themes.
 * Colors shared across Windows Terminal, Sublime Text, VS Code, and iTerm config files.
 * Referenced via inline markers in JSONC files: // {{dark.key}} or // {{light.key}}
 * Derived variants are auto-generated from hex values:
 * - Float RGB (e.g. dark.red_R, dark.red_G, dark.red_B) for iTerm plist format
 * - Alpha hex (e.g. dark.red_alpha0 through dark.red_alpha100) in 20% steps
 */
const _lightHex = {
  themeName: "Sy Light",
  background: "#F8F8F8", // editor bg, panels, title bar, gutter, tab bar, status bar
  foreground: "#1E1E1E", // editor text, operators, punctuation, brackets
  cursorColor: "#0451A5", // cursor
  selection: "#ADD6FF", // selection bg, selected items, drop target, highlight
  black: "#000000", // terminal black, shadow
  blue: "#0033B3", // keywords, storage, constants, links, accent, borders (focused), info, modified, renamed
  brightBlack: "#595959", // muted/disabled text, placeholders, scrollbar, predictive, unreachable
  brightBlue: "#1A85FF", // terminal bright blue
  brightCyan: "#1A7A7A", // types, constructors, enums, hints, terminal bright cyan
  brightGreen: "#16825D", // terminal bright green
  brightPurple: "#9400D3", // imports/exports, control flow, preprocessor, terminal bright magenta
  brightRed: "#CD3131", // strings, embedded, links, terminal bright red
  brightWhite: "#FFFFFF", // terminal bright white
  brightYellow: "#B68A00", // terminal bright yellow
  cyan: "#005FA3", // syntax constants, terminal cyan
  green: "#006B1E", // comments, created/success, diff added, terminal green
  purple: "#6C0099", // terminal magenta
  red: "#B30000", // errors, deleted, diff deleted, terminal red
  white: "#A0A0A0", // terminal white
  yellow: "#BF8803", // warnings, terminal yellow
  lightBlue: "#2E6FBA", // (light equivalent of dark.lightBlue)
  lightGreen: "#067849", // (light equivalent of dark.lightGreen)
  orange: "#C75B2E", // (light equivalent of dark.orange)
  gold: "#9C6A08", // (light equivalent of dark.gold)
  darkBlue: "#001080", // variables, properties, attributes, labels
  linkBlue: "#0366D6", // link URIs, accent, minimap border, selection border, fold marker
  darkGreen: "#036B3F", // numbers
  brown: "#7B5E00", // functions, conflicts, warning bg
  darkRed: "#9B2C2C", // regex, escape chars, special punctuation, tags, string specials, titles
  gray: "#D4D4D4", // hover states, disabled elements
  brightGray: "#EAEAEA", // active line, borders, rulers, indent guides
};
const _darkHex = {
  themeName: "Sy Dark",
  background: "#0A0A0A", // editor bg, panels, title bar, gutter, tab bar, status bar
  foreground: "#E0E0E0", // editor text, operators, punctuation, brackets
  cursorColor: "#569CD6", // cursor
  selection: "#264F78", // selection bg, selected items, drop target, highlight
  black: "#000000", // terminal black, shadow
  blue: "#569CD6", // keywords, storage, constants, tags, links, accent, borders (focused), info, modified, renamed
  brightBlack: "#858585", // muted/disabled text, placeholders, scrollbar, predictive, unreachable
  brightBlue: "#4FC1FF", // terminal bright blue, syntax constants
  brightCyan: "#A4FFFF", // terminal bright cyan
  brightGreen: "#69FF94", // terminal bright green
  brightPurple: "#FF92DF", // terminal bright magenta
  brightRed: "#FF6E6E", // terminal bright red
  brightWhite: "#FFFFFF", // terminal bright white, bright foreground
  brightYellow: "#FFFFA5", // terminal bright yellow
  cyan: "#4EC9B0", // types, constructors, enums, hints
  green: "#608B4E", // comments, created/success, diff added, terminal green
  purple: "#C586C0", // imports/exports, control flow, preprocessor, terminal magenta
  red: "#F44747", // errors, deleted, diff deleted, terminal red
  white: "#CCCCCC", // terminal white
  yellow: "#DCDCAA", // functions, warnings, diff modified, terminal yellow
  lightBlue: "#9CDCFE", // variables, properties, attributes, labels
  lightGreen: "#B5CEA8", // numbers
  orange: "#CE9178", // strings, embedded, links, conflicts
  gold: "#D7BA7D", // escape chars, special punctuation, string specials
  darkBlue: "#1E3A5F", // (dark equivalent of light.darkBlue)
  linkBlue: "#4FC1FF", // (dark equivalent of light.linkBlue)
  darkGreen: "#4D7A3E", // (dark equivalent of light.darkGreen)
  brown: "#D7BA7D", // (dark equivalent of light.brown)
  darkRed: "#D16969", // regex
  gray: "#1E1E1E", // hover states, disabled elements
  brightGray: "#454545", // active line, borders, rulers, indent guides
};
/** Normalizes hex color values to lowercase for consistency. */
function _normalizeHexCase(theme) {
  const normalized = {};
  for (const [key, value] of Object.entries(theme)) {
    normalized[key] = typeof value === "string" && value.startsWith("#") ? value.toLowerCase() : value;
  }
  return normalized;
}

const COLOR_MAP = {
  dark: _normalizeHexCase({ ..._darkHex, ..._generateColorVariants(_darkHex) }),
  light: _normalizeHexCase({ ..._lightHex, ..._generateColorVariants(_lightHex) }),
};

/** Regex matching a JSON/JS value (quoted string | boolean | null | number) followed by // {{map.key}} */
const INLINE_MARKER_REGEX = /("([^"]*)"|'([^']*)'|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(\s*[,;]?\s*)\/\/ \{\{(\w+)\.(\w+)\}\}/g;

/** Serialize a JS value to its literal form, preserving original quote style */
function toJsonLiteral(value, quoteChar) {
  if (typeof value === "string") return `${quoteChar || '"'}${value}${quoteChar || '"'}`;
  return String(value);
}

/**
 * Process inline markers in JSONC content, replacing values from the provided map.
 * Returns { content, changed } where changed indicates if any values were updated.
 */
function processInlineMarkers(content, colorMap, targetName) {
  let changed = false;
  const warnings = [];

  const updated = content.replace(INLINE_MARKER_REGEX, (match, rawValue, dblInner, sglInner, trailing, map, key) => {
    const mapObj = colorMap[map];
    if (!mapObj || !(key in mapObj)) {
      warnings.push(`>> Warning: unknown inline marker {{${map}.${key}}} in ${targetName}`);
      return match;
    }
    const newValue = mapObj[key];
    // Preserve original quote style: single quotes if matched via single-quote group
    const quoteChar = sglInner !== undefined ? "'" : '"';
    const newLiteral = toJsonLiteral(newValue, quoteChar);
    if (rawValue !== newLiteral) {
      changed = true;
    }
    return `${newLiteral}${trailing}// {{${map}.${key}}}`;
  });

  return { content: updated, changed, warnings };
}

/**
 * Clean inline markers in content, replacing values with type-appropriate defaults.
 * Strings become "", booleans become false, numbers become 0, null stays null.
 * Returns { content, changed } where changed indicates if any values were updated.
 */
function cleanInlineMarkers(content) {
  let changed = false;

  const updated = content.replace(INLINE_MARKER_REGEX, (match, rawValue, dblInner, sglInner, trailing, map, key) => {
    const quoteChar = sglInner !== undefined ? "'" : '"';
    let defaultLiteral;
    if (dblInner !== undefined || sglInner !== undefined) {
      defaultLiteral = `${quoteChar}${quoteChar}`;
    } else if (rawValue === "true" || rawValue === "false") {
      defaultLiteral = "false";
    } else if (rawValue === "null") {
      defaultLiteral = "null";
    } else {
      defaultLiteral = "0";
    }
    if (rawValue !== defaultLiteral) {
      changed = true;
    }
    return `${defaultLiteral}${trailing}// {{${map}.${key}}}`;
  });

  return { content: updated, changed };
}

/** Regex matching a CSS property value between : and ; followed by // {{map.key}} in SCSS files */
const SCSS_INLINE_MARKER_REGEX = /:\s*([^;]*?)\s*(;\s*)\/\/ \{\{(\w+)\.(\w+)\}\}/g;

/**
 * Process inline markers in SCSS content, replacing CSS property values from the provided map.
 * Returns { content, changed } where changed indicates if any values were updated.
 */
function processSCSSInlineMarkers(content, colorMap, targetName) {
  let changed = false;
  const warnings = [];

  const updated = content.replace(SCSS_INLINE_MARKER_REGEX, (match, rawValue, trailing, map, key) => {
    const mapObj = colorMap[map];
    if (!mapObj || !(key in mapObj)) {
      warnings.push(`>> Warning: unknown inline marker {{${map}.${key}}} in ${targetName}`);
      return match;
    }
    const newValue = String(mapObj[key]);
    if (rawValue.trim() !== newValue) {
      changed = true;
    }
    return `: ${newValue}${trailing}// {{${map}.${key}}}`;
  });

  return { content: updated, changed, warnings };
}

/**
 * Clean inline markers in SCSS content, replacing values with empty.
 * Returns { content, changed } where changed indicates if any values were updated.
 */
function cleanSCSSInlineMarkers(content) {
  let changed = false;

  const updated = content.replace(SCSS_INLINE_MARKER_REGEX, (match, rawValue, trailing, map, key) => {
    if (rawValue.trim() !== "") {
      changed = true;
    }
    return `:${trailing}// {{${map}.${key}}}`;
  });

  return { content: updated, changed };
}

// Only export when required as a module (e.g. by tests).
// Skip when run directly as CLI (node software/tools/build-include.js).
/* istanbul ignore else -- CLI branch: exercised by `make format_build_include`,
   not by unit tests. All testable logic lives in the exported helpers above. */
if (typeof module !== "undefined" && require.main !== module) {
  module.exports = {
    TEXT_BLOCK_START_MARKER,
    TEXT_BLOCK_END_MARKER,
    COMMENT_STYLES,
    DEFAULT_COMMENT_STYLE,
    CODE_FENCE_LANGUAGES,
    COLOR_MAP,
    INLINE_MARKER_REGEX,
    getCommentStyle,
    stripShebang,
    isFilePath,
    autoTransform,
    findMarkers,
    cleanBlock,
    replaceBlock,
    getRawBlockContent,
    toJsonLiteral,
    processInlineMarkers,
    cleanInlineMarkers,
    SCSS_INLINE_MARKER_REGEX,
    processSCSSInlineMarkers,
    cleanSCSSInlineMarkers,
    sourceMetadataHeader,
  };
}

/* istanbul ignore next -- CLI entry: exercised by `make format_build_include`,
   not by unit tests. All testable logic lives in the exported helpers above. */
(function runCliIfMain() {
  if (require.main !== module) return;
  // ---- CLI entry point ----
  const { execSync } = require("child_process");

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
  const trackedFiles = execSync(
    'git ls-files "*.sh" "*.md" "*.js" "*.jsx" "*.ts" "*.tsx" "*.mjs" "*.jsonc" "*.scss" "*.ps1.bash" "Makefile"',
    {
      encoding: "utf8",
    },
  )
    .trim()
    .split("\n")
    .filter((f) => f && !f.startsWith("software/tests/"));
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
            // Fallback: render the raw content already between the markers
            sourceContent = getRawBlockContent(content, key, commentPrefix, commentSuffix);
            if (sourceContent === null) {
              console.log(`>> Source file not found: ${key} (referenced in ${target}), skipping`);
              continue;
            }
            console.log(`>> Source file not found: ${key} (referenced in ${target}), keeping raw content`);
          } else {
            sourceContent = autoTransform(fs.readFileSync(key, "utf8"), key, target);
            // only add metadata header for shell targets (# comments are invalid in JS/TS)
            if (/\.(sh|bash|zsh)$/.test(path.extname(target).toLowerCase())) {
              const meta = sourceMetadataHeader(key, sourceContent);
              if (meta) sourceContent = meta + "\n" + sourceContent.trim();
            }
          }
        } else {
          // Unknown key, not a file path, no config — skip
          continue;
        }

        replaced = replaceBlock(content, key, sourceContent, commentPrefix, commentSuffix);

        // Markdown: ensure blank lines between comment markers and code fences
        if (path.extname(target).toLowerCase() === ".md") {
          const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
          const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
          replaced = replaced.replace(BEGIN + "\n```", BEGIN + "\n\n```");
          replaced = replaced.replace("```\n" + END, "```\n\n" + END);
        }
      }

      if (replaced !== content) {
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

  // --- Inline marker processing for JSONC, software/scripts/**/*.js, and SCSS files ---
  {
    const inlineMarkerFiles = targetFiles.filter(
      (f) => f.endsWith(".jsonc") || (f.endsWith(".js") && f.startsWith("software/scripts/")) || f.endsWith(".scss"),
    );

    for (const target of inlineMarkerFiles) {
      if (!fs.existsSync(target)) continue;

      const content = fs.readFileSync(target, "utf8");
      const isSCSS = target.endsWith(".scss");
      const result = isSCSS
        ? isCleanMode
          ? cleanSCSSInlineMarkers(content)
          : processSCSSInlineMarkers(content, COLOR_MAP, target)
        : isCleanMode
          ? cleanInlineMarkers(content)
          : processInlineMarkers(content, COLOR_MAP, target);

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
})();
