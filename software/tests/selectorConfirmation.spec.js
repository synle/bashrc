/** Confirmation preflight rejects broad selections before any script can be emitted. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getIndexConstant, getIndexFunction, setSandboxGlobal } from "./setup.js";

/** Exercise the owned terminal-confirmation boundary independently of shell transport. */
const confirm = getIndexFunction("_confirmSelectorMatches");
/** Exercise complete selector preflight before the runner's emission boundary. */
const runSelected = getIndexFunction("_doWorkTestFiles");
/** Preserve sandbox globals so shuffled tests cannot retain overrides. */
const originals = Object.fromEntries(
  [
    "readText",
    "execBashSync",
    "log",
    "emitBash",
    "_runScripts",
    "getAllRepoSoftwareFiles",
    "TEST_SCRIPT_FILES",
    "_parsedArgs",
    "IS_NO_COLOR",
  ].map((key) => [key, getIndexConstant(key)]),
);

let shell;
let output;
let runner;
let emit;

beforeEach(() => {
  shell = vi.fn(() => "");
  output = vi.fn();
  runner = vi.fn();
  emit = vi.fn();
  setSandboxGlobal("readText", async () => "# shared shell helpers");
  setSandboxGlobal("execBashSync", shell);
  setSandboxGlobal("log", output);
  setSandboxGlobal("emitBash", emit);
  setSandboxGlobal("_runScripts", runner);
  setSandboxGlobal("getAllRepoSoftwareFiles", async () => ["software/scripts/a.js", "software/scripts/b.js"]);
  setSandboxGlobal("TEST_SCRIPT_FILES", "a*,b.js");
  setSandboxGlobal("_parsedArgs", { confirmations: [] });
  setSandboxGlobal("IS_NO_COLOR", false);
});

afterEach(() => {
  for (const [key, value] of Object.entries(originals)) setSandboxGlobal(key, value);
});

describe("selector confirmation", () => {
  it("does not invoke terminal transport when no keyword has multiple matches", async () => {
    await confirm([]);
    expect(shell).not.toHaveBeenCalled();
    expect(output).not.toHaveBeenCalled();
  });

  it.each(["files", "presets"])("prints a red %s warning and passes the default-yes prompt as data", async (mode) => {
    await confirm([{ keyword: "a*", mode, matches: ["alpha", "alpine"] }]);
    expect(output.mock.calls).toEqual([[`\x1b[1;31mWarning: This keyword matches multiple ${mode}: a*\n- alpha\n- alpine\x1b[0m`]]);
    expect(shell).toHaveBeenCalledWith(
      '# shared shell helpers\nprompt_yes_no "$BASHRC_SELECTOR_PROMPT" Y',
      expect.objectContaining({
        shell: "bash",
        stdio: ["ignore", "pipe", "inherit"],
        env: expect.objectContaining({ BASHRC_SELECTOR_PROMPT: "\x1b[1;31mDo you wish to continue\x1b[0m" }),
      }),
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it("keeps the explicit warning visible when colors are disabled", async () => {
    setSandboxGlobal("IS_NO_COLOR", true);
    await confirm([{ keyword: "a*", mode: "files", matches: ["a.js", "another.js"] }]);
    expect(output.mock.calls).toEqual([["Warning: This keyword matches multiple files: a*\n- a.js\n- another.js"]]);
    expect(shell.mock.calls[0][1].env.BASHRC_SELECTOR_PROMPT).toBe("Do you wish to continue");
  });

  it.each([{ status: 1 }, { code: "ETIMEDOUT" }])("rejects cancellation or unavailable confirmation %j", async (failure) => {
    shell.mockImplementation(() => {
      throw Object.assign(new Error("terminal rejected"), failure);
    });
    await expect(confirm([{ keyword: "a*", mode: "files", matches: ["a.js", "another.js"] }])).rejects.toThrow("Selection cancelled: a*");
    expect(runner).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("preserves unexpected terminal errors instead of misclassifying them as a No", async () => {
    const failure = Object.assign(new Error("shell unavailable"), { code: "ENOENT" });
    shell.mockImplementation(() => {
      throw failure;
    });
    await expect(confirm([{ keyword: "a*", mode: "files", matches: ["a.js", "another.js"] }])).rejects.toBe(failure);
  });

  it("deduplicates raw, wildcard, and canonical file selections before dispatch", async () => {
    setSandboxGlobal("TEST_SCRIPT_FILES", "a*,a.js,software/scripts/a.js,b.js");
    await runSelected();
    expect(shell).not.toHaveBeenCalled();
    expect(runner).toHaveBeenCalledWith(
      ["software/scripts/a.js", "software/scripts/b.js", "~refresh-source.standalone.js"],
      ["software/scripts/a.js", "software/scripts/b.js"],
      "Test Files",
    );
  });

  it("does not dispatch any scripts when a later confirmation is declined", async () => {
    setSandboxGlobal("TEST_SCRIPT_FILES", "*.js");
    setSandboxGlobal("_parsedArgs", { confirmations: [{ keyword: "bundle*", mode: "presets", matches: ["bundle-a", "bundle-b"] }] });
    shell
      .mockImplementationOnce(() => "")
      .mockImplementationOnce(() => {
        throw Object.assign(new Error("No"), { status: 1 });
      });
    await expect(runSelected()).rejects.toThrow("Selection cancelled: *.js");
    expect(output.mock.calls).toEqual([
      ["\x1b[1;31mWarning: This keyword matches multiple presets: bundle*\n- bundle-a\n- bundle-b\x1b[0m"],
      ["\x1b[1;31mWarning: This keyword matches multiple files: *.js\n- software/scripts/a.js\n- software/scripts/b.js\x1b[0m"],
    ]);
    expect(runner).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("dispatches all expanded matches after confirmation", async () => {
    setSandboxGlobal("TEST_SCRIPT_FILES", "*.js");
    await runSelected();
    expect(shell).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(
      ["software/scripts/a.js", "software/scripts/b.js", "~refresh-source.standalone.js"],
      ["software/scripts/a.js", "software/scripts/b.js"],
      "Test Files",
    );
  });

  it("dispatches every match without terminal confirmation when explicitly opted in", async () => {
    setSandboxGlobal("TEST_SCRIPT_FILES", "*.js");
    setSandboxGlobal("_parsedArgs", { skipPrompt: true, confirmations: [] });
    await runSelected();
    expect(shell).not.toHaveBeenCalled();
    expect(output.mock.calls).toEqual([
      ["\x1b[1;31mWarning: This keyword matches multiple files: *.js\n- software/scripts/a.js\n- software/scripts/b.js\x1b[0m"],
    ]);
    expect(runner).toHaveBeenCalledWith(
      ["software/scripts/a.js", "software/scripts/b.js", "~refresh-source.standalone.js"],
      ["software/scripts/a.js", "software/scripts/b.js"],
      "Test Files",
    );
  });

  it.each([false, true])("rejects unmatched selections before prompting or dispatching; skipPrompt=%s", async (skipPrompt) => {
    setSandboxGlobal("_parsedArgs", { skipPrompt, confirmations: [] });
    setSandboxGlobal("TEST_SCRIPT_FILES", "a.js,missing");
    await expect(runSelected()).rejects.toThrow("No files or presets match: missing");
    expect(shell).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("does not dispatch when no files were selected", async () => {
    setSandboxGlobal("TEST_SCRIPT_FILES", "");
    await runSelected();
    expect(runner).not.toHaveBeenCalled();
    expect(shell).not.toHaveBeenCalled();
  });
});
