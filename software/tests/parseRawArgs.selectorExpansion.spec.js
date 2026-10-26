/** Literal edge wildcard expansion preserves regex metacharacters and Unicode filenames. */
import { describe, expect, it } from "vitest";
import { getIndexFunction } from "./setup.js";

/** Resolve file selectors before the runner emits any scripts. */
const expandFiles = getIndexFunction("_expandWildcardScriptFiles");

describe("literal file selector expansion", () => {
  it.each([
    ["vim*", ["software/scripts/vim.js", "software/scripts/vim-config.js"]],
    ["*config", ["software/scripts/vim-config.js", "software/scripts/git-config.js"]],
    ["*config.js", ["software/scripts/vim-config.js", "software/scripts/git-config.js"]],
    ["*im*", ["software/scripts/vim.js", "software/scripts/vim-config.js"]],
    ["vim", ["software/scripts/vim.js"]],
    ["vi", ["vi"]],
  ])("expands file selector %s with literal edge matching", (selector, expected) => {
    expect(
      expandFiles([selector], ["software/scripts/vim.js", "software/scripts/vim-config.js", "software/scripts/git-config.js"]),
    ).toEqual(expected);
  });

  it.each([
    ["a[1]", ["software/scripts/a[1].js"]],
    ["a.", ["a."]],
    ["a?*", ["a?*"]],
    ["*💡*", ["software/scripts/tool💡.js"]],
  ])("treats regex metacharacters and Unicode literally in %s", (selector, matches) => {
    const confirmations = [];
    expect(
      expandFiles([selector], ["software/scripts/a[1].js", "software/scripts/a1.js", "software/scripts/tool💡.js"], confirmations),
    ).toEqual(matches);
    expect(confirmations).toEqual([]);
  });
});
