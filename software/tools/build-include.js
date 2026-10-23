/**
 * build-include.js - Generic BEGIN/END block substitution engine.
 *
 * Managed theme flow: theme/sy/_palette_{dark,light}.jsonc -> resolved semantic/derived colors
 * -> marker-bound theme/sy/<app>_<mode>.jsonc -> readSyTheme -> native renderer/deployer -> product.
 * New feature colors belong in both foundations and app marker bindings, never in a second script-local palette.
 * See theme/README.md for the authoritative workflow; baseline/audit evidence is not a regeneration target.
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
 * Excluded target folders are protected in build/clean modes, including explicit targets.
 *
 * Usage:
 *   make format_build_include                                  # auto-scan tracked *.sh, *.md, and *.js/ts files
 *   make clean_include                                         # clean BEGIN/END block inclusions
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
/** @type {string} Canonical palette foundations and active application templates. */
const THEME_SOURCE_FOLDER = path.resolve(__dirname, "../../theme/sy");
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
 * Ensures one blank line after a markdown BEGIN marker and before its END marker,
 * matching what oxfmt produces, so build-include and the formatter agree and
 * `make format` is a fixed point. Idempotent: an existing blank line is kept, and
 * an empty block is left as-is.
 * @param {string} content - Markdown file content
 * @param {string} begin - The full BEGIN marker line
 * @param {string} end - The full END marker line
 * @returns {string} Content with the marker padding applied
 */
function padMarkdownMarkers(content, begin, end) {
  // an empty slot (adjacent markers) has nothing to separate — leave it alone
  if (content.includes(`${begin}\n${end}`)) return content;
  return content
    .replace(new RegExp(`${escapeRegExp(begin)}\\n(?=[^\\n])`), begin + "\n\n")
    .replace(new RegExp(`([^\\n])\\n${escapeRegExp(end)}`), "$1\n\n" + end);
}

/**
 * Escapes a literal string for use inside a RegExp source.
 * @param {string} value - Literal text (e.g. a marker line)
 * @returns {string} The text with regex metacharacters backslash-escaped
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/**
 * Composites validated opaque sRGB colors without changing their hues.
 * @param {string} from - Foreground six-digit hex.
 * @param {string} over - Background six-digit hex.
 * @param {number} alpha - Foreground fraction in [0, 1].
 * @returns {string} Opaque lowercase hex color.
 */
function _blendHex(from, over, alpha) {
  return (
    "#" +
    [1, 3, 5]
      .map((offset) =>
        Math.round(parseInt(from.slice(offset, offset + 2), 16) * alpha + parseInt(over.slice(offset, offset + 2), 16) * (1 - alpha))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * Resolves foundation literals, aliases, and compositing recipes without mutating their source.
 * @param {object} palette - Named hex colors, {ref}, or {from, over, alpha} recipes.
 * @param {string} [label="palette"] - Source label used in actionable validation errors.
 * @returns {object} Theme name and resolved six-digit colors.
 * @throws {TypeError} For invalid shapes, references, cycles, or alpha outside [0, 1].
 */
function resolvePalette(palette, label = "palette") {
  if (
    !palette ||
    typeof palette !== "object" ||
    Array.isArray(palette) ||
    typeof palette.themeName !== "string" ||
    !palette.themeName.trim()
  ) {
    throw new TypeError(`Invalid ${label}: expected a palette object with a non-empty themeName`);
  }
  const keys = Object.keys(palette);
  if (keys.some((key) => !/^[A-Za-z][A-Za-z0-9]*$/.test(key) || ["constructor", "prototype"].includes(key))) {
    throw new TypeError(`Invalid ${label}: role names must be safe alphanumeric identifiers`);
  }
  const resolved = { themeName: palette.themeName };
  const visiting = new Set();

  /** Resolve one literal/reference; active roles detect circular dependencies. */
  function resolve(reference) {
    if (typeof reference !== "string") throw new TypeError(`Invalid ${label}: color reference must be a string`);
    if (/^#[0-9a-f]{6}$/i.test(reference)) return reference.toLowerCase();
    if (reference === "themeName" || !Object.prototype.hasOwnProperty.call(palette, reference)) {
      throw new TypeError(`Invalid ${label}.${reference}: unknown color role`);
    }
    if (Object.prototype.hasOwnProperty.call(resolved, reference)) return resolved[reference];
    if (visiting.has(reference)) throw new TypeError(`Invalid ${label}.${reference}: circular color recipe`);
    visiting.add(reference);
    const value = palette[reference];
    let color;
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
      color = value.toLowerCase();
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const fields = Object.keys(value).sort().join(",");
      if (fields === "ref") {
        color = resolve(value.ref);
      } else if (
        fields === "alpha,from,over" &&
        typeof value.alpha === "number" &&
        Number.isFinite(value.alpha) &&
        value.alpha >= 0 &&
        value.alpha <= 1
      ) {
        color = _blendHex(resolve(value.from), resolve(value.over), value.alpha);
      }
    }
    if (!color) throw new TypeError(`Invalid ${label}.${reference}: expected hex, {ref}, or {from, over, alpha in [0, 1]}`);
    resolved[reference] = color;
    visiting.delete(reference);
    return color;
  }

  for (const key of keys) if (key !== "themeName") resolve(key);
  return resolved;
}

/**
 * Derives RGB channels, alpha, tint, and shade variants from resolved foundation colors.
 * @param {object} theme - Resolved six-digit colors and display name.
 * @returns {object} Derived values; no variants are generated recursively.
 */
function _generateColorVariants(theme) {
  const alphaSteps = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const variants = {};
  for (const [key, value] of Object.entries(theme)) {
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) continue;
    const { R, G, B } = _hexToFloatRgb(value);
    variants[`${key}_R`] = R;
    variants[`${key}_G`] = G;
    variants[`${key}_B`] = B;
    for (const percent of alphaSteps)
      variants[`${key}_alpha${percent}`] =
        value +
        Math.round((percent * 255) / 100)
          .toString(16)
          .padStart(2, "0");
    for (const percent of [10, 20]) {
      variants[`${key}_tint${percent}`] = _blendHex("#ffffff", value, percent / 100);
      variants[`${key}_shade${percent}`] = _blendHex("#000000", value, percent / 100);
    }
  }
  return variants;
}

/**
 * Loads both JSONC foundations before exposing a compatible expanded COLOR_MAP.
 * @param {string} [folder=THEME_SOURCE_FOLDER] - Folder containing the two _palette files.
 * @returns {{dark: object, light: object}} Resolved colors and derived variants.
 * @throws {Error} For unreadable/malformed files or mismatched appearance roles; no files are written.
 */
function loadColorMap(folder = THEME_SOURCE_FOLDER) {
  const result = {};
  for (const mode of ["dark", "light"]) {
    const file = path.join(folder, `_palette_${mode}.jsonc`);
    const parsed = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, "utf8"));
    if (parsed.error) throw new TypeError(`Invalid ${file}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, " ")}`);
    const base = resolvePalette(parsed.config, file);
    result[mode] = _normalizeHexCase({ ...base, ..._generateColorVariants(base) });
  }
  if (Object.keys(result.dark).sort().join(",") !== Object.keys(result.light).sort().join(",")) {
    throw new TypeError("Invalid theme foundations: dark and light roles must match");
  }
  return result;
}

/**
 * Normalizes generated hex values while preserving numeric RGB channels and theme names.
 * @param {object} theme - Foundation and derived values.
 * @returns {object} A normalized copy; the input is unchanged.
 */
function _normalizeHexCase(theme) {
  const normalized = {};
  for (const [key, value] of Object.entries(theme)) {
    normalized[key] = typeof value === "string" && value.startsWith("#") ? value.toLowerCase() : value;
  }
  return normalized;
}

/** @type {{dark: object, light: object}} Foundation colors and deterministic derived variants. */
const COLOR_MAP = loadColorMap();

/**
 * Regex matching a color literal (hex string | boolean | null | number) followed by // {{map.key}}.
 *
 * The trailing group tolerates a run of closing brackets/braces and commas before the marker so a
 * value nested inside an inline object still binds — e.g. `{ "foreground": "#76a762" } }, // {{dark.green}}`.
 * Without this the marker silently went inert and the literal drifted away from COLOR_MAP.
 * The group is echoed back verbatim on replacement, so no structure is lost.
 *
 * The string alternative only accepts a hex color or the empty string (what clean mode writes).
 * Every COLOR_MAP value is a hex color or a number, so this is lossless — and it stops the trailing
 * group from reaching past a non-color sibling and rebinding the marker to it
 * (e.g. `{ "foreground": "#569cd6", "fontStyle": "bold" }, // {{dark.blue}}` must not overwrite `"bold"`).
 */
const INLINE_MARKER_REGEX =
  /("((?:#[0-9a-fA-F]{3,8})?)"|'((?:#[0-9a-fA-F]{3,8})?)'|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)((?:\s*[}\])]\s*,?)*\s*[,;]?\s*)\/\/ \{\{(\w+)\.(\w+)\}\}/g;

/** Display names have arbitrary string values; their explicit role avoids rewriting font styles. */
const THEME_NAME_MARKER_REGEX = /("(?:\\.|[^"\\])*")([ \t]*[,;]?[ \t]*)\/\/ \{\{(\w+)\.(themeName)\}\}/g;
/** Stable JSON-string recipes keep every embedded color regeneratable after palette edits. */
const STRING_TEMPLATE_MARKER_REGEX =
  /^([ \t]*"(?:\\.|[^"\\])*"[ \t]*:[ \t]*)("(?:\\.|[^"\\])*")([ \t]*,?[ \t]*)\/\/ \{\{template: ("(?:\\.|[^"\\])*")\}\}[ \t]*$/gm;

/**
 * Serializes a marker value without losing string escapes or the existing quote style.
 * @param {*} value - Scalar marker value.
 * @param {string} [quoteChar='"'] - Original string delimiter.
 * @returns {string} Source literal; this function has no side effects.
 */
function toJsonLiteral(value, quoteChar) {
  if (typeof value !== "string") return String(value);
  if (quoteChar === "'") return "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  return JSON.stringify(value);
}

/**
 * Renders color literals, display names, and repeatable string-template comments.
 * @param {string} content - Source bytes; marker comments remain in the result.
 * @param {object} colorMap - Expanded named palettes and existing non-color maps.
 * @param {string} targetName - Source label included in diagnostics.
 * @returns {{content: string, changed: boolean, warnings: string[]}} Rendered bytes and diagnostics.
 */
function processInlineMarkers(content, colorMap, targetName) {
  const warnings = [];

  /** Resolve only owned keys, preserving valid zero/false/null values. */
  function lookup(map, key) {
    const values = colorMap && Object.prototype.hasOwnProperty.call(colorMap, map) ? colorMap[map] : null;
    if (!values || !Object.prototype.hasOwnProperty.call(values, key) || values[key] === undefined) {
      warnings.push(`>> Warning: unknown inline marker {{${map}.${key}}} in ${targetName}`);
      return undefined;
    }
    return values[key];
  }

  let updated = content.replace(INLINE_MARKER_REGEX, (match, rawValue, dblInner, sglInner, trailing, map, key) => {
    const value = lookup(map, key);
    if (value === undefined) return match;
    const quoteChar = sglInner !== undefined ? "'" : '"';
    return `${toJsonLiteral(value, quoteChar)}${trailing}// {{${map}.${key}}}`;
  });

  // Only display-name markers accept arbitrary strings; color markers retain the font/style safety guard.
  updated = updated.replace(THEME_NAME_MARKER_REGEX, (match, literal, trailing, map, key) => {
    const value = lookup(map, key);
    return typeof value === "string" ? `${JSON.stringify(value)}${trailing}// {{${map}.${key}}}` : match;
  });

  // Persist the original string template in a comment so later palette edits can rerender every embedded color.
  updated = updated.replace(STRING_TEMPLATE_MARKER_REGEX, (match, prefix, literal, trailing, template) => {
    let decoded;
    try {
      decoded = JSON.parse(template);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      warnings.push(`>> Warning: invalid JSON string template in ${targetName}; repair its escapes before retrying`);
      return match;
    }
    const before = warnings.length;
    const rendered = decoded.replace(/\{\{(\w+)\.(\w+)\}\}/g, (marker, map, key) => {
      const value = lookup(map, key);
      return value === undefined ? marker : String(value);
    });
    if (warnings.length !== before) return match;
    return `${prefix}${JSON.stringify(rendered)}${trailing}// {{template: ${template}}}`;
  });

  return { content: updated, changed: updated !== content, warnings };
}

/**
 * Validates native JSONC and rejects marker comments that do not bind to an editable value.
 * @param {string} content - Active Sy JSONC source.
 * @param {object} colorMap - Expanded foundation palettes.
 * @param {string} targetName - Diagnostic source label.
 * @returns {{content: string, changed: boolean, warnings: string[]}} Rendered source; callers must reject warnings before writes.
 */
function compileThemeTemplate(content, colorMap, targetName) {
  const result = processInlineMarkers(content, colorMap, targetName);
  const bound = new Set();
  for (const match of content.matchAll(INLINE_MARKER_REGEX)) bound.add(match.index + match[1].length + match[4].length);
  for (const match of content.matchAll(THEME_NAME_MARKER_REGEX)) bound.add(match.index + match[1].length + match[2].length);
  for (const match of content.matchAll(STRING_TEMPLATE_MARKER_REGEX))
    bound.add(match.index + match[1].length + match[2].length + match[3].length);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, content);
  let token;
  while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (token !== ts.SyntaxKind.SingleLineCommentTrivia) continue;
    if (/^\/\/\s*\{\{(?:\w+\.\w+|template:)/.test(scanner.getTokenText()) && !bound.has(scanner.getTokenPos())) {
      result.warnings.push(`>> Warning: unbound theme marker in ${targetName}; put the marker immediately after its color value`);
    }
  }
  const parsed = ts.parseConfigFileTextToJson(targetName, result.content);
  if (parsed.error)
    result.warnings.push(`>> Warning: invalid JSONC in ${targetName}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, " ")}`);
  return result;
}

/**
 * Clears rendered colors/names/templates while preserving the regeneration contract.
 * @param {string} content - Source containing inline marker comments.
 * @returns {{content: string, changed: boolean}} Cleared source; non-marker values remain untouched.
 */
function cleanInlineMarkers(content) {
  let updated = content.replace(INLINE_MARKER_REGEX, (match, rawValue, dblInner, sglInner, trailing, map, key) => {
    const quoteChar = sglInner !== undefined ? "'" : '"';
    let literal = "0";
    if (dblInner !== undefined || sglInner !== undefined) literal = quoteChar + quoteChar;
    else if (rawValue === "true" || rawValue === "false") literal = "false";
    else if (rawValue === "null") literal = "null";
    return `${literal}${trailing}// {{${map}.${key}}}`;
  });
  updated = updated.replace(THEME_NAME_MARKER_REGEX, (match, literal, trailing, map, key) => `""${trailing}// {{${map}.${key}}}`);
  updated = updated.replace(
    STRING_TEMPLATE_MARKER_REGEX,
    (match, prefix, literal, trailing, recipe) => `${prefix}""${trailing}// {{template: ${recipe}}}`,
  );
  return { content: updated, changed: updated !== content };
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
    padMarkdownMarkers,
    TEXT_BLOCK_START_MARKER,
    TEXT_BLOCK_END_MARKER,
    COMMENT_STYLES,
    DEFAULT_COMMENT_STYLE,
    CODE_FENCE_LANGUAGES,
    COLOR_MAP,
    resolvePalette,
    loadColorMap,
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
    compileThemeTemplate,
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
  const { execFileSync } = require("child_process");

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
  let trackedFiles = [];
  if (cliTargets.length === 0) {
    try {
      trackedFiles = execFileSync(
        "git",
        ["ls-files", "*.sh", "*.md", "*.js", "*.jsx", "*.ts", "*.tsx", "*.mjs", "*.jsonc", "*.scss", "*.ps1.bash", "Makefile"],
        { encoding: "utf8" },
      )
        .trim()
        .split("\n")
        .filter((file) => file && !file.startsWith("software/tests/"));
    } catch (error) {
      if (error.code !== "ENOENT" && !Number.isInteger(error.status)) throw error;
      throw new Error("Tracked target discovery failed: run from a Git checkout or pass explicit file paths; retry is safe", {
        cause: error,
      });
    }
  }
  const inclusionTargets = INCLUSIONS.flatMap((inc) => inc.targets);
  // Active themes also participate before Git staging; foundation inputs and archived evidence never do.
  const themeTargets = fs
    .readdirSync(THEME_SOURCE_FOLDER)
    .filter((name) => name.endsWith(".jsonc") && !name.startsWith("_"))
    .map((name) => path.relative(process.cwd(), path.join(THEME_SOURCE_FOLDER, name)));
  /** @type {string[]} Repository-relative folders that must never be regenerated, even through explicit targets. */
  const excludedTargetFolders = ["software/scripts/advanced/llm/_common/v1", "software/scripts/advanced/llm/_common/v2"].map(
    (folder) => path.resolve(__dirname, "../..", folder) + path.sep,
  );
  const targetFiles = (cliTargets.length > 0 ? cliTargets : [...new Set([...themeTargets, ...trackedFiles, ...inclusionTargets])]).filter(
    (target) => {
      // Resolve filesystem aliases (including macOS /var -> /private/var) before matching folder boundaries.
      const resolved = fs.existsSync(target) ? fs.realpathSync(target) : path.resolve(target);
      const themeRoot = path.dirname(THEME_SOURCE_FOLDER) + path.sep;
      if (resolved.startsWith(themeRoot) && !resolved.startsWith(THEME_SOURCE_FOLDER + path.sep)) return false;
      if (path.dirname(resolved) === THEME_SOURCE_FOLDER && path.basename(resolved).startsWith("_")) return false;
      return !excludedTargetFolders.some((folder) => resolved.startsWith(folder));
    },
  );
  if (!isCleanMode) {
    // Validate every active template before any file is rewritten; unknown roles must never become silent omissions.
    for (const target of targetFiles.filter((file) => path.resolve(file).startsWith(THEME_SOURCE_FOLDER + path.sep))) {
      if (!fs.existsSync(target)) continue;
      const result = compileThemeTemplate(fs.readFileSync(target, "utf8"), COLOR_MAP, target);
      if (result.warnings.length) throw new Error(result.warnings.join("\n"));
    }
  }

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

        // Markdown: ensure a blank line between each comment marker and the inlined
        // content (code fence or prose). oxfmt inserts it after an HTML comment that
        // precedes a block; omitting it here made `make format` flip the file every run.
        if (path.extname(target).toLowerCase() === ".md") {
          const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
          const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
          replaced = padMarkdownMarkers(replaced, BEGIN, END);
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
