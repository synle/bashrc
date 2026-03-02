/**
 * build-include.common.cjs - Shared pure functions for BEGIN/END block management.
 * Used by build-include.cjs at build time and index.js at runtime.
 * Exports TEXT_BLOCK_START_MARKER/TEXT_BLOCK_END_MARKER constants and block
 * manipulation functions (replaceBlock, getRawBlockContent, cleanBlock, findMarkers).
 */
const path = require("path");

/** @type {string} Opening delimiter for managed text blocks */
const TEXT_BLOCK_START_MARKER = "BEGIN";
/** @type {string} Closing delimiter for managed text blocks */
const TEXT_BLOCK_END_MARKER = "END";

/** Comment style per file extension */
const COMMENT_STYLES = {
  ".md": { prefix: "<!--", suffix: " -->" },
  ".html": { prefix: "<!--", suffix: " -->" },
  ".xml": { prefix: "<!--", suffix: " -->" },
  ".js": { prefix: "//", suffix: "" },
  ".jsx": { prefix: "//", suffix: "" },
  ".ts": { prefix: "//", suffix: "" },
  ".tsx": { prefix: "//", suffix: "" },
  ".cjs": { prefix: "//", suffix: "" },
  ".mjs": { prefix: "//", suffix: "" },
  ".jsonc": { prefix: "//", suffix: "" },
};
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
    return "```" + codeLang + "\n" + code + "\n```";
  }

  return sourceContent;
}

/**
 * Scan a file for all BEGIN markers and return { key, commentPrefix, commentSuffix } for each.
 */
function findMarkers(content, targetFile) {
  const { prefix, suffix } = getCommentStyle(targetFile);
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSuffix = suffix.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match: prefix BEGIN key suffix (suffix is optional with possible whitespace)
  const pattern = escapedSuffix ? `${escapedPrefix} ${TEXT_BLOCK_START_MARKER} (.+?)\\s*${escapedSuffix}` : `${escapedPrefix} ${TEXT_BLOCK_START_MARKER} (.+)`;

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
 * Replace content between BEGIN/END markers.
 * If markers are not found, behavior depends on insertMode:
 * 'append' adds to end, 'prepend' adds to beginning, null/undefined returns null.
 * @param {string} content - The full text content
 * @param {string} key - The marker key
 * @param {string} sourceContent - The new content for the block
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix (e.g. ' -->', '')
 * @param {'append'|'prepend'|null} [insertMode] - Where to insert if block not found. null/undefined returns null.
 * @returns {string|null} The modified content, or null if markers not found and no insertMode
 */
function replaceBlock(content, key, sourceContent, commentPrefix, commentSuffix = '', insertMode) {
  const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
  const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
  const block = `${BEGIN}\n${sourceContent}\n${END}`;

  const beginIdx = content.indexOf(BEGIN);
  const endIdx = content.indexOf(END);

  if (beginIdx !== -1 && endIdx !== -1) {
    return content.slice(0, beginIdx) + block + content.slice(endIdx + END.length);
  } else if (insertMode === 'append') {
    return `${content}\n\n${block}\n`;
  } else if (insertMode === 'prepend') {
    return `\n${block}\n\n${content}\n`;
  }

  return null;
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

/** Generate _R, _G, _B float entries for all hex colors in a theme object */
function _generateFloatColors(theme) {
  const floats = {};
  for (const [key, value] of Object.entries(theme)) {
    if (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)) {
      const { R, G, B } = _hexToFloatRgb(value);
      floats[`${key}_R`] = R;
      floats[`${key}_G`] = G;
      floats[`${key}_B`] = B;
    }
  }
  return floats;
}

/**
 * Central color map for dark and light themes.
 * Colors shared across Windows Terminal, Sublime Text, and iTerm config files.
 * Referenced via inline markers in JSONC files: // {{dark.key}} or // {{light.key}}
 * Float RGB variants (e.g. dark.red_R, dark.red_G, dark.red_B) are auto-generated
 * from hex values for iTerm plist format.
 */
const _darkHex = {
  themeName: "Sy Dark",
  background: "#000000",
  foreground: "#FFFFFF",
  cursorColor: "#FFFFFF",
  selection: "#264F78",
  black: "#000000",
  blue: "#569CD6",
  brightBlack: "#858585",
  brightBlue: "#4FC1FF",
  brightCyan: "#A4FFFF",
  brightGreen: "#69FF94",
  brightPurple: "#FF92DF",
  brightRed: "#FF6E6E",
  brightWhite: "#FFFFFF",
  brightYellow: "#FFFFA5",
  cyan: "#4EC9B0",
  green: "#608B4E",
  purple: "#C586C0",
  red: "#F44747",
  white: "#CCCCCC",
  yellow: "#DCDCAA",
  lightBlue: "#9CDCFE",
  lightGreen: "#B5CEA8",
  orange: "#CE9178",
  gold: "#D7BA7D",
  darkRed: "#D16969",
};
const _lightHex = {
  themeName: "Sy Light",
  background: "#FFFFFF",
  foreground: "#000000",
  cursorColor: "#000000",
  selection: "#ADD6FF",
  black: "#000000",
  blue: "#0000FF",
  brightBlack: "#6E7681",
  brightBlue: "#0451A5",
  brightCyan: "#267F99",
  brightGreen: "#098658",
  brightPurple: "#AF00DB",
  brightRed: "#A31515",
  brightWhite: "#FFFFFF",
  brightYellow: "#795E26",
  cyan: "#0070C1",
  green: "#008000",
  purple: "#800080",
  red: "#800000",
  white: "#CCCCCC",
  yellow: "#795E26",
  darkBlue: "#001080",
  linkBlue: "#0451A5",
  darkGreen: "#098658",
  brown: "#795E26",
  darkRed: "#800000",
};
const COLOR_MAP = {
  dark: { ..._darkHex, ..._generateFloatColors(_darkHex) },
  light: { ..._lightHex, ..._generateFloatColors(_lightHex) },
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
};
