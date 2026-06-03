/**
 * Tests for `_resolveBareArgPresetFallback` — the script-first / preset-fallback
 * resolver applied to plain bare CLI args (no `--files=` flag, no `@` prefix).
 *
 * Coverage:
 * - Bare-arg eligible: probes script first, falls back to preset on `not_found`.
 * - Bare-arg eligible + script hit: passes through unchanged (script wins).
 * - Bare-arg eligible + no script + no preset: passes through (downstream error path).
 * - Bare-arg eligible + ambiguous script match: passes through (downstream error path).
 * - Bare-arg eligible + ambiguous preset match: throws with `@`-formatted suggestions.
 * - Non-bare entry (from `--files=` or preset expansion): never falls back.
 * - Empty BASHRC_BARE_ARGS / empty preset map / empty input: no-op.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, getSandboxProcess } from "./setup.js";

const _resolveBareArgPresetFallback = getIndexFunction("_resolveBareArgPresetFallback");

describe("_resolveBareArgPresetFallback", () => {
  let proc;

  beforeEach(() => {
    proc = getSandboxProcess();
    delete proc.env.BASHRC_BARE_ARGS;
    delete proc.env.PRESETS_JSON;
  });

  it("returns input unchanged when BASHRC_BARE_ARGS is unset", () => {
    const result = _resolveBareArgPresetFallback(["git.js"], ["software/scripts/git.js"]);
    expect(result).toEqual(["git.js"]);
  });

  it("returns input unchanged when BASHRC_BARE_ARGS is empty", () => {
    proc.env.BASHRC_BARE_ARGS = "";
    const result = _resolveBareArgPresetFallback(["git.js"], ["software/scripts/git.js"]);
    expect(result).toEqual(["git.js"]);
  });

  it("returns input unchanged when preset map is empty", () => {
    proc.env.BASHRC_BARE_ARGS = "editors";
    proc.env.PRESETS_JSON = JSON.stringify({});
    const result = _resolveBareArgPresetFallback(["editors"], []);
    expect(result).toEqual(["editors"]);
  });

  it("expands a bare arg to a preset when no script matches", () => {
    proc.env.BASHRC_BARE_ARGS = "editors";
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["vim.js", "vs-code.js"] },
    });
    const result = _resolveBareArgPresetFallback(["editors"], ["software/scripts/git.js"]);
    expect(result).toEqual(["vim.js", "vs-code.js"]);
  });

  it("auto-resolves a fuzzy bare arg to the matching preset (substring match)", () => {
    proc.env.BASHRC_BARE_ARGS = "edit";
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["vim.js"] },
      browsers: { files: ["brave.js"] },
    });
    const result = _resolveBareArgPresetFallback(["edit"], []);
    expect(result).toEqual(["vim.js"]);
  });

  it("keeps the bare arg in place when a script matches it (script-first priority)", () => {
    proc.env.BASHRC_BARE_ARGS = "git.js";
    proc.env.PRESETS_JSON = JSON.stringify({
      git: { files: ["preset-only.js"] },
    });
    const result = _resolveBareArgPresetFallback(["git.js"], ["software/scripts/git.js"]);
    // Script matched → entry preserved, preset never consulted.
    expect(result).toEqual(["git.js"]);
  });

  it("keeps a bare arg with an ambiguous script match in place (downstream surfaces the error)", () => {
    proc.env.BASHRC_BARE_ARGS = "vim";
    proc.env.PRESETS_JSON = JSON.stringify({
      vim: { files: ["preset-only.js"] },
    });
    const result = _resolveBareArgPresetFallback(["vim"], ["software/scripts/vim-config.js", "software/scripts/vim-plug.sh"]);
    // Two scripts both regex-match "vim" → ambiguous. Helper leaves it for downstream
    // reporting; preset fallback only fires on `not_found`, not on `ambiguous`.
    expect(result).toEqual(["vim"]);
  });

  it("does NOT touch entries absent from BASHRC_BARE_ARGS (--files= and preset-expansion are strict)", () => {
    proc.env.BASHRC_BARE_ARGS = "editors";
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["vim.js"] },
      "does-not-exist": { files: ["never.js"] },
    });
    // `does-not-exist` matches no script in allRepoFiles AND would expand to a preset,
    // but it's not in bareArgs → leave alone (would have come from --files= or preset).
    const result = _resolveBareArgPresetFallback(["does-not-exist", "editors"], []);
    expect(result).toEqual(["does-not-exist", "vim.js"]);
  });

  it("leaves a bare arg in place when neither script nor preset matches", () => {
    proc.env.BASHRC_BARE_ARGS = "totally-unknown";
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["vim.js"] },
    });
    const result = _resolveBareArgPresetFallback(["totally-unknown"], []);
    // Helper does NOT throw here — downstream _runScripts "File not found" path
    // emits the script-side suggestions; this helper just logs a hint and moves on.
    expect(result).toEqual(["totally-unknown"]);
  });

  it("throws with @-formatted suggestions when a bare-arg preset match is ambiguous", () => {
    proc.env.BASHRC_BARE_ARGS = "editor";
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["a.js"] },
      "editor-pro": { files: ["b.js"] },
    });
    expect(() => _resolveBareArgPresetFallback(["editor"], [])).toThrow(/ambiguous — matched 2: editors, editor-pro/);
    expect(() => _resolveBareArgPresetFallback(["editor"], [])).toThrow(/bash run\.sh @editors/);
    expect(() => _resolveBareArgPresetFallback(["editor"], [])).toThrow(/bash run\.sh @editor-pro/);
  });

  it("handles a mix of bare args and non-bare entries, expanding only the bare ones on fallback", () => {
    proc.env.BASHRC_BARE_ARGS = "editors,git";
    proc.env.PRESETS_JSON = JSON.stringify({
      editors: { files: ["vim.js", "vs-code.js"] },
    });
    // `git` matches script → stays. `editors` no script → preset expansion. `extra.js`
    // not in bareArgs → stays untouched even though it has no script either.
    const result = _resolveBareArgPresetFallback(["editors", "git", "extra.js"], ["software/scripts/git.js"]);
    expect(result).toEqual(["vim.js", "vs-code.js", "git", "extra.js"]);
  });
});
