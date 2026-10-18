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

describe("removeBlock", () => {
  it("should remove an HTML-comment block (markers, body, and one trailing newline)", () => {
    const input = `before\n<!-- BEGIN managed-rules -->\nrule one\nrule two\n<!-- END managed-rules -->\nafter\n`;
    const result = removeBlock(input, "managed-rules", "<!--", " -->");
    expect(result).toBe("before\nafter\n");
  });

  it("should remove a bash-style block keyed with a comment suffix-less prefix", () => {
    const input = `header\n# ${TEXT_BLOCK_START_MARKER} my-key\nbody\n# ${TEXT_BLOCK_END_MARKER} my-key\nfooter`;
    const result = removeBlock(input, "my-key", "#");
    expect(result).toBe("header\nfooter");
  });

  it("should be a no-op when the block is absent (idempotent for legacy-marker cleanup)", () => {
    const input = `before\nafter\n`;
    expect(removeBlock(input, "managed-rules", "<!--", " -->")).toBe(input);
  });

  it("should be a no-op on empty content", () => {
    expect(removeBlock("", "any-key", "<!--", " -->")).toBe("");
  });

  it("should support keys containing spaces, pipes, slashes, and dots (descriptive marker keys)", () => {
    const key = "synle/bashrc | software/scripts/advanced/llm/_common/instructions.md";
    const input = `header\n<!-- BEGIN ${key} -->\nbody\n<!-- END ${key} -->\nfooter\n`;
    expect(removeBlock(input, key, "<!--", " -->")).toBe("header\nfooter\n");
  });

  it("should match the LAST END marker so block bodies that mention the END text are safe", () => {
    const input = `before\n<!-- BEGIN k -->\nintro\nliteral "<!-- END k -->" in quoted docs\nmore body\n<!-- END k -->\nafter\n`;
    expect(removeBlock(input, "k", "<!--", " -->")).toBe("before\nafter\n");
  });
});
