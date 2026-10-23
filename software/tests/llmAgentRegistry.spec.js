/**
 * Registry integrity for the Sy-managed LLM agent corpus.
 *
 * `LLM_AGENT_DEPLOY_MAP` in `llm-common.js` is the single registry every CLI's
 * `setup.js` iterates (see AGENTS.md §13.2), and `LLM_AGENT_LINK_FOLDERS` is the
 * only place a per-CLI destination is named. Both fail SILENTLY when wrong: a
 * typo in a map value deploys an agent whose body is missing, and a wrong folder
 * or frontmatter key leaves the file on disk as ordinary documentation that no
 * CLI ever resolves. Neither shows up in any other gate.
 *
 * These tests close that gap from both directions — every registered agent has a
 * source file, every source file is registered, and each destination receives
 * its supported format without duplicating agent registries.
 */
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { expandSourceMarkers, getIndexFunction } from "./setup.js";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";

const ROOT = path.resolve(".");
const LLM_COMMON_PATH = path.join(ROOT, "software/scripts/advanced/llm/llm-common.js");
/** @type {Function} Production placeholder resolver used by the shared document reader. */
const resolvePlaceholders = getIndexFunction("resolvePlaceholders");

/**
 * Evaluates `llm-common.js` in a sandbox and returns its top-level declarations.
 *
 * `const`/`let` are rewritten to `var` so every top-level declaration becomes a
 * sandbox property — the same approach `llmCommandRegistry.spec.js` already uses.
 *
 * @param {string} [home="/tmp/sandbox-home"] - Isolated configuration home.
 * @returns {Record<string, any>} The populated sandbox; filesystem effects stay under home.
 */
function loadLlmCommon(home = "/tmp/sandbox-home") {
  const source = expandSourceMarkers(fs.readFileSync(LLM_COMMON_PATH, "utf-8")).replace(/^(const|let) /gm, "var ");
  /** @type {Record<string, any>} */
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

const {
  LLM_AGENT_DEPLOY_MAP,
  pruneOrphanedSharedLLMAgents,
  LLM_AGENT_LINK_FOLDERS,
  LLM_AGENT_RETIRED_NAMES,
  LLM_AGENT_SOURCE_FOLDER,
  LLM_SHARED_AGENTS_FOLDER,
  LLM_SKILL_MARKER,
  buildLLMAgentFrontmatter,
} = loadLlmCommon();

/** @type {string} Absolute path of the canonical agent source folder. */
const AGENT_SOURCE_DIR = path.join(ROOT, LLM_AGENT_SOURCE_FOLDER);

describe("LLM agent registry", () => {
  it("resolves every registered agent to a source file that exists", () => {
    /** @type {string[]} Registry values with no matching `<value>.md` on disk. */
    const missing = Object.entries(LLM_AGENT_DEPLOY_MAP)
      .filter(([, sourceName]) => !fs.existsSync(path.join(AGENT_SOURCE_DIR, `${sourceName}.md`)))
      .map(([agentName, sourceName]) => `${agentName} -> ${sourceName}.md`);

    expect(missing).toEqual([]);
  });

  it("registers every source file, so none is dead weight", () => {
    /** @type {Set<string>} Every source basename the registry points at. */
    const registered = new Set(Object.values(LLM_AGENT_DEPLOY_MAP));
    /** @type {string[]} `.md` files present on disk but named by no registry entry. */
    const orphans = fs
      .readdirSync(AGENT_SOURCE_DIR)
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => path.basename(entry, ".md"))
      .filter((name) => !registered.has(name));

    expect(orphans).toEqual([]);
  });

  it("opens every agent source with the shared [Sy] marker", () => {
    // Orphan detection matches this prefix against the first body line of a
    // deployed file. A source missing it deploys an agent that can never be
    // swept on rename, so it would linger in the harness picker forever.
    /** @type {string[]} Sources whose first line carries no marker. */
    const unmarked = Object.values(LLM_AGENT_DEPLOY_MAP).filter((sourceName) => {
      const body = fs.readFileSync(path.join(AGENT_SOURCE_DIR, `${sourceName}.md`), "utf-8");
      return !(body.split("\n", 1)[0] || "").startsWith(LLM_SKILL_MARKER);
    });

    expect(unmarked).toEqual([]);
  });

  it("keeps agent sources free of generated frontmatter", () => {
    // Metadata belongs to the shared renderer, not vendor-neutral role sources.
    /** @type {string[]} Sources that open with a YAML fence. */
    const fenced = Object.values(LLM_AGENT_DEPLOY_MAP).filter((sourceName) =>
      fs.readFileSync(path.join(AGENT_SOURCE_DIR, `${sourceName}.md`), "utf-8").startsWith("---"),
    );

    expect(fenced).toEqual([]);
  });

  it("names no CLI, tool, or model in an agent source", () => {
    // AGENTS.md §13.2: an agent source is vendor-neutral prose, exactly like a
    // SKILL.md body. A vendor token here is silently wrong on three CLIs.
    /** @type {RegExp[]} Tokens that mean the source stopped being portable. */
    const banned = [/\bsubagent_type\b/, /\bclaude\b/i, /\bcopilot\b/i, /\bgemini\b/i, /\bopencode\b/i, /\bmcp__/];
    /** @type {string[]} `<source>: <token>` for every violation found. */
    const violations = [];
    for (const sourceName of Object.values(LLM_AGENT_DEPLOY_MAP)) {
      const body = fs.readFileSync(path.join(AGENT_SOURCE_DIR, `${sourceName}.md`), "utf-8");
      for (const pattern of banned) {
        if (pattern.test(body)) violations.push(`${sourceName}: ${pattern}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("`sy-agent-` distinguishes worker names from workflow names", () => {
    // Workers and workflows share pickers, so their ownership prefixes differ.
    /** @type {string[]} Registry keys missing the ownership prefix. */
    const unprefixed = Object.keys(LLM_AGENT_DEPLOY_MAP).filter((name) => !name.startsWith("sy-agent-"));

    expect(unprefixed).toEqual([]);
  });

  it("keeps source filenames bare, with `sy-agent-` applied only at deploy time", () => {
    // Same split as the command corpus: the key is what gets deployed, the
    // value is the file on disk. A prefixed source filename would mean a future
    // prefix change renames every file instead of editing one map.
    /** @type {string[]} Registry values that leaked the deploy-time prefix onto disk. */
    const prefixedSources = Object.values(LLM_AGENT_DEPLOY_MAP).filter((name) => name.startsWith("sy-"));

    expect(prefixedSources).toEqual([]);
  });

  it("never re-registers a retired agent name", () => {
    /** @type {string[]} Names present in both the live registry and the retired list. */
    const resurrected = Object.keys(LLM_AGENT_DEPLOY_MAP).filter((name) => LLM_AGENT_RETIRED_NAMES.includes(name));

    expect(resurrected).toEqual([]);
  });
});

describe("LLM agent link folders", () => {
  it("keeps ONE physical agent folder beside the other shared corpora", () => {
    // The whole point of the symlink model: agents live next to skills,
    // instructions, and plans, so one `ls` of the LLM home shows everything.
    expect(LLM_SHARED_AGENTS_FOLDER).toBe("/tmp/sandbox-home/sy/ai_llm/agents");
  });

  it("gives every CLI a folder and a suffix", () => {
    for (const { folder, suffix } of LLM_AGENT_LINK_FOLDERS) {
      expect(path.isAbsolute(folder), `${folder} is absolute`).toBe(true);
      expect(suffix.startsWith("."), `${suffix} starts with a dot`).toBe(true);
    }
  });

  it("links each CLI into its own verified folder and suffix", () => {
    expect(LLM_AGENT_LINK_FOLDERS).toEqual([
      { folder: "/tmp/sandbox-home/.claude/agents", suffix: ".md" },
      { folder: "/tmp/sandbox-home/.copilot/agents", suffix: ".agent.md" },
      { folder: "/tmp/sandbox-home/.config/opencode/agent", suffix: ".md" },
      { folder: "/tmp/sandbox-home/.gemini/agents", suffix: ".md", delivery: "file", format: "portable" },
      { folder: "/tmp/sandbox-home/.pi/agent/agents", suffix: ".md" },
    ]);
  });

  it("renders only supported keys for strict frontmatter consumers", () => {
    expect(buildLLMAgentFrontmatter("sy-pr-x", "d", "portable")).toBe('name: sy-pr-x\ndescription: "d"');
  });

  it("preserves the union frontmatter for compatible consumers", () => {
    // Verified live (AGENTS.md §13.2): `name` is REQUIRED by Claude Code, which
    // silently skips a file without it, and used by Copilot. `mode: subagent` is
    // required by OpenCode to classify the agent as dispatchable. Each CLI
    // ignores the keys it does not know, which is what lets ONE file serve all
    // three — dropping either key breaks one of them with no visible error.
    expect(buildLLMAgentFrontmatter("sy-pr-x", "d")).toBe('name: sy-pr-x\ndescription: "d"\nmode: subagent');
  });
});

describe("LLM agent orphan cleanup", () => {
  it("exposes a prune pass that the deploy calls before linking", () => {
    // Prune obsolete owned artifacts before reconciling native destinations.
    expect(typeof pruneOrphanedSharedLLMAgents).toBe("function");

    const common = fs.readFileSync(LLM_COMMON_PATH, "utf-8");
    /** @type {string} Body of deploySharedLLMAgents, where the ordering must hold. */
    const deploy = common.slice(common.indexOf("async function deploySharedLLMAgents"));
    /** @type {number} Offset of the prune call inside the deploy body. */
    const pruneAt = deploy.indexOf("pruneOrphanedSharedLLMAgents()");
    /** @type {number} Offset of the link call inside the deploy body. */
    const linkAt = deploy.indexOf("linkSharedLLMAgents()");

    expect(pruneAt).toBeGreaterThan(-1);
    expect(linkAt).toBeGreaterThan(-1);
    expect(pruneAt, "prune runs before link").toBeLessThan(linkAt);
  });

  it("rejects unknown frontmatter formats instead of deploying malformed metadata", () => {
    expect(() => buildLLMAgentFrontmatter("sy-pr-x", "d", "unknown")).toThrow("Unknown agent format: unknown");
  });
});

describe("LLM agent deploy call sites", () => {
  it("calls deploySharedLLMAgents from every CLI setup script", () => {
    // One registry, never a per-CLI list: each setup.js calls the shared deploy
    // and iterates nothing of its own. A CLI that stops calling it silently
    // stops repairing the corpus.
    for (const cli of ["claude", "copilot", "gemini", "opencode", "pi"]) {
      const setup = fs.readFileSync(path.join(ROOT, `software/scripts/advanced/llm/${cli}/setup.js`), "utf-8");
      expect(setup, `${cli}/setup.js calls deploySharedLLMAgents()`).toContain("await deploySharedLLMAgents();");
    }
  });

  it("names no agent inside a command body", () => {
    // AGENTS.md §13.2 + §13.0: a skill selects a worker by BEHAVIOR, never by
    // name. A name here is literal prose on any CLI that resolves agents
    // differently, and rots the moment an agent is renamed.
    const commandDir = path.join(ROOT, "software/scripts/advanced/llm/_common/v_current/skills");
    /** @type {string[]} `<command>: <agent>` for every agent name found in a body. */
    const violations = [];
    for (const entry of fs.readdirSync(commandDir).filter((f) => f.endsWith(".md"))) {
      const body = fs.readFileSync(path.join(commandDir, entry), "utf-8");
      for (const agentName of Object.keys(LLM_AGENT_DEPLOY_MAP)) {
        if (body.includes(agentName)) violations.push(`${entry}: ${agentName}`);
      }
    }

    expect(violations).toEqual([]);
  });
});

// --- Filesystem deployment integration ---

describe("shared agent filesystem deployment", () => {
  /** @type {string} Unique home with spaces, owned by the current test. */
  let home;
  /** @type {Record<string, any>} Shared deployment entry points and isolated paths. */
  let common;
  /** @type {string} Gemini's regular-file destination. */
  let gemini;
  /** @type {string} Pi's linked destination. */
  let pi;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "llm agents "));
    common = loadLlmCommon(home);
    gemini = path.join(home, ".gemini", "agents");
    pi = path.join(home, ".pi", "agent", "agents");
  });

  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it("deploys Gemini as discoverable regular files with strict-compatible metadata", async () => {
    await common.deploySharedLLMAgents();
    const target = path.join(gemini, "sy-agent-pr-reviewer.md");
    const source = await common.readLLMAgentSource("pr-reviewer");
    const content = fs.readFileSync(target, "utf-8");
    expect(fs.lstatSync(target).isFile()).toBe(true);
    expect(
      content
        .split("\n---\n")[0]
        .split("\n")
        .map((line) => line.split(":")[0]),
    ).toEqual(["---", "name", "description"]);
    expect(content.split("\n---\n\n")[1]).toBe(`${source}\n`);
    expect(fs.readdirSync(gemini).sort()).toEqual(["sy-agent-pr-babysitter.md", "sy-agent-pr-reviewer.md"]);
  });

  it("links Pi and existing compatible destinations to the same shared artifact", async () => {
    await common.deploySharedLLMAgents();
    const target = path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-agent-pr-reviewer.md");
    expect(fs.readlinkSync(path.join(pi, "sy-agent-pr-reviewer.md"))).toBe(target);
    expect(fs.readlinkSync(path.join(home, ".claude", "agents", "sy-agent-pr-reviewer.md"))).toBe(target);
    expect(fs.readlinkSync(path.join(home, ".copilot", "agents", "sy-agent-pr-reviewer.agent.md"))).toBe(target);
    expect(fs.readlinkSync(path.join(home, ".config", "opencode", "agent", "sy-agent-pr-reviewer.md"))).toBe(target);
    expect(fs.readFileSync(target, "utf-8").split("\n---\n")[0]).toContain("\nmode: subagent");
  });

  it("leaves correct links and native files unchanged on repeat deployment", async () => {
    await common.deploySharedLLMAgents();
    const native = path.join(gemini, "sy-agent-pr-reviewer.md");
    const linked = path.join(pi, "sy-agent-pr-reviewer.md");
    const firstFile = fs.statSync(native);
    const firstLink = fs.lstatSync(linked);
    const firstContent = fs.readFileSync(native, "utf-8");
    await common.deploySharedLLMAgents();
    expect(fs.statSync(native).mtimeMs).toBe(firstFile.mtimeMs);
    expect(fs.statSync(native).ino).toBe(firstFile.ino);
    expect(fs.lstatSync(linked).ino).toBe(firstLink.ino);
    expect(fs.readFileSync(native, "utf-8")).toBe(firstContent);
  });

  it("refreshes owned native files without retaining stale body text", async () => {
    await common.deploySharedLLMAgents();
    const target = path.join(gemini, "sy-agent-pr-reviewer.md");
    const expected = fs.readFileSync(target, "utf-8");
    fs.writeFileSync(target, "---\nname: sy-agent-pr-reviewer\n---\n\n[Sy] Stale role\n");
    await common.deploySharedLLMAgents();
    expect(fs.readFileSync(target, "utf-8")).toBe(expected);
  });

  it.each([".gemini/agents", ".pi/agent/agents"])("preserves a user-authored agent occupying %s", async (folder) => {
    const target = path.join(home, folder, "sy-agent-pr-reviewer.md");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "My private worker\n");
    await common.deploySharedLLMAgents();
    expect(fs.lstatSync(target).isFile()).toBe(true);
    expect(fs.readFileSync(target, "utf-8")).toBe("My private worker\n");
  });

  it.each([
    [".claude/agents", ".md"],
    [".copilot/agents", ".agent.md"],
    [".config/opencode/agent", ".md"],
    [".gemini/agents", ".md"],
    [".pi/agent/agents", ".md"],
  ])("preserves foreign symlinks at %s", async (folder, suffix) => {
    const destination = path.join(home, folder);
    fs.mkdirSync(destination, { recursive: true });
    const source = path.join(home, "private-worker.md");
    const target = path.join(destination, `sy-agent-pr-reviewer${suffix}`);
    fs.writeFileSync(source, "Private worker\n");
    fs.symlinkSync(source, target);
    const originalLink = fs.lstatSync(target);
    await common.deploySharedLLMAgents();
    expect(fs.readlinkSync(target)).toBe(source);
    expect(fs.lstatSync(target).ino).toBe(originalLink.ino);
    expect(fs.readFileSync(source, "utf-8")).toBe("Private worker\n");
  });

  it("repairs an owned symlink pointing to the wrong shared worker", async () => {
    await common.deploySharedLLMAgents();
    const target = path.join(pi, "sy-agent-pr-reviewer.md");
    const source = path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-agent-pr-reviewer.md");
    fs.unlinkSync(target);
    fs.symlinkSync(path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-agent-pr-babysitter.md"), target);
    await common.deploySharedLLMAgents();
    expect(fs.readlinkSync(target)).toBe(source);
    expect(fs.readFileSync(target, "utf-8")).toBe(fs.readFileSync(source, "utf-8"));
  });

  it("preserves a folder occupying a native-file destination", async () => {
    const target = path.join(gemini, "sy-agent-pr-reviewer.md");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "keep.txt"), "Keep\n");
    await common.deploySharedLLMAgents();
    expect(fs.readdirSync(target)).toEqual(["keep.txt"]);
  });

  it("replaces an owned symlink when the native loader requires a file", async () => {
    await common.deploySharedLLMAgents();
    const target = path.join(gemini, "sy-agent-pr-reviewer.md");
    fs.unlinkSync(target);
    fs.symlinkSync(path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-agent-pr-reviewer.md"), target);
    await common.deploySharedLLMAgents();
    expect(fs.lstatSync(target).isFile()).toBe(true);
    expect(fs.readFileSync(target, "utf-8").split("\n---\n")[0]).not.toContain("mode:");
  });

  it("prunes removed managed native agents but preserves unmarked neighbors", async () => {
    await common.deploySharedLLMAgents();
    fs.writeFileSync(path.join(gemini, "sy-old-role.md"), "[Sy] Obsolete worker\n");
    fs.writeFileSync(path.join(gemini, "private.md"), "Private worker\n");
    await common.deploySharedLLMAgents();
    expect(fs.readdirSync(gemini).sort()).toEqual(["private.md", "sy-agent-pr-babysitter.md", "sy-agent-pr-reviewer.md"]);
    expect(fs.readFileSync(path.join(gemini, "private.md"), "utf-8")).toBe("Private worker\n");
  });

  it("deploys registry additions to a new metadata-only client without a separate content list", async () => {
    /** @type {string} Hypothetical strict client's native destination. */
    const destination = path.join(home, "custom-client", "agents");
    common.LLM_AGENT_LINK_FOLDERS.push({ folder: destination, suffix: ".worker.md", delivery: "file", format: "portable" });
    common.LLM_AGENT_DEPLOY_MAP["sy-extra-reviewer"] = "pr-reviewer";
    await common.deploySharedLLMAgents();
    expect(fs.readdirSync(destination).sort()).toEqual([
      "sy-agent-pr-babysitter.worker.md",
      "sy-agent-pr-reviewer.worker.md",
      "sy-extra-reviewer.worker.md",
    ]);
    expect(fs.readFileSync(path.join(destination, "sy-extra-reviewer.worker.md"), "utf-8")).toContain("name: sy-extra-reviewer\n");
    expect(fs.readlinkSync(path.join(pi, "sy-extra-reviewer.md"))).toBe(path.join(common.LLM_SHARED_AGENTS_FOLDER, "sy-extra-reviewer.md"));
    expect(fs.lstatSync(path.join(gemini, "sy-extra-reviewer.md")).isFile()).toBe(true);
  });

  it("keeps frontmatter-like body text intact when adapting a shared artifact", async () => {
    fs.mkdirSync(common.LLM_SHARED_AGENTS_FOLDER, { recursive: true });
    fs.writeFileSync(
      path.join(common.LLM_SHARED_AGENTS_FOLDER, "custom.md"),
      "---\nname: custom\nmode: subagent\n---\n\n[Sy] Custom role\n\nmode: subagent\n",
    );
    await common.linkSharedLLMAgents();
    expect(fs.readFileSync(path.join(gemini, "custom.md"), "utf-8")).toBe(
      '---\nname: custom\ndescription: "Custom role"\n---\n\n[Sy] Custom role\n\nmode: subagent\n',
    );
  });
});
