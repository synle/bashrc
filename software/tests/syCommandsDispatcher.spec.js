/** Tests for software/scripts/advanced/llm/_common/sy-commands.profile.bash. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PARTIAL = path.join(ROOT_DIR, "software/scripts/advanced/llm/_common/sy-commands.profile.bash");

let sandbox;

/**
 * Create a fresh sandbox dir with:
 *   - `sandbox/home/sy/ai_llm/skills/sy-<name>/SKILL.md` seeded with the supplied body.
 *   - PATH-shadowed stubs for `claude`, `copilot`, `gemini`, `opencode` that
 *     echo their name + every argument they were called with to stdout so the
 *     test can assert which CLI fired with which prompt.
 *
 * The stubs land in `sandbox/bin/`; the test prepends that dir to $PATH when
 * sourcing the partial so the dispatcher resolves the stubs instead of any
 * real CLIs that may be installed on the host.
 */
beforeEach(() => {
  sandbox = fs.mkdtempSync("/tmp/sycommands-test-");
  fs.mkdirSync(path.join(sandbox, "home/sy/ai_llm/skills"), { recursive: true });
  fs.mkdirSync(path.join(sandbox, "bin"), { recursive: true });
  for (const cli of ["claude", "copilot", "gemini", "opencode", "pi"]) {
    const stubPath = path.join(sandbox, "bin", cli);
    fs.writeFileSync(stubPath, `#!/usr/bin/env bash\nprintf '${cli}'\nfor a in "$@"; do printf ' [%s]' "$a"; done\nprintf '\\n'\n`);
    fs.chmodSync(stubPath, 0o755);
  }
  // is_help_arg is a function the partial calls — provide a minimal definition
  // so we don't have to load the entire common-functions.bash for these tests.
  fs.writeFileSync(
    path.join(sandbox, "helpers.bash"),
    `function is_help_arg() { case "\${1:-}" in help|--help|-h|/?|-\\?|/help|-help|\\?) return 0;; *) return 1;; esac; }
function is_truthy() { case "\${1:-}" in 1|true|TRUE|y|Y|yes|YES) return 0;; *) return 1;; esac; }\n`,
  );
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Write a prompt body to `sandbox/home/sy/ai_llm/skills/sy-<name>/SKILL.md`.
 *
 * @param {string} name - Command name without the `sy-` prefix and `.md` suffix.
 * @param {string} body - Prompt body content.
 */
function writeCommand(name, body) {
  /** @type {string} Folder-form skill location the dispatcher globs at shell start. */
  const skillFolder = path.join(sandbox, `home/sy/ai_llm/skills/sy-${name}`);
  fs.mkdirSync(skillFolder, { recursive: true });
  fs.writeFileSync(path.join(skillFolder, "SKILL.md"), body);
}

/**
 * Run a one-liner under bash with the sandbox's PATH, fake HOME, and the
 * partial already sourced. Returns stdout (the CLI stub output captures
 * cleanly so the caller can assert which CLI fired and with what prompt).
 *
 * `LLM_ROOT_FOLDER` is exported because the dispatcher resolves its skills folder
 * as `${LLM_ROOT_FOLDER}/skills`, read directly with no default — the same value a
 * real shell sees once run.sh re-exports it into ~/.bash_syle_common. It has to be
 * set here for that reason: with the `:-` chain gone there is nothing to fall back
 * to, which is exactly the loud failure the direct read is meant to produce.
 *
 * @param {string} script - Bash script body, executed after the helpers + partial are sourced.
 * @returns {string} Captured stdout (trimmed).
 */
function runBash(script) {
  const cmd = `HOME='${sandbox}/home' LLM_ROOT_FOLDER='${sandbox}/home/sy/ai_llm' PATH='${sandbox}/bin':"$PATH" bash -c '
    source "${sandbox}/helpers.bash"
    source "${PARTIAL}"
    ${script}
  '`;
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

describe("sy-commands dispatcher", () => {
  it("defines sy-<name> for each ~/sy/ai_llm/skills/sy-<name>/SKILL.md on disk", () => {
    writeCommand("foo", "prompt for foo");
    writeCommand("bar", "prompt for bar");
    // compgen is a bash builtin — no awk/tr/single-quote pitfalls when this
    // string gets wrapped inside the outer `bash -c '...'` invocation.
    const declared = runBash("compgen -A function sy-");
    const fns = declared.split(/\s+/).filter(Boolean);
    expect(fns).toContain("sy-bar");
    expect(fns).toContain("sy-foo");
  });

  it("defaults to claude when no override and $LLM is unset", () => {
    writeCommand("foo", "the prompt body");
    const out = runBash("sy-foo 2>/dev/null");
    expect(out).toBe("claude [/sy-foo]");
  });

  it("uses $LLM when the env var names a supported CLI", () => {
    writeCommand("foo", "body");
    const out = runBash("LLM=gemini sy-foo 2>/dev/null");
    expect(out).toBe("gemini [-i] [/sy-foo]");
  });

  it("uses the leading positional arg when it names a supported CLI, stripping it from prompt args", () => {
    writeCommand("foo", "body");
    const out = runBash("sy-foo opencode arg1 arg2 2>/dev/null");
    expect(out).toBe("opencode [--prompt] [/sy-foo arg1 arg2]");
  });

  it("does NOT strip the first arg when it is not a supported CLI", () => {
    writeCommand("foo", "body");
    const out = runBash("sy-foo somerandomthing 2>/dev/null");
    expect(out).toContain("claude");
    expect(out).toBe("claude [/sy-foo somerandomthing]");
  });

  it("substitutes $ARGUMENTS into the body when the body references it", () => {
    writeCommand("foo", "Review this PR: $ARGUMENTS — be thorough.");
    const out = runBash("sy-foo https://example.com/pr/1 2>/dev/null");
    expect(out).toBe("claude [/sy-foo https://example.com/pr/1]");
  });

  it("appends a trailing `Arguments:` line when the body has no $ARGUMENTS placeholder", () => {
    writeCommand("foo", "Do the thing.");
    const out = runBash("sy-foo first second 2>/dev/null");
    expect(out).toBe("claude [/sy-foo first second]");
  });

  it("dispatches without an args appendix when no prompt args were forwarded", () => {
    writeCommand("foo", "Plain body.");
    const out = runBash("sy-foo 2>/dev/null");
    expect(out).toBe("claude [/sy-foo]");
  });

  it("prints help via is_help_arg without invoking any CLI", () => {
    writeCommand("foo", "should not appear");
    const out = runBash("sy-foo --help 2>&1");
    expect(out).toContain("sy-foo: dispatch");
    expect(out).toContain("Usage: sy-foo");
    expect(out).not.toContain("should not appear");
  });

  it("falls back to claude when $LLM is set to an unknown name", () => {
    writeCommand("foo", "body");
    const out = runBash("LLM=somethingweird sy-foo 2>/dev/null");
    expect(out).toContain("claude");
    expect(out).toContain("[/sy-foo]");
  });

  it("errors with a hint when the prompt body file is missing", () => {
    // No writeCommand("foo") — body is absent on purpose.
    // Manually inject a sy-foo function via the dispatcher so we can exercise the missing-body path.
    let err = "";
    try {
      runBash("_sy_dispatch foo 2>&1");
    } catch (e) {
      err = e.stdout?.toString() + e.stderr?.toString();
    }
    expect(err).toContain("prompt body missing");
    expect(err).toContain("--preset=llm");
  });

  it("echoes the resolved CLI to stderr so the user sees the routing decision", () => {
    writeCommand("foo", "body");
    const cmd = `HOME='${sandbox}/home' LLM_ROOT_FOLDER='${sandbox}/home/sy/ai_llm' PATH='${sandbox}/bin':"$PATH" bash -c '
      source "${sandbox}/helpers.bash"
      source "${PARTIAL}"
      sy-foo gemini 2>/tmp/sycommands-stderr-${process.pid}.log
    '`;
    execSync(cmd, { encoding: "utf-8" });
    const stderr = fs.readFileSync(`/tmp/sycommands-stderr-${process.pid}.log`, "utf-8");
    fs.unlinkSync(`/tmp/sycommands-stderr-${process.pid}.log`);
    expect(stderr).toContain("Command: gemini -i /sy-foo");
    expect(stderr).toContain("SY_SKILL_INLINE=0");
    expect(stderr).toContain("SY_LLM_NON_INTERACTIVE=0");
  });
});

describe("sy-commands CLI registry", () => {
  it("derives _SY_SUPPORTED_LLMS from the single _SY_LLM_SPECS registry", () => {
    expect(runBash("echo ${_SY_SUPPORTED_LLMS[*]}")).toBe("claude copilot gemini opencode pi");
  });

  it("declares a native dispatch kind only for CLIs that expose one", () => {
    expect(runBash("_sy_native_kind claude")).toBe("slash");
    expect(runBash("_sy_native_kind copilot")).toBe("slash");
    expect(runBash("_sy_native_kind gemini")).toBe("slash");
    expect(runBash("_sy_native_kind opencode")).toBe("slash");
    expect(runBash("_sy_native_kind pi")).toBe("skill");
  });

  it("returns non-zero for a CLI that is not in the registry", () => {
    expect(runBash("_sy_native_kind nope > /dev/null; echo exit=$?")).toBe("exit=1");
  });

  it("keeps the registry the ONLY place a CLI name is written", () => {
    // The DRY invariant this file exists to hold: adding a CLI must be one
    // record in _SY_LLM_SPECS. A `case claude)` or `opencode ...` anywhere in
    // the executable body means a second list has crept back in.
    const source = fs.readFileSync(PARTIAL, "utf-8");
    const offenders = source
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      // Comments and the registry records themselves are allowed to name CLIs.
      .filter(({ line }) => !/^\s*#/.test(line) && !/^\s*"[a-z]+\|/.test(line))
      .filter(({ line }) => /\b(claude|copilot|gemini|opencode)\b/.test(line))
      .map(({ line, n }) => `${n}: ${line.trim()}`);
    expect(offenders).toEqual([]);
  });

  it("derives the default CLI from the registry rather than restating it", () => {
    expect(runBash("echo $_SY_DEFAULT_LLM")).toBe(runBash("echo ${_SY_SUPPORTED_LLMS[0]}"));
  });
});

describe("sy-commands pinned <cli>_skill_<name> wrappers", () => {
  it("registers one wrapper per CLI for every deployed skill", () => {
    writeCommand("foo", "body");
    const fns = runBash("compgen -A function | grep _skill_foo").split(/\s+/).filter(Boolean);
    expect(fns.sort()).toEqual(["claude_skill_foo", "copilot_skill_foo", "gemini_skill_foo", "opencode_skill_foo", "pi_skill_foo"]);
    expect(runBash("compgen -A function opencode_skill_run_foo")).toBe("opencode_skill_run_foo");
    expect(runBash("compgen -A function sy-run-foo")).toBe("sy-run-foo");
  });

  it("flattens hyphens in the skill name to underscores", () => {
    writeCommand("review-pr", "body");
    const fns = runBash("compgen -A function | grep review").split(/\s+/).filter(Boolean);
    expect(fns).toContain("opencode_skill_review_pr");
    // The call-time family keeps the hyphenated name it always had.
    expect(fns).toContain("sy-review-pr");
  });

  it("pins its CLI instead of reading the leading positional override", () => {
    writeCommand("foo", "body");
    const out = runBash("gemini_skill_foo opencode 2>/dev/null");
    expect(out).toBe("gemini [-i] [/sy-foo opencode]");
  });

  it("pins its CLI over the $LLM env var", () => {
    writeCommand("foo", "body");
    expect(runBash("LLM=claude gemini_skill_foo 2>/dev/null")).toBe("gemini [-i] [/sy-foo]");
  });

  it("prints pinned help via is_help_arg without invoking any CLI", () => {
    writeCommand("foo", "should not appear");
    const out = runBash("opencode_skill_foo --help 2>&1");
    expect(out).toContain("opencode_skill_foo: run the sy-foo workflow through opencode");
    expect(out).not.toContain("should not appear");
  });
});

describe("sy-commands dispatch modes", () => {
  it("uses OpenCode's interactive native skill route by default", () => {
    writeCommand("foo", "the body");
    expect(runBash("opencode_skill_foo alpha beta 2>/dev/null")).toBe("opencode [--prompt] [/sy-foo alpha beta]");
  });

  it("uses Copilot's native skill route by default", () => {
    writeCommand("list-prs", "the full list-prs body");
    expect(runBash("copilot_skill_list_prs table pwd 2>/dev/null")).toBe("copilot [-i] [/sy-list-prs table pwd]");
  });

  it("honors an explicit inline override for OpenCode", () => {
    writeCommand("foo", "the body");
    const out = runBash("SY_SKILL_INLINE=1 opencode_skill_foo 2>/dev/null");
    expect(out).toBe("opencode [--prompt] [the body]");
  });

  it("forwards OpenCode args inside the interactive slash prompt", () => {
    writeCommand("foo", "the body");
    const out = runBash("opencode_skill_foo alpha beta 2>/dev/null");
    expect(out).toBe("opencode [--prompt] [/sy-foo alpha beta]");
  });

  it("sends `/<skill>` through each interactive native route", () => {
    writeCommand("foo", "the body");
    expect(runBash("copilot_skill_foo 2>/dev/null")).toBe("copilot [-i] [/sy-foo]");
    expect(runBash("claude_skill_foo 2>/dev/null")).toBe("claude [/sy-foo]");
    expect(runBash("gemini_skill_foo 2>/dev/null")).toBe("gemini [-i] [/sy-foo]");
    expect(runBash("pi_skill_foo 2>/dev/null")).toBe("pi [/skill:sy-foo]");
  });

  it("appends args to the slash line rather than as a separate argv entry", () => {
    writeCommand("foo", "the body");
    const out = runBash("claude_skill_foo alpha beta 2>/dev/null");
    expect(out).toBe("claude [/sy-foo alpha beta]");
  });

  it("falls back to inline when the non-interactive surface has no verified native route", () => {
    writeCommand("foo", "the body");
    expect(runBash("gemini_skill_run_foo 2>/dev/null")).toBe("gemini [-p] [the body]");
    expect(runBash("pi_skill_run_foo 2>/dev/null")).toBe("pi [-p] [the body]");
  });

  it("honors both boolean controls on the call-time sy-<name> family", () => {
    writeCommand("foo", "the body");
    expect(runBash("SY_SKILL_INLINE=1 sy-foo opencode 2>/dev/null")).toBe("opencode [--prompt] [the body]");
    expect(runBash("SY_LLM_NON_INTERACTIVE=1 sy-foo opencode 2>/dev/null")).toBe("opencode [run] [--command] [sy-foo]");
  });

  it("uses native interactive routing when both booleans are unset", () => {
    writeCommand("foo", "the body");
    expect(runBash("opencode_skill_foo 2>/dev/null")).toBe("opencode [--prompt] [/sy-foo]");
  });

  it("still errors on a missing skill in native mode, before invoking any CLI", () => {
    let err = "";
    try {
      runBash("_sy_dispatch_cli opencode foo 0 2>&1");
    } catch (e) {
      err = e.stdout?.toString() + e.stderr?.toString();
    }
    expect(err).toContain("prompt body missing");
    expect(err).not.toContain("opencode [");
  });

  it("prints command and both boolean options before launch", () => {
    writeCommand("foo", "body");
    const native = runBash("opencode_skill_foo 2>&1 >/dev/null");
    expect(native).toContain("Command: opencode --prompt /sy-foo");
    expect(native).toContain("SY_SKILL_INLINE=0 (0=native skill, 1=inline SKILL.md)");
    expect(native).toContain("SY_LLM_NON_INTERACTIVE=0 (0=interactive, 1=print and exit)");
    const run = runBash("opencode_skill_run_foo 2>&1 >/dev/null");
    expect(run).toContain("Command: opencode run --command sy-foo");
    expect(run).toContain("SY_LLM_NON_INTERACTIVE=1");
  });
});

describe("sy-commands raw-prompt inline wrappers", () => {
  it("registers <cli>_skill_inline for every CLI plus the call-time sy-inline", () => {
    const fns = runBash('compgen -A function | grep -E "_skill_inline\\$|^sy-inline\\$"').split(/\s+/).filter(Boolean);
    expect(fns.sort()).toEqual([
      "claude_skill_inline",
      "copilot_skill_inline",
      "gemini_skill_inline",
      "opencode_skill_inline",
      "pi_skill_inline",
      "sy-inline",
    ]);
  });

  it("registers the inline family even when no skill is deployed", () => {
    // No writeCommand() at all — the glob expands to nothing.
    expect(runBash('opencode_skill_inline "free text" 2>/dev/null')).toBe("opencode [--prompt] [free text]");
  });

  it("sends the arguments verbatim as the prompt, joined with spaces", () => {
    expect(runBash("claude_skill_inline do the thing 2>/dev/null")).toBe("claude [do the thing]");
    expect(runBash('gemini_skill_inline "one arg" 2>/dev/null')).toBe("gemini [-i] [one arg]");
  });

  it("honors the inline boolean for pinned skill wrappers", () => {
    writeCommand("foo", "the body");
    expect(runBash("SY_SKILL_INLINE=yes opencode_skill_foo 2>/dev/null")).toBe("opencode [--prompt] [the body]");
  });

  it("forces print mode through the run wrapper family", () => {
    writeCommand("foo", "the body");
    expect(runBash("claude_skill_run_foo 2>/dev/null")).toBe("claude [-p] [/sy-foo]");
    expect(runBash("copilot_skill_run_foo 2>/dev/null")).toBe("copilot [-p] [/sy-foo]");
    expect(runBash("opencode_skill_run_foo arg 2>/dev/null")).toBe("opencode [run] [--command] [sy-foo] [arg]");
    expect(runBash("opencode_skill_run_foo arg 2>&1 >/dev/null")).toContain("Command: opencode run --command sy-foo arg");
    expect(runBash("claude_skill_run_foo arg 2>&1 >/dev/null")).toContain("Command: claude -p /sy-foo arg");
  });

  it("picks the CLI at call time on sy-inline, stripping the override token", () => {
    expect(runBash("sy-inline opencode hello world 2>/dev/null")).toBe("opencode [--prompt] [hello world]");
    expect(runBash("LLM=gemini sy-inline hello 2>/dev/null")).toBe("gemini [-i] [hello]");
    expect(runBash("sy-inline hello 2>/dev/null")).toBe("claude [hello]");
    expect(runBash("sy-run-inline gemini hello 2>/dev/null")).toBe("gemini [-p] [hello]");
  });

  it("errors instead of launching a CLI with an empty prompt", () => {
    let err = "";
    try {
      runBash("opencode_skill_inline 2>&1");
    } catch (e) {
      err = e.stdout?.toString() + e.stderr?.toString();
    }
    expect(err).toContain("no prompt given");
    expect(err).not.toContain("opencode [");
  });

  it("prints help via is_help_arg without invoking any CLI", () => {
    expect(runBash("opencode_skill_inline --help 2>&1")).toContain("opencode_skill_inline: send a raw prompt to opencode");
    expect(runBash("sy-inline --help 2>&1")).toContain("sy-inline: send a raw prompt to the chosen LLM CLI");
  });

  it("skips a deployed skill that would shadow the reserved inline name", () => {
    writeCommand("inline", "a body that must never be reachable");
    const out = runBash('opencode_skill_inline "free text" 2>/dev/null');
    expect(out).toBe("opencode [--prompt] [free text]");
  });
});
