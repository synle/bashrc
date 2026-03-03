/** @type {string} Opening delimiter for managed text blocks */
export const TEXT_BLOCK_START_MARKER: string;
/** @type {string} Closing delimiter for managed text blocks */
export const TEXT_BLOCK_END_MARKER: string;
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
export function replaceBlock(
  content: string,
  key: string,
  sourceContent: string,
  commentPrefix: string,
  commentSuffix?: string,
  insertMode?: "append" | "prepend" | null,
): string;
