/** Tests for software/scripts/advanced/llm/memory-bridge.standalone.js. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_PATH = path.join(ROOT_DIR, "software/scripts/advanced/llm/memory-bridge.standalone.js");
const COMMON_JS_PATH = path.join(ROOT_DIR, "software/common.js");

// Real `replaceBlock` — loaded from common.js so the test exercises the actual marker
// behavior rather than a stub.
const { replaceBlock } = require(COMMON_JS_PATH);

/**
 * Loads the standalone script into a vm sandbox seeded with real `fs` and `path`
 * plus stubs for the few index.js globals the script consumes (`replaceBlock`,
 * `backupConfigFile`, `writeText`, `log`, `BASE_HOMEDIR_LINUX`).
 *
 * @param {string} fakeHome - Absolute path to a tmpdir to use as `BASE_HOMEDIR_LINUX`.
 * @returns {Record<string, any>} The populated sandbox (callers invoke `sandbox.doWork()`).
 */
function loadSandbox(fakeHome) {
  const src = fs.readFileSync(SCRIPT_PATH, "utf-8");
  const varSrc = src.replace(/^(const|let|var) /gm, "var ");
  const sandbox = {
    fs,
    path,
    log: () => {},
    BASE_HOMEDIR_LINUX: fakeHome,
    replaceBlock,
    backupConfigFile: async () => {},
    writeText: async (filePath, text) => {
      fs.writeFileSync(filePath, text);
    },
  };
  vm.runInNewContext(varSrc, sandbox);
  return sandbox;
}

/**
 * Materializes a fake project under `<fakeHome>/.claude/projects/<encoded>/memory/`
 * with the supplied MEMORY.md content and a content map for the linked files.
 *
 * @param {string} fakeHome - Absolute path to the fake home dir.
 * @param {string} encodedName - Encoded project folder name (e.g. `-Users-syle-git-foo`).
 * @param {string} memoryIndex - Body for the `MEMORY.md` index file.
 * @param {Record<string, string>} [linkedFiles={}] - File-name → content for each linked memory record.
 */
function makeProject(fakeHome, encodedName, memoryIndex, linkedFiles = {}) {
  const dir = path.join(fakeHome, ".claude/projects", encodedName, "memory");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "MEMORY.md"), memoryIndex);
  for (const [name, content] of Object.entries(linkedFiles)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

/**
 * Pre-seeds the target instruction files so the bridge has somewhere to write.
 * Mirrors what `<cli>/setup.js` would have left behind on a real machine.
 *
 * @param {string} fakeHome - Absolute path to the fake home dir.
 * @param {string[]} which - Subset of `["copilot", "gemini", "opencode"]` to seed.
 */
function seedTargets(fakeHome, which) {
  const targets = {
    copilot: path.join(fakeHome, ".copilot/AGENTS.md"),
    gemini: path.join(fakeHome, ".gemini/GEMINI.md"),
    opencode: path.join(fakeHome, ".config/opencode/AGENTS.md"),
  };
  for (const name of which) {
    const target = targets[name];
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "# Existing user content\n");
  }
}

let fakeHome;

beforeEach(() => {
  // Prefix is dash-free on purpose: the in-script decoder reverses Claude's
  // `/`→`-` encoding to look up real `~/git/<repo>` paths on disk, so a
  // fakeHome with dashes in its components (e.g. `/tmp/memory-bridge-test-`)
  // would scramble the round-trip and make the decoder tests undecidable.
  fakeHome = fs.mkdtempSync("/tmp/memorybridge");
});

afterEach(() => {
  fs.rmSync(fakeHome, { recursive: true, force: true });
});

describe("memory-bridge.standalone.js", () => {
  it("no-ops when ~/.claude/projects/ does not exist", async () => {
    const sandbox = loadSandbox(fakeHome);
    await expect(sandbox.doWork()).resolves.toBeUndefined();
  });

  it("no-ops when no project has a memory/ subfolder", async () => {
    fs.mkdirSync(path.join(fakeHome, ".claude/projects/-some-encoded"), { recursive: true });
    seedTargets(fakeHome, ["copilot"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();
    const after = fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8");
    expect(after).toBe("# Existing user content\n");
  });

  it("renders a single project's memory into all three targets", async () => {
    makeProject(fakeHome, "-Users-syle-git-foo", "- [User machine](user_machine.md) — laptop notes\n", {
      "user_machine.md": "---\nname: user-machine\n---\n\nNew MacBook M3",
    });
    seedTargets(fakeHome, ["copilot", "gemini", "opencode"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();

    for (const target of [
      path.join(fakeHome, ".copilot/AGENTS.md"),
      path.join(fakeHome, ".gemini/GEMINI.md"),
      path.join(fakeHome, ".config/opencode/AGENTS.md"),
    ]) {
      const content = fs.readFileSync(target, "utf-8");
      expect(content).toContain("# Existing user content");
      expect(content).toContain("BEGIN synle/bashrc | software/scripts/advanced/llm/memory-bridge");
      expect(content).toContain("END synle/bashrc | software/scripts/advanced/llm/memory-bridge");
      expect(content).toContain("# Persistent Context");
      expect(content).toContain("user_machine.md");
      expect(content).toContain("New MacBook M3");
      expect(content).toContain("-Users-syle-git-foo");
    }
  });

  it("is idempotent — a second run produces the same file", async () => {
    makeProject(fakeHome, "-Users-syle-git-foo", "- [M](m.md) — x\n", { "m.md": "body" });
    seedTargets(fakeHome, ["copilot"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();
    const first = fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8");
    await sandbox.doWork();
    const second = fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8");
    expect(second).toBe(first);
  });

  it("skips targets that are not present on disk yet", async () => {
    makeProject(fakeHome, "-Users-syle-git-foo", "- [M](m.md) — x\n", { "m.md": "body" });
    // Only copilot is set up; gemini + opencode are absent.
    seedTargets(fakeHome, ["copilot"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();
    expect(fs.existsSync(path.join(fakeHome, ".gemini/GEMINI.md"))).toBe(false);
    expect(fs.existsSync(path.join(fakeHome, ".config/opencode/AGENTS.md"))).toBe(false);
    expect(fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8")).toContain("# Persistent Context");
  });

  it("renders every linked file in the index", async () => {
    makeProject(fakeHome, "-Users-syle-git-foo", "- [A](a.md) — alpha\n- [B](b.md) — beta\n- [C](c.md) — gamma\n", {
      "a.md": "alpha body",
      "b.md": "beta body",
      "c.md": "gamma body",
    });
    seedTargets(fakeHome, ["copilot"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();
    const content = fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8");
    expect(content).toContain("alpha body");
    expect(content).toContain("beta body");
    expect(content).toContain("gamma body");
    // Order is preserved.
    expect(content.indexOf("alpha body")).toBeLessThan(content.indexOf("beta body"));
    expect(content.indexOf("beta body")).toBeLessThan(content.indexOf("gamma body"));
  });

  it("surfaces a placeholder for an index entry whose target file is missing", async () => {
    makeProject(fakeHome, "-Users-syle-git-foo", "- [Ghost](ghost.md) — missing on disk\n", {});
    seedTargets(fakeHome, ["copilot"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();
    const content = fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8");
    expect(content).toContain("(file missing on disk:");
    expect(content).toContain("ghost.md");
  });

  it("renders multiple projects with stable ordering (lexicographic by encoded name)", async () => {
    makeProject(fakeHome, "-Users-syle-git-foo", "- [F](f.md) — foo\n", { "f.md": "foo body" });
    makeProject(fakeHome, "-Users-syle-git-bar", "- [B](b.md) — bar\n", { "b.md": "bar body" });
    seedTargets(fakeHome, ["copilot"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();
    const content = fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8");
    // `-Users-syle-git-bar` sorts before `-Users-syle-git-foo`.
    expect(content.indexOf("bar body")).toBeLessThan(content.indexOf("foo body"));
  });

  it("decodes a project name to the real ~/git/<repo> path when the repo exists, preserving multi-`-` names", async () => {
    // The decoder validates against `BASE_HOMEDIR_LINUX/git/<repo>` on disk, so
    // the encoded project name must encode a path under `fakeHome` (the value we
    // pass as BASE_HOMEDIR_LINUX). Build the encoded name from fakeHome itself
    // so the test stays hermetic instead of poking the user's real `/Users/...`.
    /** @type {string} Encoded form of `<fakeHome>/git/display-dj` — every `/` becomes `-`. */
    const encoded = `${fakeHome}/git/display-dj`.replace(/\//g, "-");
    fs.mkdirSync(path.join(fakeHome, "git/display-dj"), { recursive: true });
    makeProject(fakeHome, encoded, "- [M](m.md) — x\n", { "m.md": "body" });
    seedTargets(fakeHome, ["copilot"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();
    const content = fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8");
    expect(content).toContain("~/git/display-dj");
  });

  it("falls back to the naive decode when the candidate ~/git/<repo> path does not exist", async () => {
    // No matching dir under `<fakeHome>/git/` — decoder should fall back to the
    // naive `/Users/syle/git/nonexistent` decode (since the encoded name encodes
    // that path verbatim).
    makeProject(fakeHome, "-Users-syle-git-nonexistent", "- [M](m.md) — x\n", { "m.md": "body" });
    seedTargets(fakeHome, ["copilot"]);
    const sandbox = loadSandbox(fakeHome);
    await sandbox.doWork();
    const content = fs.readFileSync(path.join(fakeHome, ".copilot/AGENTS.md"), "utf-8");
    expect(content).toContain("/Users/syle/git/nonexistent");
  });
});
