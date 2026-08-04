/** Unit tests for expandSpecMacros() in autocomplete.common.js. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import vm from "vm";

// ---- load expandSpecMacros from autocomplete.common.js into a sandbox ----
const commonSource = fs.readFileSync("software/metadata/autocomplete.common.js", "utf-8");

const sandbox = {};
vm.runInNewContext(commonSource.replace(/^(const|let) /gm, "var ").replace(/^function (\w+)\(/gm, "var $1 = function $1("), sandbox);
const expandSpecMacros = sandbox.expandSpecMacros;
const DYNAMIC_TOKENS = sandbox.DYNAMIC_TOKENS;

describe("expandSpecMacros", () => {
  it("passes through content unchanged when no macros are defined", () => {
    const input = "add|--all,-A\ndiff|--staged,--cached\n";
    expect(expandSpecMacros(input)).toBe(input);
  });

  it("expands a single-level macro reference", () => {
    const input = ["add|__git_my_flags__,--extra", ">__git_my_flags__|--all,-A,--patch,-p"].join("\n");
    const out = expandSpecMacros(input);
    expect(out).toContain("add|--all,-A,--patch,-p,--extra");
    expect(out).not.toContain(">__git_my_flags__");
  });

  it("strips macro definition lines from output", () => {
    const input = ["foo|x,y", ">__bar__|a,b,c"].join("\n");
    const out = expandSpecMacros(input);
    expect(out.split("\n").filter((l) => l.startsWith(">"))).toEqual([]);
  });

  it("recursively expands macros that reference other macros", () => {
    const input = ["cmd|__outer__", ">__outer__|--first,__inner__", ">__inner__|--second,--third"].join("\n");
    const out = expandSpecMacros(input);
    expect(out).toContain("cmd|--first,--second,--third");
  });

  it("passes through dynamic tokens unchanged (they're runtime-expanded)", () => {
    const input = ["add|__git_files__,__my_flags__", ">__my_flags__|--all,-A"].join("\n");
    const out = expandSpecMacros(input);
    expect(out).toContain("add|__git_files__,--all,-A");
  });

  it("dedupes the expanded completion list per line, preserving first-occurrence order", () => {
    const input = ["cmd|__a__,__b__,--shared", ">__a__|--shared,--unique1", ">__b__|--shared,--unique2"].join("\n");
    const out = expandSpecMacros(input);
    expect(out).toContain("cmd|--shared,--unique1,--unique2");
  });

  it("throws on macro recursion exceeding maxDepth", () => {
    const input = ["cmd|__a__", ">__a__|__b__", ">__b__|__a__"].join("\n");
    expect(() => expandSpecMacros(input)).toThrow(/cycle|recursion/i);
  });

  it("throws on duplicate macro definitions", () => {
    const input = [">__dup__|--first", ">__dup__|--second", "cmd|__dup__"].join("\n");
    expect(() => expandSpecMacros(input)).toThrow(/duplicate macro/i);
  });

  it("throws on malformed > lines", () => {
    const input = ">not_a_macro_format\ncmd|x";
    expect(() => expandSpecMacros(input)).toThrow(/malformed macro/i);
  });

  it("throws on unknown __token__ references that are not local macros or dynamic tokens", () => {
    const input = "cmd|__totally_made_up_token__";
    expect(() => expandSpecMacros(input)).toThrow(/unknown token/i);
  });

  it("allows custom maxDepth via options", () => {
    // 3 levels of nesting: a -> b -> c -> literal
    const input = ["cmd|__a__", ">__a__|__b__", ">__b__|__c__", ">__c__|--leaf"].join("\n");
    expect(expandSpecMacros(input, { maxDepth: 10 })).toContain("cmd|--leaf");
    expect(() => expandSpecMacros(input, { maxDepth: 1 })).toThrow(/recursion exceeded/i);
  });

  it("allows custom knownDynamicTokens for isolated testing", () => {
    const input = "cmd|__custom_dyn__";
    expect(() => expandSpecMacros(input)).toThrow(/unknown token/i);
    expect(expandSpecMacros(input, { knownDynamicTokens: ["__custom_dyn__"] })).toContain("cmd|__custom_dyn__");
  });

  it("preserves command lines that have no | separator", () => {
    const input = "bareword\ncmd|--flag";
    const out = expandSpecMacros(input, { knownDynamicTokens: [] });
    // no macros defined, returns input unchanged
    expect(out).toBe(input);
  });

  it("preserves command lines without | when macros are defined", () => {
    const input = ["bareword", "cmd|__m__", ">__m__|--x"].join("\n");
    const out = expandSpecMacros(input);
    expect(out).toContain("bareword");
    expect(out).toContain("cmd|--x");
  });

  it("loads DYNAMIC_TOKENS as an array with expected entries", () => {
    expect(Array.isArray(DYNAMIC_TOKENS)).toBe(true);
    expect(DYNAMIC_TOKENS).toContain("__git_branches__");
    expect(DYNAMIC_TOKENS).toContain("__npm_scripts__");
    expect(DYNAMIC_TOKENS).toContain("__nested_paths__");
    // The 7 static flag tokens MUST NOT be in DYNAMIC_TOKENS — they're macros now.
    expect(DYNAMIC_TOKENS).not.toContain("__git_add_flags__");
    expect(DYNAMIC_TOKENS).not.toContain("__git_diff_flags__");
    expect(DYNAMIC_TOKENS).not.toContain("__git_rebase_flags__");
  });
});

describe("expandSpecMacros — git spec file integration", () => {
  it("resolves all 7 __git_*_flags__ macros from the on-disk git spec file", () => {
    const gitSpec = fs.readFileSync("software/metadata/autocomplete-complete-spec/git", "utf-8");
    const expanded = expandSpecMacros(gitSpec);
    // After expansion, no `>` lines should remain.
    expect(expanded.split("\n").filter((l) => l.startsWith(">"))).toEqual([]);
    // After expansion, no `__git_*_flags__` tokens should remain (they're all defined locally).
    const stillReferenced = expanded.match(/__git_[a-z]+_flags__/g);
    expect(stillReferenced, `unresolved macros: ${stillReferenced}`).toBeNull();
    // Spot-check: the `diff` command should now have literal flags.
    expect(expanded).toMatch(/^diff\|.*--staged.*--cached.*--word-diff/m);
  });
});
