/** Exercises Gemini setup against real skill folders to prove name-based migration preserves user data. */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getIndexFunction, loadScriptHelpers, setSandboxGlobal } from "./setup.js";

/** Setup boundaries unrelated to skill discovery. */
const OTHER_DEPLOYMENTS = [
  "deploySharedMcpServers",
  "_doGeminiSettingsWork",
  "_doGeminiKeysWork",
  "deploySharedLLMInstructions",
  "_doGeminiInstructionsWork",
  "deploySharedLLMSkills",
  "deploySharedLLMAgents",
];
/** Per-test owned home; never points to the real user profile. */
let home;
/** Original sandbox filesystem restored after each real-filesystem integration test. */
let originalFs;
/** Active Gemini discovery root inside the owned fixture. */
let gemini;
/** Canonical interoperable skill root inside the owned fixture. */
let agents;

/** Creates a valid fixture skill and returns its folder. */
function skill(root, name, body = "kept") {
  const folder = path.join(root, name);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "SKILL.md"), `---\nname: ${name}\ndescription: Fixture skill.\n---\n${body}\n`);
  return folder;
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "gemini skills "));
  gemini = path.join(home, ".gemini", "skills");
  agents = path.join(home, ".agents", "skills");
  loadScriptHelpers("software/scripts/advanced/llm/gemini/setup.js");
  originalFs = getIndexFunction("fs");
  setSandboxGlobal("fs", fs);
  setSandboxGlobal("BASE_HOMEDIR_LINUX", home);
  setSandboxGlobal("isBinaryFound", async () => true);
  setSandboxGlobal("mkdir", async (folder) => fs.mkdirSync(folder, { recursive: true }));
  for (const name of OTHER_DEPLOYMENTS) setSandboxGlobal(name, async () => {});
});

afterEach(() => {
  setSandboxGlobal("fs", originalFs);
  fs.rmSync(home, { recursive: true, force: true });
});

describe("Gemini canonical skill migration", () => {
  it("unlinks a same-name duplicate without modifying the canonical skill or Gemini-only skills", async () => {
    const canonical = skill(agents, "shared");
    const before = fs.readFileSync(path.join(canonical, "SKILL.md"), "utf8");
    skill(gemini, "gemini-only");
    fs.symlinkSync(canonical, path.join(gemini, "shared"));

    await getIndexFunction("doWork")();

    expect(fs.readdirSync(gemini)).toEqual(["gemini-only"]);
    expect(fs.readFileSync(path.join(canonical, "SKILL.md"), "utf8")).toBe(before);
    expect(fs.existsSync(path.join(gemini, "gemini-only", "SKILL.md"))).toBe(true);
  });

  it("matches folder names rather than Sy ownership or symlink target identity", async () => {
    skill(agents, "same-name");
    const foreign = skill(path.join(home, "foreign"), "different-name");
    fs.mkdirSync(gemini, { recursive: true });
    fs.symlinkSync(foreign, path.join(gemini, "same-name"));

    await getIndexFunction("doWork")();

    expect(fs.readdirSync(gemini)).toEqual([]);
    expect(fs.existsSync(path.join(foreign, "SKILL.md"))).toBe(true);
  });

  it("backs up a real duplicate folder and extra user files outside Gemini discovery", async () => {
    skill(agents, "shared", "canonical");
    const duplicate = skill(gemini, "shared", "user content");
    fs.writeFileSync(path.join(duplicate, "notes.txt"), "do not lose");
    skill(agents, "shared-two");
    skill(gemini, "shared-two", "second user skill");
    const before = fs.readFileSync(path.join(duplicate, "SKILL.md"), "utf8");

    await getIndexFunction("doWork")();

    expect(fs.readdirSync(gemini)).toEqual([]);
    const backups = fs.readdirSync(path.dirname(gemini)).filter((name) => name.startsWith("skills-backup-"));
    expect(backups).toHaveLength(1);
    const backedUp = path.join(path.dirname(gemini), backups[0], "shared");
    expect(fs.readFileSync(path.join(backedUp, "SKILL.md"), "utf8")).toBe(before);
    expect(fs.readFileSync(path.join(backedUp, "notes.txt"), "utf8")).toBe("do not lose");
    expect(fs.existsSync(path.join(path.dirname(backedUp), "shared-two", "SKILL.md"))).toBe(true);
  });

  it("keeps a Gemini skill when the same-name .agents entry is not a valid skill", async () => {
    fs.mkdirSync(path.join(agents, "shared"), { recursive: true });
    const local = skill(gemini, "shared");

    await getIndexFunction("doWork")();

    expect(fs.existsSync(path.join(local, "SKILL.md"))).toBe(true);
  });

  it("leaves Gemini skills intact when the canonical root is absent", async () => {
    const local = skill(gemini, "unique");

    await getIndexFunction("doWork")();

    expect(fs.existsSync(path.join(local, "SKILL.md"))).toBe(true);
    expect(fs.existsSync(agents)).toBe(false);
  });

  it("does not create a Gemini skills root when only canonical skills exist", async () => {
    skill(agents, "shared");

    await getIndexFunction("doWork")();

    expect(fs.existsSync(gemini)).toBe(false);
  });

  it("refuses a symlinked Gemini root instead of removing skills through it", async () => {
    const canonical = skill(agents, "shared");
    fs.mkdirSync(path.dirname(gemini), { recursive: true });
    fs.symlinkSync(agents, gemini);

    await expect(getIndexFunction("doWork")()).rejects.toThrow("Gemini skills root must not be a symlink");

    expect(fs.existsSync(path.join(canonical, "SKILL.md"))).toBe(true);
    expect(fs.lstatSync(gemini).isSymbolicLink()).toBe(true);
  });

  it("keeps Gemini entries when the canonical SKILL.md is a folder rather than a file", async () => {
    fs.mkdirSync(path.join(agents, "shared", "SKILL.md"), { recursive: true });
    skill(gemini, "shared");
    await getIndexFunction("doWork")();
    expect(fs.readdirSync(gemini)).toEqual(["shared"]);
  });

  it("refuses to remove a real folder that the canonical skill still points into", async () => {
    const local = skill(gemini, "shared");
    fs.mkdirSync(agents, { recursive: true });
    fs.symlinkSync(local, path.join(agents, "shared"));
    await expect(getIndexFunction("doWork")()).rejects.toThrow("Canonical skill must not live inside Gemini skills root");
    expect(fs.existsSync(path.join(local, "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(agents, "shared", "SKILL.md"))).toBe(true);
  });

  it("stays stable on a second setup without making more backups", async () => {
    skill(agents, "shared");
    skill(gemini, "shared");
    skill(gemini, "unique");
    await getIndexFunction("doWork")();
    const first = fs.readdirSync(path.dirname(gemini));

    await getIndexFunction("doWork")();

    expect(fs.readdirSync(path.dirname(gemini))).toEqual(first);
    expect(fs.readdirSync(gemini)).toEqual(["unique"]);
  });
});
