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

describe("shared-home ownership tests", () => {
  it("should claim links under the current home and every former one", () => {
    const current = llm.LLM_SHARED_ROOT_FOLDER;
    const legacy = llm.LLM_LEGACY_ROOT_FOLDER;

    expect(llm.isUnderSharedLLMHome(`${current}/skills/sy-debug/SKILL.md`)).toBe(true);
    // The whole point: a link written before the move must still read as ours, or the
    // cleanup pass leaves it dangling and the deploy pass calls it user-authored.
    expect(llm.isUnderSharedLLMHome(`${legacy}/skills/sy-debug/SKILL.md`)).toBe(true);
    expect(llm.isUnderSharedLLMHome(`${llm.LLM_LEGACY_PLANS_FOLDER}/bashrc/plan.md`)).toBe(true);
    expect(llm.isUnderSharedLLMHome(current)).toBe(true);
  });

  it("should never claim a path outside those roots", () => {
    expect(llm.isUnderSharedLLMHome(`${SANDBOX_HOME}/.claude/skills/mine/SKILL.md`)).toBe(false);
    expect(llm.isUnderSharedLLMHome(`${SANDBOX_HOME}/unrelated`)).toBe(false);
    // Path-boundary, not string-prefix: a sibling folder sharing the prefix is not ours.
    expect(llm.isUnderSharedLLMHome(`${llm.LLM_SHARED_ROOT_FOLDER}-backup/skills/x`)).toBe(false);
  });
});

describe("deployed docs name folders by placeholder, never by hardcoded path", () => {
  const deployedSources = [
    { label: "instructions.md", text: instructions },
    ...splitFiles.map(({ target, text }) => ({ label: target, text })),
    ...fs
      .readdirSync(path.join(ROOT, COMMON_FOLDER, "commands"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({
        label: `commands/${name}`,
        text: fs.readFileSync(path.join(ROOT, COMMON_FOLDER, "commands", name), "utf-8"),
      })),
    {
      label: "instructions-copilot-tweaks.md",
      text: fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/copilot/instructions-copilot-tweaks.md"), "utf-8"),
    },
  ];

  it("should never hardcode the personal root or the LLM home", () => {
    // A hardcoded path is a second spelling of a folder common-env.sh already owns:
    // it goes stale the day the root moves, and is wrong outright on a machine whose
    // home layout differs. Every one of these must be a placeholder instead.
    for (const { label, text } of deployedSources) {
      for (const forbidden of ["~/_extra", "$HOME/_extra", "~/sy/", "/ai_llm/", "sy_llm_ai"]) {
        expect(text, `${label} hardcodes ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("should resolve every placeholder it uses to a real absolute folder", () => {
    // The LLM-only token plus the shared ones a doc gets for free. `<<SY_ROOT_FOLDER>>`
    // is resolved by COMMON_PLACEHOLDERS in index.js rather than declared here, so it
    // is named explicitly — otherwise moving it to the shared registry would have
    // silently dropped it out of this assertion.
    const folderTokens = [...Object.keys(llm.LLM_DOC_PATH_PLACEHOLDERS), "<<SY_ROOT_FOLDER>>", "<<HOME>>"];

    for (const { label, text } of deployedSources) {
      const deployed = llm.resolveLLMDocPlaceholders(text);
      for (const token of folderTokens) {
        expect(deployed, `${label} left ${token} unresolved`).not.toContain(token);
      }
    }

    // The map itself must point somewhere real, or resolution quietly bakes in
    // "undefined" and every deployed pointer is a broken path.
    for (const [token, value] of Object.entries(llm.LLM_DOC_PATH_PLACEHOLDERS)) {
      expect(typeof value, `${token} resolves to a non-string`).toBe("string");
      expect(path.isAbsolute(value), `${token} resolves to a relative path`).toBe(true);
    }
  });

  it("should resolve every PR-loop tuning placeholder to a positive number of seconds", () => {
    // These carry the babysit / review cadence, so an unresolved token ships the
    // literal `<<SY_PR_POLL_INTERVAL_SECONDS>>` to an agent, which reads as prose and
    // silently loses the interval it was supposed to sleep.
    for (const { label, text } of deployedSources) {
      const deployed = llm.resolveLLMDocPlaceholders(text);
      for (const token of Object.keys(llm.LLM_DOC_TUNING_PLACEHOLDERS)) {
        expect(deployed, `${label} left ${token} unresolved`).not.toContain(token);
      }
    }

    for (const [token, value] of Object.entries(llm.LLM_DOC_TUNING_PLACEHOLDERS)) {
      expect(value, `${token} resolves to a non-string`).toBeTypeOf("string");
      expect(Number(value), `${token} resolves to a non-positive number`).toBeGreaterThan(0);
    }
  });

  it("should route every deployed doc through the one reader that resolves placeholders", () => {
    // readText alone skips resolution, which ships `<<LLM_ROOT_FOLDER>>` verbatim to an
    // agent — it reads as a literal folder name and fails silently. readLLMDocSource
    // is the only sanctioned reader for a doc that gets deployed.
    const readerFiles = [
      "software/scripts/advanced/llm/llm-common.js",
      "software/scripts/advanced/llm/claude/setup.js",
      "software/scripts/advanced/llm/copilot/setup.js",
      "software/scripts/advanced/llm/gemini/setup.js",
      "software/scripts/advanced/llm/opencode/setup.js",
      "software/scripts/advanced/llm/pi/setup.js",
    ];

    for (const file of readerFiles) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf-8");
      for (const line of source.split("\n")) {
        // Only the definition of readLLMDocSource itself may call readText on a doc.
        if (line.includes("resolveLLMDocPlaceholders(await readText")) continue;
        expect(line, `${file} reads a deployed doc with readText`).not.toMatch(/readText`[^`]*\.md`/);
      }
    }
  });
});
