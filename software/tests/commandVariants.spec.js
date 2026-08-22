/** Contract for register_command_variants, the generic command-variant generator. */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_CORE = path.join(ROOT_DIR, "software/bootstrap/profile-core.sh");

/**
 * Sources profile-core.sh in a clean bash and runs `script` after it.
 * @param {string} script - Bash snippet evaluated once the engine is loaded
 * @returns {string} Trimmed stdout of the snippet
 */
function run(script) {
  return execFileSync("bash", ["-c", `source "${PROFILE_CORE}" > /dev/null 2>&1\n${script}`], {
    encoding: "utf8",
  }).trim();
}

// A throwaway family to decorate. `demo_one` echoes back everything the
// variant injected, so each assertion reads the real invocation rather than
// the generated source text.
const FAMILY = `
function demo_one() { echo "one args=[$*] mode=\${DEMO_MODE:-unset}"; }
function demo_two() { echo "two args=[$*]"; }
function unrelated() { echo nope; }
alias demo_alias='demo_one cat'
alias other_alias='unrelated'
`;

describe("register_command_variants", () => {
  it("derives a prefixed variant from every matching function", () => {
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=i --select-fn='^demo_' --env='DEMO_MODE=on'
        type -t idemo_one idemo_two; type -t iunrelated || echo NOT_GENERATED`),
    ).toBe("function\nfunction\nNOT_GENERATED");
  });

  it("injects the env assignment and forwards arguments", () => {
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=i --select-fn='^demo_one$' --env='DEMO_MODE=on'
        idemo_one alpha beta`),
    ).toBe("one args=[alpha beta] mode=on");
  });

  it("keeps the injected env out of the calling shell", () => {
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=i --select-fn='^demo_one$' --env='DEMO_MODE=on'
        idemo_one x > /dev/null; echo "[\${DEMO_MODE:-unset}]"`),
    ).toBe("[unset]");
  });

  it("appends extra args after the caller's own", () => {
    // Appending last matters: argv is last-wins for most CLIs, so the
    // decoration beats a flag the base command hardcoded.
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=v --select-fn='^demo_two$' --args='--long --git'
        vdemo_two mine`),
    ).toBe("two args=[mine --long --git]");
  });

  it("supports a suffix instead of a prefix", () => {
    expect(
      run(`${FAMILY}
        register_command_variants --suffix=_verbose --select-fn='^demo_two$' --args='--long'
        demo_two_verbose x`),
    ).toBe("two args=[x --long]");
  });

  it("selects aliases by target and embeds the target, not the alias name", () => {
    // Aliases are not expanded inside a function body, so a generated variant
    // must call what the alias POINTS AT.
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=i --select-alias='^demo_' --env='DEMO_MODE=on'
        idemo_alias tail; type -t iother_alias || echo NOT_GENERATED`),
    ).toBe("one args=[cat tail] mode=on\nNOT_GENERATED");
  });

  it("flattens an alias whose body starts with another alias", () => {
    // A variant is a FUNCTION, and bash expands no aliases inside a function
    // body. `ls_newest -> ll -> ls` therefore has to be resolved down to the
    // function/binary at the head, or the variant dies with "command not found".
    expect(
      run(`function base_cmd() { echo "base args=[$*]"; }
        alias mid='base_cmd --mid'
        alias top='mid --top'
        register_command_variants --suffix=_x --select-alias-name='^top$' --args='--extra'
        top_x caller`),
    ).toBe("base args=[--mid --top caller --extra]");
  });

  it("terminates on a self-referential alias", () => {
    // Same stopping rule bash itself uses: expand the head once, never again.
    expect(
      run(`alias loopy='loopy --again'
        register_command_variants --suffix=_x --select-alias-name='^loopy$' --dry-run`),
    ).toBe('loopy_x -> loopy --again "$@"');
  });

  it("selects aliases by name", () => {
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=i --select-alias-name='^other_' --args='--flag'
        declare -f iother_alias | command grep -c unrelated`),
    ).toBe("1");
  });

  it("never clobbers an existing command", () => {
    expect(
      run(`${FAMILY}
        function idemo_one() { echo PRESERVED; }
        register_command_variants --prefix=i --select-fn='^demo_one$' --env='DEMO_MODE=on'
        idemo_one`),
    ).toBe("PRESERVED");
  });

  it("is idempotent across repeated runs", () => {
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=i --select-fn='^demo_one$' --env='DEMO_MODE=on'
        register_command_variants --prefix=i --select-fn='^demo_one$' --env='DEMO_MODE=on'
        command_variants | command grep -c '^idemo_one'`),
    ).toBe("1");
  });

  it("previews without defining under --dry-run", () => {
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=i --select-fn='^demo_one$' --env='DEMO_MODE=on' --dry-run
        type -t idemo_one || echo NOT_DEFINED`),
    ).toBe('idemo_one -> DEMO_MODE=on demo_one "$@"\nNOT_DEFINED');
  });

  it("records every variant in the discovery registry", () => {
    // Generated names appear in no source file; command_variants is the only
    // way to answer "what does this run?".
    expect(
      run(`${FAMILY}
        register_command_variants --prefix=i --select-fn='^demo_one$' --env='DEMO_MODE=on'
        command_variants idemo_one`),
    ).toBe('idemo_one\tDEMO_MODE=on demo_one "$@"');
  });

  it.each([
    ["--select-fn='^demo_'", "--prefix or --suffix is required"],
    ["--prefix=i", "a --select-* option is required"],
    ["--prefix=i --bogus", "unknown option: --bogus"],
  ])("rejects a malformed invocation (%s)", (args, message) => {
    expect(run(`register_command_variants ${args} 2>&1 || true`)).toContain(message);
  });
});
