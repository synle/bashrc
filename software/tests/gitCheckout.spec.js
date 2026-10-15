/** Runtime checks for the standalone git_checkout wrapper. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GIT_CHECKOUT = path.join(ROOT_DIR, "software/scripts/git.checkout.cjs");

/**
 * Run git in one repo.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test User",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test User",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  }).trim();
}

/**
 * Create a committed repo with a main branch and one feature branch.
 * @returns {{sandbox: string, repo: string, worktree: string}}
 */
function makeRepo() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "git-checkout-"));
  const repo = path.join(sandbox, "repo");
  const worktree = path.join(sandbox, "feature-worktree");
  fs.mkdirSync(repo);

  git(repo, ["init", "--quiet", "--initial-branch=main"]);
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "--quiet", "-m", "init"]);
  git(repo, ["branch", "feature"]);

  return { sandbox, repo, worktree };
}

describe("git_checkout", () => {
  /** @type {string[]} */
  let sandboxes = [];

  beforeEach(() => {
    sandboxes = [];
  });

  afterEach(() => {
    for (const sandbox of sandboxes) {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("should delegate to git checkout when the branch is not in another worktree", () => {
    const { sandbox, repo } = makeRepo();
    sandboxes.push(sandbox);

    const result = spawnSync("node", [GIT_CHECKOUT, "feature"], {
      cwd: repo,
      encoding: "utf8",
      env: process.env,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(git(repo, ["branch", "--show-current"])).toBe("feature");
  });

  it("should print a cd block when the branch already lives in another worktree", () => {
    const { sandbox, repo, worktree } = makeRepo();
    sandboxes.push(sandbox);

    git(repo, ["worktree", "add", "--quiet", worktree, "feature"]);
    const result = spawnSync("node", [GIT_CHECKOUT, "feature"], {
      cwd: repo,
      encoding: "utf8",
      env: process.env,
    });

    const repoReal = fs.realpathSync(repo);
    const worktreeReal = fs.realpathSync(worktree);

    expect(result.status, result.stderr).toBe(0);
    expect(git(repo, ["branch", "--show-current"])).toBe("main");
    expect(result.stderr).not.toContain("already used by worktree");
    expect(result.stdout).toContain("================================================================================");
    expect(result.stdout).toContain('REPO: "repo"');
    expect(result.stdout).toContain('BRANCH: "feature"');
    expect(result.stdout).toContain(`PWD: \"${repoReal}\"`);
    expect(result.stdout).toContain(`cd \"${repoReal}\"`);
    expect(result.stdout).toContain(`cd \"${worktreeReal}\"`);
  });
});
