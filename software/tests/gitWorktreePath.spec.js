/**
 * Guards the canonical git worktree layout produced by the `worktree-path` and
 * `create-worktree` aliases in `software/scripts/git.gitconfig`.
 *
 * Worktree paths used to be spelled out by hand in every agent command doc, which is how
 * `~/.worktrees/<owner>/<repo-pr409-stale-clone>` and a full clone dumped straight into the
 * container folder both ended up on a real machine. The aliases are now the single
 * implementation, so this spec runs them for real — a temp repo, a fake origin, a fake
 * `$HOME` — rather than pattern-matching the config text. Anything that changes the layout,
 * the branch-name encoding, or the primary-checkout guard fails here.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GIT_CONFIG_TEMPLATE = path.join(ROOT_DIR, "software/scripts/git.gitconfig");
const ALIAS_NAMES = ["worktree-path", "create-worktree"];

let sandboxDir = "";
let aliasConfigPath = "";
let repoCounter = 0;

/**
 * Copies the worktree alias lines verbatim out of the shipped gitconfig into a standalone
 * `[alias]` file. Verbatim matters: git does its own unescaping of `\"` and `\\`, so
 * re-quoting the value here would test a different string than the installer writes.
 * @returns {string} Path to the generated alias-only gitconfig.
 */
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

/**
 * Runs git with the worktree aliases loaded and every ambient config isolated away.
 * @param {string[]} args - Arguments passed to git.
 * @param {{cwd: string, home: string}} options - Working folder and the `$HOME` the alias should see.
 * @returns {{status: number, stdout: string, stderr: string}} The captured result.
 */
function runGit(args, { cwd, home }) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      HOME: home,
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

/**
 * Creates an isolated repo whose origin remote is `remoteUrl`, plus its own fake `$HOME`.
 * @param {string} name - Folder name for the repo inside the sandbox.
 * @param {string} remoteUrl - The URL to register as `origin`, or an empty string for none.
 * @returns {{cwd: string, home: string}} Context accepted by `runGit`.
 */
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

/**
 * Resolves the worktree path the aliases would use, asserting the alias itself succeeded.
 * @param {{cwd: string, home: string}} context - Repo context from `makeRepo`.
 * @param {string} [name] - The branch or PR argument; omitted means "use current HEAD".
 * @returns {string} The printed path.
 */
function worktreePath(context, name) {
  const args = name === undefined ? ["worktree-path"] : ["worktree-path", name];
  const result = runGit(args, context);
  expect(result.status, `git ${args.join(" ")} failed: ${result.stderr}`).toBe(0);
  return result.stdout;
}

describe("git worktree layout", () => {
  beforeAll(() => {
    sandboxDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bashrc-worktree-")));
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
      expect(worktreePath(context, "topic")).toBe(path.join(context.home, ".worktrees", owner, repo, `${repo}__branch-topic`));
    });

    it("should never take the owner or repo from the folder name", () => {
      // the exact drift the layout exists to prevent: a checkout folder that disagrees with its remote
      const context = makeRepo("misleading-folder-name", "git@github.com:acme/storage-ui.git");
      expect(worktreePath(context, "topic")).toContain(path.join(".worktrees", "acme", "storage-ui", "storage-ui__"));
    });

    it.each([
      ["main", "branch-main"],
      ["syle/sw-cache-assets", "branch-syle_sw-cache-assets"],
      ["release/v1.0", "branch-release_v1.0"],
      ["feature/JIRA-123_fix~weird chars!", "branch-feature_JIRA-123_fix_weird_chars"],
      // runs of replaced characters collapse instead of stacking up underscores
      ["a///b", "branch-a_b"],
      ["spaced   out", "branch-spaced_out"],
      // leading and trailing separators are trimmed so the folder never starts with a dot
      [".hidden.", "branch-hidden"],
      ["_lead_trail_", "branch-lead_trail"],
      ["unicode-caf\u00e9-\u00fc", "branch-unicode-caf_-"],
      // a number, with or without the prefix, is a PR slot
      ["409", "pr-409"],
      ["pr-409", "pr-409"],
    ])("should encode %s as the %s slot", (name, slot) => {
      const context = makeRepo(`slot-${slot}`, "git@github.com:acme/widget-store.git");
      expect(worktreePath(context, name)).toBe(path.join(context.home, ".worktrees", "acme", "widget-store", `widget-store__${slot}`));
    });

    it("should keep a branch literally named pr-409 from colliding with PR 409", () => {
      const context = makeRepo("collision", "git@github.com:acme/widget-store.git");
      // `pr-409` as a *slot* is the PR; the same text as a *branch* still has to be reachable,
      // which is what the explicit second argument on create-worktree is for.
      expect(worktreePath(context, "pr-409")).toContain("widget-store__pr-409");
      expect(worktreePath(context, "feature/pr-409")).toContain("widget-store__branch-feature_pr-409");
    });

    it("should prefix every leaf folder with the repo name", () => {
      const context = makeRepo("leaf-prefix", "git@github.com:acme/widget-store.git");
      for (const name of ["main", "409", "syle/topic"]) {
        expect(path.basename(worktreePath(context, name)).startsWith("widget-store__")).toBe(true);
      }
    });

    it("should fall back to the current branch when no name is given", () => {
      const context = makeRepo("default-head", "git@github.com:acme/widget-store.git");
      expect(worktreePath(context)).toContain("widget-store__branch-main");
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
      execFileSync(
        "git",
        ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "--message", "init"],
        { cwd: context.cwd, stdio: "ignore" },
      );
      return context;
    }

    it("should create the worktree at the canonical path and print only that path", () => {
      const context = makeCommittedRepo("create-new");
      const result = runGit(["create-worktree", "syle/topic/one"], context);

      expect(result.status, result.stderr).toBe(0);
      // stdout carries the path and nothing else, so `cd "$(git create-worktree x)"` works
      expect(result.stdout.split("\n")).toHaveLength(1);
      expect(result.stdout).toBe(path.join(context.home, ".worktrees", "acme", "widget-store", "widget-store__branch-syle_topic_one"));
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

    it("should honor an explicit slot so PR work lands in a pr-<number> folder", () => {
      const context = makeCommittedRepo("create-pr-slot");
      const result = runGit(["create-worktree", "syle/topic/three", "409"], context);

      expect(result.status, result.stderr).toBe(0);
      expect(path.basename(result.stdout)).toBe("widget-store__pr-409");
    });

    it("should not hard-reset a branch that still holds unpushed commits", () => {
      // `git worktree add -B <branch> origin/<branch>` silently discards local-only commits.
      // An interrupted babysit run leaves exactly that state, so the alias has to check first.
      const origin = path.join(sandboxDir, "unpushed-origin.git");
      execFileSync("git", ["init", "--bare", "--quiet", "--initial-branch=main", origin], { stdio: "ignore" });

      const context = makeCommittedRepo("create-keeps-unpushed");
      const git = (...args) => execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd: context.cwd, stdio: "ignore" });

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
      expect(result.stderr).toContain("usage");
    });
  });
});
