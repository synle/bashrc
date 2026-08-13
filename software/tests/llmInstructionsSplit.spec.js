/**
 * Integrity of the split between the always-loaded LLM instructions and the
 * on-demand PR workflow file.
 *
 * `instructions.md` is deployed verbatim into `~/.claude/CLAUDE.md` and its three
 * siblings, and Claude Code refuses to load a `CLAUDE.md` over 40k chars. The PR
 * rules were moved into `instructions-pr-workflow.md` to stay under that budget,
 * leaving a pointer behind. Three things can silently undo that split, and none of
 * them is caught anywhere else in the suite:
 *
 *   1. the always-loaded file creeping back over the budget,
 *   2. the pointer being written as a Claude `@path` import — which per Claude Code's
 *      memory docs loads the target at launch, re-inflating the very context the
 *      split exists to protect, while still looking correct in the rendered file,
 *   3. rules going missing in the move, or the pointer naming a path the deploy
 *      code never writes.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import vm from "vm";

const ROOT = path.resolve(".");
const COMMON_FOLDER = "software/scripts/advanced/llm/_common";
const INSTRUCTIONS_PATH = path.join(ROOT, COMMON_FOLDER, "instructions.md");
const PR_WORKFLOW_PATH = path.join(ROOT, COMMON_FOLDER, "instructions-pr-workflow.md");
const LLM_COMMON_PATH = path.join(ROOT, "software/scripts/advanced/llm/llm-common.js");

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
/** @type {string} On-demand PR workflow rules. */
const prWorkflow = fs.readFileSync(PR_WORKFLOW_PATH, "utf-8");

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
    BASE_HOMEDIR_LINUX: "/tmp/sandbox-home",
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
 * Counts markdown list items, which is how a "rule" is expressed in both files.
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

describe("PR workflow pointer", () => {
  it("should keep a Source Control section that points at the split file", () => {
    expect(instructions).toContain("## Source Control & PRs");
    expect(instructions).toContain("pr-workflow.md");
  });

  it("should reference the pointer path in backticks so Claude does not import it", () => {
    // `@~/path/to.md` outside backticks is an import and loads at launch; backticks
    // keep it literal and on-demand. Assert the backticked form is present...
    expect(instructions).toContain("`~/sy_llm_ai/instructions/pr-workflow.md`");
    // ...and that no bare @-import of it exists anywhere in the file.
    expect(instructions).not.toMatch(/@[^\s`]*pr-workflow\.md/);
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

  it("should name a target the deploy registry actually writes", () => {
    /** @type {Record<string, string>} Target basename -> repo-relative source. */
    const registry = llm.LLM_SHARED_INSTRUCTION_FILES;
    expect(Object.keys(registry)).toContain("pr-workflow.md");
    expect(instructions).toContain(`${path.basename(llm.LLM_SHARED_INSTRUCTIONS_FOLDER)}/pr-workflow.md`);
  });
});

describe("shared instruction registry", () => {
  it("should point every registered target at a source file that exists", () => {
    for (const [target, source] of Object.entries(llm.LLM_SHARED_INSTRUCTION_FILES)) {
      expect(fs.existsSync(path.join(ROOT, source)), `${target} -> ${source}`).toBe(true);
    }
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
  it("should hold the PR rules in the split file, not the always-loaded one", () => {
    for (const lead of [
      "Every PR branches off the default branch",
      "Split by slice, never by layer",
      "Hard dependencies phase into waves",
      "Prose-only self-merge requires the PR to be standalone",
      "A bare `#<number>` is a rendering bug",
    ]) {
      expect(prWorkflow, `split file should hold: ${lead}`).toContain(lead);
      expect(instructions, `always-loaded file should not duplicate: ${lead}`).not.toContain(lead);
    }
  });

  it("should keep the combined bullet count at or above the pre-split total", () => {
    // 158 rules before the split; the pointer stub adds a few, so this can only grow.
    expect(countBullets(instructions) + countBullets(prWorkflow)).toBeGreaterThanOrEqual(158);
  });

  it("should give the split file its own top-level heading and section structure", () => {
    expect(prWorkflow.startsWith("# ")).toBe(true);
    expect(prWorkflow).toContain("## Branches, titles, commits");
    expect(prWorkflow).toContain("## Reviewing and babysitting");
  });
});

describe("plans folder references", () => {
  it("should not mention the pre-consolidation plans path anywhere in the instructions", () => {
    expect(instructions).not.toContain("sy_llm_ai_plans");
    expect(prWorkflow).not.toContain("sy_llm_ai_plans");
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
