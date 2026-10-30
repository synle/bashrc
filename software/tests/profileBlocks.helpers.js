/**
 * Extract profile blocks and classify reusable build-time includes without excluding their syntax-check bodies.
 * @param {string} content - Generated profile content.
 * @returns {Array<{key: string, body: string, lineNumber: number, isBuildInclude: boolean}>} Blocks with source metadata classification.
 */
export function extractBlocks(content) {
  const blocks = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const beginMatch = lines[i].match(/^# BEGIN (.+)$/);
    if (beginMatch) {
      const key = beginMatch[1].trim();
      const startLine = i + 1;
      const bodyLines = [];
      i++;
      while (i < lines.length) {
        const endMatch = lines[i].match(/^# END (.+)$/);
        if (endMatch && endMatch[1].trim() === key) {
          break;
        }
        bodyLines.push(lines[i]);
        i++;
      }
      if (bodyLines.length > 0) {
        const header = bodyLines[0].match(/^# (.+) \| [0-9a-f]{32} \| .+$/);
        const isBuildInclude = key.includes("/") && header?.[1] === key;
        blocks.push({ key, body: bodyLines.join("\n"), lineNumber: startLine + 1, isBuildInclude });
      }
    }
    i++;
  }
  return blocks;
}
