import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const replaceBlock = getIndexFunction("replaceBlock");
const appendTextBlock = getIndexFunction("appendTextBlock");
const prependTextBlock = getIndexFunction("prependTextBlock");
const removeEmptyBlocks = getIndexFunction("removeEmptyBlocks");
const _expandSourceMarkers = getIndexFunction("_expandSourceMarkers");
const TEXT_BLOCK_START_MARKER = getIndexConstant("TEXT_BLOCK_START_MARKER");
const TEXT_BLOCK_END_MARKER = getIndexConstant("TEXT_BLOCK_END_MARKER");
const TEXT_BLOCK_SHORT_MARKER = getIndexConstant("TEXT_BLOCK_SHORT_MARKER");
const TEXT_BLOCK_ALIAS_MARKER = getIndexConstant("TEXT_BLOCK_ALIAS_MARKER");
const TEXT_BLOCK_SOURCE_MARKER = getIndexConstant("TEXT_BLOCK_SOURCE_MARKER");
const TEXT_BLOCK_SOURCE_START_MARKER = getIndexConstant("TEXT_BLOCK_SOURCE_START_MARKER");
const TEXT_BLOCK_SOURCE_END_MARKER = getIndexConstant("TEXT_BLOCK_SOURCE_END_MARKER");

// ---- tests ----

describe("replaceBlock", () => {
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

  describe("should match and replace existing BEGIN/END blocks", () => {
    it("should replace content within existing markers", () => {
      const input = `before

# BEGIN MY_BLOCK
old legacy content
# END MY_BLOCK

after`;
      const result = appendTextBlock(input, "MY_BLOCK", "new content");
      expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nnew content\n# ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result).not.toContain("old legacy content");
    });

    it("should replace content with // prefix blocks too", () => {
      const input = `// BEGIN MY_BLOCK
old
// END MY_BLOCK`;
      const result = appendTextBlock(input, "MY_BLOCK", "new", "//");
      expect(result).toContain(`// ${TEXT_BLOCK_START_MARKER} MY_BLOCK\nnew\n// ${TEXT_BLOCK_END_MARKER} MY_BLOCK`);
      expect(result).not.toContain("old");
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
    it("should handle content containing # END in the value", () => {
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

describe("removeEmptyBlocks", () => {
  it("should remove empty BEGIN/END pairs", () => {
    const input = `header\n# ${TEXT_BLOCK_START_MARKER} empty block\n# ${TEXT_BLOCK_END_MARKER} empty block\nfooter`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_START_MARKER);
    expect(result).toContain("header");
    expect(result).toContain("footer");
  });

  it("should keep blocks that have content", () => {
    const input = `# ${TEXT_BLOCK_START_MARKER} filled\nsome content\n# ${TEXT_BLOCK_END_MARKER} filled`;
    const result = removeEmptyBlocks(input);
    expect(result).toContain("some content");
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} filled`);
    expect(result).toContain(`# ${TEXT_BLOCK_END_MARKER} filled`);
  });

  it("should remove empty but keep filled in mixed content", () => {
    const input = [
      `# ${TEXT_BLOCK_START_MARKER} empty`,
      `# ${TEXT_BLOCK_END_MARKER} empty`,
      "",
      `# ${TEXT_BLOCK_START_MARKER} filled`,
      "real content",
      `# ${TEXT_BLOCK_END_MARKER} filled`,
      "",
      `# ${TEXT_BLOCK_START_MARKER} also empty`,
      `# ${TEXT_BLOCK_END_MARKER} also empty`,
    ].join("\n");
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain("empty");
    expect(result).toContain("real content");
    expect(result).toContain(`# ${TEXT_BLOCK_START_MARKER} filled`);
  });

  it("should handle empty pairs with whitespace between markers", () => {
    const input = `# ${TEXT_BLOCK_START_MARKER} spaced\n   \n# ${TEXT_BLOCK_END_MARKER} spaced`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_START_MARKER);
  });

  it("should handle Windows-style \\r\\n line endings", () => {
    const input = `# ${TEXT_BLOCK_START_MARKER} crlf\r\n# ${TEXT_BLOCK_END_MARKER} crlf`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_START_MARKER);
  });

  it("should handle \\r\\n with whitespace between markers", () => {
    const input = `# ${TEXT_BLOCK_START_MARKER} crlf\r\n  \r\n# ${TEXT_BLOCK_END_MARKER} crlf`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_START_MARKER);
  });

  it("should return unchanged text when no markers present", () => {
    const input = "just some text\nno markers here";
    const result = removeEmptyBlocks(input);
    expect(result).toBe(input.trim());
  });

  it("should remove short-form BEGIN/END markers", () => {
    const input = `header\n# ${TEXT_BLOCK_SHORT_MARKER} empty block\nfooter`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_SHORT_MARKER);
    expect(result).toContain("header");
    expect(result).toContain("footer");
  });

  it("should remove short-form BEGIN/END markers with dash separator", () => {
    const input = `header\n# ${TEXT_BLOCK_SHORT_MARKER} - empty block\nfooter`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_SHORT_MARKER);
    expect(result).toContain("header");
    expect(result).toContain("footer");
  });

  it("should remove short-form BEGIN/END markers with extra whitespace around dash", () => {
    const input = `header\n# ${TEXT_BLOCK_SHORT_MARKER}   -  empty block\nfooter`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_SHORT_MARKER);
    expect(result).toContain("header");
    expect(result).toContain("footer");
  });
});

describe("short-form marker expansion via replaceBlock", () => {
  it("should expand short-form and replace content", () => {
    const content = `# ${TEXT_BLOCK_SHORT_MARKER} Bash Keybindings`;
    const result = replaceBlock(content, "Bash Keybindings", "bind -x key", "#", "");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} Bash Keybindings\nbind -x key\n# ${TEXT_BLOCK_END_MARKER} Bash Keybindings`);
  });

  it("should expand short-form with dash separator", () => {
    const content = `# ${TEXT_BLOCK_SHORT_MARKER} - Bash Keybindings`;
    const result = replaceBlock(content, "Bash Keybindings", "bind -x key", "#", "");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} Bash Keybindings\nbind -x key\n# ${TEXT_BLOCK_END_MARKER} Bash Keybindings`);
  });

  it("should expand short-form with extra whitespace around dash", () => {
    const content = `# ${TEXT_BLOCK_SHORT_MARKER}   -  Bash Keybindings`;
    const result = replaceBlock(content, "Bash Keybindings", "bind -x key", "#", "");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} Bash Keybindings\nbind -x key\n# ${TEXT_BLOCK_END_MARKER} Bash Keybindings`);
  });

  it("should preserve surrounding content when expanding short-form", () => {
    const content = `before\n# ${TEXT_BLOCK_SHORT_MARKER} mykey\nafter`;
    const result = replaceBlock(content, "mykey", "new content", "#", "");
    expect(result).toBe(`before\n# ${TEXT_BLOCK_START_MARKER} mykey\nnew content\n# ${TEXT_BLOCK_END_MARKER} mykey\nafter`);
  });

  it("should work with // comment prefix in short-form", () => {
    const content = `// ${TEXT_BLOCK_SHORT_MARKER} mykey`;
    const result = replaceBlock(content, "mykey", "value", "//", "");
    expect(result).toBe(`// ${TEXT_BLOCK_START_MARKER} mykey\nvalue\n// ${TEXT_BLOCK_END_MARKER} mykey`);
  });

  it("should work with HTML comment markers in short-form", () => {
    const content = `<!-- ${TEXT_BLOCK_SHORT_MARKER} mykey -->`;
    const result = replaceBlock(content, "mykey", "value", "<!--", " -->");
    expect(result).toBe(`<!-- ${TEXT_BLOCK_START_MARKER} mykey -->\nvalue\n<!-- ${TEXT_BLOCK_END_MARKER} mykey -->`);
  });

  it("should prefer long-form markers over short-form", () => {
    const content = `# ${TEXT_BLOCK_START_MARKER} mykey\nold\n# ${TEXT_BLOCK_END_MARKER} mykey`;
    const result = replaceBlock(content, "mykey", "new", "#", "");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} mykey\nnew\n# ${TEXT_BLOCK_END_MARKER} mykey`);
  });
});

describe("BLOCK alias marker expansion via replaceBlock", () => {
  it("should expand BLOCK marker and replace content", () => {
    const content = `# ${TEXT_BLOCK_ALIAS_MARKER} mykey`;
    const result = replaceBlock(content, "mykey", "new content", "#", "");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} mykey\nnew content\n# ${TEXT_BLOCK_END_MARKER} mykey`);
  });

  it("should expand BLOCK marker with dash separator", () => {
    const content = `# ${TEXT_BLOCK_ALIAS_MARKER} - mykey`;
    const result = replaceBlock(content, "mykey", "new content", "#", "");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} mykey\nnew content\n# ${TEXT_BLOCK_END_MARKER} mykey`);
  });

  it("should expand BLOCK marker with extra whitespace around dash", () => {
    const content = `# ${TEXT_BLOCK_ALIAS_MARKER}   -  mykey`;
    const result = replaceBlock(content, "mykey", "new content", "#", "");
    expect(result).toBe(`# ${TEXT_BLOCK_START_MARKER} mykey\nnew content\n# ${TEXT_BLOCK_END_MARKER} mykey`);
  });
});

describe("removeEmptyBlocks with BLOCK alias", () => {
  it("should remove BLOCK markers", () => {
    const input = `header\n# ${TEXT_BLOCK_ALIAS_MARKER} empty block\nfooter`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_ALIAS_MARKER);
    expect(result).toContain("header");
    expect(result).toContain("footer");
  });

  it("should remove BLOCK markers with dash separator", () => {
    const input = `header\n# ${TEXT_BLOCK_ALIAS_MARKER} - empty block\nfooter`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_ALIAS_MARKER);
    expect(result).toContain("header");
    expect(result).toContain("footer");
  });
});

describe("_expandSourceMarkers", () => {
  it("should expand SOURCE marker into empty SOURCE_BEGIN/SOURCE_END pair", () => {
    const input = `header\n# ${TEXT_BLOCK_SOURCE_MARKER} software/scripts/foo.bash\nfooter`;
    const result = _expandSourceMarkers(input, "#");
    expect(result.content).toContain(`# ${TEXT_BLOCK_SOURCE_START_MARKER} software/scripts/foo.bash`);
    expect(result.content).toContain(`# ${TEXT_BLOCK_SOURCE_END_MARKER} software/scripts/foo.bash`);
    expect(result.content).toContain("header");
    expect(result.content).toContain("footer");
  });

  it("should return the list of source file paths", () => {
    const input = [`# ${TEXT_BLOCK_SOURCE_MARKER} path/to/a.bash`, `# ${TEXT_BLOCK_SOURCE_MARKER} path/to/b.sh`].join("\n");
    const result = _expandSourceMarkers(input, "#");
    expect(result.sourceFiles).toEqual(["path/to/a.bash", "path/to/b.sh"]);
  });

  it("should return empty sourceFiles when no SOURCE markers present", () => {
    const input = "no markers here";
    const result = _expandSourceMarkers(input, "#");
    expect(result.sourceFiles).toEqual([]);
    expect(result.content).toBe(input);
  });

  it("should trim whitespace from file paths", () => {
    const input = `# ${TEXT_BLOCK_SOURCE_MARKER}   path/to/file.bash  `;
    const result = _expandSourceMarkers(input, "#");
    expect(result.sourceFiles).toEqual(["path/to/file.bash"]);
    expect(result.content).toContain(`# ${TEXT_BLOCK_SOURCE_START_MARKER} path/to/file.bash`);
  });

  it("should extract path from SOURCE marker with dash prefix", () => {
    const input = `# ${TEXT_BLOCK_SOURCE_MARKER} - path/to/file.bash`;
    const result = _expandSourceMarkers(input, "#");
    expect(result.sourceFiles).toEqual(["path/to/file.bash"]);
    expect(result.content).toContain(`# ${TEXT_BLOCK_SOURCE_START_MARKER} path/to/file.bash`);
  });

  it("should extract path from SOURCE marker with label prefix", () => {
    const input = `# ${TEXT_BLOCK_SOURCE_MARKER} Bash Keys - software/scripts/bash-keys.profile.bash`;
    const result = _expandSourceMarkers(input, "#");
    expect(result.sourceFiles).toEqual(["software/scripts/bash-keys.profile.bash"]);
    expect(result.content).toContain(`# ${TEXT_BLOCK_SOURCE_START_MARKER} software/scripts/bash-keys.profile.bash`);
  });

  it("should collect file paths from existing SOURCE_BEGIN markers", () => {
    const input = `# ${TEXT_BLOCK_SOURCE_START_MARKER} path/to/file.bash\nold content\n# ${TEXT_BLOCK_SOURCE_END_MARKER} path/to/file.bash`;
    const result = _expandSourceMarkers(input, "#");
    expect(result.sourceFiles).toEqual(["path/to/file.bash"]);
    expect(result.content).toContain(`# ${TEXT_BLOCK_SOURCE_START_MARKER} path/to/file.bash`);
  });

  it("should collect from both SOURCE and existing SOURCE_BEGIN markers", () => {
    const input = [
      `# ${TEXT_BLOCK_SOURCE_MARKER} path/to/new.bash`,
      `# ${TEXT_BLOCK_SOURCE_START_MARKER} path/to/existing.bash`,
      `old content`,
      `# ${TEXT_BLOCK_SOURCE_END_MARKER} path/to/existing.bash`,
    ].join("\n");
    const result = _expandSourceMarkers(input, "#");
    expect(result.sourceFiles).toEqual(["path/to/new.bash", "path/to/existing.bash"]);
  });
});

describe("removeEmptyBlocks with SOURCE markers", () => {
  it("should remove unexpanded SOURCE markers", () => {
    const input = `header\n# ${TEXT_BLOCK_SOURCE_MARKER} software/scripts/foo.bash\nfooter`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_SOURCE_MARKER);
    expect(result).toContain("header");
    expect(result).toContain("footer");
  });

  it("should remove empty SOURCE_BEGIN/SOURCE_END pairs", () => {
    const input = `header\n# ${TEXT_BLOCK_SOURCE_START_MARKER} path/to/file.bash\n# ${TEXT_BLOCK_SOURCE_END_MARKER} path/to/file.bash\nfooter`;
    const result = removeEmptyBlocks(input);
    expect(result).not.toContain(TEXT_BLOCK_SOURCE_START_MARKER);
    expect(result).not.toContain(TEXT_BLOCK_SOURCE_END_MARKER);
    expect(result).toContain("header");
    expect(result).toContain("footer");
  });
});
