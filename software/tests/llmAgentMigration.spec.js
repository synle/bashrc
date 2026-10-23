/** Filesystem regression coverage for the PR worker deployment-name migration. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expandSourceMarkers, getIndexFunction } from "./setup.js";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";

/** @type {string} Repository root containing the canonical source bodies. */
const ROOT = path.resolve(".");
/** @type {Function} Production document placeholder resolver. */
const resolvePlaceholders = getIndexFunction("resolvePlaceholders");

/**
 * Loads the production deployer with filesystem effects confined to a unique home.
 * @param {string} home - Test-owned configuration home.
 * @returns {Record<string, any>} Deployment entry points and isolated paths.
 * @throws {Error} If source loading or evaluation fails; no user files are touched.
 */
function loadDeployment(home) {
  /** @type {string} Expanded production module with accessible sandbox constants. */
  const source = expandSourceMarkers(fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/llm-common.js"), "utf-8")).replace(
    /^(const|let) /gm,
    "var ",
  );
  /** @type {Record<string, any>} Real filesystem with isolated deployment boundaries. */
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
    getOllamaHosts: async () => [{ ip: "127.0.0.1", hostname: "local", tags: [], isDefault: true, isLocal: true }],
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

describe.each([".md", ".agent.md"])("PR agent migration with %s destinations", (suffix) => {
  /** @type {string} Unique test-owned home, including spaces. */
  let home;
  /** @type {string} Isolated consumer folder. */
  let destination;
  /** @type {Record<string, any>} Production deployer and registry. */
  let common;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "pr agent migration "));
    destination = path.join(home, "consumer", "agents");
    common = loadDeployment(home);
    common.LLM_AGENT_LINK_FOLDERS = [{ folder: destination, suffix }];
    fs.mkdirSync(common.LLM_SHARED_AGENTS_FOLDER, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });
  });

  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it.each(["pr-babysitter", "pr-reviewer", "sy-pr-babysitter", "sy-pr-reviewer"])(
    "retires owned shared files and links for %s and deploys both new names",
    async (legacy) => {
      /** @type {string} Retired shared artifact. */
      const oldSource = path.join(common.LLM_SHARED_AGENTS_FOLDER, `${legacy}.md`);
      /** @type {string} Retired consumer link. */
      const oldLink = path.join(destination, `${legacy}${suffix}`);
      fs.writeFileSync(oldSource, "---\nname: old\n---\n\n[Sy] Prior PR worker\n");
      fs.symlinkSync(oldSource, oldLink);
      await common.deploySharedLLMAgents();
      expect(fs.existsSync(oldSource)).toBe(false);
      expect(fs.readdirSync(destination).sort()).toEqual([`sy-agent-pr-babysitter${suffix}`, `sy-agent-pr-reviewer${suffix}`]);
      expect(fs.readlinkSync(path.join(destination, `sy-agent-pr-reviewer${suffix}`))).toBe(
        path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-agent-pr-reviewer.md"),
      );
      expect(common.LLM_AGENT_RETIRED_NAMES).toContain(legacy);
    },
  );

  it("removes marked legacy copies and dangling managed links without touching private neighbors", async () => {
    fs.writeFileSync(path.join(destination, `sy-pr-reviewer${suffix}`), "[Sy] Old rendered reviewer\n");
    fs.symlinkSync(path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-pr-babysitter.md"), path.join(destination, `sy-pr-babysitter${suffix}`));
    fs.writeFileSync(path.join(destination, `private${suffix}`), "Private worker\n");
    await common.deploySharedLLMAgents();
    expect(fs.readdirSync(destination).sort()).toEqual([
      `private${suffix}`,
      `sy-agent-pr-babysitter${suffix}`,
      `sy-agent-pr-reviewer${suffix}`,
    ]);
    expect(fs.readFileSync(path.join(destination, `private${suffix}`), "utf-8")).toBe("Private worker\n");
  });

  it("preserves foreign files and links even when their names match retired workers", async () => {
    /** @type {string} Foreign artifact outside the managed shared folder. */
    const privateSource = path.join(home, "private.md");
    fs.writeFileSync(privateSource, "Private linked worker\n");
    fs.writeFileSync(path.join(destination, `sy-pr-reviewer${suffix}`), "Private reviewer\n");
    fs.symlinkSync(privateSource, path.join(destination, `sy-pr-babysitter${suffix}`));
    await common.deploySharedLLMAgents();
    expect(fs.readFileSync(path.join(destination, `sy-pr-reviewer${suffix}`), "utf-8")).toBe("Private reviewer\n");
    expect(fs.readlinkSync(path.join(destination, `sy-pr-babysitter${suffix}`))).toBe(privateSource);
    expect(fs.readFileSync(privateSource, "utf-8")).toBe("Private linked worker\n");
  });

  it("keeps new links and expanded persona bodies stable on repeat deployment", async () => {
    await common.deploySharedLLMAgents();
    /** @type {string} New consumer link. */
    const reviewer = path.join(destination, `sy-agent-pr-reviewer${suffix}`);
    /** @type {string} Canonical deployed role. */
    const source = path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-agent-pr-reviewer.md");
    /** @type {fs.Stats} Initial link identity. */
    const firstLink = fs.lstatSync(reviewer);
    /** @type {string} Initial expanded persona and frontmatter. */
    const firstContent = fs.readFileSync(source, "utf-8");
    await common.deploySharedLLMAgents();
    expect(fs.lstatSync(reviewer).ino).toBe(firstLink.ino);
    expect(fs.readFileSync(source, "utf-8")).toBe(firstContent);
    expect(firstContent).toContain("name: sy-agent-pr-reviewer\n");
    expect(firstContent).toContain(path.join(home, "sy", "ai_llm", "skills", "sy-review-pr", "SKILL.md"));
    expect(firstContent).not.toContain("<<LLM_ROOT_FOLDER>>");
  });
});
