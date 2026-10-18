import { describe, it, expect, beforeEach } from "vitest";

import { getIndexFunction, expandSourceMarkers } from "./setup.js";

import fs from "fs";

import path from "path";

import os from "os";

import vm from "vm";

const ROOT = path.resolve(".");

const COMMON_FOLDER = "software/scripts/advanced/llm/_common";

const INSTRUCTIONS_PATH = path.join(ROOT, COMMON_FOLDER, "instructions.md");

const LLM_COMMON_PATH = path.join(ROOT, "software/scripts/advanced/llm/llm-common.js");

const SANDBOX_HOME = "/tmp/sandbox-home";

const SANDBOX_SY_HOME = `${SANDBOX_HOME}/sy`;

const resolvePlaceholders = getIndexFunction("resolvePlaceholders");

const CLAUDE_MD_CHAR_LIMIT = 40000;

const CHAR_BUDGET = 39500;

const instructions = fs.readFileSync(INSTRUCTIONS_PATH, "utf-8");

const SPLIT_EXPECTATIONS = {
  "pr-workflow.md": {
    heading: "# PR & Source Control Workflow",
    sections: ["## Branches, titles, commits", "## Reviewing and babysitting"],
    leads: [
      "Every PR branches off the default branch",
      "Split by slice, never by layer",
      "Hard dependencies phase into waves",
      "Prose-only self-merge requires the PR to be standalone",
      "A bare `#<number>` is a rendering bug",
    ],
  },
  "debugging.md": {
    heading: "# Debugging Discipline",
    sections: ["## Reproduce before you theorize", "## Fix the cause, then prove it"],
    leads: [
      "No fix without a reproduction",
      "One hypothesis, one change, one observation",
      "Bisect; don't stare",
      "Prove the fix is load-bearing",
      "Never round an unexplained remainder up to",
    ],
  },
  "testing.md": {
    heading: "# Test Quality",
    sections: ["## What a test asserts", "## How a test is shaped"],
    leads: [
      "Test behavior, not implementation",
      "A test that passes before the fix is not a regression test",
      "Assert values, not the absence of an explosion",
      "Don't mock what you don't own",
      "Deterministic or deleted",
    ],
  },
  "readability.md": {
    heading: "# Readability & Design",
    sections: ["## Naming & shape", "## Boundaries & visibility"],
    leads: [
      "Name the magic value",
      "Flatten the nest",
      "Enum over boolean parameter",
      "Widening visibility is a design change",
      "Encapsulate the low-level behind a clean API",
    ],
  },
  "review-guardrails.md": {
    heading: "# Review & Runtime Guardrails",
    sections: ["## Review-Derived Guardrails", "## Concurrency & Resources"],
    leads: [
      "One behavior, every path",
      "Retry taxonomy is public behavior",
      "Selectors prove uniqueness",
      "Control planes preserve identity",
      "Cryptographic pseudonyms fail closed",
      "Operational docs are executable interfaces",
      "Isolate every iteration of a long-running loop",
      "Systemic upstream failure trips a breaker",
      "Persistent tests clean what they create",
      "Enforce byte, item, page, token, and time limits",
      "Async request/RPC paths never call blocking",
    ],
  },
  "performance.md": {
    heading: "# Measure Before Optimizing",
    sections: ["## Prove the win", "## Spend complexity carefully"],
    leads: [
      "No optimization without a number before and after",
      "Profile; don't guess",
      "State the budget before optimizing",
      "Fix the complexity class before micro-optimizing",
      "Re-measure after landing",
    ],
  },
  // The one INLINED split file: persona.md is also pulled back into the top of
  // instructions.md through a BEGIN/END path block, so unlike its siblings its rules
  // are SUPPOSED to appear in the always-loaded file too. `inlined` turns the
  // not-duplicated assertion off for exactly this file rather than weakening it for
  // all siblings. Why both copies: claude and gemini read only the always-loaded block,
  // while opencode loads the standalone file as its own rules document — and position
  // matters for a persona, the smallest and oldest thing in a long context.
  // Deployed as `~persona.md` so it sorts LAST — see LLM_PERSONA_INSTRUCTION_FILE.
  "~persona.md": {
    heading: "# Persona — Caveman Speak",
    sections: [],
    inlined: true,
    leads: [
      "**No self-reference.**",
      "**Hold persona every turn.**",
      "Progress updates, status reports, PR state lists, task summaries, and `task_complete` final messages are replies to the user",
      "**Never caveman-ify:**",
      "Both PRs wait on approval. Backend auto-merge armed.",
    ],
  },
};

function loadLlmCommon() {
  const source = expandSourceMarkers(fs.readFileSync(LLM_COMMON_PATH, "utf-8")).replace(/^(const|let) /gm, "var ");
  /** @type {Record<string, any>} */
  const sandbox = {
    path,
    // The legacy-folder detector does real filesystem work against temp fixtures.
    fs,
    BASE_HOMEDIR_LINUX: SANDBOX_HOME,
    // The LLM home hangs off the personal root, not the bare home folder.
    SY_ROOT_FOLDER: SANDBOX_SY_HOME,
    // LLM_SHARED_ROOT_FOLDER reads LLM_ROOT_FOLDER directly with no default, so the
    // sandbox has to supply it. Set to the sandbox root rather than inherited from the
    // real environment, which would make these assertions depend on whoever ran them.
    process: { env: { LLM_ROOT_FOLDER: `${SANDBOX_SY_HOME}/ai_llm` } },
    log: () => {},
    // The legacy-folder detector frames its warning with the shared separator.
    LINE_BREAK_HASH: "#".repeat(80),
    is_os_mac: 0,
    readJson: () => ({}),
    readText: () => "",
    getOllamaHosts: async () => [{ ip: "127.0.0.1", hostname: "local", tags: [], isDefault: true, isLocal: true }],
    // The REAL resolver from index.js — never a stub, which would be a second
    // implementation free to disagree with the one that actually deploys. The
    // shared roots are pinned to the sandbox so these assertions never depend on
    // the home layout of whoever ran them.
    resolvePlaceholders: (content, tokenMap = {}) =>
      resolvePlaceholders(content, { SY_ROOT_FOLDER: SANDBOX_SY_HOME, HOME: SANDBOX_HOME, ...tokenMap }),
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

const llm = loadLlmCommon();

const splitFiles = Object.entries(llm.LLM_SHARED_INSTRUCTION_FILES).map(([target, source]) => ({
  target,
  source,
  text: fs.readFileSync(path.join(ROOT, source), "utf-8"),
}));

const SHARED_FOLDER_RESOLVED = llm.LLM_SHARED_INSTRUCTIONS_FOLDER;

function countBullets(text) {
  return text.split("\n").filter((line) => /^\s*- /.test(line)).length;
}

describe("refreshPathKeyedBlocks", () => {
  let home;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "pathkeyed-"));
  });

  function withBlock(key, body) {
    return `top\n<!-- BEGIN ${key} -->\n${body}\n<!-- END ${key} -->\nbottom\n`;
  }

  it("replaces the block body with the source file's current content", () => {
    fs.writeFileSync(path.join(home, "ctx.md"), "new rules\n");
    const out = llm.refreshPathKeyedBlocks(withBlock("Mine | ~/ctx.md", "old rules"), home);
    expect(out).toBe(withBlock("Mine | ~/ctx.md", "new rules"));
  });

  it("expands $HOME/ the same as ~/", () => {
    fs.writeFileSync(path.join(home, "ctx.md"), "new rules");
    expect(llm.refreshPathKeyedBlocks(withBlock("Mine | $HOME/ctx.md", "old"), home)).toBe(withBlock("Mine | $HOME/ctx.md", "new rules"));
  });

  it("keeps the old body when the source file is empty", () => {
    fs.writeFileSync(path.join(home, "ctx.md"), "  \n");
    const input = withBlock("Mine | ~/ctx.md", "old rules");
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
  });

  it("keeps the old body when the source file is missing", () => {
    const input = withBlock("Mine | ~/absent.md", "old rules");
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
  });

  it("never adds a block that is not already in the file", () => {
    fs.writeFileSync(path.join(home, "ctx.md"), "new rules");
    expect(llm.refreshPathKeyedBlocks("no markers here\n", home)).toBe("no markers here\n");
  });

  it("skips repo-owned synle/bashrc keys", () => {
    const input = withBlock("synle/bashrc | software/x.md", "managed");
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
  });

  it("refuses a source outside the home folder", () => {
    const input = withBlock("Mine | /etc/hosts", "old rules");
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
  });

  it("refuses a credential-shaped source", () => {
    fs.writeFileSync(path.join(home, ".env"), "TOKEN=replace-me");
    const input = withBlock("Mine | ~/.env", "old rules");
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
  });

  it("leaves duplicated markers untouched", () => {
    fs.writeFileSync(path.join(home, "ctx.md"), "new rules");
    const input = withBlock("Mine | ~/ctx.md", "a") + withBlock("Mine | ~/ctx.md", "b");
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
  });

  it("is idempotent on a second run", () => {
    fs.writeFileSync(path.join(home, "ctx.md"), "new rules");
    const once = llm.refreshPathKeyedBlocks(withBlock("Mine | ~/ctx.md", "old"), home);
    expect(llm.refreshPathKeyedBlocks(once, home)).toBe(once);
  });
});
