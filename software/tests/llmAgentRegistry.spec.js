/** Filesystem regressions for retiring managed skills and PR workers without deleting private artifacts. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expandSourceMarkers, getIndexFunction } from "./setup.js";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";

/** @type {string} Repository containing the production deployment source. */
const ROOT = path.resolve(".");
/** @type {Function} Production document placeholder resolver. */
const resolvePlaceholders = getIndexFunction("resolvePlaceholders");
/** @type {string[]} Every previously deployed PR worker name. */
const RETIRED_WORKERS = [
  "pr-babysitter",
  "pr-reviewer",
  "sy-pr-babysitter",
  "sy-pr-reviewer",
  "sy-agent-pr-babysitter",
  "sy-agent-pr-reviewer",
];
/** @type {string[]} Unused skill names that must disappear from managed deployment. */
const RETIRED_UNUSED_SKILLS = [
  "sy-maintenance-day",
  "sy-squash-unpushed",
  "sy-sync-and-clean-repo",
  "sy-sync-and-clean-repos",
  "sy-merge",
  "sy-release",
  "sy-close-stale-prs",
  "sy-create-pr",
  "sy-draft-pr",
];

/**
 * Loads production deployment functions into a test-owned filesystem home.
 * @param {string} home - Unique temporary configuration home.
 * @returns {Record<string, any>} Production declarations with isolated side effects.
 * @throws {Error} If source reading, evaluation, or filesystem operations fail.
 */
function loadDeployment(home) {
  /** @type {string} Production declarations exposed to the sandbox. */
  const source = expandSourceMarkers(fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/llm-common.js"), "utf-8")).replace(
    /^(const|let) /gm,
    "var ",
  );
  /** @type {Record<string, any>} Globals used by production deployment entry points. */
  const sandbox = {
    fs,
    path,
    resolvePlaceholders,
    BASE_HOMEDIR_LINUX: home,
    SY_ROOT_FOLDER: path.join(home, "sy"),
    process: { env: { LLM_ROOT_FOLDER: path.join(home, "sy", "ai_llm") } },
    log: () => {},
    is_os_mac: 0,
    readJson: () => ({}),
    readText: async (_parts, sourcePath) => fs.readFileSync(path.join(ROOT, sourcePath), "utf-8"),
    writeText: async (target, content) => {
      if (fs.existsSync(target) && fs.readFileSync(target, "utf-8") === content) return;
      fs.writeFileSync(target, content);
    },
    safeSymlink: (target, destination) => fs.symlinkSync(target, destination),
    getOllamaHosts: async () => [],
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  // Resource installation has its own real-filesystem contract suite.
  sandbox.deploySharedLLMUpstreamSkills = async () => [];
  return sandbox;
}

describe("retired PR guidance deployment", () => {
  /** @type {string} Unique test-owned home, including spaces. */
  let home;
  /** @type {Record<string, any>} Isolated production deployment entry points. */
  let common;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "retired PR workers "));
    common = loadDeployment(home);
    fs.mkdirSync(common.LLM_SHARED_AGENTS_FOLDER, { recursive: true });
  });

  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it("registers no worker sources and explicitly retires every prior PR worker", () => {
    expect(common.LLM_AGENT_DEPLOY_MAP).toEqual({});
    expect(common.LLM_AGENT_RETIRED_NAMES).toEqual(expect.arrayContaining(RETIRED_WORKERS));
  });

  it.each(RETIRED_WORKERS)("retires the shared artifact and owned client links for %s", async (name) => {
    /** @type {string} Prior managed source artifact. */
    const source = path.join(common.LLM_SHARED_AGENTS_FOLDER, `${name}.md`);
    fs.writeFileSync(source, "[Sy] Retired PR worker\n");
    for (const { folder, suffix, delivery } of common.LLM_AGENT_LINK_FOLDERS) {
      fs.mkdirSync(folder, { recursive: true });
      const target = path.join(folder, `${name}${suffix}`);
      if (delivery === "file") fs.writeFileSync(target, "---\nname: old\n---\n\n[Sy] Retired worker\n");
      else fs.symlinkSync(source, target);
    }

    await common.deploySharedLLMAgents();

    expect(fs.readdirSync(common.LLM_SHARED_AGENTS_FOLDER)).toEqual([]);
    for (const { folder } of common.LLM_AGENT_LINK_FOLDERS) expect(fs.readdirSync(folder)).toEqual([]);
  });

  it.each([
    [".claude/agents", ".md"],
    [".copilot/agents", ".agent.md"],
    [".config/opencode/agent", ".md"],
    [".gemini/agents", ".md"],
    [".pi/agent/agents", ".md"],
  ])("preserves private files, foreign links, and folders in %s", async (folder, suffix) => {
    const destination = path.join(home, folder);
    const privateSource = path.join(home, "private.md");
    const foreignLink = path.join(destination, `sy-agent-pr-reviewer${suffix}`);
    const privateFile = path.join(destination, `sy-agent-pr-babysitter${suffix}`);
    const privateFolder = path.join(destination, `pr-reviewer${suffix}`);
    fs.mkdirSync(privateFolder, { recursive: true });
    fs.writeFileSync(path.join(privateFolder, "keep.txt"), "Keep folder content\n");
    fs.writeFileSync(privateSource, "Private linked worker\n");
    fs.writeFileSync(privateFile, "Private worker\n");
    fs.symlinkSync(privateSource, foreignLink);
    const firstLink = fs.lstatSync(foreignLink);

    await common.deploySharedLLMAgents();
    await common.deploySharedLLMAgents();

    expect(fs.readFileSync(privateFile, "utf-8")).toBe("Private worker\n");
    expect(fs.readlinkSync(foreignLink)).toBe(privateSource);
    expect(fs.lstatSync(foreignLink).ino).toBe(firstLink.ino);
    expect(fs.readFileSync(privateSource, "utf-8")).toBe("Private linked worker\n");
    expect(fs.readFileSync(path.join(privateFolder, "keep.txt"), "utf-8")).toBe("Keep folder content\n");
    expect(fs.readdirSync(destination).sort()).toEqual([
      `pr-reviewer${suffix}`,
      `sy-agent-pr-babysitter${suffix}`,
      `sy-agent-pr-reviewer${suffix}`,
    ]);
  });

  it("removes dangling managed links without recreating workers on repeat deployment", async () => {
    const destination = path.join(home, ".pi", "agent", "agents");
    fs.mkdirSync(destination, { recursive: true });
    fs.symlinkSync(
      path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-agent-pr-reviewer.md"),
      path.join(destination, "sy-agent-pr-reviewer.md"),
    );

    await common.deploySharedLLMAgents();
    await common.deploySharedLLMAgents();

    expect(fs.readdirSync(destination)).toEqual([]);
    expect(fs.readdirSync(common.LLM_SHARED_AGENTS_FOLDER)).toEqual([]);
  });

  it("replaces a legacy execute-plan skill and retires the scheduler on repeat deployment", async () => {
    for (const name of ["sy-pr-loop", "sy-execute-plan"]) {
      const oldSource = path.join(common.LLM_SHARED_SKILLS_FOLDER, name);
      fs.mkdirSync(oldSource, { recursive: true });
      fs.writeFileSync(path.join(oldSource, "SKILL.md"), "Old skill without a marker\n");
      for (const folder of common.LLM_SKILL_LINK_FOLDERS) {
        fs.mkdirSync(folder, { recursive: true });
        fs.symlinkSync(oldSource, path.join(folder, name));
      }
    }

    await common.deploySharedLLMSkills();
    expect(common.LLM_COMMAND_DEPLOY_MAP["sy-execute-plan"]).toBe("execute-plan");
    const reviewer = path.join(common.LLM_SHARED_SKILLS_FOLDER, "sy-review-pr", "SKILL.md");
    const firstContent = fs.readFileSync(reviewer, "utf-8");
    const firstFile = fs.statSync(reviewer);
    /** @type {string} Restored command's canonical deployed file. */
    const executor = path.join(common.LLM_SHARED_SKILLS_FOLDER, "sy-execute-plan", "SKILL.md");
    /** @type {string} First deployment bytes, used to prove repeatability. */
    const executorContent = fs.readFileSync(executor, "utf-8");
    /** @type {fs.Stats} First deployment identity and modification time. */
    const executorFile = fs.statSync(executor);
    await common.deploySharedLLMSkills();

    expect(common.LLM_COMMAND_RETIRED_NAMES).toContain("sy-pr-loop");
    expect(common.LLM_COMMAND_RETIRED_NAMES).not.toContain("sy-execute-plan");
    expect(fs.existsSync(path.join(common.LLM_SHARED_SKILLS_FOLDER, "sy-pr-loop"))).toBe(false);
    expect(executorContent).toContain("name: sy-execute-plan\n");
    expect(executorContent).toContain("skills/sy-loop/SKILL.md");
    expect(executorContent).toContain("instructions/pr-workflow.md");
    expect(executorContent).not.toContain("Old skill without a marker");
    expect(executorContent).not.toMatch(/<<[A-Z_]+>>/);
    expect(fs.readFileSync(executor, "utf-8")).toBe(executorContent);
    expect(fs.statSync(executor).ino).toBe(executorFile.ino);
    expect(fs.statSync(executor).mtimeMs).toBe(executorFile.mtimeMs);
    expect(firstContent).toContain("name: sy-review-pr\n");
    expect(firstContent).not.toMatch(/<<[A-Z_]+>>/);
    expect(fs.readFileSync(reviewer, "utf-8")).toBe(firstContent);
    expect(fs.statSync(reviewer).ino).toBe(firstFile.ino);
    expect(fs.statSync(reviewer).mtimeMs).toBe(firstFile.mtimeMs);
    for (const folder of common.LLM_SKILL_LINK_FOLDERS) {
      expect(fs.existsSync(path.join(folder, "sy-pr-loop"))).toBe(false);
      expect(fs.readlinkSync(path.join(folder, "sy-execute-plan"))).toBe(path.dirname(executor));
      expect(fs.readlinkSync(path.join(folder, "sy-review-pr"))).toBe(path.dirname(reviewer));
    }
  });

  it("preserves real restored-skill folders and foreign retired-skill links", async () => {
    const destination = common.LLM_SKILL_LINK_FOLDERS[0];
    const privateFolder = path.join(destination, "sy-execute-plan");
    const privateSource = path.join(home, "private-skill");
    const privateLink = path.join(destination, "sy-pr-loop");
    fs.mkdirSync(privateFolder, { recursive: true });
    fs.mkdirSync(privateSource, { recursive: true });
    fs.writeFileSync(path.join(privateFolder, "SKILL.md"), "Private workflow\n");
    fs.writeFileSync(path.join(privateSource, "SKILL.md"), "Private linked workflow\n");
    fs.symlinkSync(privateSource, privateLink);

    await common.deploySharedLLMSkills();
    await common.deploySharedLLMSkills();

    expect(fs.readFileSync(path.join(privateFolder, "SKILL.md"), "utf-8")).toBe("Private workflow\n");
    expect(fs.readlinkSync(privateLink)).toBe(privateSource);
    expect(fs.readFileSync(path.join(privateSource, "SKILL.md"), "utf-8")).toBe("Private linked workflow\n");
  });

  it.each(RETIRED_UNUSED_SKILLS)("retires unused %s and its owned links on repeat deployment", async (name) => {
    /** @type {string} Legacy canonical skill folder, deliberately without a managed marker. */
    const source = path.join(common.LLM_SHARED_SKILLS_FOLDER, name);
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "SKILL.md"), "Legacy workflow without a marker\n");
    for (const folder of common.LLM_SKILL_LINK_FOLDERS) {
      fs.mkdirSync(folder, { recursive: true });
      fs.symlinkSync(source, path.join(folder, name));
    }

    await common.deploySharedLLMSkills();
    await common.deploySharedLLMSkills();

    expect(fs.existsSync(source)).toBe(false);
    expect(common.LLM_COMMAND_DEPLOY_MAP[name]).toBeUndefined();
    expect(common.LLM_COMMAND_RETIRED_NAMES).toContain(name);
    for (const folder of common.LLM_SKILL_LINK_FOLDERS) expect(fs.readdirSync(folder)).not.toContain(name);
  });

  it.each(RETIRED_UNUSED_SKILLS)("preserves private folders and foreign links named %s", async (name) => {
    /** @type {string} Unmanaged real client folder sharing a retired name. */
    const privateFolder = path.join(common.LLM_SKILL_LINK_FOLDERS[0], name);
    /** @type {string} Foreign skill source outside the managed shared skills folder. */
    const privateSource = path.join(home, "private-skill");
    /** @type {string} Another client's foreign link sharing that retired name. */
    const privateLink = path.join(common.LLM_SKILL_LINK_FOLDERS[1], name);
    fs.mkdirSync(privateFolder, { recursive: true });
    fs.mkdirSync(privateSource, { recursive: true });
    fs.mkdirSync(path.dirname(privateLink), { recursive: true });
    fs.writeFileSync(path.join(privateFolder, "SKILL.md"), "Private workflow\n");
    fs.writeFileSync(path.join(privateSource, "SKILL.md"), "Private linked workflow\n");
    fs.symlinkSync(privateSource, privateLink);
    /** @type {number} Link identity proving repeated deployment leaves the foreign link intact. */
    const firstLinkInode = fs.lstatSync(privateLink).ino;

    await common.deploySharedLLMSkills();
    await common.deploySharedLLMSkills();

    expect(fs.readFileSync(path.join(privateFolder, "SKILL.md"), "utf-8")).toBe("Private workflow\n");
    expect(fs.readlinkSync(privateLink)).toBe(privateSource);
    expect(fs.lstatSync(privateLink).ino).toBe(firstLinkInode);
    expect(fs.readFileSync(path.join(privateSource, "SKILL.md"), "utf-8")).toBe("Private linked workflow\n");
  });

  it("keeps each client setup connected to the shared retirement pass", () => {
    for (const cli of ["claude", "copilot", "gemini", "opencode", "pi"]) {
      const setup = fs.readFileSync(path.join(ROOT, `software/scripts/advanced/llm/${cli}/setup.js`), "utf-8");
      expect(setup).toContain("await deploySharedLLMAgents();");
    }
  });
});
