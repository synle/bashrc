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
 *   - `sandbox/home/.claude/commands/sy-<name>.md` seeded with the supplied body.
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
  fs.mkdirSync(path.join(sandbox, "home/.claude/commands"), { recursive: true });
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
 * Write a prompt body to `sandbox/home/.claude/commands/sy-<name>.md`.
 *
 * @param {string} name - Command name without the `sy-` prefix and `.md` suffix.
 * @param {string} body - Prompt body content.
 */
function writeCommand(name, body) {
  fs.writeFileSync(path.join(sandbox, `home/.claude/commands/sy-${name}.md`), body);
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
  it("defines sy-<name> for each ~/.claude/commands/sy-<name>.md on disk", () => {
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
    expect(err).toContain("claude/setup.js");
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
