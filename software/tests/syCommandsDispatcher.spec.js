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
 *   - `sandbox/home/sy_llm_ai/skills/sy-<name>/SKILL.md` seeded with the supplied body.
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
  fs.mkdirSync(path.join(sandbox, "home/sy_llm_ai/skills"), { recursive: true });
  fs.mkdirSync(path.join(sandbox, "bin"), { recursive: true });
  for (const cli of ["claude", "copilot", "gemini", "opencode"]) {
    const stubPath = path.join(sandbox, "bin", cli);
    fs.writeFileSync(stubPath, `#!/usr/bin/env bash\nprintf '${cli}'\nfor a in "$@"; do printf ' [%s]' "$a"; done\nprintf '\\n'\n`);
    fs.chmodSync(stubPath, 0o755);
  }
  // is_help_arg is a function the partial calls — provide a minimal definition
  // so we don't have to load the entire common-functions.bash for these tests.
  fs.writeFileSync(
    path.join(sandbox, "helpers.bash"),
    `function is_help_arg() { case "\${1:-}" in help|--help|-h|/?|-\\?|/help|-help|\\?) return 0;; *) return 1;; esac; }\n`,
  );
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/**
 * Write a prompt body to `sandbox/home/sy_llm_ai/skills/sy-<name>/SKILL.md`.
 *
 * @param {string} name - Command name without the `sy-` prefix and `.md` suffix.
 * @param {string} body - Prompt body content.
 */
function writeCommand(name, body) {
  /** @type {string} Folder-form skill location the dispatcher globs at shell start. */
  const skillFolder = path.join(sandbox, `home/sy_llm_ai/skills/sy-${name}`);
  fs.mkdirSync(skillFolder, { recursive: true });
  fs.writeFileSync(path.join(skillFolder, "SKILL.md"), body);
}

/**
 * Run a one-liner under bash with the sandbox's PATH, fake HOME, and the
 * partial already sourced. Returns stdout (the CLI stub output captures
 * cleanly so the caller can assert which CLI fired and with what prompt).
 *
 * @param {string} script - Bash script body, executed after the helpers + partial are sourced.
 * @returns {string} Captured stdout (trimmed).
 */
function runBash(script) {
  const cmd = `HOME='${sandbox}/home' PATH='${sandbox}/bin':"$PATH" bash -c '
    source "${sandbox}/helpers.bash"
    source "${PARTIAL}"
    ${script}
  '`;
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

describe("sy-commands dispatcher", () => {
  it("defines sy-<name> for each ~/sy_llm_ai/skills/sy-<name>/SKILL.md on disk", () => {
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
    expect(out).toContain("claude [the prompt body]");
  });

  it("uses $LLM when the env var names a supported CLI", () => {
    writeCommand("foo", "body");
    const out = runBash("LLM=gemini sy-foo 2>/dev/null");
    expect(out).toContain("gemini [-p]");
    expect(out).toContain("[body]");
  });

  it("uses the leading positional arg when it names a supported CLI, stripping it from prompt args", () => {
    writeCommand("foo", "body");
    const out = runBash("sy-foo opencode arg1 arg2 2>/dev/null");
    expect(out).toContain("opencode [run]");
    expect(out).toContain("body");
    expect(out).toContain("Arguments: arg1 arg2");
  });

  it("does NOT strip the first arg when it is not a supported CLI", () => {
    writeCommand("foo", "body");
    const out = runBash("sy-foo somerandomthing 2>/dev/null");
    expect(out).toContain("claude");
    expect(out).toContain("body");
    expect(out).toContain("Arguments: somerandomthing");
  });

  it("substitutes $ARGUMENTS into the body when the body references it", () => {
    writeCommand("foo", "Review this PR: $ARGUMENTS — be thorough.");
    const out = runBash("sy-foo https://example.com/pr/1 2>/dev/null");
    expect(out).toContain("Review this PR: https://example.com/pr/1 — be thorough.");
    expect(out).not.toContain("Arguments:");
  });

  it("appends a trailing `Arguments:` line when the body has no $ARGUMENTS placeholder", () => {
    writeCommand("foo", "Do the thing.");
    const out = runBash("sy-foo first second 2>/dev/null");
    expect(out).toContain("Do the thing.");
    expect(out).toContain("Arguments: first second");
  });

  it("dispatches without an args appendix when no prompt args were forwarded", () => {
    writeCommand("foo", "Plain body.");
    const out = runBash("sy-foo 2>/dev/null");
    expect(out).toContain("Plain body.");
    expect(out).not.toContain("Arguments:");
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
    expect(out).toContain("body");
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
    const cmd = `HOME='${sandbox}/home' PATH='${sandbox}/bin':"$PATH" bash -c '
      source "${sandbox}/helpers.bash"
      source "${PARTIAL}"
      sy-foo gemini 2>/tmp/sycommands-stderr-${process.pid}.log
    '`;
    execSync(cmd, { encoding: "utf-8" });
    const stderr = fs.readFileSync(`/tmp/sycommands-stderr-${process.pid}.log`, "utf-8");
    fs.unlinkSync(`/tmp/sycommands-stderr-${process.pid}.log`);
    expect(stderr).toContain(">> sy-foo -> gemini");
  });
});

describe("sy-commands CLI registry", () => {
  it("derives _SY_SUPPORTED_LLMS from the single _SY_LLM_SPECS registry", () => {
    expect(runBash("echo ${_SY_SUPPORTED_LLMS[*]}")).toBe("claude copilot gemini opencode");
  });

  it("declares a native dispatch kind only for CLIs that expose one", () => {
    expect(runBash("_sy_native_kind claude")).toBe("slash");
    expect(runBash("_sy_native_kind copilot")).toBe("slash");
    expect(runBash("_sy_native_kind opencode")).toBe("command");
    // gemini has no verified native surface — empty means "degrade to inline".
    expect(runBash("_sy_native_kind gemini")).toBe("");
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
    expect(fns.sort()).toEqual(["claude_skill_foo", "copilot_skill_foo", "gemini_skill_foo", "opencode_skill_foo"]);
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
    expect(out).toContain("gemini [-p]");
    expect(out).toContain("Arguments: opencode");
  });

  it("pins its CLI over the $LLM env var", () => {
    writeCommand("foo", "body");
    expect(runBash("LLM=claude gemini_skill_foo 2>/dev/null")).toContain("gemini [-p]");
  });

  it("prints pinned help via is_help_arg without invoking any CLI", () => {
    writeCommand("foo", "should not appear");
    const out = runBash("opencode_skill_foo --help 2>&1");
    expect(out).toContain("opencode_skill_foo: run the sy-foo workflow through opencode");
    expect(out).not.toContain("should not appear");
  });
});

describe("sy-commands dispatch modes", () => {
  it("inlines the whole body by default", () => {
    writeCommand("foo", "the body");
    expect(runBash("opencode_skill_foo 2>/dev/null")).toBe("opencode [run] [the body]");
  });

  it("names the skill through the CLI flag when the kind is `command`", () => {
    writeCommand("foo", "the body");
    const out = runBash("SY_SKILL_MODE=native opencode_skill_foo 2>/dev/null");
    expect(out).toBe("opencode [run] [--command] [sy-foo]");
  });

  it("forwards args after the skill name for a `command` CLI", () => {
    writeCommand("foo", "the body");
    const out = runBash("SY_SKILL_MODE=native opencode_skill_foo alpha beta 2>/dev/null");
    expect(out).toBe("opencode [run] [--command] [sy-foo] [alpha] [beta]");
  });

  it("sends `/<skill>` as ordinary prompt text when the kind is `slash`", () => {
    writeCommand("foo", "the body");
    expect(runBash("SY_SKILL_MODE=native copilot_skill_foo 2>/dev/null")).toBe("copilot [-p] [/sy-foo]");
    expect(runBash("SY_SKILL_MODE=native claude_skill_foo 2>/dev/null")).toBe("claude [/sy-foo]");
  });

  it("appends args to the slash line rather than as a separate argv entry", () => {
    writeCommand("foo", "the body");
    const out = runBash("SY_SKILL_MODE=native claude_skill_foo alpha beta 2>/dev/null");
    expect(out).toBe("claude [/sy-foo alpha beta]");
  });

  it("degrades to inline for a CLI with no native surface", () => {
    writeCommand("foo", "the body");
    expect(runBash("SY_SKILL_MODE=native gemini_skill_foo 2>/dev/null")).toBe("gemini [-p] [the body]");
  });

  it("honors SY_SKILL_MODE on the call-time sy-<name> family too", () => {
    writeCommand("foo", "the body");
    const out = runBash("SY_SKILL_MODE=native sy-foo opencode 2>/dev/null");
    expect(out).toBe("opencode [run] [--command] [sy-foo]");
  });

  it("falls back to inline when SY_SKILL_MODE is an unknown value", () => {
    writeCommand("foo", "the body");
    expect(runBash("SY_SKILL_MODE=bogus opencode_skill_foo 2>/dev/null")).toBe("opencode [run] [the body]");
  });

  it("still errors on a missing skill in native mode, before invoking any CLI", () => {
    let err = "";
    try {
      runBash("SY_SKILL_MODE=native _sy_dispatch_cli opencode foo 2>&1");
    } catch (e) {
      err = e.stdout?.toString() + e.stderr?.toString();
    }
    expect(err).toContain("prompt body missing");
    expect(err).not.toContain("opencode [run]");
  });

  it("tags the routing line with the mode that fired", () => {
    writeCommand("foo", "body");
    expect(runBash("opencode_skill_foo 2>&1 >/dev/null")).toContain(">> sy-foo -> opencode (inline)");
    expect(runBash("SY_SKILL_MODE=native opencode_skill_foo 2>&1 >/dev/null")).toContain(">> sy-foo -> opencode (native/command)");
  });
});
