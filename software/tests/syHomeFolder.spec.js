/**
 * Tests for SY_ROOT_FOLDER — the personal root folder ($HOME/_extra).
 *
 * It is declared once in software/bootstrap/common-env.sh and consumed from both bash
 * (profile partials) and JS (software/index.js). Two failure modes, both silent:
 *
 * 1. Declaring it in common-env.sh is NOT enough to reach an interactive shell.
 *    common-env.sh is inlined into run.sh and sourced there, but only a hand-listed
 *    subset of its exports is re-emitted into ~/.bash_syle_common (the file wired up as
 *    $BASH_ENV). SY_ROOT_FOLDER was missing from that list, so `echo $SY_ROOT_FOLDER`
 *    printed nothing in a real shell while every :- fallback quietly papered over it.
 *
 * 2. A consumer writing its own "$HOME/_extra" literal instead of deriving from the variable
 *    means the folder is no longer controlled in one place, and moving it silently
 *    strands whatever kept the copy. Consumers therefore fall back to a bare home folder,
 *    never to a repeated "_extra" — the name appears only in the single declaration.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMMON_ENV = path.join(ROOT_DIR, "software/bootstrap/common-env.sh");
const RUN_SH = path.join(ROOT_DIR, "run.sh");
const INDEX_JS = path.join(ROOT_DIR, "software/index.js");
const WORKSPACE_PARTIAL = path.join(ROOT_DIR, "software/scripts/bash-tmux-workspace.profile.bash");

/**
 * Files allowed to contain a literal personal-root path. Only the declaration and the
 * copy `make format` inlines into run.sh — every other consumer reads the env var and
 * falls back to a bare home folder rather than repeating the name.
 */
const ALLOWED_LITERAL_FILES = ["software/bootstrap/common-env.sh", "run.sh"];

/**
 * Read a file from the repo root.
 * @param {string} relativePath Path relative to the repo root.
 * @returns {string} File contents.
 */
function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

describe("SY_ROOT_FOLDER", () => {
  it("is declared exactly once in common-env.sh", () => {
    const declarations = fs
      .readFileSync(COMMON_ENV, "utf8")
      .split("\n")
      .filter((line) => /^\s*export\s+SY_ROOT_FOLDER=/.test(line));

    expect(declarations).toHaveLength(1);
    expect(declarations[0]).toContain('"$HOME/_extra"');
  });

  it("is re-exported by run.sh into the shared common profile so interactive shells see it", () => {
    // The block writes already-resolved values in single quotes into $BASH_SYLE_COMMON_PATH.
    expect(fs.readFileSync(RUN_SH, "utf8")).toContain("export SY_ROOT_FOLDER='$SY_ROOT_FOLDER'");
  });

  it("resolves to the same path in bash whether or not run.sh already exported it", () => {
    const script = `
      unset SY_ROOT_FOLDER
      HOME=/fake/home
      . "${COMMON_ENV}" > /dev/null 2>&1
      echo "$SY_ROOT_FOLDER"
    `;
    const resolved = execFileSync("bash", ["-c", script], { encoding: "utf8" }).trim();

    expect(resolved).toBe("/fake/home/_extra");
  });

  it("is exposed to JS from the same env var, read directly with no second default", () => {
    const source = fs.readFileSync(INDEX_JS, "utf8");

    expect(source).toMatch(/const SY_ROOT_FOLDER = process\.env\.SY_ROOT_FOLDER;/);
    expect(source).not.toMatch(/const SY_ROOT_FOLDER = process\.env\.SY_ROOT_FOLDER \|\|/);
  });

  it("resolves in JS to exactly what run.sh exported", () => {
    const probe = `process.stdout.write(String(process.env.SY_ROOT_FOLDER));`;
    const withExport = execFileSync("node", ["-e", probe], {
      encoding: "utf8",
      env: { ...process.env, SY_ROOT_FOLDER: "/elsewhere/_extra" },
    });

    expect(withExport).toBe("/elsewhere/_extra");
  });

  it("leaves a consumer with an obviously broken path when unset, never a silent second default", () => {
    const script = `
      unset SY_ROOT_FOLDER
      HOME=/fake/home
      . "${WORKSPACE_PARTIAL}" > /dev/null 2>&1
      echo "$WORKSPACE_CONFIG_FOLDER"
    `;
    const resolved = execFileSync("bash", ["-c", script], { encoding: "utf8" }).trim();

    expect(resolved).toBe("/workspaces_tmux");
    expect(resolved).not.toContain("/fake/home");
  });

  it("relocates every consumer when it is set", () => {
    const script = `
      SY_ROOT_FOLDER=/elsewhere/root
      HOME=/fake/home
      . "${WORKSPACE_PARTIAL}" > /dev/null 2>&1
      echo "$WORKSPACE_CONFIG_FOLDER"
    `;
    const resolved = execFileSync("bash", ["-c", script], { encoding: "utf8" }).trim();

    expect(resolved).toBe("/elsewhere/root/workspaces_tmux");
  });

  it("has no personal-root literal outside the declaration and its documented fallbacks", () => {
    const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT_DIR, encoding: "utf8" })
      .split("\n")
      .filter((file) => /\.(js|sh|bash)$/.test(file))
      .filter((file) => !file.startsWith("software/tests/"))
      .filter((file) => !ALLOWED_LITERAL_FILES.includes(file));

    const offenders = tracked.filter((file) => /\$\{?HOME\}?\/_extra(?![_a-zA-Z0-9])/.test(readRepoFile(file)));

    expect(offenders).toEqual([]);
  });

  it("is never deleted by make nuke", () => {
    // The personal root holds authored plan files that no re-run can regenerate, so the
    // blanket rm -rf that once sat in `nuke` must stay gone. Outlived the one-time
    // migration that first added this guard.
    const makefile = readRepoFile("Makefile");
    const nuke = makefile.slice(makefile.indexOf("\nnuke:"), makefile.indexOf("$(MAKE) clean", makefile.indexOf("\nnuke:")));
    // Comment lines are allowed to name it — they are why it is spared.
    const commands = nuke
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");

    expect(commands).not.toMatch(/~\/_extra/);
  });
});
