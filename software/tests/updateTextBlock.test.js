import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const updateTextBlock = getIndexFunction("updateTextBlock");
const appendTextBlock = getIndexFunction("appendTextBlock");
const prependTextBlock = getIndexFunction("prependTextBlock");
const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");
const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");

// ---- tests ----

describe("updateTextBlock", () => {
  describe("append - new block into empty content", () => {
    it("should append a new block to empty content", () => {
      const result = appendTextBlock("", "MY_BLOCK", "line1\nline2");
      expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nline1\nline2\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
    });
  });

  describe("prepend - new block into empty content", () => {
    it("should prepend a new block to empty content", () => {
      const result = prependTextBlock("", "MY_BLOCK", "line1\nline2");
      expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nline1\nline2\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
    });
  });

  describe("append - new block into existing content", () => {
    it("should append a block after existing content", () => {
      const result = appendTextBlock("existing stuff", "MY_BLOCK", "new content");
      expect(result).toContain("existing stuff");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nnew content\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result.indexOf("existing stuff")).toBeLessThan(result.indexOf(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK`));
    });
  });

  describe("prepend - new block into existing content", () => {
    it("should prepend a block before existing content", () => {
      const result = prependTextBlock("existing stuff", "MY_BLOCK", "new content");
      expect(result).toContain("existing stuff");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nnew content\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result.indexOf(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK`)).toBeLessThan(result.indexOf("existing stuff"));
    });
  });

  describe("update existing block (new format)", () => {
    it("should replace the content of an existing block", () => {
      const input = `before stuff

# ${TEXT_BLOCK_START_MARKER} MY_BLOCK
old content here
# ${TEXT_BLOCK_END_MARKER} MY_BLOCK

after stuff`;
      const result = appendTextBlock(input, "MY_BLOCK", "brand new content");
      expect(result).toContain("before stuff");
      expect(result).toContain("after stuff");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nbrand new content\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result).not.toContain("old content here");
    });

    it("should update when called via prependTextBlock too", () => {
      const input = `top

# ${TEXT_BLOCK_START_MARKER} MY_BLOCK
old
# ${TEXT_BLOCK_END_MARKER} MY_BLOCK

bottom`;
      const result = prependTextBlock(input, "MY_BLOCK", "updated");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nupdated\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result).not.toContain("\nold\n");
    });
  });

  describe("backward compatibility - upgrade legacy format to new format", () => {
    it("should match legacy format and rewrite with new markers", () => {
      const input = `before

# MY_BLOCK
old legacy content
# END MY_BLOCK

after`;
      const result = appendTextBlock(input, "MY_BLOCK", "new content");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nnew content\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result).not.toContain("old legacy content");
      expect(result).not.toMatch(/# MY_BLOCK\n/);
      expect(result).not.toContain("# END MY_BLOCK");
    });

    it("should upgrade legacy // prefix blocks too", () => {
      const input = `// MY_BLOCK
old
// END MY_BLOCK`;
      const result = appendTextBlock(input, "MY_BLOCK", "new", "//");
      expect(result).toContain(`// ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nnew\n// ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result).not.toContain("// END MY_BLOCK");
    });
  });

  describe("multiple blocks - should only update the targeted block", () => {
    it("should not clobber other blocks when updating one", () => {
      const input = `# ${TEXT_BLOCK_START_MARKER} BLOCK_A
content a
# ${TEXT_BLOCK_END_MARKER} BLOCK_A

# ${TEXT_BLOCK_START_MARKER} BLOCK_B
content b
# ${TEXT_BLOCK_END_MARKER} BLOCK_B`;

      const result = appendTextBlock(input, "BLOCK_A", "updated a");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} BLOCK_A\nupdated a\n# ${TEXT_BLOCK_END_MARKER} BLOCK_A`);
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} BLOCK_B\ncontent b\n# ${TEXT_BLOCK_END_MARKER} BLOCK_B`);
    });

    it("should update the second block without clobbering the first", () => {
      const input = `# ${TEXT_BLOCK_START_MARKER} BLOCK_A
content a
# ${TEXT_BLOCK_END_MARKER} BLOCK_A

# ${TEXT_BLOCK_START_MARKER} BLOCK_B
content b
# ${TEXT_BLOCK_END_MARKER} BLOCK_B`;

      const result = appendTextBlock(input, "BLOCK_B", "updated b");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} BLOCK_A\ncontent a\n# ${TEXT_BLOCK_END_MARKER} BLOCK_A`);
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} BLOCK_B\nupdated b\n# ${TEXT_BLOCK_END_MARKER} BLOCK_B`);
    });
  });

  describe("multi-line content in existing block", () => {
    it("should replace multi-line content correctly", () => {
      const input = `# ${TEXT_BLOCK_START_MARKER} CONFIG
line1
line2
line3
# ${TEXT_BLOCK_END_MARKER} CONFIG`;

      const result = appendTextBlock(input, "CONFIG", "new1\nnew2");
      expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} CONFIG\nnew1\nnew2\n# ${TEXT_BLOCK_END_MARKER} CONFIG`);
    });
  });

  describe("custom comment prefix", () => {
    it("should work with // comment prefix", () => {
      const result = appendTextBlock("", "MY_BLOCK", "some content", "//");
      expect(result).toBe(`// ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nsome content\n// ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
    });

    it("should update existing block with // prefix", () => {
      const input = `// ${TEXT_BLOCK_START_MARKER} MY_BLOCK
old
// ${TEXT_BLOCK_END_MARKER} MY_BLOCK`;

      const result = appendTextBlock(input, "MY_BLOCK", "new", "//");
      expect(result).toContain(`// ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nnew\n// ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result).not.toContain("\nold\n");
    });
  });

  describe("whitespace handling", () => {
    it("should trim configValue", () => {
      const result = appendTextBlock("", "MY_BLOCK", "  content with spaces  \n\n");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\ncontent with spaces\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
    });

    it("should not produce more than one consecutive blank line", () => {
      const result = appendTextBlock("some\n\n\n\ncontent", "BLK", "val");
      expect(result).not.toMatch(/\n\n\n/);
    });
  });

  describe("three blocks - update the middle one", () => {
    it("should only update block B and leave A and C intact", () => {
      const input = `# ${TEXT_BLOCK_START_MARKER} BLOCK_A
aaa
# ${TEXT_BLOCK_END_MARKER} BLOCK_A

# ${TEXT_BLOCK_START_MARKER} BLOCK_B
bbb
# ${TEXT_BLOCK_END_MARKER} BLOCK_B

# ${TEXT_BLOCK_START_MARKER} BLOCK_C
ccc
# ${TEXT_BLOCK_END_MARKER} BLOCK_C`;

      const result = appendTextBlock(input, "BLOCK_B", "new_b");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} BLOCK_A\naaa\n# ${TEXT_BLOCK_END_MARKER} BLOCK_A`);
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} BLOCK_B\nnew_b\n# ${TEXT_BLOCK_END_MARKER} BLOCK_B`);
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} BLOCK_C\nccc\n# ${TEXT_BLOCK_END_MARKER} BLOCK_C`);
      expect(result).not.toContain("bbb");
    });
  });

  describe("block with content that looks like a delimiter", () => {
    it("should handle content containing # END_CONTENT in the value", () => {
      const input = `# ${TEXT_BLOCK_START_MARKER} MY_BLOCK
some content
# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`;

      const result = appendTextBlock(input, "MY_BLOCK", `has # ${TEXT_BLOCK_END_MARKER} inside`);
      expect(result).toContain(
        `# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nhas # ${TEXT_BLOCK_END_MARKER} inside\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`,
      );
    });
  });
});
