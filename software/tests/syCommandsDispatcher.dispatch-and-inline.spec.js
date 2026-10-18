import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { execSync } from "child_process";

import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const PARTIAL = path.join(ROOT_DIR, "software/scripts/advanced/llm/_common/sy-commands.profile.bash");

let sandbox;

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

function writeCommand(name, body) {
  /** @type {string} Folder-form skill location the dispatcher globs at shell start. */
  const skillFolder = path.join(sandbox, `home/sy/ai_llm/skills/sy-${name}`);
  fs.mkdirSync(skillFolder, { recursive: true });
  fs.writeFileSync(path.join(skillFolder, "SKILL.md"), body);
}

function runBash(script) {
  const cmd = `HOME='${sandbox}/home' LLM_ROOT_FOLDER='${sandbox}/home/sy/ai_llm' PATH='${sandbox}/bin':"$PATH" bash -c '
    source "${sandbox}/helpers.bash"
    source "${PARTIAL}"
    ${script}
  '`;
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

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

  it("keeps a literal & in $ARGUMENTS under bash 5.2+ patsub_replacement", () => {
    writeCommand("foo", "Open $ARGUMENTS now");
    const out = runBash('SY_SKILL_INLINE=1 opencode_skill_foo "https://x.test/?a=1&b=2" 2>/dev/null');
    expect(out).toBe("opencode [--prompt] [Open https://x.test/?a=1&b=2 now]");
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
