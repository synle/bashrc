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

    expect(rendered).toContain("every main agent and subagent sends a status sentence first");
    expect(rendered).toContain("within 30 words");
    expect(rendered).toContain("`IN PROGRESS`, `BLOCKED`, or `DONE`");
    expect(rendered).toContain("2 steps left \u2014 test and inspect diff.");
    expect(rendered).toContain("Subagents send updates to their parent at start, each phase boundary, and before returning.");
    expect(rendered).toContain("does not report completion until required results arrive");
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
