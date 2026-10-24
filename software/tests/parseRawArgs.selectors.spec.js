/** Regression coverage for exact selectors, explicit edge wildcards, and confirmation requests. */
import { beforeEach, describe, expect, it } from "vitest";
import { getIndexFunction, getSandboxProcess } from "./setup.js";

/** Parse selectors through the setup engine's argument boundary. */
const parseRawArgs = getIndexFunction("parseRawArgs");
/** Resolve file selectors before the runner emits any scripts. */
const expandFiles = getIndexFunction("_expandWildcardScriptFiles");

describe("setup selectors", () => {
  let proc;

  beforeEach(() => {
    proc = getSandboxProcess();
    delete proc.env.TEST_SCRIPT_FILES;
    delete proc.env.IS_FORCE_REFRESH;
    delete proc.env.BASHRC_BARE_ARGS;
    proc.env.PRESETS_JSON = JSON.stringify({
      edit: { files: ["exact.js"] },
      editors: { files: ["vim.js"] },
      "editor-pro": { files: ["code.js"] },
      "other-edit": { files: ["other.js"] },
    });
  });

  it.each(["--file", "--files", "-file", "-files"])("accepts %s with a separate filename", (flag) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([flag, "git.js"]);
    expect(parseRawArgs()).toMatchObject({ files: "git.js", forceRefresh: false, bareArgs: [] });
    expect(proc.env.TEST_SCRIPT_FILES).toBe("git.js");
    expect(proc.env.IS_FORCE_REFRESH).toBeUndefined();
  });

  it.each(["--file=git.js", "--files=git.js", "-file=git.js", "-files=git.js"])("accepts %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(parseRawArgs()).toMatchObject({ files: "git.js", forceRefresh: false, bareArgs: [] });
  });

  it.each(["--preset", "--presets", "-preset", "-presets"])("accepts %s with a separate preset", (flag) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([flag, "editors"]);
    expect(parseRawArgs()).toMatchObject({ files: "vim.js", presets: ["editors"], bareArgs: [], confirmations: [] });
  });

  it.each(["--preset=editors", "--presets=EDITORS", "@editors", "--preset=@editors"])("accepts exact preset %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(parseRawArgs()).toMatchObject({ files: "vim.js", presets: ["editors"], bareArgs: [], confirmations: [] });
  });

  it.each(["--preset=editor", "@editor", "--preset=#editors", "--preset=#EDIT*"])("rejects nonmatching preset %s atomically", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["-f", "--files=git.js", arg]);
    expect(() => parseRawArgs()).toThrow(/Unknown preset/);
    expect(proc.env.TEST_SCRIPT_FILES).toBeUndefined();
    expect(proc.env.IS_FORCE_REFRESH).toBeUndefined();
    expect(proc.env.BASHRC_BARE_ARGS).toBeUndefined();
  });

  it.each(["#editors", "#EDIT*"])("does not interpret %s as a preset marker", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(parseRawArgs()).toMatchObject({ files: arg, presets: [], bareArgs: [arg], confirmations: [] });
  });

  it.each(["--preset=EDIT*", "--presets=EDIT*", "@EDIT*", "--preset=@EDIT*"])("collects every prefix match for %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(parseRawArgs()).toMatchObject({
      files: "exact.js,vim.js,code.js",
      presets: ["edit", "editors", "editor-pro"],
      confirmations: [{ keyword: "EDIT*", mode: "presets", matches: ["edit", "editors", "editor-pro"] }],
    });
  });

  it.each(["--preset=*edit", "@*edit"])("collects every suffix match for %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(parseRawArgs()).toMatchObject({
      files: "exact.js,other.js",
      presets: ["edit", "other-edit"],
      confirmations: [{ keyword: "*edit", mode: "presets", matches: ["edit", "other-edit"] }],
    });
  });

  it.each(["--presets=*dit*", "@*dit*"])("collects every contains match for %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(parseRawArgs()).toMatchObject({
      files: "exact.js,vim.js,code.js,other.js",
      presets: ["edit", "editors", "editor-pro", "other-edit"],
      confirmations: [{ keyword: "*dit*", mode: "presets", matches: ["edit", "editors", "editor-pro", "other-edit"] }],
    });
  });

  it("does not require confirmation for a single wildcard match or an explicit list", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["@*pro", "--preset=edit,editors"]);
    expect(parseRawArgs()).toMatchObject({
      files: "code.js,exact.js,vim.js",
      presets: ["editor-pro", "edit", "editors"],
      confirmations: [],
    });
  });

  it.each(["@missing", "@missing*", "@*missing", "@ed*it"])("rejects invalid preset selector %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(() => parseRawArgs()).toThrow(/Unknown preset/);
    expect(proc.env.TEST_SCRIPT_FILES).toBeUndefined();
  });

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

  it("collects file confirmation requests for duplicate basenames, preserving folder boundaries", () => {
    const confirmations = [];
    const files = [
      "software/scripts/advanced/a/setup.js",
      "software/scripts/advanced/b/setup.js",
      "software/scripts/advanced-extra/setup.js",
    ];
    expect(expandFiles(["advanced/setup.js"], files, confirmations)).toEqual([
      "software/scripts/advanced/a/setup.js",
      "software/scripts/advanced/b/setup.js",
    ]);
    expect(confirmations).toEqual([
      {
        keyword: "advanced/setup.js",
        mode: "files",
        matches: ["software/scripts/advanced/a/setup.js", "software/scripts/advanced/b/setup.js"],
      },
    ]);
    expect(files).toEqual([
      "software/scripts/advanced/a/setup.js",
      "software/scripts/advanced/b/setup.js",
      "software/scripts/advanced-extra/setup.js",
    ]);
  });

  it.each([["vim*"], ["--file", "vim*"], ["--file=vim*"], ["--files", "vim*"]])("expands file aliases %j", (...args) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(args);
    const parsed = parseRawArgs();
    expect(
      expandFiles(parsed.files.split(","), ["software/scripts/vim.js", "software/scripts/vim-config.js", "software/scripts/git.js"]),
    ).toEqual(["software/scripts/vim.js", "software/scripts/vim-config.js"]);
  });

  it.each(["--file", "--files", "--preset", "--presets"])("rejects missing values for %s before selecting anything", (flag) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([flag]);
    expect(() => parseRawArgs()).toThrow(/requires a value/);
    expect(proc.env.TEST_SCRIPT_FILES).toBeUndefined();
    expect(proc.env.IS_FORCE_REFRESH).toBeUndefined();
  });

  it("does not consume another option as a selector value", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--file", "--dryrun"]);
    expect(() => parseRawArgs()).toThrow(/--file requires a value/);
  });

  it("keeps force refresh available alongside file selectors", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["-f", "--file", "git.js"]);
    expect(parseRawArgs()).toMatchObject({ files: "git.js", forceRefresh: true });
  });

  it("does not introduce a short preset alias", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["-p=editors"]);
    expect(parseRawArgs()).toMatchObject({ files: "", presets: [], forceRefresh: false });
  });
});
