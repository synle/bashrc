import { describe, it, expect } from "vitest";

import { getIndexFunction, getIndexConstant } from "./setup.js";

const replaceBlock = getIndexFunction("replaceBlock");

const removeBlock = getIndexFunction("removeBlock");

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
