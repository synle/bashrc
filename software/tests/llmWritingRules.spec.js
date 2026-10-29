/** Verifies shared prose limits and meaning-preserving guidance authoring checks. */
import { beforeEach, describe, expect, it } from "vitest";
import { getIndexConstant, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";
import fs from "fs";
import path from "path";

/** @type {string} Active shared guidance source folder. */
const SOURCE_FOLDER = "software/scripts/advanced/llm/_common/v_current";
/** @type {string} Shared tuning token used by both authoring surfaces. */
const SENTENCE_LIMIT_TOKEN = "<<SY_PROSE_SENTENCE_MAX_WORDS>>";
/** @type {string} Canonical short labels repeated verbatim at each writing-rule entry point. */
const WRITING_CHECKLIST = [
  "- **Apply Writing Rules from `instructions.md`.**",
  "- **One idea per sentence.**",
  "- **ASD-STE100-inspired sentence limit.**",
  "- **Meaning never dropped.**",
  "- **No theater.**",
  "- **Trim restatement, never a rule.**",
  "- **Preserve named-rule names verbatim.**",
  "- **Meaning has one home.**",
  "- **The environment is a source of truth.**",
  "- **Never invent a rule while cleaning.**",
].join("\n");
/** @type {string} Current cleanup-skill source, before deployment rendering. */
const cleanup = fs.readFileSync(path.join(SOURCE_FOLDER, "skills/clean-instructions.md"), "utf-8");

beforeEach(() => loadScriptHelpers("software/scripts/advanced/llm/llm-common.js"));

describe("shared guidance sentence limit", () => {
  it.each(["instructions.md", "skills/clean-instructions.md"])("renders the existing default limit in %s", (sourceName) => {
    const source = fs.readFileSync(path.join(SOURCE_FOLDER, sourceName), "utf-8");
    const rendered = getIndexFunction("resolveLLMDocPlaceholders")(source);

    expect(source).toContain(SENTENCE_LIMIT_TOKEN);
    expect(rendered).toContain("at most 30 words per prose sentence");
    expect(rendered).not.toContain(SENTENCE_LIMIT_TOKEN);
  });

  it.each(["instructions.md", "skills/clean-instructions.md"])("honors a shared limit change in %s", (sourceName) => {
    const tuning = getIndexConstant("LLM_DOC_TUNING_PLACEHOLDERS");
    setSandboxGlobal("LLM_DOC_TUNING_PLACEHOLDERS", { ...tuning, [SENTENCE_LIMIT_TOKEN]: "25" });
    const source = fs.readFileSync(path.join(SOURCE_FOLDER, sourceName), "utf-8");
    const rendered = getIndexFunction("resolveLLMDocPlaceholders")(source);

    expect(rendered).toContain("at most 25 words per prose sentence");
    expect(rendered).not.toContain("at most 30 words per prose sentence");
    expect(rendered).not.toContain(SENTENCE_LIMIT_TOKEN);
  });
});

describe("shared milestone status guidance", () => {
  it("requires bounded, explicit progress updates from main agents and subagents", () => {
    const source = fs.readFileSync(path.join(SOURCE_FOLDER, "instructions.md"), "utf-8");
    const rendered = getIndexFunction("resolveLLMDocPlaceholders")(source);

    expect(rendered).toContain("/instructions/progress-updates.md");
  });
});

describe("shared skill invocation semantics", () => {
  it("loads workflow instructions inline without treating shell launchers as prerequisites", () => {
    const source = fs.readFileSync(path.join(SOURCE_FOLDER, "instructions.md"), "utf8");
    const skills = source.split("## Agent Skills\n", 2)[1].split("\n## ", 1)[0];
    expect(skills).toContain("**Skill invocation**");
    expect(skills).toContain("host's skill tool");
    expect(skills).toContain("canonical `SKILL.md`");
    expect(skills).toContain("execute inline");
    expect(skills).toContain("same-named terminal launchers as skill prerequisites");
    expect(skills).toContain("Starting another agent requires separate authority.");
    expect(skills).toContain("Native-tool checks and mandatory safety gates remain independent.");
  });

  it("preserves skill homes, discovery, portability, and ownership while tightening the section", () => {
    const source = fs.readFileSync(path.join(SOURCE_FOLDER, "instructions.md"), "utf8");
    const skills = source.split("## Agent Skills\n", 2)[1].split("\n## ", 1)[0];
    expect(skills).toContain("Repo-local skills win collisions.");
    expect(skills).toContain("<repo>/.agents/skills/<name>/SKILL.md");
    expect(skills).toContain("~/.agents/skills/<name>/SKILL.md");
    expect(skills).toContain("registry-owned sources/deployment");
    expect(skills).toContain("CLI-native and plugin locations");
    expect(skills).toContain("preserve content when consolidating");
    expect(skills).toContain("verified CLI discovery");
    expect(skills).toContain("never duplicate bodies or overwrite unrelated files");
    expect(skills).toContain("kebab-case");
    expect(skills).toContain("`name` and `description`");
    expect(skills).toContain("what it does and when to use it");
    expect(skills).toContain(".opencode/commands");
    expect(skills).toContain("same-commit registration");
    expect(skills).toContain("per-CLI command lists");
  });

  it("executes loaded sync steps inline without a same-named shell command and retains the secret gate", () => {
    const sync = fs.readFileSync(path.join(SOURCE_FOLDER, "skills/sync-pr-branch.md"), "utf8");
    expect(sync).toContain("Once loaded, execute these steps inline");
    expect(sync).toContain("Do not probe or invoke a shell command named `sy-sync-pr-branch`");
    expect(sync).toContain("argument payload, not a shell command");
    expect(sync).toContain("plus a secret scan of");
    expect(sync).toContain("git log @{u}..HEAD -p");
  });

  it("keeps internal sync argument examples separate from terminal commands", () => {
    const body = fs.readFileSync(path.join(SOURCE_FOLDER, "skills/babysit-pr.md"), "utf8");
    expect(body.includes("`/sy-sync-pr-branch <PR-URL>")).toBe(false);
    expect(body.includes("`<PR-URL> workspace=<resolved-checkout> server-side=never report=structured`")).toBe(true);
  });

  it.each([
    `${SOURCE_FOLDER}/instructions-pr-workflow.md`,
    `${SOURCE_FOLDER}/skills/pr-reconciliation-pass.md`,
    `${SOURCE_FOLDER}/skills/babysit-pr.md`,
    "software/scripts/advanced/llm/_common/upstream-adapters.common.md",
  ])("keeps the shared invocation rule explicit at composition seam %s", (sourcePath) => {
    expect(fs.readFileSync(sourcePath, "utf8")).toContain("**Skill invocation**");
  });
});

describe("shared writing checklist", () => {
  it("keeps the canonical short list separate from its complete explanations", () => {
    expect(cleanup).toContain(`## Hard rules\n\n${WRITING_CHECKLIST}\n\n## Checklist details\n`);
  });

  it.each([
    ["AGENTS.md", `${SOURCE_FOLDER}/skills/clean-instructions.md`],
    [".agents/skills/refresh-llm-guidance/SKILL.md", `${SOURCE_FOLDER}/skills/clean-instructions.md`],
    [`${SOURCE_FOLDER}/instructions.md`, "<<LLM_ROOT_FOLDER>>/skills/sy-clean-instructions/SKILL.md"],
    [`${SOURCE_FOLDER}/instructions-persona.md`, "<<LLM_ROOT_FOLDER>>/skills/sy-clean-instructions/SKILL.md"],
    [`${SOURCE_FOLDER}/skills/migrate-cross-agent-skills-and-context.md`, "<<LLM_ROOT_FOLDER>>/skills/sy-clean-instructions/SKILL.md"],
  ])("lists every label verbatim and points to full details in %s", (sourceName, checklistPath) => {
    const source = fs.readFileSync(sourceName, "utf-8");

    expect(source).toContain(WRITING_CHECKLIST);
    expect(source).toContain(`\`${checklistPath}\``);
  });

  it.each(["instructions.md", "instructions-persona.md", "skills/migrate-cross-agent-skills-and-context.md"])(
    "renders a usable full-checklist path in %s",
    (sourceName) => {
      const source = fs.readFileSync(path.join(SOURCE_FOLDER, sourceName), "utf-8");
      const rendered = getIndexFunction("resolveLLMDocPlaceholders")(source);
      const skillsFolder = getIndexConstant("LLM_SHARED_SKILLS_FOLDER");

      expect(rendered).toContain(`\`${skillsFolder}/sy-clean-instructions/SKILL.md\``);
      expect(rendered).not.toContain("<<LLM_ROOT_FOLDER>>");
    },
  );
});

describe("guidance cleanup writing checks", () => {
  it("requires controlled English without inventing actors or weakening conditions", () => {
    expect(cleanup).toContain("ASD-STE100-inspired controlled English");
    expect(cleanup).toContain("active voice");
    expect(cleanup).toContain("one established term per concept");
    expect(cleanup).toContain("Keep conditions and exceptions attached to their actions.");
    expect(cleanup).toContain("Never invent an actor or certainty to force active voice.");
  });

  it("preserves negation, exact numbers and units, and safety boundaries", () => {
    expect(cleanup).toContain("**Meaning never dropped.**");
    expect(cleanup).toContain("Optional articles may go.");
    expect(cleanup).toContain("Never drop `not`, `never`, `no`, or `only`.");
    expect(cleanup).toContain("Keep numbers and units exact.");
    expect(cleanup).toContain("safety gates");
  });

  it("excludes theatrical phrasing and unnecessary chatter while retaining required checkpoints", () => {
    expect(cleanup).toContain("**No theater.**");
    expect(cleanup).toContain('No "me think", roleplay, or chatter between tool calls.');
    expect(cleanup).toContain("Keep required progress checkpoints.");
    expect(cleanup).toContain("If Caveman phrasing is not shorter, use plain prose.");
    expect(cleanup).toContain("Write rules and skills in precise standard English.");
  });
});
