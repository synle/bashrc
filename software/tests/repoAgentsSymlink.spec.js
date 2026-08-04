/** Tests for software/scripts/advanced/llm/repo-agents-symlink.standalone.js. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_PATH = path.join(ROOT_DIR, "software/scripts/advanced/llm/repo-agents-symlink.standalone.js");

/**
 * Loads the standalone script into a vm sandbox seeded with the globals the
 * script consumes from index.js (`fs`, `path`, `log`, `BASE_HOMEDIR_LINUX`,
 * `process.env`). Real `fs` is intentional — the script's only side effects
 * are symlink/lstat/readdir ops, and we want to exercise them against real
 * tmpdirs.
 *
 * @param {Record<string, string>} env - Env-var overrides to expose under process.env (e.g. BASHRC_AGENTS_REPO_ROOTS).
 * @returns {Record<string, any>} The populated sandbox (callers invoke `sandbox.doWork()`).
 */
function loadSandbox(env) {
  const src = fs.readFileSync(SCRIPT_PATH, "utf-8");
  const varSrc = src.replace(/^(const|let|var) /gm, "var ");
  const sandbox = {
    fs,
    path,
    log: () => {},
    BASE_HOMEDIR_LINUX: os.homedir(),
    process: { env: { ...env } },
  };
  vm.runInNewContext(varSrc, sandbox);
  return sandbox;
}

/**
 * Materializes a fake git repo under `tmpRoot/<name>/` with optional files
 * pre-seeded. Always drops a `.git/` folder so `_findGitReposIn` treats it
 * as a repo.
 *
 * @param {string} tmpRoot - Absolute path to the parent dir holding the fake repos.
 * @param {string} name - Repo folder name.
 * @param {Record<string, string>} [files={}] - File-name → content map to seed at the repo root.
 * @returns {string} Absolute path to the created repo.
 */
function makeRepo(tmpRoot, name, files = {}) {
  const repo = path.join(tmpRoot, name);
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  for (const [fname, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(repo, fname), content);
  }
  return repo;
}

let tmpRoot;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync("/tmp/repo-agents-test-");
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("repo-agents-symlink.standalone.js", () => {
  it("creates relative AGENTS.md -> CLAUDE.md symlink when AGENTS.md is missing", async () => {
    makeRepo(tmpRoot, "repo1", { "CLAUDE.md": "rules content" });
    const sandbox = loadSandbox({ BASHRC_AGENTS_REPO_ROOTS: tmpRoot });
    await sandbox.doWork();
    const link = path.join(tmpRoot, "repo1", "AGENTS.md");
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(link)).toBe("CLAUDE.md");
    expect(fs.readFileSync(link, "utf-8")).toBe("rules content");
  });

  it("skips repos that don't have a CLAUDE.md", async () => {
    makeRepo(tmpRoot, "no-claude", {});
    const sandbox = loadSandbox({ BASHRC_AGENTS_REPO_ROOTS: tmpRoot });
    await sandbox.doWork();
    expect(fs.existsSync(path.join(tmpRoot, "no-claude", "AGENTS.md"))).toBe(false);
  });

  it("is idempotent — leaves an existing AGENTS.md -> CLAUDE.md symlink alone", async () => {
    const repo = makeRepo(tmpRoot, "already-linked", { "CLAUDE.md": "rules" });
    fs.symlinkSync("CLAUDE.md", path.join(repo, "AGENTS.md"));
    const before = fs.lstatSync(path.join(repo, "AGENTS.md")).mtimeMs;
    const sandbox = loadSandbox({ BASHRC_AGENTS_REPO_ROOTS: tmpRoot });
    await sandbox.doWork();
    const after = fs.lstatSync(path.join(repo, "AGENTS.md")).mtimeMs;
    expect(after).toBe(before);
    expect(fs.readlinkSync(path.join(repo, "AGENTS.md"))).toBe("CLAUDE.md");
  });

  it("does not clobber an existing AGENTS.md regular file", async () => {
    const repo = makeRepo(tmpRoot, "with-existing-file", {
      "CLAUDE.md": "claude rules",
      "AGENTS.md": "hand-written agent rules",
    });
    const sandbox = loadSandbox({ BASHRC_AGENTS_REPO_ROOTS: tmpRoot });
    await sandbox.doWork();
    const agents = path.join(repo, "AGENTS.md");
    expect(fs.lstatSync(agents).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(agents, "utf-8")).toBe("hand-written agent rules");
  });

  it("does not clobber a foreign symlink pointing somewhere other than CLAUDE.md", async () => {
    const repo = makeRepo(tmpRoot, "foreign-link", {
      "CLAUDE.md": "claude rules",
      "OTHER.md": "other content",
    });
    fs.symlinkSync("OTHER.md", path.join(repo, "AGENTS.md"));
    const sandbox = loadSandbox({ BASHRC_AGENTS_REPO_ROOTS: tmpRoot });
    await sandbox.doWork();
    expect(fs.readlinkSync(path.join(repo, "AGENTS.md"))).toBe("OTHER.md");
  });

  it("walks multiple repo roots from comma-separated env var", async () => {
    const rootA = fs.mkdtempSync("/tmp/repo-agents-test-rootA-");
    const rootB = fs.mkdtempSync("/tmp/repo-agents-test-rootB-");
    try {
      makeRepo(rootA, "alpha", { "CLAUDE.md": "a" });
      makeRepo(rootB, "beta", { "CLAUDE.md": "b" });
      const sandbox = loadSandbox({ BASHRC_AGENTS_REPO_ROOTS: `${rootA},${rootB}` });
      await sandbox.doWork();
      expect(fs.readlinkSync(path.join(rootA, "alpha", "AGENTS.md"))).toBe("CLAUDE.md");
      expect(fs.readlinkSync(path.join(rootB, "beta", "AGENTS.md"))).toBe("CLAUDE.md");
    } finally {
      fs.rmSync(rootA, { recursive: true, force: true });
      fs.rmSync(rootB, { recursive: true, force: true });
    }
  });

  it("skips a configured repo root that doesn't exist on disk without throwing", async () => {
    makeRepo(tmpRoot, "real-repo", { "CLAUDE.md": "rules" });
    const sandbox = loadSandbox({ BASHRC_AGENTS_REPO_ROOTS: `/nonexistent-foo,${tmpRoot}` });
    await sandbox.doWork();
    expect(fs.readlinkSync(path.join(tmpRoot, "real-repo", "AGENTS.md"))).toBe("CLAUDE.md");
  });

  it("skips top-level entries that are not git repos (no .git child)", async () => {
    fs.mkdirSync(path.join(tmpRoot, "not-a-repo"), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, "not-a-repo", "CLAUDE.md"), "rules");
    const sandbox = loadSandbox({ BASHRC_AGENTS_REPO_ROOTS: tmpRoot });
    await sandbox.doWork();
    expect(fs.existsSync(path.join(tmpRoot, "not-a-repo", "AGENTS.md"))).toBe(false);
  });

  it("expands ~ in the configured repo root", async () => {
    // Real $HOME is on the user's machine — point ~ at a tmpdir via $HOME override.
    const fakeHome = fs.mkdtempSync("/tmp/repo-agents-test-home-");
    try {
      makeRepo(fakeHome, "home-repo", { "CLAUDE.md": "rules" });
      const src = fs.readFileSync(SCRIPT_PATH, "utf-8");
      const varSrc = src.replace(/^(const|let|var) /gm, "var ");
      const sandbox = {
        fs,
        path,
        log: () => {},
        BASE_HOMEDIR_LINUX: fakeHome,
        process: { env: { BASHRC_AGENTS_REPO_ROOTS: "~" } },
      };
      vm.runInNewContext(varSrc, sandbox);
      await sandbox.doWork();
      expect(fs.readlinkSync(path.join(fakeHome, "home-repo", "AGENTS.md"))).toBe("CLAUDE.md");
    } finally {
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});
