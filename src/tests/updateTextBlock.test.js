import { describe, it, expect } from "vitest";

// ---- copy of the functions under test (isolated from index.js globals) ----
function cleanupExtraWhitespaces(text) {
  return text.replace(/[\r\n][\r\n][\n]+/g, "\n\n").trim();
}

function updateTextBlock(resultTextContent, configKey, configValue, commentPrefix, isPrepend) {
  configValue = configValue.trim();

  const regex = new RegExp(`(\\n)*(${commentPrefix} ${configKey})(\\n)[\\S\\s]+(${commentPrefix} END ${configKey})(\\n)*`);

  if (resultTextContent.match(regex)) {
    resultTextContent = resultTextContent
      .replace(
        regex,
        `

${commentPrefix} ${configKey}
${configValue}
${commentPrefix} END ${configKey}

`,
      )
      .trim();
  } else if (isPrepend === false) {
    // append
    resultTextContent = `
${resultTextContent}

${commentPrefix} ${configKey}
${configValue}
${commentPrefix} END ${configKey}

`;
  } else {
    // prepend
    resultTextContent = `

${commentPrefix} ${configKey}
${configValue}
${commentPrefix} END ${configKey}

${resultTextContent}

`;
  }

  return cleanupExtraWhitespaces(resultTextContent);
}

function appendTextBlock(resultTextContent, configKey, configValue, commentPrefix = "#") {
  return updateTextBlock(resultTextContent, configKey, configValue, commentPrefix, false);
}

function prependTextBlock(resultTextContent, configKey, configValue, commentPrefix = "#") {
  return updateTextBlock(resultTextContent, configKey, configValue, commentPrefix, true);
}

// ---- tests ----

describe("updateTextBlock", () => {
  describe("append - new block into empty content", () => {
    it("should append a new block to empty content", () => {
      const result = appendTextBlock("", "MY_BLOCK", "line1\nline2");
      expect(result).toBe(`# MY_BLOCK\nline1\nline2\n# END MY_BLOCK`);
    });
  });

  describe("prepend - new block into empty content", () => {
    it("should prepend a new block to empty content", () => {
      const result = prependTextBlock("", "MY_BLOCK", "line1\nline2");
      expect(result).toBe(`# MY_BLOCK\nline1\nline2\n# END MY_BLOCK`);
    });
  });

  describe("append - new block into existing content", () => {
    it("should append a block after existing content", () => {
      const result = appendTextBlock("existing stuff", "MY_BLOCK", "new content");
      expect(result).toContain("existing stuff");
      expect(result).toContain("# MY_BLOCK\nnew content\n# END MY_BLOCK");
      expect(result.indexOf("existing stuff")).toBeLessThan(result.indexOf("# MY_BLOCK"));
    });
  });

  describe("prepend - new block into existing content", () => {
    it("should prepend a block before existing content", () => {
      const result = prependTextBlock("existing stuff", "MY_BLOCK", "new content");
      expect(result).toContain("existing stuff");
      expect(result).toContain("# MY_BLOCK\nnew content\n# END MY_BLOCK");
      expect(result.indexOf("# MY_BLOCK")).toBeLessThan(result.indexOf("existing stuff"));
    });
  });

  describe("update existing block", () => {
    it("should replace the content of an existing block", () => {
      const input = `before stuff

# MY_BLOCK
old content here
# END MY_BLOCK

after stuff`;
      const result = appendTextBlock(input, "MY_BLOCK", "brand new content");
      expect(result).toContain("before stuff");
      expect(result).toContain("after stuff");
      expect(result).toContain("# MY_BLOCK\nbrand new content\n# END MY_BLOCK");
      expect(result).not.toContain("old content here");
    });

    it("should update when called via prependTextBlock too", () => {
      const input = `top

# MY_BLOCK
old
# END MY_BLOCK

bottom`;
      const result = prependTextBlock(input, "MY_BLOCK", "updated");
      expect(result).toContain("# MY_BLOCK\nupdated\n# END MY_BLOCK");
      expect(result).not.toContain("old");
    });
  });

  describe("multiple blocks - should only update the targeted block", () => {
    it("should not clobber other blocks when updating one", () => {
      const input = `# BLOCK_A
content a
# END BLOCK_A

# BLOCK_B
content b
# END BLOCK_B`;

      const result = appendTextBlock(input, "BLOCK_A", "updated a");
      expect(result).toContain("# BLOCK_A\nupdated a\n# END BLOCK_A");
      expect(result).toContain("# BLOCK_B\ncontent b\n# END BLOCK_B");
    });

    it("should update the second block without clobbering the first", () => {
      const input = `# BLOCK_A
content a
# END BLOCK_A

# BLOCK_B
content b
# END BLOCK_B`;

      const result = appendTextBlock(input, "BLOCK_B", "updated b");
      expect(result).toContain("# BLOCK_A\ncontent a\n# END BLOCK_A");
      expect(result).toContain("# BLOCK_B\nupdated b\n# END BLOCK_B");
    });
  });

  describe("multi-line content in existing block", () => {
    it("should replace multi-line content correctly", () => {
      const input = `# CONFIG
line1
line2
line3
# END CONFIG`;

      const result = appendTextBlock(input, "CONFIG", "new1\nnew2");
      expect(result).toBe("# CONFIG\nnew1\nnew2\n# END CONFIG");
    });
  });

  describe("custom comment prefix", () => {
    it("should work with // comment prefix", () => {
      const result = appendTextBlock("", "MY_BLOCK", "some content", "//");
      expect(result).toBe("// MY_BLOCK\nsome content\n// END MY_BLOCK");
    });

    it("should update existing block with // prefix", () => {
      const input = `// MY_BLOCK
old
// END MY_BLOCK`;

      const result = appendTextBlock(input, "MY_BLOCK", "new", "//");
      expect(result).toContain("// MY_BLOCK\nnew\n// END MY_BLOCK");
      expect(result).not.toContain("old");
    });
  });

  describe("whitespace handling", () => {
    it("should trim configValue", () => {
      const result = appendTextBlock("", "MY_BLOCK", "  content with spaces  \n\n");
      expect(result).toContain("# MY_BLOCK\ncontent with spaces\n# END MY_BLOCK");
    });

    it("should not produce more than one consecutive blank line", () => {
      const result = appendTextBlock("some\n\n\n\ncontent", "BLK", "val");
      expect(result).not.toMatch(/\n\n\n/);
    });
  });

  describe("three blocks - update the middle one", () => {
    it("should only update block B and leave A and C intact", () => {
      const input = `# BLOCK_A
aaa
# END BLOCK_A

# BLOCK_B
bbb
# END BLOCK_B

# BLOCK_C
ccc
# END BLOCK_C`;

      const result = appendTextBlock(input, "BLOCK_B", "new_b");
      expect(result).toContain("# BLOCK_A\naaa\n# END BLOCK_A");
      expect(result).toContain("# BLOCK_B\nnew_b\n# END BLOCK_B");
      expect(result).toContain("# BLOCK_C\nccc\n# END BLOCK_C");
      expect(result).not.toContain("bbb");
    });
  });

  describe("block with content that looks like a delimiter", () => {
    it("should handle content containing # END in the value", () => {
      const input = `# MY_BLOCK
some content
# END MY_BLOCK`;

      // update with content that itself contains "# END" (but not the full delimiter)
      const result = appendTextBlock(input, "MY_BLOCK", "has # END inside");
      expect(result).toContain("# MY_BLOCK\nhas # END inside\n# END MY_BLOCK");
    });
  });
});
