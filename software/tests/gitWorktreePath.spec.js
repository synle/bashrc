import { describe, it, expect, beforeAll, afterAll } from "vitest";

import fs from "fs";

import os from "os";

import path from "path";

import { execFileSync, spawnSync } from "child_process";

import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const GIT_CONFIG_TEMPLATE = path.join(ROOT_DIR, "software/scripts/git.gitconfig");

const WORKTREE_CREATE_CLI = path.join(ROOT_DIR, "software/scripts/git.worktree_create.cjs");

const ALIAS_NAMES = ["worktree-path", "create-worktree"];

let sandboxDir = "";

let aliasConfigPath = "";

let cliBin = "";

let repoCounter = 0;

function writeAliasConfig() {
  const template = fs.readFileSync(GIT_CONFIG_TEMPLATE, "utf-8");
  const lines = ALIAS_NAMES.map((name) => {
    const line = template.split("\n").find((candidate) => candidate.startsWith(`${name} = `));
    expect(line, `alias '${name}' is missing from git.gitconfig`).toBeTruthy();
    return line;
  });

  const configPath = path.join(sandboxDir, "alias.gitconfig");
  fs.writeFileSync(configPath, `[alias]\n${lines.join("\n")}\n`);
  return configPath;
}

function runGit(args, { cwd, home }) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      HOME: home,
      PATH: `${cliBin}:${process.env.PATH}`,
      GIT_CONFIG_GLOBAL: aliasConfigPath,
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
    },
  });

  return {
    status: result.status ?? 1,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? "").trim(),
  };
}

function makeRepo(name, remoteUrl) {
  // the counter keeps two cases that describe themselves the same way (`409` and `pr-409`
  // both resolve to the pr-409 slot) from landing in one another's sandbox
  repoCounter += 1;
  const slug = `${repoCounter}-${name}`.replace(/[^A-Za-z0-9._-]/g, "_");
  const cwd = path.join(sandboxDir, slug, "repo");
  const home = path.join(sandboxDir, slug, "home");
  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(home, { recursive: true });

  execFileSync("git", ["init", "--quiet", "--initial-branch=main", "."], { cwd, stdio: "ignore" });
  if (remoteUrl) execFileSync("git", ["remote", "add", "origin", remoteUrl], { cwd, stdio: "ignore" });
  return { cwd, home };
}

function worktreePath(context, name) {
  const args = name === undefined ? ["worktree-path"] : ["worktree-path", name];
  const result = runGit(args, context);
  expect(result.status, `git ${args.join(" ")} failed: ${result.stderr}`).toBe(0);
  return result.stdout;
}

describe("git worktree layout", () => {
  beforeAll(() => {
    sandboxDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bashrc-worktree-")));
    cliBin = path.join(sandboxDir, "bin");
    fs.mkdirSync(cliBin);
    fs.copyFileSync(WORKTREE_CREATE_CLI, path.join(cliBin, "worktree_create"));
    fs.chmodSync(path.join(cliBin, "worktree_create"), 0o755);
    aliasConfigPath = writeAliasConfig();
  });

  afterAll(() => {
    if (sandboxDir) fs.rmSync(sandboxDir, { recursive: true, force: true });
  });

  describe("worktree-path", () => {
    it.each([
      ["git@github.com:acme/widget-store.git", "acme", "widget-store"],
      ["https://github.com/acme/widget-store.git", "acme", "widget-store"],
      ["https://github.com/acme/widget-store", "acme", "widget-store"],
      ["ssh://git@github.com/acme/widget-store.git", "acme", "widget-store"],
      // the SSO form real org remotes use, where the ssh user carries a numeric suffix
      ["ssh://org-12345678@github.com/acme/widget-store", "acme", "widget-store"],
      // a nested group: the immediate parent stands in for the owner
      ["git@gitlab.com:acme/tools/widget-store.git", "tools", "widget-store"],
      ["https://github.com/acme/widget-store.git/", "acme", "widget-store"],
    ])("should derive owner and repo from the origin remote %s", (remoteUrl, owner, repo) => {
      const context = makeRepo(`remote-${owner}-${repo}`, remoteUrl);
      expect(worktreePath(context, "topic")).toBe(path.join(context.home, ".worktrees", owner, repo, "topic"));
    });

    it("should never take the owner or repo from the folder name", () => {
      // the exact drift the layout exists to prevent: a checkout folder that disagrees with its remote
      const context = makeRepo("misleading-folder-name", "git@github.com:acme/storage-ui.git");
      expect(worktreePath(context, "topic")).toContain(path.join(".worktrees", "acme", "storage-ui"));
    });

    it.each([
      ["main", "main"],
      ["syle/sw-cache-assets", "syle_sw-cache-assets"],
      ["release/v1.0", "release_v1.0"],
      ["feature/JIRA-123_fix~weird chars!", "feature_JIRA-123_fix_weird_chars"],
      // runs of replaced characters collapse instead of stacking up underscores
      ["a///b", "a_b"],
      ["spaced   out", "spaced_out"],
      // leading and trailing separators are trimmed so the folder never starts with a dot
      [".hidden.", "hidden"],
      ["_lead_trail_", "lead_trail"],
      ["unicode-caf\u00e9-\u00fc", "unicode-caf"],
      ["409", "409"],
      ["pr-409", "pr-409"],
    ])("should encode %s as %s", (name, slot) => {
      const context = makeRepo(`slot-${slot}`, "git@github.com:acme/widget-store.git");
      expect(worktreePath(context, name)).toBe(path.join(context.home, ".worktrees", "acme", "widget-store", slot));
    });

    it("should preserve safe hyphens in branch leaves", () => {
      const context = makeRepo("collision", "git@github.com:acme/widget-store.git");
      expect(worktreePath(context, "pr-409")).toContain(path.join(".worktrees", "acme", "widget-store", "pr-409"));
      expect(worktreePath(context, "feature/pr-409")).toContain(path.join(".worktrees", "acme", "widget-store", "feature_pr-409"));
    });

    it("should keep the repo name out of the leaf folder", () => {
      const context = makeRepo("leaf-prefix", "git@github.com:acme/widget-store.git");
      for (const name of ["main", "409", "syle/topic"]) {
        expect(path.basename(worktreePath(context, name)).startsWith("widget-store")).toBe(false);
      }
    });

    it("should resolve the current branch explicitly", () => {
      const context = makeRepo("default-head", "git@github.com:acme/widget-store.git");
      expect(worktreePath(context, "main")).toContain(path.join(".worktrees", "acme", "widget-store", "main"));
    });

    it("should never emit a path segment that can escape the container folder", () => {
      const context = makeRepo("traversal", "git@github.com:acme/widget-store.git");
      for (const name of ["..", "../../etc", "a/../../b", "..."]) {
        const result = runGit(["worktree-path", name], context);
        if (result.status !== 0) continue;
        const leaf = path.basename(result.stdout);
        expect(leaf.split(path.sep)).toHaveLength(1);
        expect(leaf.startsWith(".")).toBe(false);
        expect(path.resolve(result.stdout).startsWith(path.join(context.home, ".worktrees"))).toBe(true);
      }
    });

    it("should fail loudly when there is no origin remote", () => {
      const context = makeRepo("no-remote", "");
      const result = runGit(["worktree-path", "topic"], context);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("no origin remote");
    });

    it("should fail loudly when the name has no usable characters", () => {
      const context = makeRepo("unusable-name", "git@github.com:acme/widget-store.git");
      const result = runGit(["worktree-path", "///"], context);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("no usable characters");
    });
  });
});
