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

describe("shared instruction registry", () => {
it("should point every registered target at a source file that exists", () => {
    for (const [target, source] of Object.entries(llm.LLM_SHARED_INSTRUCTION_FILES)) {
      expect(fs.existsSync(path.join(ROOT, source)), `${target} -> ${source}`).toBe(true);
    }
  });

it("should have content expectations for every registered file, and no orphans", () => {
    expect(Object.keys(SPLIT_EXPECTATIONS).sort()).toEqual(Object.keys(llm.LLM_SHARED_INSTRUCTION_FILES).sort());
  });

it("should place instructions, plans, and PR memory under one shared root", () => {
    expect(llm.LLM_SHARED_INSTRUCTIONS_FOLDER.startsWith(llm.LLM_SHARED_ROOT_FOLDER)).toBe(true);
    expect(llm.LLM_SHARED_PLANS_FOLDER.startsWith(llm.LLM_SHARED_ROOT_FOLDER)).toBe(true);
    expect(llm.LLM_SHARED_PR_REVIEWS_FOLDER).toBe(path.join(llm.LLM_SHARED_ROOT_FOLDER, "pr_reviews"));
    expect(llm.LLM_SHARED_PR_BABYSITS_FOLDER).toBe(path.join(llm.LLM_SHARED_ROOT_FOLDER, "pr_babysits"));
  });

it("should keep the legacy plans folder distinct from the new one", () => {
    expect(llm.LLM_LEGACY_PLANS_FOLDER).not.toBe(llm.LLM_SHARED_PLANS_FOLDER);
    expect(llm.LLM_LEGACY_PLANS_FOLDER.endsWith("sy_llm_ai_plans")).toBe(true);
  });

it("should hang the shared root off the personal root, not the bare home folder", () => {
    expect(llm.LLM_SHARED_ROOT_FOLDER).toBe(`${SANDBOX_SY_HOME}/ai_llm`);
    expect(llm.LLM_SHARED_ROOT_FOLDER.startsWith(SANDBOX_SY_HOME)).toBe(true);
  });

it("should point each legacy folder at the destination its content belongs in", () => {
    // The plans folder is NOT the root: its content belongs under <root>/plans, so the
    // recovery command the detector prints has to carry a per-row destination.
    expect(llm.LLM_LEGACY_FOLDERS.map((row) => row.folder)).toEqual([llm.LLM_LEGACY_ROOT_FOLDER, llm.LLM_LEGACY_PLANS_FOLDER]);
    expect(llm.LLM_LEGACY_FOLDERS.map((row) => row.destination)).toEqual([llm.LLM_SHARED_ROOT_FOLDER, llm.LLM_SHARED_PLANS_FOLDER]);
    for (const { folder, destination } of llm.LLM_LEGACY_FOLDERS) {
      expect(folder).not.toBe(destination);
    }
  });

it("should list the persona file last, even behind a name that sorts after it", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "llm-instr-"));
    const original = llm.LLM_SHARED_INSTRUCTIONS_FOLDER;
    try {
      for (const name of ["testing.md", "~persona.md", "debugging.md", "~~late.md", "notes.txt"]) {
        fs.writeFileSync(path.join(folder, name), "x");
      }
      llm.LLM_SHARED_INSTRUCTIONS_FOLDER = folder;
      expect(llm.getSharedLLMInstructionFilePaths().map((p) => path.basename(p))).toEqual([
        "debugging.md",
        "testing.md",
        "~~late.md",
        "~persona.md",
      ]);
    } finally {
      llm.LLM_SHARED_INSTRUCTIONS_FOLDER = original;
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

it("should deploy the persona under a name that sorts after every letter", () => {
    expect(llm.LLM_PERSONA_INSTRUCTION_FILE).toBe("~persona.md");
    expect(Object.keys(llm.LLM_SHARED_INSTRUCTION_FILES)).toContain(llm.LLM_PERSONA_INSTRUCTION_FILE);
  });
});

describe("no rules were lost in the split", () => {
it("should hold each file's rules in the split file, not the always-loaded one", () => {
    for (const { target, text } of splitFiles) {
      for (const lead of SPLIT_EXPECTATIONS[target].leads) {
        expect(text, `${target} should hold: ${lead}`).toContain(lead);
        // An inlined file (persona.md) is deliberately present in both places.
        if (SPLIT_EXPECTATIONS[target].inlined) continue;
        expect(instructions, `always-loaded file should not duplicate: ${lead}`).not.toContain(lead);
      }
    }
  });

it("should keep the combined bullet count at or above the pre-split total", () => {
    // 158 rules before the first split; pointer stubs add a few, so this can only grow.
    const total = splitFiles.reduce((sum, { text }) => sum + countBullets(text), countBullets(instructions));
    expect(total).toBeGreaterThanOrEqual(158);
  });

it("should give every split file its own top-level heading and section structure", () => {
    for (const { target, text } of splitFiles) {
      expect(text.startsWith("# "), `${target} needs a top-level heading`).toBe(true);
      expect(text, `${target} heading`).toContain(SPLIT_EXPECTATIONS[target].heading);
      for (const section of SPLIT_EXPECTATIONS[target].sections) {
        expect(text, `${target} section`).toContain(section);
      }
    }
  });
});

describe("plans folder references", () => {
it("should not mention the pre-consolidation plans path anywhere in the instructions", () => {
    expect(instructions).not.toContain("sy_llm_ai_plans");
    for (const { target, text } of splitFiles) {
      expect(text, `${target} should not name the legacy plans folder`).not.toContain("sy_llm_ai_plans");
    }
  });

it("should point plan artifacts at the consolidated folder", () => {
    expect(instructions).toContain("<<LLM_ROOT_FOLDER>>/plans/");
    expect(llm.resolveLLMDocPlaceholders(instructions)).toContain(`${llm.LLM_SHARED_ROOT_FOLDER}/plans/`);
  });

it("should not name the pre-consolidation LLM home anywhere", () => {
    for (const { target, text } of splitFiles) {
      expect(text, `${target} should not name the legacy LLM home`).not.toContain("sy_llm_ai");
    }
    expect(instructions).not.toContain("sy_llm_ai");
  });
});
