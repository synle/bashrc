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
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
 * Stand-in for SY_HOME_FOLDER, the personal root the LLM home hangs off.
 * @type {string}
 */
const SANDBOX_SY_HOME = `${SANDBOX_HOME}/sy`;

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
    // The LLM home hangs off the personal root, not the bare home folder.
    SY_HOME_FOLDER: SANDBOX_SY_HOME,
    // Deliberately empty: LLM_SHARED_ROOT_FOLDER prefers process.env.LLM_HOME_FOLDER,
    // and inheriting the real one would make these assertions depend on whoever ran them.
    process: { env: {} },
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

  it("should hang the shared root off the personal root, not the bare home folder", () => {
    expect(llm.LLM_SHARED_ROOT_FOLDER).toBe(`${SANDBOX_SY_HOME}/ai_llm`);
    expect(llm.LLM_SHARED_ROOT_FOLDER.startsWith(SANDBOX_SY_HOME)).toBe(true);
  });

  it("should migrate the whole legacy root before the older standalone plans folder", () => {
    // Order is load-bearing: the root move must land <old-root>/plans under the new
    // root first, or the plans migration fills a folder that is about to move again.
    expect(llm.LLM_LEGACY_FOLDER_MIGRATIONS.map((m) => m.from)).toEqual([llm.LLM_LEGACY_ROOT_FOLDER, llm.LLM_LEGACY_PLANS_FOLDER]);
    expect(llm.LLM_LEGACY_FOLDER_MIGRATIONS.map((m) => m.to)).toEqual([llm.LLM_SHARED_ROOT_FOLDER, llm.LLM_SHARED_PLANS_FOLDER]);
    for (const { from, to, label } of llm.LLM_LEGACY_FOLDER_MIGRATIONS) {
      expect(from, label).not.toBe(to);
      expect(label.length).toBeGreaterThan(0);
    }
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
    expect(instructions).toContain("~/sy/ai_llm/plans/");
  });

  it("should not name the pre-consolidation LLM home anywhere", () => {
    for (const { target, text } of splitFiles) {
      expect(text, `${target} should not name the legacy LLM home`).not.toContain("sy_llm_ai");
    }
    expect(instructions).not.toContain("sy_llm_ai");
  });
});

describe("legacy plan symlink retargeting", () => {
  /**
   * Builds a throwaway plans folder holding one cross-repo symlink that still points
   * at the pre-consolidation location, mirroring what the real migration hit.
   * @returns {{plans: string, legacy: string, legacyRoot: string, link: string, target: string}} Paths under a temp root.
   */
  function makeFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sy-plans-"));
    const legacy = path.join(root, "sy_llm_ai_plans");
    const legacyRoot = path.join(root, "sy_llm_ai");
    const plans = path.join(root, "sy", "ai_llm", "plans");

    fs.mkdirSync(path.join(plans, "repo-a"), { recursive: true });
    fs.mkdirSync(path.join(plans, "repo-b"), { recursive: true });

    const target = path.join(plans, "repo-b", "plan-shared.md");
    fs.writeFileSync(target, "# shared plan\n");

    // The link still names the OLD folder, exactly as `mv` would leave it.
    const link = path.join(plans, "repo-a", "plan-shared.md");
    fs.symlinkSync(path.join(legacy, "repo-b", "plan-shared.md"), link);

    return { plans, legacy, legacyRoot, link, target };
  }

  /**
   * Wraps a single legacy folder as the migration registry the function now takes.
   * @param {string} from - Old folder.
   * @param {string} to - New folder.
   * @returns {Array<{from: string, to: string}>} One-row registry.
   */
  const asMigrations = (from, to) => [{ from, to, label: "test" }];

  it("should repoint a legacy symlink at the new folder", () => {
    const { plans, legacy, link, target } = makeFixture();
    expect(fs.existsSync(link)).toBe(false); // dangling before the repair

    expect(llm.retargetLegacyPlanSymlinks(plans, asMigrations(legacy, plans))).toBe(1);

    expect(fs.readlinkSync(link)).toBe(target);
    expect(fs.readFileSync(link, "utf-8")).toBe("# shared plan\n");
  });

  it("should be idempotent on a second pass", () => {
    const { plans, legacy } = makeFixture();
    expect(llm.retargetLegacyPlanSymlinks(plans, asMigrations(legacy, plans))).toBe(1);
    expect(llm.retargetLegacyPlanSymlinks(plans, asMigrations(legacy, plans))).toBe(0);
  });

  it("should leave a link whose retargeted destination is missing", () => {
    const { plans, legacy, link, target } = makeFixture();
    fs.rmSync(target);

    expect(llm.retargetLegacyPlanSymlinks(plans, asMigrations(legacy, plans))).toBe(0);
    expect(fs.readlinkSync(link)).toContain("sy_llm_ai_plans");
  });

  it("should not touch a symlink that already points at the new folder", () => {
    const { plans, legacy, link, target } = makeFixture();
    fs.unlinkSync(link);
    fs.symlinkSync(target, link);

    expect(llm.retargetLegacyPlanSymlinks(plans, asMigrations(legacy, plans))).toBe(0);
    expect(fs.readlinkSync(link)).toBe(target);
  });

  it("should no-op when the plans folder does not exist", () => {
    expect(llm.retargetLegacyPlanSymlinks("/tmp/definitely-not-here-xyz", asMigrations("/tmp/legacy-xyz", "/tmp/x"))).toBe(0);
  });

  it("should rebase a link that pointed inside the whole legacy root", () => {
    // The root move is the second migration: a plan link written before it names
    // <old-root>/plans/..., which has to land at <new-root>/plans/... .
    const { plans, legacyRoot, link, target } = makeFixture();
    const newRoot = path.dirname(plans);

    fs.unlinkSync(link);
    fs.symlinkSync(path.join(legacyRoot, "plans", "repo-b", "plan-shared.md"), link);

    expect(llm.retargetLegacyPlanSymlinks(plans, asMigrations(legacyRoot, newRoot))).toBe(1);
    expect(fs.readlinkSync(link)).toBe(target);
  });

  it("should not treat the legacy root as a prefix of the legacy plans folder", () => {
    // "<root>/sy_llm_ai" is a string prefix of "<root>/sy_llm_ai_plans", so a bare
    // startsWith would rebase a plans link onto the root migration and produce
    // <new-root>/_plans/... . Registry order puts the root first precisely so this
    // case is exercised in the same order production runs it.
    const { plans, legacy, legacyRoot, link, target } = makeFixture();
    const newRoot = path.dirname(plans);

    expect(
      llm.retargetLegacyPlanSymlinks(plans, [
        { from: legacyRoot, to: newRoot, label: "llm home" },
        { from: legacy, to: plans, label: "plans" },
      ]),
    ).toBe(1);

    expect(fs.readlinkSync(link)).toBe(target);
  });
});

describe("one-time legacy folder migration", () => {
  /** @type {string} Throwaway root recreated per test so nothing leaks between cases. */
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync("/tmp/llm-migrate-");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  /**
   * Seeds a file at `<root>/<relative>`, creating parents as needed.
   *
   * @param {string} relative - Path relative to the throwaway root.
   * @param {string} body - File contents.
   * @returns {string} The absolute path written.
   */
  function seed(relative, body) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
    return full;
  }

  it("should move every entry and delete the legacy folder", async () => {
    seed("old/instructions/testing.md", "testing");
    seed("old/skills/sy-foo/SKILL.md", "foo");

    const moved = await llm.migrateLegacyLLMFolder(path.join(root, "old"), path.join(root, "new"), "llm home");

    expect(moved).toBe(2);
    expect(fs.existsSync(path.join(root, "old"))).toBe(false);
    expect(fs.readFileSync(path.join(root, "new/instructions/testing.md"), "utf-8")).toBe("testing");
    expect(fs.readFileSync(path.join(root, "new/skills/sy-foo/SKILL.md"), "utf-8")).toBe("foo");
  });

  it("should keep the source when an entry already exists at the destination", async () => {
    seed("old/plans/a.md", "legacy");
    seed("old/plans/b.md", "also legacy");
    seed("new/plans/a.md", "already migrated");

    const moved = await llm.migrateLegacyLLMFolder(path.join(root, "old"), path.join(root, "new"), "llm home");

    // Only `plans` collides, so nothing under it moves and the legacy tree survives
    // for the user to reconcile by hand rather than being silently destroyed.
    expect(moved).toBe(0);
    expect(fs.existsSync(path.join(root, "old/plans/a.md"))).toBe(true);
    expect(fs.readFileSync(path.join(root, "new/plans/a.md"), "utf-8")).toBe("already migrated");
  });

  it("should no-op when the legacy folder is absent", async () => {
    const moved = await llm.migrateLegacyLLMFolder(path.join(root, "missing"), path.join(root, "new"), "llm home");

    expect(moved).toBe(0);
    expect(fs.existsSync(path.join(root, "new"))).toBe(false);
  });

  it("should no-op when source and destination are the same folder", async () => {
    seed("same/keep.md", "keep");

    const moved = await llm.migrateLegacyLLMFolder(path.join(root, "same"), path.join(root, "nested", "..", "same"), "llm home");

    expect(moved).toBe(0);
    expect(fs.readFileSync(path.join(root, "same/keep.md"), "utf-8")).toBe("keep");
  });

  it("should be idempotent on a second pass", async () => {
    seed("old/skills/sy-foo/SKILL.md", "foo");

    const first = await llm.migrateLegacyLLMFolder(path.join(root, "old"), path.join(root, "new"), "llm home");
    const second = await llm.migrateLegacyLLMFolder(path.join(root, "old"), path.join(root, "new"), "llm home");

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(fs.readFileSync(path.join(root, "new/skills/sy-foo/SKILL.md"), "utf-8")).toBe("foo");
  });

  it("should run every registry row and land the plans folder inside the migrated root", async () => {
    // Mirrors the real shape: the whole legacy root moves first, then the older
    // standalone plans folder lands inside the folder the first row just created.
    seed("legacy-root/instructions/testing.md", "testing");
    seed("legacy-plans/bashrc/plan-2026-01-01-x.md", "plan");

    const moved = await llm.migrateLegacyLLMFolders([
      { from: path.join(root, "legacy-root"), to: path.join(root, "home"), label: "llm home" },
      { from: path.join(root, "legacy-plans"), to: path.join(root, "home/plans"), label: "plans" },
    ]);

    expect(moved).toBe(2);
    expect(fs.existsSync(path.join(root, "legacy-root"))).toBe(false);
    expect(fs.existsSync(path.join(root, "legacy-plans"))).toBe(false);
    expect(fs.readFileSync(path.join(root, "home/instructions/testing.md"), "utf-8")).toBe("testing");
    expect(fs.readFileSync(path.join(root, "home/plans/bashrc/plan-2026-01-01-x.md"), "utf-8")).toBe("plan");
  });
});

describe("migration ordering guard", () => {
  it("should expose a memoized guard that both deploy entry points await", () => {
    const source = fs.readFileSync(LLM_COMMON_PATH, "utf-8");

    // The bug this pins: deploySharedLLMSkills() used to mkdir the new skills folder
    // before any migration ran, so migrateLegacyLLMFolder saw `skills` already at the
    // destination, skipped it, and left the legacy home behind on every future run.
    const skillsDeploy = source.slice(source.indexOf("async function deploySharedLLMSkills()"));
    const guardAt = skillsDeploy.indexOf("await ensureLLMHomeMigrated()");
    const mkdirAt = skillsDeploy.indexOf("fs.mkdirSync(LLM_SHARED_SKILLS_FOLDER");

    expect(guardAt).toBeGreaterThan(-1);
    expect(mkdirAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(mkdirAt);

    const instructionsDeploy = source.slice(source.indexOf("async function deploySharedLLMInstructions()"));
    expect(instructionsDeploy.indexOf("await ensureLLMHomeMigrated()")).toBeGreaterThan(-1);

    // Nothing may call the raw walker directly — that is how the ordering bug returns.
    expect(source.match(/await migrateLegacyLLMFolders\(\)/g)).toBeNull();
  });

  it("should run the migration only once across repeated calls", async () => {
    const first = await llm.ensureLLMHomeMigrated();
    const second = await llm.ensureLLMHomeMigrated();

    expect(typeof first).toBe("number");
    expect(second).toBe(first);
  });
});

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
