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

describe("create-worktree", () => {
    /**
     * Builds a repo with one commit so `git worktree add` has something to branch from.
     * @param {string} name - Folder name for the repo inside the sandbox.
     * @returns {{cwd: string, home: string}} Context accepted by `runGit`.
     */
    function makeCommittedRepo(name) {
      const context = makeRepo(name, "git@github.com:acme/widget-store.git");
      fs.writeFileSync(path.join(context.cwd, "README.md"), "probe\n");
      execFileSync("git", ["add", "README.md"], { cwd: context.cwd, stdio: "ignore" });
      execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "--message", "init"], {
        cwd: context.cwd,
        stdio: "ignore",
      });
      return context;
    }

    it("should create the worktree at the canonical path and print only that path", () => {
      const context = makeCommittedRepo("create-new");
      const result = runGit(["create-worktree", "syle/topic/one"], context);

      expect(result.status, result.stderr).toBe(0);
      // stdout carries the path and nothing else, so `cd "$(worktree_create x)"` works
      expect(result.stdout.split("\n")).toHaveLength(1);
      expect(result.stdout).toBe(path.join(context.home, ".worktrees", "acme", "widget-store", "syle_topic_one"));
      expect(fs.existsSync(result.stdout)).toBe(true);
    });

    it("should reuse the existing worktree instead of creating a second one", () => {
      const context = makeCommittedRepo("create-reuse");
      const first = runGit(["create-worktree", "syle/topic/two"], context);
      const second = runGit(["create-worktree", "syle/topic/two"], context);

      expect(second.status, second.stderr).toBe(0);
      expect(fs.realpathSync(second.stdout)).toBe(fs.realpathSync(first.stdout));
      expect(second.stderr).toContain("reusing");
    });

    it("should never hand back the primary checkout for a branch checked out there", () => {
      // The regression this guards: matching `branch refs/heads/main` in the porcelain output
      // returns the user's own repo, so an agent told to "work in a worktree" would edit the
      // primary checkout and move the user's HEAD out from under them.
      const context = makeCommittedRepo("create-primary-guard");
      const result = runGit(["create-worktree", "main"], context);

      expect(result.status, result.stderr).toBe(0);
      expect(fs.realpathSync(result.stdout)).not.toBe(fs.realpathSync(context.cwd));
      expect(result.stdout).toContain(path.join(".worktrees", "acme", "widget-store"));
    });

    it("should ignore PR semantics and use only the sanitized branch name", () => {
      const context = makeCommittedRepo("create-pr-slot");
      const result = runGit(["create-worktree", "pr-409"], context);

      expect(result.status, result.stderr).toBe(0);
      expect(path.basename(result.stdout)).toBe("pr-409");
    });

    it("should not hard-reset a branch that still holds unpushed commits", () => {
      // `git worktree add -B <branch> origin/<branch>` silently discards local-only commits.
      // An interrupted babysit run leaves exactly that state, so the alias has to check first.
      const origin = path.join(sandboxDir, "unpushed-origin.git");
      execFileSync("git", ["init", "--bare", "--quiet", "--initial-branch=main", origin], { stdio: "ignore" });

      const context = makeCommittedRepo("create-keeps-unpushed");
      const git = (...args) =>
        execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd: context.cwd, stdio: "ignore" });

      git("remote", "set-url", "origin", origin);
      git("push", "--quiet", "origin", "main");
      git("switch", "--quiet", "-c", "syle/topic");
      git("push", "--quiet", "--set-upstream", "origin", "syle/topic");

      fs.writeFileSync(path.join(context.cwd, "local-only.txt"), "unpushed\n");
      git("add", "local-only.txt");
      git("commit", "--quiet", "--message", "local only");
      const unpushedSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: context.cwd, encoding: "utf-8" }).trim();
      git("switch", "--quiet", "main");

      const result = runGit(["create-worktree", "syle/topic"], context);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("unpushed");

      const worktreeHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: result.stdout, encoding: "utf-8" }).trim();
      expect(worktreeHead).toBe(unpushedSha);
      expect(fs.existsSync(path.join(result.stdout, "local-only.txt"))).toBe(true);
    });

    it("should require a branch name", () => {
      const context = makeCommittedRepo("create-no-args");
      const result = runGit(["create-worktree"], context);

      expect(result.status).not.toBe(0);
      expect(result.stderr.toLowerCase()).toContain("usage");
    });
  })
});
