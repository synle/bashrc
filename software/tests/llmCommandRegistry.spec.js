/**
 * Registry integrity for the Sy-managed LLM command corpus.
 *
 * `LLM_COMMAND_DEPLOY_MAP` in `llm-common.js` is the single registry every CLI's
 * `setup.js` iterates (see AGENTS.md §13.1). Nothing else in the suite checks that
 * its entries actually resolve, so a typo in a value would deploy a command whose
 * body is missing — silently, on every machine, with no gate failing. These tests
 * close that gap from both directions: every registered command has a source file,
 * and every source file is registered.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

const ROOT = path.resolve(".");
const LLM_COMMON_PATH = path.join(ROOT, "software/scripts/advanced/llm/llm-common.js");

/**
 * Evaluates `llm-common.js` in a sandbox and returns its top-level declarations.
 *
 * `const`/`let` are rewritten to `var` so every top-level declaration becomes a
 * sandbox property, matching the approach already used by `llmMcpRegistry.spec.js`.
 * Only the globals referenced during top-level evaluation need seeding — the file
 * declares functions and constants, so nothing that touches the filesystem runs.
 *
 * @returns {Record<string, any>} The populated sandbox.
 */
function loadLlmCommon() {
  const source = fs.readFileSync(LLM_COMMON_PATH, "utf-8").replace(/^(const|let) /gm, "var ");
  /** @type {Record<string, any>} */
  const sandbox = {
    path,
    // llm-common.js builds ~/sy_llm_ai/* paths from this at top level.
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
/** @type {Record<string, string>} Deployed command name (no extension) -> source basename. */
const DEPLOY_MAP = llm.LLM_COMMAND_DEPLOY_MAP;
/** @type {string[]} Command names we no longer deploy and must sweep off dev machines. */
const RETIRED = llm.LLM_COMMAND_RETIRED_NAMES;
/** @type {string} Repo-relative folder holding every command body. */
const SOURCE_FOLDER = llm.LLM_COMMAND_SOURCE_FOLDER;
/** @type {string} First-line prefix every command body carries. */
const MARKER = llm.LLM_SKILL_MARKER;

/**
 * Absolute path to a command body given its source basename.
 * @param {string} sourceName - A `LLM_COMMAND_DEPLOY_MAP` value, no `.md`.
 * @returns {string} Absolute path to the `.md` file.
 */
function sourcePath(sourceName) {
  return path.join(ROOT, SOURCE_FOLDER, `${sourceName}.md`);
}

/** @type {string[]} Every `.md` basename actually present in the source folder. */
const filesOnDisk = fs
  .readdirSync(path.join(ROOT, SOURCE_FOLDER))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""));

// ---- Constants resolve ----

describe("llm-common.js registry constants", () => {
  it("exposes a non-empty LLM_COMMAND_DEPLOY_MAP", () => {
    expect(DEPLOY_MAP).toBeTypeOf("object");
    expect(Object.keys(DEPLOY_MAP).length).toBeGreaterThan(0);
  });

  it("exposes the source folder and skill marker the deploy loop depends on", () => {
    expect(SOURCE_FOLDER).toBe("software/scripts/advanced/llm/_common/commands");
    expect(MARKER).toBe("[Sy] ");
    expect(fs.existsSync(path.join(ROOT, SOURCE_FOLDER))).toBe(true);
  });

  it("exposes LLM_COMMAND_RETIRED_NAMES as an array of strings", () => {
    expect(Array.isArray(RETIRED)).toBe(true);
    for (const name of RETIRED) expect(name).toBeTypeOf("string");
  });
});

// ---- Shared skills folder ----

describe("shared skills deploy constants", () => {
  it("puts the one physical skill copy under ~/sy_llm_ai/skills", () => {
    expect(llm.LLM_SHARED_SKILLS_FOLDER).toBe("/tmp/sandbox-home/sy_llm_ai/skills");
  });

  it("links every skill into each CLI's own skills folder, per-skill (never a folder symlink)", () => {
    expect(llm.LLM_SKILL_LINK_FOLDERS).toEqual([
      "/tmp/sandbox-home/.claude/skills",
      "/tmp/sandbox-home/.copilot/skills",
      "/tmp/sandbox-home/.config/opencode/skills",
      "/tmp/sandbox-home/.gemini/skills",
      "/tmp/sandbox-home/.agents/skills",
    ]);
  });

  it("derives a YAML-safe, length-capped description from the [Sy] first line", () => {
    expect(llm.buildLLMSkillDescription('[Sy] Review a PR "carefully".\n\nbody')).toBe('Review a PR \\"carefully\\".');
    expect(llm.buildLLMSkillDescription(`[Sy] ${"x".repeat(500)}`)).toHaveLength(llm.LLM_SKILL_DESCRIPTION_MAX);
  });

  it("keeps the one-time legacy sweep flag and its folder list side by side", () => {
    // When the flag is finally flipped to false, delete cleanupLegacySySkillArtifacts,
    // LLM_LEGACY_SY_ARTIFACT_FOLDERS, and this test together.
    expect(llm.LLM_ONE_TIME_SY_CLEANUP_ENABLED).toBeTypeOf("boolean");
    expect(llm.LLM_LEGACY_SY_ARTIFACT_FOLDERS).toContain("/tmp/sandbox-home/.claude/commands");
    expect(llm.LLM_LEGACY_SY_ARTIFACT_FOLDERS).toContain("/tmp/sandbox-home/.config/opencode/commands");
  });
});

// ---- Every registered command resolves to a real body ----

describe("LLM_COMMAND_DEPLOY_MAP -> source files", () => {
  it("every registered command has a source file on disk", () => {
    const missing = Object.entries(DEPLOY_MAP)
      .filter(([, sourceName]) => !fs.existsSync(sourcePath(sourceName)))
      .map(([key, sourceName]) => `${key} -> ${SOURCE_FOLDER}/${sourceName}.md`);
    expect(missing, `registered commands with no source file:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every source file is registered — no orphans left behind by a rename", () => {
    const referenced = new Set(Object.values(DEPLOY_MAP));
    const orphans = filesOnDisk.filter((name) => !referenced.has(name));
    expect(
      orphans,
      `command bodies present but not in LLM_COMMAND_DEPLOY_MAP (add an entry or delete the file):\n${orphans.join("\n")}`,
    ).toEqual([]);
  });

  it("every command body is non-empty and starts with the [Sy] marker", () => {
    const bad = [];
    for (const sourceName of new Set(Object.values(DEPLOY_MAP))) {
      const body = fs.readFileSync(sourcePath(sourceName), "utf-8");
      if (body.trim().length === 0) bad.push(`${sourceName}.md: empty`);
      else if (!body.startsWith(MARKER)) bad.push(`${sourceName}.md: first line must start with "${MARKER}"`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("every command body has a single-line description after the marker", () => {
    const bad = [];
    for (const sourceName of new Set(Object.values(DEPLOY_MAP))) {
      const firstLine = fs.readFileSync(sourcePath(sourceName), "utf-8").split("\n")[0];
      const description = firstLine.slice(MARKER.length).trim();
      if (description.length < 20) bad.push(`${sourceName}.md: description too short to be useful ("${description}")`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});

// ---- Key hygiene ----

describe("LLM_COMMAND_DEPLOY_MAP key hygiene", () => {
  it("every key is sy- prefixed so Sy commands cluster and never collide", () => {
    const bad = Object.keys(DEPLOY_MAP).filter((key) => !key.startsWith("sy-"));
    expect(bad, `keys missing the sy- prefix: ${bad.join(", ")}`).toEqual([]);
  });

  it("every key is extension-less — the folder-based CLIs append their own", () => {
    const bad = Object.keys(DEPLOY_MAP).filter((key) => key.endsWith(".md"));
    expect(bad, `keys must not carry an extension: ${bad.join(", ")}`).toEqual([]);
  });

  it("keys are sorted alphabetically so the deploy order is readable", () => {
    const keys = Object.keys(DEPLOY_MAP);
    expect(keys).toEqual([...keys].sort());
  });

  it("no retired name is still registered as a live command", () => {
    const live = new Set(Object.keys(DEPLOY_MAP));
    const conflicts = RETIRED.filter((name) => live.has(name));
    expect(
      conflicts,
      `names in both LLM_COMMAND_RETIRED_NAMES and LLM_COMMAND_DEPLOY_MAP — a live command would be swept off disk: ${conflicts.join(", ")}`,
    ).toEqual([]);
  });
});
