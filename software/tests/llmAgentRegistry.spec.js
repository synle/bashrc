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
 * source file, every source file is registered — and pin the union frontmatter
 * that was verified live against all three real binaries, so a well-meaning
 * "cleanup" that drops a key fails here rather than on a dev machine weeks later.
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
 * sandbox property — the same approach `llmCommandRegistry.spec.js` already uses.
 *
 * @returns {Record<string, any>} The populated sandbox.
 */
function loadLlmCommon() {
  const source = fs.readFileSync(LLM_COMMON_PATH, "utf-8").replace(/^(const|let) /gm, "var ");
  /** @type {Record<string, any>} */
  const sandbox = {
    path,
    BASE_HOMEDIR_LINUX: "/tmp/sandbox-home",
    SY_ROOT_FOLDER: "/tmp/sandbox-home/sy",
    process: { env: { LLM_ROOT_FOLDER: "/tmp/sandbox-home/sy/ai_llm" } },
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

  it("keeps agent sources free of frontmatter, since each CLI gets its own", () => {
    // Frontmatter is generated per CLI at deploy time. Any in the source would
    // both break the [Sy] first-line marker above and be wrong for three of the
    // four destinations.
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

  it("`sy-` prefixes every agent name", () => {
    // Same convention as LLM_COMMAND_DEPLOY_MAP. The prefix is what makes a
    // rendered agent label legible as ours next to a vendor- or plugin-supplied
    // one, which is the only place the name is ever read.
    /** @type {string[]} Registry keys missing the ownership prefix. */
    const unprefixed = Object.keys(LLM_AGENT_DEPLOY_MAP).filter((name) => !name.startsWith("sy-"));

    expect(unprefixed).toEqual([]);
  });

  it("keeps source filenames bare, with `sy-` applied only at deploy time", () => {
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
    ]);
  });

  it("omits gemini, which has no agent surface to link into", () => {
    // Gemini 0.55.1 exposes `gemini skills` but no agents subcommand and no
    // --agent flag. An entry would link files nothing reads, and no probe could
    // tell us it had gone stale.
    expect(LLM_AGENT_LINK_FOLDERS.some(({ folder }) => folder.includes(".gemini"))).toBe(false);
  });

  it("writes the union frontmatter every CLI was verified to accept", () => {
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
    // Same shape as the instructions corpus: prune first, so the link pass may
    // treat every surviving non-symlink as genuinely foreign. Inlining the
    // cleanup into the link loop is what made the link pass need a carve-out for
    // its own leftovers, which is exactly the bug this ordering removes.
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

  it("keeps the link pass free of its own cleanup carve-outs", () => {
    // A non-symlink reaching the link pass is someone else's, unconditionally.
    // A marker check here would mean prune had not done its job.
    const common = fs.readFileSync(LLM_COMMON_PATH, "utf-8");
    const linkFn = common.slice(common.indexOf("function linkSharedLLMAgents"));
    const body = linkFn.slice(0, linkFn.indexOf("\n}\n"));

    expect(body).not.toContain("LLM_SKILL_MARKERS");
    expect(body).toContain("skippedForeign++");
  });
});

describe("LLM agent deploy call sites", () => {
  it("calls deploySharedLLMAgents from every CLI setup script", () => {
    // One registry, never a per-CLI list: each setup.js calls the shared deploy
    // and iterates nothing of its own. A CLI that stops calling it silently
    // stops repairing the corpus.
    for (const cli of ["claude", "copilot", "gemini", "opencode"]) {
      const setup = fs.readFileSync(path.join(ROOT, `software/scripts/advanced/llm/${cli}/setup.js`), "utf-8");
      expect(setup, `${cli}/setup.js calls deploySharedLLMAgents()`).toContain("await deploySharedLLMAgents();");
    }
  });

  it("names no agent inside a command body", () => {
    // AGENTS.md §13.2 + §13.0: a skill selects a worker by BEHAVIOR, never by
    // name. A name here is literal prose on any CLI that resolves agents
    // differently, and rots the moment an agent is renamed.
    const commandDir = path.join(ROOT, "software/scripts/advanced/llm/_common/commands");
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
