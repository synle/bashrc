/**
 * Registry integrity for the Sy-managed LLM agent corpus.
 *
 * `LLM_AGENT_DEPLOY_MAP` in `llm-common.js` is the single registry every CLI's
 * `setup.js` iterates (see AGENTS.md §13.2), and `LLM_AGENT_DEPLOY_FOLDERS` is the
 * only place a per-CLI destination or frontmatter shape is named. Both fail
 * SILENTLY when wrong: a typo in a map value deploys an agent whose body is
 * missing, and a wrong frontmatter key leaves the file on disk as ordinary
 * documentation that no CLI ever resolves. Neither shows up in any other gate.
 *
 * These tests close that gap from both directions — every registered agent has a
 * source file, every source file is registered — and pin the two frontmatter
 * shapes that were verified live against the real binaries, so a well-meaning
 * "cleanup" that unifies them fails here rather than on a dev machine weeks later.
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

const { LLM_AGENT_DEPLOY_MAP, LLM_AGENT_DEPLOY_FOLDERS, LLM_AGENT_RETIRED_NAMES, LLM_AGENT_SOURCE_FOLDER, LLM_SKILL_MARKER } =
  loadLlmCommon();

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

  it("never re-registers a retired agent name", () => {
    /** @type {string[]} Names present in both the live registry and the retired list. */
    const resurrected = Object.keys(LLM_AGENT_DEPLOY_MAP).filter((name) => LLM_AGENT_RETIRED_NAMES.includes(name));

    expect(resurrected).toEqual([]);
  });
});

describe("LLM agent deploy folders", () => {
  it("gives every CLI a folder, a suffix, and a frontmatter builder", () => {
    for (const [cli, entry] of Object.entries(LLM_AGENT_DEPLOY_FOLDERS)) {
      expect(path.isAbsolute(entry.folder), `${cli} folder is absolute`).toBe(true);
      expect(entry.suffix.startsWith("."), `${cli} suffix starts with a dot`).toBe(true);
      expect(typeof entry.frontmatter, `${cli} frontmatter is a builder`).toBe("function");
    }
  });

  it("pins the frontmatter each CLI was verified to require", () => {
    // Verified live (AGENTS.md §13.2): claude 2.1.223 and copilot 1.0.81 both
    // require a `name` key and ignore a file without one; opencode 1.18.18 takes
    // the name from the filename and instead requires `mode: subagent`. These
    // are NOT interchangeable, and getting one wrong fails silently.
    expect(LLM_AGENT_DEPLOY_FOLDERS.claude.frontmatter("sy-pr-x", "d")).toBe('name: sy-pr-x\ndescription: "d"');
    expect(LLM_AGENT_DEPLOY_FOLDERS.copilot.frontmatter("sy-pr-x", "d")).toBe('name: sy-pr-x\ndescription: "d"');
    expect(LLM_AGENT_DEPLOY_FOLDERS.opencode.frontmatter("sy-pr-x", "d")).toBe('description: "d"\nmode: subagent');
  });

  it("writes each CLI into its own verified folder and suffix", () => {
    expect(LLM_AGENT_DEPLOY_FOLDERS.claude.folder).toBe("/tmp/sandbox-home/.claude/agents");
    expect(LLM_AGENT_DEPLOY_FOLDERS.claude.suffix).toBe(".md");
    expect(LLM_AGENT_DEPLOY_FOLDERS.copilot.folder).toBe("/tmp/sandbox-home/.copilot/agents");
    expect(LLM_AGENT_DEPLOY_FOLDERS.copilot.suffix).toBe(".agent.md");
    expect(LLM_AGENT_DEPLOY_FOLDERS.opencode.folder).toBe("/tmp/sandbox-home/.config/opencode/agent");
    expect(LLM_AGENT_DEPLOY_FOLDERS.opencode.suffix).toBe(".md");
  });

  it("omits gemini, which has no agent surface to write to", () => {
    // Gemini 0.55.1 exposes `gemini skills` but no agents subcommand and no
    // --agent flag. An entry here would write files nothing reads, and no probe
    // could tell us it had gone stale.
    expect(LLM_AGENT_DEPLOY_FOLDERS.gemini).toBeUndefined();
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
