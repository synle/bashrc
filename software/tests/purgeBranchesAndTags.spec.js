/** Real Git fixtures for current-repository branch and tag purging. */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

/** Git profile partial loaded through the shell's normal source path. */
const PROFILE = path.resolve("software/scripts/bash-git-helpers.profile.bash");
/** Owned disposable repository folders. */
const FOLDERS = [];

afterEach(() => {
  for (const folder of FOLDERS.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Execute native Git in an owned fixture, throwing on setup failures.
 * @param {string} folder Repository folder.
 * @param {string[]} args Git arguments.
 * @returns {string} Trimmed stdout.
 * @throws {Error} If Git fails or exceeds its deadline.
 */
function git(folder, args) {
  const result = spawnSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    timeout: 2000,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
  return result.stdout.trim();
}

/**
 * Create a repository with an unmerged topic, a tag, and an untouched remote-tracking ref.
 * @param {string} [branch="main"] Initial default branch.
 * @returns {string} Owned repository folder.
 * @throws {Error} If filesystem or Git setup fails.
 */
function fixture(branch = "main") {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "purge-refs-"));
  FOLDERS.push(folder);
  git(folder, ["init", "-b", branch]);
  git(folder, ["config", "user.name", "Fixture"]);
  git(folder, ["config", "user.email", "fixture@example.invalid"]);
  git(folder, ["commit", "--allow-empty", "-m", "initial"]);
  git(folder, ["update-ref", `refs/remotes/origin/${branch}`, "HEAD"]);
  git(folder, ["symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/origin/${branch}`]);
  git(folder, ["checkout", "-b", "topic/quote's"]);
  git(folder, ["commit", "--allow-empty", "-m", "unmerged"]);
  git(folder, ["tag", "local-tag"]);
  return folder;
}

/**
 * Load the complete profile partial and invoke the public shell helper.
 * @param {string} folder Invocation folder.
 * @param {string[]} [args=[]] Helper arguments.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and captured output.
 */
function purge(folder, args = []) {
  return spawnSync(
    "/bin/bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `
function is_help_arg() { [ "\${1:-}" = "--help" ]; }
function safe_source() { /bin/bash -n "$1" && source "$1"; }
safe_source "$1" || exit
shift
purge_branches_and_tags "$@"
`,
      "test",
      PROFILE,
      ...args,
    ],
    {
      cwd: folder,
      encoding: "utf8",
      timeout: 3000,
      env: { ...process.env, BASH_ENV: "/dev/null", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    },
  );
}

describe("purge_branches_and_tags", () => {
  it.each(["main", "master", "trunk"])("keeps detected default %s and remote refs while deleting unmerged local refs", (branch) => {
    const folder = fixture(branch);
    fs.writeFileSync(path.join(folder, "untracked.txt"), "keep\n");
    const result = purge(folder);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`keeping default branch '${branch}'`);
    expect(git(folder, ["for-each-ref", "--format=%(refname)"])).toBe(
      `refs/heads/${branch}\nrefs/remotes/origin/HEAD\nrefs/remotes/origin/${branch}`,
    );
    expect(git(folder, ["branch", "--show-current"])).toBe(branch);
    expect(fs.readFileSync(path.join(folder, "untracked.txt"), "utf8")).toBe("keep\n");
    expect(purge(folder).status).toBe(0);
  });

  it.each(["main", "master"])("falls back to local %s without origin refs", (branch) => {
    const folder = fixture(branch);
    git(folder, ["symbolic-ref", "--delete", "refs/remotes/origin/HEAD"]);
    git(folder, ["update-ref", "-d", `refs/remotes/origin/${branch}`]);
    const result = purge(folder);
    expect(result.status).toBe(0);
    expect(git(folder, ["for-each-ref", "--format=%(refname)"])).toBe(`refs/heads/${branch}`);
  });

  it.each([
    { args: ["--dry-run"], status: 0, output: "would delete local tag 'local-tag'" },
    { args: ["--help"], status: 0, output: "purge_branches_and_tags:" },
    { args: ["--invalid"], status: 1, output: "expected no arguments or --dry-run" },
    { args: ["--dry-run", "extra"], status: 1, output: "expected no arguments or --dry-run" },
  ])("preserves every ref and checkout for $args", ({ args, status, output }) => {
    const folder = fixture();
    const before = git(folder, ["show-ref"]);
    const result = purge(folder, args);
    expect(result.status).toBe(status);
    expect(result.stdout + result.stderr).toContain(output);
    expect(git(folder, ["show-ref"])).toBe(before);
    expect(git(folder, ["branch", "--show-current"])).toBe("topic/quote's");
  });

  it("fails without changing refs when default is unknown", () => {
    const folder = fixture("trunk");
    git(folder, ["symbolic-ref", "--delete", "refs/remotes/origin/HEAD"]);
    const before = git(folder, ["show-ref"]);
    const result = purge(folder);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("default branch must exist locally; nothing deleted");
    expect(git(folder, ["show-ref"])).toBe(before);
  });

  it("stops before deleting refs when checkout would overwrite working files", () => {
    const folder = fixture();
    fs.writeFileSync(path.join(folder, "tracked.txt"), "topic\n");
    git(folder, ["add", "tracked.txt"]);
    git(folder, ["commit", "-m", "topic file"]);
    fs.writeFileSync(path.join(folder, "tracked.txt"), "dirty\n");
    const before = git(folder, ["show-ref"]);
    const result = purge(folder);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("would be overwritten by checkout");
    expect(git(folder, ["show-ref"])).toBe(before);
    expect(fs.readFileSync(path.join(folder, "tracked.txt"), "utf8")).toBe("dirty\n");
  });

  it("reports linked-worktree branch deletion failure and retains its files and tags", () => {
    const folder = fixture();
    git(folder, ["checkout", "main"]);
    const linked = path.join(folder, "linked");
    git(folder, ["worktree", "add", linked, "topic/quote's"]);
    const result = purge(folder);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("used by worktree");
    expect(git(folder, ["branch", "--list", "topic/quote's"])).toContain("topic/quote's");
    expect(git(folder, ["tag", "--list"])).toBe("local-tag");
    expect(fs.existsSync(path.join(linked, ".git"))).toBe(true);
  });
});
