/** @type {string} Opening delimiter for managed text blocks */
const TEXT_BLOCK_START_MARKER = "BEGIN";
/** @type {string} Closing delimiter for managed text blocks */
const TEXT_BLOCK_END_MARKER = "END";

/**
 * Replace content between BEGIN/END markers.
 * If markers are not found, behavior depends on insertMode:
 * 'append' adds to end, 'prepend' adds to beginning, null/undefined returns content as-is.
 * @param {string} content - The full text content
 * @param {string} key - The marker key
 * @param {string} sourceContent - The new content for the block
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix (e.g. ' -->', '')
 * @param {'append'|'prepend'|null} [insertMode] - Where to insert if block not found. null/undefined returns content as-is.
 * @returns {string} The modified content, or original content if markers not found and no insertMode
 */
function replaceBlock(content, key, sourceContent, commentPrefix, commentSuffix = "", insertMode) {
  sourceContent = sourceContent.trim();

  const BEGIN = `${commentPrefix} ${TEXT_BLOCK_START_MARKER} ${key}${commentSuffix}`;
  const END = `${commentPrefix} ${TEXT_BLOCK_END_MARKER} ${key}${commentSuffix}`;
  const block = `${BEGIN}\n${sourceContent}\n${END}`;

  const beginIdx = content.indexOf(BEGIN);
  const endIdx = content.indexOf(END);

  if (beginIdx !== -1 && endIdx !== -1) {
    return content.slice(0, beginIdx) + block + content.slice(endIdx + END.length);
  } else if (insertMode === "append") {
    return `${content}\n\n${block}\n`;
  } else if (insertMode === "prepend") {
    return `\n${block}\n\n${content}\n`;
  }

  return content;
}

// Only export when required as a module (e.g. by build-include.cjs).
// Skip when this file is inlined into index.js via BEGIN/END markers,
// where index.js runs as the main module (require.main === module).
if (typeof module !== "undefined" && require.main !== module) {
  module.exports = {
    TEXT_BLOCK_START_MARKER,
    TEXT_BLOCK_END_MARKER,
    replaceBlock,
  };
}
