import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import path from "path";

/** Absolute source partial loaded by each isolated Bash fixture. */
const profilePath = path.resolve("software/scripts/bash-fzf.profile.bash");

/**
 * Run the bookmark picker with a fixed selection and fixture-owned aliases.
 * @param {string} shell Bash executable to test.
 * @param {string} setup Shell definitions for the fixture.
 * @param {string} selection Bookmark returned by the picker.
 * @returns {string[]} Output lines, after asserting successful execution without stderr.
 * @throws {Error} When subprocess assertions fail.
 */
function runFavorite(shell, setup, selection = "favorite_alias") {
  const result = spawnSync(shell, ["--noprofile", "--norc"], {
    input: `
      set -u
      SY_ROOT_FOLDER=/unused
      source ${JSON.stringify(profilePath)}
      BOOKMARK_SYLE_PATH=/dev/null
      LINE_BREAK_HASH="################################################################################"
      shopt -s expand_aliases
      function h1() { printf 'H1:%s\\n' "$@"; }
      function hr() { printf '%s\\n' HR; }
      function fzf_run() { printf '%s\\n' ${JSON.stringify(selection)}; }
      ${setup}
      fuzzy_favorite_command
    `,
    env: { ...process.env, BASH_ENV: "/dev/null" },
    encoding: "utf-8",
    timeout: 3000,
  });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return result.stdout.trimEnd().split("\n");
}

describe.each(["/bin/bash", "bash"])("bookmark alias chains (%s subprocess)", (shell) => {
  it("shows both alias names before the terminal command and executes only once", () => {
    const lines = runFavorite(
      shell,
      `
        alias favorite_alias='favorite_stage'
        alias favorite_stage="command printf 'EXEC:%s\\\\n' worker"
      `,
    );
    expect(lines).toEqual([
      "H1:favorite_alias",
      "HR",
      "H1:favorite_alias is an alias",
      "favorite_stage is an alias",
      "################################################################################",
      "H1:command printf 'EXEC:%s\\n' worker",
      "HR",
      "EXEC:worker",
    ]);
  });

  it("preserves quoted arguments from three aliases and the original selection", () => {
    const lines = runFavorite(
      shell,
      `
        function favorite_target() { printf 'EXEC:<%s>\\n' "$@"; }
        alias favorite_alias='favorite_middle --outer'
        alias favorite_middle='favorite_stage "two words"'
        alias favorite_stage='favorite_target --inner'
      `,
      "favorite_alias --selected",
    );
    expect(lines).toMatchInlineSnapshot(`
      [
        "H1:favorite_alias --selected",
        "HR",
        "H1:favorite_alias is an alias",
        "favorite_middle is an alias",
        "favorite_stage is an alias",
        "################################################################################",
        "H1:favorite_target --inner "two words" --outer",
        "HR",
        "EXEC:<--inner>",
        "EXEC:<two words>",
        "EXEC:<--outer>",
        "EXEC:<--selected>",
      ]
    `);
  });

  it("continues through leading whitespace without duplicating the alias token", () => {
    const lines = runFavorite(
      shell,
      `
        function favorite_target() { printf 'EXEC:%s\\n' "$*"; }
        alias favorite_alias='   favorite_stage --outer'
        alias favorite_stage='favorite_target --inner'
      `,
    );
    expect(lines).toMatchInlineSnapshot(`
      [
        "H1:favorite_alias",
        "HR",
        "H1:favorite_alias is an alias",
        "favorite_stage is an alias",
        "################################################################################",
        "H1:favorite_target --inner --outer",
        "HR",
        "EXEC:--inner --outer",
      ]
    `);
  });

  it("stops at a self-referencing alias and still executes its underlying function", () => {
    const lines = runFavorite(
      shell,
      `
        function favorite_alias() { printf 'EXEC:%s\\n' "$*"; }
        alias favorite_alias='favorite_alias --self'
      `,
    );
    expect(lines).toMatchInlineSnapshot(`
      [
        "H1:favorite_alias",
        "HR",
        "H1:favorite_alias is an alias",
        "################################################################################",
        "H1:favorite_alias --self",
        "HR",
        "EXEC:--self",
      ]
    `);
  });

  it("stops a mutual cycle after listing each alias once", () => {
    const lines = runFavorite(
      shell,
      `
        function favorite_alias() { printf 'EXEC:%s\\n' "$*"; }
        alias favorite_alias='favorite_stage --outer'
        alias favorite_stage='favorite_alias --inner'
      `,
    );
    expect(lines).toMatchInlineSnapshot(`
      [
        "H1:favorite_alias",
        "HR",
        "H1:favorite_alias is an alias",
        "favorite_stage is an alias",
        "################################################################################",
        "H1:favorite_alias --inner --outer",
        "HR",
        "EXEC:--inner --outer",
      ]
    `);
  });

  it("does not expand aliases after command", () => {
    const lines = runFavorite(
      shell,
      `
        alias favorite_alias='favorite_stage'
        alias favorite_stage="command printf 'EXEC:%s\\\\n' worker"
        alias printf=false
      `,
    );
    expect(lines).toEqual([
      "H1:favorite_alias",
      "HR",
      "H1:favorite_alias is an alias",
      "favorite_stage is an alias",
      "################################################################################",
      "H1:command printf 'EXEC:%s\\n' worker",
      "HR",
      "EXEC:worker",
    ]);
  });

  it("keeps substitutions literal during display and evaluates only the selection", () => {
    const lines = runFavorite(
      shell,
      `
        function favorite_target() { printf 'EXEC:%s\\n' "$*"; }
        alias favorite_alias='favorite_stage "$(printf SUBSTITUTION)"'
        alias favorite_stage='favorite_target'
      `,
    );
    expect(lines).toEqual([
      "H1:favorite_alias",
      "HR",
      "H1:favorite_alias is an alias",
      "favorite_stage is an alias",
      "################################################################################",
      'H1:favorite_target "$(printf SUBSTITUTION)"',
      "HR",
      "EXEC:SUBSTITUTION",
    ]);
  });

  it("accepts an empty alias expansion without executing another command", () => {
    const lines = runFavorite(shell, "alias favorite_alias=''");
    expect(lines).toMatchInlineSnapshot(`
      [
        "H1:favorite_alias",
        "HR",
        "H1:favorite_alias is an alias",
        "################################################################################",
        "H1:",
        "HR",
      ]
    `);
  });

  it("does not resolve or execute anything when the picker is cancelled", () => {
    const lines = runFavorite(shell, "function favorite_alias() { printf '%s\\n' UNEXPECTED; }", "");
    expect(lines).toEqual([""]);
  });
});
