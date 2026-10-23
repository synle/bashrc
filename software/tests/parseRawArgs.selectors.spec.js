/** Regression coverage for equivalent setup selectors and prefix wildcards. */
import { beforeEach, describe, expect, it } from "vitest";
import { getIndexFunction, getSandboxProcess } from "./setup.js";

/** Parse CLI selectors through the setup engine's argument boundary. */
const parseRawArgs = getIndexFunction("parseRawArgs");
/** Expand parsed file selectors through the runner's wildcard boundary. */
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
    expect(parseRawArgs()).toMatchObject({ files: "vim.js", presets: ["editors"], bareArgs: [] });
  });

  it.each(["--preset=editors", "--presets=editors", "#editors", "@editors", "--preset=#editors"])(
    "accepts %s as a strict preset selector",
    (arg) => {
      proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
      expect(parseRawArgs()).toMatchObject({ files: "vim.js", presets: ["editors"], bareArgs: [] });
    },
  );

  it.each(["--preset=EDIT*", "--presets=EDIT*", "#EDIT*", "@EDIT*"])("expands every prefix match for %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(parseRawArgs()).toMatchObject({ files: "exact.js,vim.js,code.js", presets: ["edit", "editors", "editor-pro"] });
  });

  it("composes raw files, repeated aliases, and preset lists", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([
      "raw.js",
      "--files",
      "git.js",
      "--file=extra.js",
      "--preset",
      "edit,editors",
      "--presets=editor-pro",
    ]);
    expect(parseRawArgs()).toMatchObject({ files: "raw.js,git.js,extra.js,exact.js,vim.js,code.js", bareArgs: ["raw.js"] });
  });

  it.each([["vim*"], ["--file", "vim*"], ["--file=vim*"], ["--files", "vim*"]])("expands file prefix selectors %j", (...args) => {
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

  it.each(["#missing", "#missing*", "#*", "#"])("rejects invalid preset selector %s", (arg) => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify([arg]);
    expect(() => parseRawArgs()).toThrow(/Unknown preset|requires a preset name/);
    expect(proc.env.TEST_SCRIPT_FILES).toBeUndefined();
  });

  it("quotes hash-prefixed suggestions so the shell does not discard them", () => {
    proc.env.BASHRC_RAW_ARGS = JSON.stringify(["#editor"]);
    expect(() => parseRawArgs()).toThrow("bash run.sh '#editors'");
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
