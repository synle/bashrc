/** Core shared constants and block-manipulation utilities (replaceBlock, appendTextBlock, etc.). Inlined into index.js via BEGIN/END markers. */
/** @type {string} Opening delimiter for managed text blocks */
const TEXT_BLOCK_START_MARKER = "BEGIN";
/** @type {string} Closing delimiter for managed text blocks */
const TEXT_BLOCK_END_MARKER = "END";
/** @type {string} Short-form combined marker prefix (e.g. "# BEGIN/END key" or "# BEGIN/END - key") */
const TEXT_BLOCK_SHORT_MARKER = `${TEXT_BLOCK_START_MARKER}/${TEXT_BLOCK_END_MARKER}`;
/** @type {string} Alternate short-form marker keyword (e.g. "# BLOCK key" or "# BLOCK - key") */
const TEXT_BLOCK_ALIAS_MARKER = "BLOCK";
/** @type {string} Runtime source-include marker keyword (e.g. "# SOURCE path/to/file.bash" or "# SOURCE - path/to/file.bash"). Ignored by build-include, resolved at runtime by ~cleanup.js. */
const TEXT_BLOCK_SOURCE_MARKER = "SOURCE";
/** @type {string} Opening delimiter for source-include blocks (e.g. "# SOURCE_BEGIN path/to/file.bash"). Persists across runs so content is always re-fetched. */
const TEXT_BLOCK_SOURCE_START_MARKER = "SOURCE_BEGIN";
/** @type {string} Closing delimiter for source-include blocks (e.g. "# SOURCE_END path/to/file.bash"). */
const TEXT_BLOCK_SOURCE_END_MARKER = "SOURCE_END";

/**
 * Expand short-form markers into long-form BEGIN/END pairs.
 * Supported forms: "# BEGIN/END key", "# BEGIN/END - key", "# BLOCK key", "# BLOCK - key".
 * The dash separator is optional and surrounding whitespace around it is flexible.
 * @param {string} content - The text content to expand
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix
 * @returns {string} Content with short-form markers expanded to BEGIN/END pairs
 */
function _expandShortFormMarkers(content, commentPrefix, commentSuffix = "") {
  const escaped = commentPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSuffix = commentSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keywords = `${TEXT_BLOCK_SHORT_MARKER}|${TEXT_BLOCK_ALIAS_MARKER}`;
  const pattern = new RegExp(`${escaped} (?:${keywords})\\s+[^a-zA-Z0-9]*([^\\r\\n]+?)\\s*${escapedSuffix}$`, "gm");
  return content.replace(pattern, (_, key) => {
    const begin = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
    const end = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
    return `${begin}\n${end}`;
  });
}

/**
 * Expand SOURCE markers into SOURCE_BEGIN/SOURCE_END pairs and collect the referenced file paths.
 * Also collects file paths from existing SOURCE_BEGIN/SOURCE_END blocks so content is always re-fetched.
 * SOURCE markers are runtime-only includes (ignored by build-include, resolved at runtime).
 * @param {string} content - The text content to expand
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix
 * @returns {{ content: string, sourceFiles: string[] }} Expanded content and list of source file paths
 */
function _expandSourceMarkers(content, commentPrefix, commentSuffix = "") {
  const escaped = commentPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSuffix = commentSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Step 1: Expand short-form "# SOURCE path" into "# SOURCE_BEGIN path\n# SOURCE_END path"
  const shortPattern = new RegExp(`${escaped} ${TEXT_BLOCK_SOURCE_MARKER}\\s+.*?(\\S+\\/\\S+?)\\s*${escapedSuffix}$`, "gm");
  content = content.replace(shortPattern, (_, key) => {
    const trimmedKey = key.trim();
    const begin = `${commentPrefix} ${TEXT_BLOCK_SOURCE_START_MARKER} ${trimmedKey}${commentSuffix}`;
    const end = `${commentPrefix} ${TEXT_BLOCK_SOURCE_END_MARKER} ${trimmedKey}${commentSuffix}`;
    return `${begin}\n${end}`;
  });

  // Step 2: Collect all file paths from SOURCE_BEGIN markers (including freshly expanded ones)
  /** @type {string[]} */
  const sourceFiles = [];
  const beginPattern = new RegExp(`${escaped} ${TEXT_BLOCK_SOURCE_START_MARKER}\\s+(\\S+)\\s*${escapedSuffix}$`, "gm");
  let match;
  while ((match = beginPattern.exec(content)) !== null) {
    sourceFiles.push(match[1].trim());
  }

  return { content, sourceFiles };
}

/**
 * Replace content between BEGIN/END markers for multiple key/content pairs in a single pass.
 * Short-form markers are expanded once upfront. Each entry in the blockMap is applied sequentially.
 * @param {string} content - The full text content
 * @param {Object<string, string>} blockMap - Map of marker keys to their new content
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix (e.g. ' -->', '')
 * @param {'append'|'prepend'|null} [insertMode] - Where to insert if block not found. null/undefined returns content as-is.
 * @returns {string} The modified content with all blocks replaced
 */
function replaceBlocks(content, blockMap, commentPrefix, commentSuffix = "", insertMode) {
  content = _expandShortFormMarkers(content, commentPrefix, commentSuffix);

  for (const [key, sourceContent] of Object.entries(blockMap)) {
    const trimmed = sourceContent.trim();
    const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
    const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
    const block = `${BEGIN}\n${trimmed}\n${END}`;

    const beginIdx = content.indexOf(BEGIN);
    let endIdx = content.indexOf(END);

    if (beginIdx !== -1) {
      // Use lastIndexOf to find the LAST END marker — content between markers
      // may accidentally contain the END marker text (e.g. backtick-quoted
      // references in documentation), and indexOf would match that first.
      endIdx = content.lastIndexOf(END);
      if (endIdx !== -1 && endIdx > beginIdx) {
        content = content.slice(0, beginIdx) + block + content.slice(endIdx + END.length);
      }
    } else if (insertMode === "append") {
      content = `${content}\n\n${block}\n`;
    } else if (insertMode === "prepend") {
      content = `\n${block}\n\n${content}\n`;
    }
  }

  return content;
}

/**
 * Replace content between BEGIN/END markers.
 * Short-form markers ("# BEGIN/END key" or "# BEGIN/END - key") are expanded first.
 * If markers are not found, behavior depends on insertMode:
 * 'append' adds to end, 'prepend' adds to beginning, null/undefined returns content as-is.
 * Delegates to replaceBlocks with a single-entry map.
 * @param {string} content - The full text content
 * @param {string} key - The marker key
 * @param {string} sourceContent - The new content for the block
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix (e.g. ' -->', '')
 * @param {'append'|'prepend'|null} [insertMode] - Where to insert if block not found. null/undefined returns content as-is.
 * @returns {string} The modified content, or original content if markers not found and no insertMode
 */
function replaceBlock(content, key, sourceContent, commentPrefix, commentSuffix = "", insertMode) {
  return replaceBlocks(content, { [key]: sourceContent }, commentPrefix, commentSuffix, insertMode);
}

/**
 * Remove a BEGIN/END block (markers + content + a single trailing newline) from `content`.
 * Mirrors `replaceBlock`'s signature so callers can pass any comment style — bash (`#`/``),
 * JS (`//`/``), HTML (`<!--`/` -->`), etc. Returns the input unchanged when markers are
 * absent (idempotent), so it's safe to call on every run for legacy-marker cleanup.
 * Uses the same `lastIndexOf(END)` strategy as `replaceBlock` to tolerate END marker text
 * appearing inside the block body (e.g. quoted in documentation).
 * @param {string} content - The full text content
 * @param {string} key - The marker key to remove
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//', '<!--')
 * @param {string} [commentSuffix=''] - Comment suffix (e.g. ' -->', '')
 * @returns {string} The content with the block removed, or the original content if not found
 */
function removeBlock(content, key, commentPrefix, commentSuffix = "") {
  if (!content) return content;
  const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
  const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
  const beginIdx = content.indexOf(BEGIN);
  const endIdx = content.lastIndexOf(END);
  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) return content;
  let cutEnd = endIdx + END.length;
  // Swallow exactly one trailing newline so we don't leave a blank line where the block was.
  if (content[cutEnd] === "\n") cutEnd += 1;
  return content.slice(0, beginIdx) + content.slice(cutEnd);
}

// Only export when required as a module (e.g. by build-include.js).
// Skip when this file is inlined into index.js via BEGIN/END markers,
// where index.js runs as the main module (require.main === module).
if (typeof module !== "undefined" && require.main !== module) {
  module.exports = {
    TEXT_BLOCK_START_MARKER,
    TEXT_BLOCK_END_MARKER,
    TEXT_BLOCK_SHORT_MARKER,
    TEXT_BLOCK_ALIAS_MARKER,
    TEXT_BLOCK_SOURCE_MARKER,
    TEXT_BLOCK_SOURCE_START_MARKER,
    TEXT_BLOCK_SOURCE_END_MARKER,
    _expandSourceMarkers,
    replaceBlock,
    replaceBlocks,
    removeBlock,
  };
}
