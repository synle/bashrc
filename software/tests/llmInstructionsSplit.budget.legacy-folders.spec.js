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

describe("legacy folder detector", () => {
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
