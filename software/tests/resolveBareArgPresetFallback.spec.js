/** Bare selectors prefer exact or explicit wildcard script matches before preset fallback. */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, getSandboxProcess } from "./setup.js";

/** Resolve through the runner's bare-selector boundary without mutating candidates. */
const resolveBare = getIndexFunction("_resolveBareArgPresetFallback");

describe("bare selector fallback", () => {
  let proc;
  beforeEach(() => {
    proc = getSandboxProcess();
    delete proc.env.BASHRC_BARE_ARGS;
    delete proc.env.PRESETS_JSON;
  });

  it.each([undefined, ""])("preserves explicit file selections when bare arguments are %s", (bare) => {
    proc.env.BASHRC_BARE_ARGS = bare;
    expect(resolveBare(["git.js"], ["software/scripts/git.js"])).toEqual(["git.js"]);
  });

  it("preserves selection when no presets exist", () => {
    proc.env.BASHRC_BARE_ARGS = "editors";
    proc.env.PRESETS_JSON = "{}";
    expect(resolveBare(["editors"], [])).toEqual(["editors"]);
  });

  it("expands an exact bare preset when no script matches", () => {
    proc.env.BASHRC_BARE_ARGS = "editors";
    proc.env.PRESETS_JSON = JSON.stringify({ editors: { files: ["vim.js", "vs-code.js"] } });
    expect(resolveBare(["editors"], ["software/scripts/git.js"])).toEqual(["vim.js", "vs-code.js"]);
  });

  it("does not expand a preset abbreviation without a wildcard", () => {
    proc.env.BASHRC_BARE_ARGS = "edit";
    proc.env.PRESETS_JSON = JSON.stringify({ editors: { files: ["vim.js"] } });
    expect(resolveBare(["edit"], [])).toEqual(["edit"]);
  });

  it("preserves exact script priority and leaves candidates unchanged", () => {
    proc.env.BASHRC_BARE_ARGS = "git";
    proc.env.PRESETS_JSON = JSON.stringify({ git: { files: ["preset-only.js"] } });
    const candidates = ["software/scripts/git.js"];
    expect(resolveBare(["git"], candidates)).toEqual(["git"]);
    expect(candidates).toEqual(["software/scripts/git.js"]);
  });

  it("preserves multiple script wildcard matches instead of selecting presets", () => {
    proc.env.BASHRC_BARE_ARGS = "vim*";
    proc.env.PRESETS_JSON = JSON.stringify({ vim: { files: ["preset-only.js"] } });
    const confirmations = [];
    expect(resolveBare(["vim*"], ["software/scripts/vim-config.js", "software/scripts/vim-jetpack.sh"], confirmations)).toEqual(["vim*"]);
    expect(confirmations).toEqual([]);
  });

  it("does not reinterpret explicit files as presets", () => {
    proc.env.BASHRC_BARE_ARGS = "editors";
    proc.env.PRESETS_JSON = JSON.stringify({ editors: { files: ["vim.js"] }, other: { files: ["never.js"] } });
    expect(resolveBare(["other", "editors"], [])).toEqual(["other", "vim.js"]);
  });

  it("preserves unknown names for the preflight error", () => {
    proc.env.BASHRC_BARE_ARGS = "unknown";
    proc.env.PRESETS_JSON = JSON.stringify({ editors: { files: ["vim.js"] } });
    expect(resolveBare(["unknown"], [])).toEqual(["unknown"]);
  });

  it.each(["editor*", "*editor*", "*s"])("collects multiple preset matches for %s", (keyword) => {
    proc.env.BASHRC_BARE_ARGS = keyword;
    proc.env.PRESETS_JSON = JSON.stringify({ editors: { files: ["a.js"] }, "editor-tools": { files: ["b.js"] } });
    const confirmations = [];
    expect(resolveBare([keyword], [], confirmations)).toEqual(["a.js", "b.js"]);
    expect(confirmations).toEqual([{ keyword, mode: "presets", matches: ["editors", "editor-tools"] }]);
  });

  it("handles mixed bare and explicit entries", () => {
    proc.env.BASHRC_BARE_ARGS = "editors,git";
    proc.env.PRESETS_JSON = JSON.stringify({ editors: { files: ["vim.js", "vs-code.js"] } });
    expect(resolveBare(["editors", "git", "extra.js"], ["software/scripts/git.js"])).toEqual(["vim.js", "vs-code.js", "git", "extra.js"]);
  });
});
