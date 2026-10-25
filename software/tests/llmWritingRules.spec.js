/** Verifies shared prose limits and meaning-preserving guidance authoring checks. */
import { beforeEach, describe, expect, it } from "vitest";
import { getIndexConstant, getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";
import fs from "fs";
import path from "path";

/** @type {string} Active shared guidance source folder. */
const SOURCE_FOLDER = "software/scripts/advanced/llm/_common/v_current";
/** @type {string} Shared tuning token used by both authoring surfaces. */
const SENTENCE_LIMIT_TOKEN = "<<SY_PROSE_SENTENCE_MAX_WORDS>>";
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
