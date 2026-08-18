/**
 * Integrity of the split between the always-loaded LLM instructions and the
 * on-demand instruction files deployed beside them.
 *
 * `instructions.md` is deployed verbatim into `~/.claude/CLAUDE.md` and its three
 * siblings, and Claude Code refuses to load a `CLAUDE.md` over 40k chars. Sections
 * too big to always-load were moved into their own files, leaving a pointer behind.
 * Three things can silently undo that split, and none of them is caught anywhere
 * else in the suite:
 *
 *   1. the always-loaded file creeping back over the budget,
 *   2. a pointer being written as a Claude `@path` import — which per Claude Code's
 *      memory docs loads the target at launch, re-inflating the very context the
 *      split exists to protect, while still looking correct in the rendered file,
 *   3. rules going missing in the move, or a pointer naming a path the deploy
 *      code never writes.
 *
 * Every split file is discovered from `LLM_SHARED_INSTRUCTION_FILES`, never from a
 * list kept here — a second list is the drift this consolidation exists to prevent.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import vm from "vm";

const ROOT = path.resolve(".");
const COMMON_FOLDER = "software/scripts/advanced/llm/_common";
const INSTRUCTIONS_PATH = path.join(ROOT, COMMON_FOLDER, "instructions.md");
const LLM_COMMON_PATH = path.join(ROOT, "software/scripts/advanced/llm/llm-common.js");

/**
 * Fake home the sandbox resolves shared paths against, so the deployed `~/...` form
 * can be derived rather than hardcoded.
 * @type {string}
 */
const SANDBOX_HOME = "/tmp/sandbox-home";

/**
 * Claude Code's documented hard limit for a `CLAUDE.md`, in characters.
 * @type {number}
 */
const CLAUDE_MD_CHAR_LIMIT = 40000;

/**
 * Headroom kept below the limit so a normal rule addition can't push the deployed
 * file over between one commit and the next.
 * @type {number}
 */
const CHAR_BUDGET = CLAUDE_MD_CHAR_LIMIT - 5000;

/** @type {string} Always-loaded instructions, as deployed. */
const instructions = fs.readFileSync(INSTRUCTIONS_PATH, "utf-8");

/**
 * Per-split-file content expectations, keyed by the same target basename the deploy
 * registry uses. Test data, not a second registry — a key here with no matching
 * registry entry (or the reverse) fails "every registered file has expectations".
 * @type {Record<string, {heading: string, sections: string[], leads: string[]}>}
 */
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
  // The one INLINED split file: persona.md is also pulled back into the top of
  // instructions.md through a BEGIN/END path block, so unlike its siblings its rules
  // are SUPPOSED to appear in the always-loaded file too. `inlined` turns the
  // not-duplicated assertion off for exactly this file rather than weakening it for
  // all three. Why both copies: claude and gemini read only the always-loaded block,
  // while opencode loads the standalone file as its own rules document — and position
  // matters for a persona, the smallest and oldest thing in a long context.
  "persona.md": {
    heading: "# Persona — Caveman Speak",
    sections: [],
    inlined: true,
    leads: ["**No self-reference.**", "**Hold persona every turn.**", "**Never caveman-ify:**"],
  },
};

/**
 * Evaluates `llm-common.js` in a sandbox and returns its top-level declarations,
 * matching the loader used by `llmCommandRegistry.spec.js`.
 * @returns {Record<string, any>} The populated sandbox.
 */
function loadLlmCommon() {
  const source = fs.readFileSync(LLM_COMMON_PATH, "utf-8").replace(/^(const|let) /gm, "var ");
  /** @type {Record<string, any>} */
  const sandbox = {
    path,
    // retargetLegacyPlanSymlinks does real filesystem work against temp fixtures.
    fs,
    BASE_HOMEDIR_LINUX: SANDBOX_HOME,
    log: () => {},
    is_os_mac: 0,
    readJson: () => ({}),
    readText: () => "",
    getSyHPOmenHomeIpAddress: () => null,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

const llm = loadLlmCommon();

/**
 * Every on-demand instruction file, discovered from the deploy registry.
 * @type {Array<{target: string, source: string, text: string}>}
 */
const splitFiles = Object.entries(llm.LLM_SHARED_INSTRUCTION_FILES).map(([target, source]) => ({
  target,
  source,
  text: fs.readFileSync(path.join(ROOT, source), "utf-8"),
}));

/**
 * The shared instructions folder as it appears in the deployed pointers (`~/...`).
 * @type {string}
 */
const SHARED_FOLDER_TILDE = llm.LLM_SHARED_INSTRUCTIONS_FOLDER.replace(SANDBOX_HOME, "~");

/**
 * Counts markdown list items, which is how a "rule" is expressed in every file.
 * @param {string} text - File content.
 * @returns {number} Count of top-level and nested bullets.
 */
function countBullets(text) {
  return text.split("\n").filter((line) => /^\s*- /.test(line)).length;
}

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
  it("should point at every registered file by its deployed path, in backticks", () => {
    for (const { target } of splitFiles) {
      // `@~/path/to.md` outside backticks is an import and loads at launch; backticks
      // keep it literal and on-demand. Assert the backticked form is present...
      expect(instructions, `pointer for ${target}`).toContain(`\`${SHARED_FOLDER_TILDE}/${target}\``);
      // ...and that no bare @-import of it exists anywhere in the file.
      expect(instructions, `@-import of ${target}`).not.toMatch(new RegExp(`@[^\\s\`]*${target.replace(".", "\\.")}`));
    }
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

describe("shared instruction registry", () => {
  it("should point every registered target at a source file that exists", () => {
    for (const [target, source] of Object.entries(llm.LLM_SHARED_INSTRUCTION_FILES)) {
      expect(fs.existsSync(path.join(ROOT, source)), `${target} -> ${source}`).toBe(true);
    }
  });

  it("should have content expectations for every registered file, and no orphans", () => {
    expect(Object.keys(SPLIT_EXPECTATIONS).sort()).toEqual(Object.keys(llm.LLM_SHARED_INSTRUCTION_FILES).sort());
  });

  it("should place instructions and plans under one shared root", () => {
    expect(llm.LLM_SHARED_INSTRUCTIONS_FOLDER.startsWith(llm.LLM_SHARED_ROOT_FOLDER)).toBe(true);
    expect(llm.LLM_SHARED_PLANS_FOLDER.startsWith(llm.LLM_SHARED_ROOT_FOLDER)).toBe(true);
  });

  it("should keep the legacy plans folder distinct from the new one", () => {
    expect(llm.LLM_LEGACY_PLANS_FOLDER).not.toBe(llm.LLM_SHARED_PLANS_FOLDER);
    expect(llm.LLM_LEGACY_PLANS_FOLDER.endsWith("sy_llm_ai_plans")).toBe(true);
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
    expect(instructions).toContain("~/sy_llm_ai/plans/");
  });
});

describe("legacy plan symlink retargeting", () => {
  /**
   * Builds a throwaway plans folder holding one cross-repo symlink that still points
   * at the pre-consolidation location, mirroring what the real migration hit.
   * @returns {{plans: string, legacy: string, link: string, target: string}} Paths under a temp root.
   */
  function makeFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sy-plans-"));
    const legacy = path.join(root, "sy_llm_ai_plans");
    const plans = path.join(root, "sy_llm_ai", "plans");

    fs.mkdirSync(path.join(plans, "repo-a"), { recursive: true });
    fs.mkdirSync(path.join(plans, "repo-b"), { recursive: true });

    const target = path.join(plans, "repo-b", "plan-shared.md");
    fs.writeFileSync(target, "# shared plan\n");

    // The link still names the OLD folder, exactly as `mv` would leave it.
    const link = path.join(plans, "repo-a", "plan-shared.md");
    fs.symlinkSync(path.join(legacy, "repo-b", "plan-shared.md"), link);

    return { plans, legacy, link, target };
  }

  it("should repoint a legacy symlink at the new folder", () => {
    const { plans, legacy, link, target } = makeFixture();
    expect(fs.existsSync(link)).toBe(false); // dangling before the repair

    expect(llm.retargetLegacyPlanSymlinks(plans, legacy)).toBe(1);

    expect(fs.readlinkSync(link)).toBe(target);
    expect(fs.readFileSync(link, "utf-8")).toBe("# shared plan\n");
  });

  it("should be idempotent on a second pass", () => {
    const { plans, legacy } = makeFixture();
    expect(llm.retargetLegacyPlanSymlinks(plans, legacy)).toBe(1);
    expect(llm.retargetLegacyPlanSymlinks(plans, legacy)).toBe(0);
  });

  it("should leave a link whose retargeted destination is missing", () => {
    const { plans, legacy, link, target } = makeFixture();
    fs.rmSync(target);

    expect(llm.retargetLegacyPlanSymlinks(plans, legacy)).toBe(0);
    expect(fs.readlinkSync(link)).toContain("sy_llm_ai_plans");
  });

  it("should not touch a symlink that already points at the new folder", () => {
    const { plans, legacy, link, target } = makeFixture();
    fs.unlinkSync(link);
    fs.symlinkSync(target, link);

    expect(llm.retargetLegacyPlanSymlinks(plans, legacy)).toBe(0);
    expect(fs.readlinkSync(link)).toBe(target);
  });

  it("should no-op when the plans folder does not exist", () => {
    expect(llm.retargetLegacyPlanSymlinks("/tmp/definitely-not-here-xyz", "/tmp/legacy-xyz")).toBe(0);
  });
});
