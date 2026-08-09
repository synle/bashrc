/**
 * Tests for the cwd-scoped `worktree_clean` CLI and shared Git-function
 * installer.
 */
import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_PATH = path.join(ROOT_DIR, "software/scripts/git.worktree_clean.mjs");
const INSTALLER_PATH = path.join(ROOT_DIR, "software/scripts/git-functions.js");
const CLI_SOURCE = fs.readFileSync(CLI_PATH, "utf-8");
const INSTALLER_SOURCE = fs.readFileSync(INSTALLER_PATH, "utf-8");

/**
 * Run Git with isolated identity settings.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {void}
 */
function git(cwd, args) {
  execFileSync("git", ["-c", "user.name=Test User", "-c", "user.email=test@example.com", ...args], { cwd, stdio: "ignore" });
}

/**
 * Create a repository with one committed file on `main`.
 * @param {string} repoRoot
 * @returns {void}
 */
function initRepo(repoRoot) {
  fs.mkdirSync(repoRoot, { recursive: true });
  git(repoRoot, ["init", "--quiet", "--initial-branch=main", "."]);
  fs.writeFileSync(path.join(repoRoot, "README.md"), "initial\n");
  git(repoRoot, ["add", "README.md"]);
  git(repoRoot, ["commit", "--quiet", "-m", "initial"]);
}

/**
 * Create a branch worktree, commit it, and fast-forward `main` to it.
 * @param {string} repoRoot
 * @param {string} worktreePath
 * @param {string} branch
 * @returns {void}
 */
function createMergedWorktree(repoRoot, worktreePath, branch) {
  git(repoRoot, ["worktree", "add", "--quiet", "-b", branch, worktreePath, "main"]);
  fs.writeFileSync(path.join(worktreePath, `${branch}.txt`), "merged\n");
  git(worktreePath, ["add", "."]);
  git(worktreePath, ["commit", "--quiet", "-m", `merge ${branch}`]);
  git(repoRoot, ["merge", "--quiet", "--ff-only", branch]);
}

/**
 * Create a committed but unmerged worktree.
 * @param {string} repoRoot
 * @param {string} worktreePath
 * @param {string} branch
 * @returns {void}
 */
function createActiveWorktree(repoRoot, worktreePath, branch) {
  git(repoRoot, ["worktree", "add", "--quiet", "-b", branch, worktreePath, "main"]);
  fs.writeFileSync(path.join(worktreePath, `${branch}.txt`), "active\n");
  git(worktreePath, ["add", "."]);
  git(worktreePath, ["commit", "--quiet", "-m", `active ${branch}`]);
}

/**
 * Run the real CLI from a selected current working folder.
 * @param {string} cwd
 * @param {string[]} [args]
 * @returns {{status: number, stdout: string, stderr: string}}
 */
function runCli(cwd, args = []) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

describe("worktree_clean", () => {
  it("removes merged worktrees in cwd and nested repositories only", () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-clean-"));
    const scope = path.join(parent, "scope");
    const repo = path.join(scope, "repo");
    const nestedRepo = path.join(scope, "packages", "nested");
    const outsideRepo = path.join(parent, "outside");
    const merged = path.join(scope, "worktrees", "merged");
    const dirty = path.join(scope, "worktrees", "dirty");
    const active = path.join(scope, "worktrees", "active");
    const nestedMerged = path.join(scope, "packages", "nested-worktree");
    const outsideMerged = path.join(parent, "outside-worktree");

    try {
      initRepo(repo);
      createMergedWorktree(repo, merged, "merged");
      createMergedWorktree(repo, dirty, "dirty");
      fs.writeFileSync(path.join(dirty, "local-only.txt"), "keep me\n");
      createActiveWorktree(repo, active, "active");

      initRepo(nestedRepo);
      createMergedWorktree(nestedRepo, nestedMerged, "nested-merged");

      initRepo(outsideRepo);
      createMergedWorktree(outsideRepo, outsideMerged, "outside-merged");

      const result = runCli(scope);

      expect(result.status).toBe(0);
      expect(fs.existsSync(merged)).toBe(false);
      expect(fs.existsSync(nestedMerged)).toBe(false);
      expect(fs.existsSync(dirty)).toBe(true);
      expect(fs.existsSync(active)).toBe(true);
      expect(fs.existsSync(outsideMerged)).toBe(true);
      expect(result.stdout).toContain(`🧭 PWD`);
      expect(result.stdout).toContain(`📦 REPO`);
      expect(result.stdout).toContain(`🧹 REMOVED`);
      expect(result.stdout).toContain(`uncommitted changes`);
      expect(result.stdout).toContain(`branch is not merged`);
      expect(result.stdout).toContain(`kept`);
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("supports dry-run without removing a merged worktree", () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-clean-dry-"));
    const repo = path.join(parent, "repo");
    const merged = path.join(parent, "merged");

    try {
      initRepo(repo);
      createMergedWorktree(repo, merged, "merged");

      const result = runCli(parent, ["--dry-run"]);

      expect(result.status).toBe(0);
      expect(fs.existsSync(merged)).toBe(true);
      expect(result.stdout).toContain(`🧪 WOULD REMOVE`);
      expect(result.stdout).toContain(`would remove 1`);
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("rejects unknown flags", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-clean-args-"));
    try {
      const result = runCli(folder, ["--nope"]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`unknown option`);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it("keeps executable payload and installer syntax valid", () => {
    expect(CLI_SOURCE.startsWith("#!/usr/bin/env node")).toBe(true);
    execFileSync(process.execPath, ["--check", CLI_PATH], { stdio: "ignore" });
    expect(INSTALLER_SOURCE).toContain(`software/scripts/git.pr_list.mjs`);
    expect(INSTALLER_SOURCE).toContain(`software/scripts/git.worktree_clean.mjs`);
    expect(INSTALLER_SOURCE).toContain(`list_prs`);
    expect(INSTALLER_SOURCE).toContain(`worktree_clean`);
    expect(INSTALLER_SOURCE).toMatch(/async function doWork\(\)/);
    expect(INSTALLER_SOURCE).toMatch(/async function undoWork\(\)/);
  });
});
