/** Guards the fzf case-mode wrapper and its generated doubled-prefix variants. */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Sourced in the same order profile-advanced.sh sources them: every partial
// that defines a picker must load BEFORE bash-fzf.profile.bash, whose last
// statement runs the variant generator.
const PARTIALS = [
  "software/bootstrap/profile-core.sh",
  "software/scripts/bash-history.profile.bash",
  "software/scripts/bash-fzf.profile.bash",
];

const HAS_FZF = (() => {
  try {
    execFileSync("fzf", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Sources the picker partials in a clean bash and runs `script` after them.
 * @param {string} script - Bash snippet evaluated once the partials are loaded
 * @returns {string} Trimmed stdout of the snippet
 */
function runInProfile(script) {
  const preamble = PARTIALS.map((p) => `source "${path.join(ROOT_DIR, p)}" > /dev/null 2>&1`).join("\n");
  return execFileSync("bash", ["-c", `${preamble}\n${script}`], {
    encoding: "utf8",
    env: { ...process.env, FZF_DEFAULT_OPTS: "" },
  }).trim();
}

describe("fzf case-mode wrapper", () => {
  it("every partial it depends on exists", () => {
    for (const p of PARTIALS) {
      expect(existsSync(path.join(ROOT_DIR, p)), p).toBe(true);
    }
  });

  it("defines fzf_run and the variant generator", () => {
    expect(runInProfile("type -t fzf_run; type -t fzf_register_case_variants")).toBe("function\nfunction");
  });

  // The `i` prefix (`fuzzy_cd` -> `ifuzzy_cd`, `fcd` -> `ifcd`, `glog` ->
  // `iglog`) reuses fzf's own case-insensitive flag as the mnemonic. Both
  // sources are covered: fuzzy_* functions, and aliases expanding to one.
  // `ifuzzy_history` additionally proves the generator sees pickers defined in
  // a DIFFERENT partial, i.e. that the source ordering holds.
  it.each([
    ["ifuzzy_cd", "fuzzy_* function"],
    ["ifuzzy_edit", "fuzzy_* function"],
    ["ifuzzy_git_show", "fuzzy_* function"],
    ["ifuzzy_history", "fuzzy_* function from another partial"],
    ["ifcd", "alias -> fuzzy_cd"],
    ["ifcat", "alias -> fuzzy_edit cat"],
    ["ifcopy", "alias -> fuzzy_edit copy"],
    ["iglog", "alias -> fuzzy_git_show"],
  ])("generates %s (%s)", (name) => {
    expect(runInProfile(`type -t ${name} || echo MISSING`)).toBe("function");
  });

  it("variants request the insensitive mode and pass arguments through", () => {
    expect(runInProfile("declare -f ifcd")).toContain('FZF_CASE_MODE=insensitive fuzzy_cd "$@"');
  });

  it("never clobbers a name that already exists", () => {
    // A generated name must never eat a command that already exists — `if`,
    // `id`, and a user's own helper all live in the same `i*` space.
    // Pre-defining the target name proves the skip.
    const out = runInProfile("function ifcd() { echo PRESERVED; }; fzf_register_case_variants; ifcd");
    expect(out).toBe("PRESERVED");
  });

  it.skipIf(!HAS_FZF)("maps FZF_CASE_MODE onto the right fzf flag", () => {
    // -i is case-INsensitive and +i is case-SENSITIVE; unset means smart-case,
    // which turns case-sensitive on its own once the query has an uppercase
    // char. Asserted against real fzf --filter output, not the flag string.
    const filter = (mode, query) => runInProfile(`printf 'ABC\\nabc\\n' | ${mode} fzf_run --filter=${query} | tr '\\n' ' '`);

    expect(filter("", "ABC")).toBe("ABC");
    expect(filter("FZF_CASE_MODE=insensitive", "ABC")).toBe("ABC abc");
    expect(filter("FZF_CASE_MODE=sensitive", "abc")).toBe("abc");
  });

  it.skipIf(!HAS_FZF)("leaves FZF_CASE_MODE unset in the calling shell", () => {
    expect(runInProfile('FZF_CASE_MODE=insensitive fzf_run --filter=x < /dev/null > /dev/null; echo "[${FZF_CASE_MODE:-unset}]"')).toBe(
      "[unset]",
    );
  });

  it("routes every picker through fzf_run rather than bare fzf", () => {
    // A picker calling `fzf` directly would silently ignore FZF_CASE_MODE.
    const out = runInProfile(
      `for fn in $(declare -F | command awk '{print $3}' | command grep '^fuzzy_'); do
         declare -f "$fn" | command grep -nE '(\\| *fzf |=\\$\\(fzf |^ *fzf )' && echo "BARE_FZF_IN:$fn"
       done; echo DONE`,
    );
    expect(out).toBe("DONE");
  });
});
