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
import { describe, it, expect, beforeEach } from "vitest";
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
    // The legacy-folder detector does real filesystem work against temp fixtures.
    fs,
    BASE_HOMEDIR_LINUX: SANDBOX_HOME,
    // The LLM home hangs off the personal root, not the bare home folder.
    SY_HOME_FOLDER: SANDBOX_SY_HOME,
    // Deliberately empty: LLM_SHARED_ROOT_FOLDER prefers process.env.LLM_HOME_FOLDER,
    // and inheriting the real one would make these assertions depend on whoever ran them.
    process: { env: {} },
    log: () => {},
    // The legacy-folder detector frames its warning with the shared separator.
    LINE_BREAK_HASH: "#".repeat(80),
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

  it("should point each legacy folder at the destination its content belongs in", () => {
    // The plans folder is NOT the root: its content belongs under <root>/plans, so the
    // recovery command the detector prints has to carry a per-row destination.
    expect(llm.LLM_LEGACY_FOLDERS.map((row) => row.folder)).toEqual([llm.LLM_LEGACY_ROOT_FOLDER, llm.LLM_LEGACY_PLANS_FOLDER]);
    expect(llm.LLM_LEGACY_FOLDERS.map((row) => row.destination)).toEqual([llm.LLM_SHARED_ROOT_FOLDER, llm.LLM_SHARED_PLANS_FOLDER]);
    for (const { folder, destination } of llm.LLM_LEGACY_FOLDERS) {
      expect(folder).not.toBe(destination);
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

describe("legacy folder detector", () => {
  /**
   * Builds a throwaway pair of legacy folders, one holding a file and one empty, so a
   * test can assert on real filesystem state rather than a mocked existsSync.
   * @returns {{root: string, populated: string, empty: string, file: string, rows: Array<{folder: string, destination: string}>}} Fixture paths.
   */
  function makeFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sy-legacy-"));
    const populated = path.join(root, "sy_llm_ai");
    const empty = path.join(root, "sy_llm_ai_plans");
    const destination = path.join(root, "sy", "ai_llm");

    fs.mkdirSync(populated, { recursive: true });
    fs.mkdirSync(empty, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });

    const file = path.join(populated, "keep-me.md");
    fs.writeFileSync(file, "# not migrated\n");

    return {
      root,
      populated,
      empty,
      file,
      rows: [
        { folder: populated, destination },
        { folder: empty, destination: path.join(destination, "plans") },
      ],
    };
  }

  /**
   * Runs the detector with logging captured and the once-per-process latch cleared.
   * @param {Array<{folder: string, destination: string}>} rows - Rows to probe.
   * @returns {{found: Array<{folder: string, destination: string}>, logs: string[]}} Result and captured output.
   */
  function warn(rows) {
    /** @type {string[]} Everything the detector printed. */
    const logs = [];
    const previousLog = llm.log;
    llm.log = (...args) => logs.push(args.join(" "));
    try {
      return { found: llm.warnAboutLegacyLLMFolders(rows), logs };
    } finally {
      llm.log = previousLog;
    }
  }

  beforeEach(() => {
    // The latch is per-process by design; reset it so cases stay independent.
    llm._legacyLLMFolderWarningShown = false;
  });

  it("should report a legacy folder that still holds files", () => {
    const { populated, rows } = makeFixture();
    const { found, logs } = warn(rows);

    expect(found.map((row) => row.folder)).toEqual([populated]);
    expect(logs.join("\n")).toContain(populated);
  });

  it("should print each row's own destination, not the shared root for both", () => {
    const { rows } = makeFixture();
    // Give the plans row content too, so both rows report.
    fs.writeFileSync(path.join(rows[1].folder, "plan-old.md"), "# old\n");

    const { logs } = warn(rows);
    const output = logs.join("\n");

    // The plans folder belongs under <root>/plans - a shared-root destination would
    // tell the reader to dump plan files loose in the LLM home.
    expect(output).toContain(`'${rows[1].folder}/' '${rows[1].destination}/'`);
    expect(output).toContain(`'${rows[0].folder}/' '${rows[0].destination}/'`);
  });

  it("should stay silent for a legacy folder that exists but is empty", () => {
    const { empty, rows } = makeFixture();
    const { found } = warn(rows);

    expect(found.map((row) => row.folder)).not.toContain(empty);
  });

  it("should stay silent when no legacy folder is present", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sy-legacy-clean-"));
    const { found, logs } = warn([{ folder: path.join(root, "gone"), destination: root }]);

    expect(found).toEqual([]);
    expect(logs).toEqual([]);
  });

  it("should never move or delete anything it reports", () => {
    const { populated, file, rows } = makeFixture();
    warn(rows);

    // The whole point of replacing the migration with a detector: it is read-only.
    expect(fs.existsSync(populated)).toBe(true);
    expect(fs.readFileSync(file, "utf-8")).toBe("# not migrated\n");
  });

  it("should log once no matter how many deploy entry points call it", () => {
    const { rows } = makeFixture();

    const first = warn(rows);
    llm._legacyLLMFolderWarningShown = true;
    const second = warn(rows);

    expect(first.logs.length).toBeGreaterThan(0);
    expect(second.logs).toEqual([]);
    // Still reports the finding to its caller - only the printing is suppressed.
    expect(second.found.length).toBe(first.found.length);
  });

  it("should have no folder-moving machinery left behind", () => {
    const source = fs.readFileSync(LLM_COMMON_PATH, "utf-8");

    for (const gone of ["migrateLegacyLLMFolder", "ensureLLMHomeMigrated", "retargetLegacyPlanSymlinks", "LLM_LEGACY_FOLDER_MIGRATIONS"]) {
      expect(source, `${gone} should be gone now that the migration has run everywhere`).not.toContain(gone);
    }
    // No rename/copy call may creep back into the detector path.
    expect(source).not.toContain("fs.renameSync");
  });

  it("should warn from every deploy entry point before it writes into the shared home", () => {
    const source = fs.readFileSync(LLM_COMMON_PATH, "utf-8");

    for (const entry of ["deploySharedLLMInstructions", "deploySharedLLMSkills"]) {
      const body = source.slice(source.indexOf(`async function ${entry}(`));
      expect(body.indexOf("warnAboutLegacyLLMFolders()"), entry).toBeGreaterThan(-1);
      expect(body.indexOf("warnAboutLegacyLLMFolders()"), entry).toBeLessThan(body.indexOf("fs.mkdirSync"));
    }
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
