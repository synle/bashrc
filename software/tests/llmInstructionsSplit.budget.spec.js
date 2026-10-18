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

describe("shared CLI hook merge", () => {
it("preserves existing event hooks and adds managed reminder only once", () => {
    const userHook = { hooks: [{ type: "command", command: "user-hook" }] };
    const managedHook = { hooks: [{ type: "command", command: "persona-hook" }] };
    const settings = { hooks: { UserPromptSubmit: [userHook] } };

    expect(llm.mergeLLMHookEntry(settings, "UserPromptSubmit", managedHook)).toBe(true);
    expect(llm.mergeLLMHookEntry(settings, "UserPromptSubmit", managedHook)).toBe(true);

    expect(settings.hooks.UserPromptSubmit).toEqual([userHook, managedHook]);
  });

it("rejects malformed event lists without replacing user data", () => {
    const settings = { hooks: { BeforeAgent: { command: "user-hook" } } };

    expect(llm.mergeLLMHookEntry(settings, "BeforeAgent", { command: "persona-hook" })).toBe(false);
    expect(settings.hooks.BeforeAgent).toEqual({ command: "user-hook" });
  });

it("replaces an older persona reminder while preserving hooks grouped beside it", () => {
    const userHook = { type: "command", command: "user-hook" };
    const oldHook = { type: "command", command: "node", args: [llm.LLM_PERSONA_HOOK_HELPER_PATH, "claude", "old reminder"] };
    const updated = { hooks: [{ ...oldHook, args: [llm.LLM_PERSONA_HOOK_HELPER_PATH, "claude", "new reminder"] }] };
    const settings = { hooks: { UserPromptSubmit: [{ matcher: "*", hooks: [userHook, oldHook] }] } };

    llm.mergeLLMHookEntry(settings, "UserPromptSubmit", updated);
    llm.mergeLLMHookEntry(settings, "UserPromptSubmit", updated);

    expect(settings.hooks.UserPromptSubmit).toEqual([{ matcher: "*", hooks: [userHook] }, updated]);
  });
});

describe("always-loaded instructions stay within the CLAUDE.md budget", () => {
it("should keep instructions.md under the char budget", () => {
    expect(instructions.length).toBeLessThan(CHAR_BUDGET);
  });

it("should stay under the hard limit even with both auto-generated markers added", () => {
    // deploySharedLLMInstructions / getLLMCustomInstructions wrap the content in an
    // opening and closing comment; ~200 chars covers both plus the BEGIN/END pair.
    expect(instructions.length + 200).toBeLessThan(CLAUDE_MD_CHAR_LIMIT);
  });
});

describe("split file pointers", () => {
it("should point at every registered file through a placeholder that resolves on deploy", () => {
    /** @type {string} Exactly what the deploy pass writes to disk. */
    const deployed = llm.resolveLLMDocPlaceholders(instructions);

    for (const { target } of splitFiles) {
      // The SOURCE stays symbolic. A hardcoded `~/_extra/ai_llm/...` here would be a
      // second spelling of a folder common-env.sh already declares, and would be
      // outright wrong on a machine whose home layout differs.
      expect(instructions, `placeholder pointer for ${target}`).toContain(`\`<<LLM_ROOT_FOLDER>>/instructions/${target}\``);
      // The DEPLOYED bytes carry the resolved absolute path, because the agent reading
      // them has no shell to expand anything — an unexpanded variable in a `mkdir -p`
      // is a write at the filesystem root.
      expect(deployed, `resolved pointer for ${target}`).toContain(`\`${SHARED_FOLDER_RESOLVED}/${target}\``);
      // `@~/path/to.md` outside backticks is an import that loads at launch; backticks
      // keep it literal and on-demand.
      expect(instructions, `@-import of ${target}`).not.toMatch(new RegExp(`@[^\\s\`]*${target.replace(".", "\\.")}`));
    }

    // Nothing may survive unresolved — a literal `<<LLM_ROOT_FOLDER>>` reaching an agent
    // reads as a folder name and fails silently.
    expect(deployed, "unresolved placeholder in the deployed instructions").not.toContain("<<LLM_ROOT_FOLDER>>");
  });

it("should keep a Source Control section that points at the PR workflow file", () => {
    expect(instructions).toContain("## Source Control & PRs");
    expect(instructions).toContain("pr-workflow.md");
  });

it("should not carry a Claude @path import of any kind", () => {
    /** @type {string[]} Lines outside fenced code blocks holding a bare @-import. */
    const imports = [];
    let inFence = false;
    for (const line of instructions.split("\n")) {
      if (line.trim().startsWith("```")) inFence = !inFence;
      else if (!inFence && /(^|\s)@[~./][^\s`]*\.md/.test(line)) imports.push(line);
    }
    expect(imports).toEqual([]);
  });
});
