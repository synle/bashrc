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

  it("requires selector confirmation by default", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["--files=vim*"]);
    const { files, skipPrompt } = parseRawArgs();
    expect({ files, skipPrompt }).toMatchInlineSnapshot(`
      {
        "files": "vim*",
        "skipPrompt": false,
      }
    `);
  });

  it.each(["--skip-prompt", "-skip-prompt"])("accepts %s without changing the selected files", (flag) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([flag, "--files=vim*"]);
    const { files, skipPrompt, forceRefresh, bareArgs } = parseRawArgs();
    expect({ files, skipPrompt, forceRefresh, bareArgs }).toMatchInlineSnapshot(`
      {
        "bareArgs": [],
        "files": "vim*",
        "forceRefresh": false,
        "skipPrompt": true,
      }
    `);
    expect(proc.env.TEST_SCRIPT_FILES).toBe("vim*");
  });

  it.each(["--file", "--files", "-file", "-files"])("accepts %s with a separate filename", (flag) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([flag, "git.js"]);
    const { files, forceRefresh, bareArgs } = parseRawArgs();
    expect({ files, forceRefresh, bareArgs }).toMatchInlineSnapshot(`
      {
        "bareArgs": [],
        "files": "git.js",
        "forceRefresh": false,
      }
    `);
    expect(proc.env.TEST_SCRIPT_FILES).toBe("git.js");
    expect(proc.env.IS_FORCE_REFRESH).toBeUndefined();
  });

  it.each(["--file=git.js", "--files=git.js", "-file=git.js", "-files=git.js"])("accepts %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    const { files, forceRefresh, bareArgs } = parseRawArgs();
    expect({ files, forceRefresh, bareArgs }).toMatchInlineSnapshot(`
      {
        "bareArgs": [],
        "files": "git.js",
        "forceRefresh": false,
      }
    `);
  });

  it.each(["--preset", "--presets", "-preset", "-presets"])("accepts %s with a separate preset", (flag) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([flag, "editors"]);
    const { files, presets, bareArgs, confirmations } = parseRawArgs();
    expect({ files, presets, bareArgs, confirmations }).toMatchInlineSnapshot(`
      {
        "bareArgs": [],
        "confirmations": [],
        "files": "vim.js",
        "presets": [
          "editors",
        ],
      }
    `);
  });

  it.each(["--preset=editors", "--presets=EDITORS", "@editors", "--preset=@editors"])("accepts exact preset %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    const { files, presets, bareArgs, confirmations } = parseRawArgs();
    expect({ files, presets, bareArgs, confirmations }).toMatchInlineSnapshot(`
      {
        "bareArgs": [],
        "confirmations": [],
        "files": "vim.js",
        "presets": [
          "editors",
        ],
      }
    `);
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
    const { files, presets, bareArgs, confirmations } = parseRawArgs();
    expect(files).toBe(arg);
    expect(bareArgs).toEqual([arg]);
    expect({ presets, confirmations }).toMatchInlineSnapshot(`
      {
        "confirmations": [],
        "presets": [],
      }
    `);
  });

  it.each(["--preset=EDIT*", "--presets=EDIT*", "@EDIT*", "--preset=@EDIT*"])("collects every prefix match for %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    const { files, presets, confirmations } = parseRawArgs();
    expect({ files, presets, confirmations }).toMatchInlineSnapshot(`
      {
        "confirmations": [
          {
            "keyword": "EDIT*",
            "matches": [
              "edit",
              "editors",
              "editor-pro",
            ],
            "mode": "presets",
          },
        ],
        "files": "exact.js,vim.js,code.js",
        "presets": [
          "edit",
          "editors",
          "editor-pro",
        ],
      }
    `);
  });

  it.each(["--preset=*edit", "@*edit"])("collects every suffix match for %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    const { files, presets, confirmations } = parseRawArgs();
    expect({ files, presets, confirmations }).toMatchInlineSnapshot(`
      {
        "confirmations": [
          {
            "keyword": "*edit",
            "matches": [
              "edit",
              "other-edit",
            ],
            "mode": "presets",
          },
        ],
        "files": "exact.js,other.js",
        "presets": [
          "edit",
          "other-edit",
        ],
      }
    `);
  });

  it.each(["--presets=*dit*", "@*dit*"])("collects every contains match for %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    const { files, presets, confirmations } = parseRawArgs();
    expect({ files, presets, confirmations }).toMatchInlineSnapshot(`
      {
        "confirmations": [
          {
            "keyword": "*dit*",
            "matches": [
              "edit",
              "editors",
              "editor-pro",
              "other-edit",
            ],
            "mode": "presets",
          },
        ],
        "files": "exact.js,vim.js,code.js,other.js",
        "presets": [
          "edit",
          "editors",
          "editor-pro",
          "other-edit",
        ],
      }
    `);
  });

  it("does not require confirmation for a single wildcard match or an explicit list", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["@*pro", "--preset=edit,editors"]);
    const { files, presets, confirmations } = parseRawArgs();
    expect({ files, presets, confirmations }).toMatchInlineSnapshot(`
      {
        "confirmations": [],
        "files": "code.js,exact.js,vim.js",
        "presets": [
          "editor-pro",
          "edit",
          "editors",
        ],
      }
    `);
  });

  it.each(["@missing", "@missing*", "@*missing", "@ed*it"])("rejects invalid preset selector %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(() => parseRawArgs()).toThrow(/Unknown preset/);
    expect(proc.env.TEST_SCRIPT_FILES).toBeUndefined();
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
    const { files, forceRefresh } = parseRawArgs();
    expect({ files, forceRefresh }).toMatchInlineSnapshot(`
      {
        "files": "git.js",
        "forceRefresh": true,
      }
    `);
  });

  it("does not introduce a short preset alias", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["-p=editors"]);
    const { files, presets, forceRefresh } = parseRawArgs();
    expect({ files, presets, forceRefresh }).toMatchInlineSnapshot(`
      {
        "files": "",
        "forceRefresh": false,
        "presets": [],
      }
    `);
  });
});
