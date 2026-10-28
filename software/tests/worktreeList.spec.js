/** Contract tests for the standalone read-only worktree inventory command. */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

/** @type {string} Repository root containing the payload and installer. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** @type {string} Standalone executable source. */
const CLI = path.join(ROOT, "software/scripts/git.worktree_list.cjs");
/** @type {string} Immutable committed repository copied into each independent fixture. */
let seed;
/** @type {string[]} Temporary fixture roots owned by the current test. */
const fixtures = [];

/**
 * Run local Git with isolated configuration and no hooks or network access.
 * @param {string} cwd Working folder.
 * @param {string[]} args Git arguments.
 * @returns {void} Creates or modifies only the test's private repository.
 */
function git(cwd, args) {
  execFileSync("git", ["-c", "user.name=Test User", "-c", "user.email=test@example.com", "-c", `core.hooksPath=${os.devNull}`, ...args], {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" },
    stdio: "ignore",
    timeout: 10000,
  });
}

/**
 * Allocate one private fixture, resolving macOS temporary-folder symlinks.
 * @returns {string} Absolute fixture root registered for cleanup.
 */
function fixture() {
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-list-")));
  fixtures.push(folder);
  return folder;
}

/**
 * Copy an immutable seed so each test owns its complete repository state.
 * @param {string} folder Destination repository root.
 * @returns {void} Writes the fixture repository.
 */
function repo(folder) {
  fs.cpSync(seed, folder, { recursive: true });
}

/**
 * Execute the public CLI with bounded runtime and captured output.
 * @param {string} cwd Discovery root.
 * @param {string[]} [args] CLI arguments.
 * @param {NodeJS.ProcessEnv} [env] Environment overrides.
 * @returns {ReturnType<typeof spawnSync>} Process status and output.
 */
function run(cwd, args = [], env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1", ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10000,
  });
}

beforeAll(() => {
  seed = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-list-seed-")));
  git(seed, ["init", "--quiet", "--initial-branch=main"]);
  git(seed, ["commit", "--quiet", "--allow-empty", "-m", "initial"]);
});
afterEach(() => {
  for (const folder of fixtures.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});
afterAll(() => fs.rmSync(seed, { recursive: true, force: true }));

describe("worktree_list", () => {
  it("returns exact raw fields, deduplicates linked checkouts, and limits discovery scope", () => {
    const parent = fixture();
    const scope = path.join(parent, "scope");
    const root = path.join(scope, "local-name");
    const nested = path.join(scope, "packages", "nested");
    repo(root);
    repo(nested);
    repo(path.join(parent, "outside"));
    repo(path.join(scope, ".hidden"));
    repo(path.join(scope, "node_modules", "ignored"));
    fs.symlinkSync(path.join(parent, "outside"), path.join(scope, "symlink"), "dir");
    git(root, ["remote", "add", "origin", "git@example.invalid:acme/widget-store.git"]);
    git(nested, ["remote", "add", "origin", "https://example.invalid/other/nested.git"]);
    git(root, ["worktree", "add", "--quiet", "-b", "inside", path.join(scope, "linked")]);
    git(root, ["worktree", "add", "--quiet", "-b", "feature/list", path.join(parent, "external tree")]);
    fs.writeFileSync(path.join(parent, "external tree", "untracked.txt"), "preserve me\n");
    const before = execFileSync("git", ["worktree", "list", "--porcelain", "-z"], { cwd: root });

    const result = run(scope, ["--raw"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout.replaceAll(parent, "<fixture>"))).toMatchInlineSnapshot(`
      [
        {
          "branch_name": "main",
          "org": "acme",
          "repo": "widget-store",
          "root_path": "<fixture>/scope/local-name",
          "worktree_path": "<fixture>/scope/local-name",
        },
        {
          "branch_name": "feature/list",
          "org": "acme",
          "repo": "widget-store",
          "root_path": "<fixture>/scope/local-name",
          "worktree_path": "<fixture>/external tree",
        },
        {
          "branch_name": "inside",
          "org": "acme",
          "repo": "widget-store",
          "root_path": "<fixture>/scope/local-name",
          "worktree_path": "<fixture>/scope/linked",
        },
        {
          "branch_name": "main",
          "org": "other",
          "repo": "nested",
          "root_path": "<fixture>/scope/packages/nested",
          "worktree_path": "<fixture>/scope/packages/nested",
        },
      ]
    `);
    expect(execFileSync("git", ["worktree", "list", "--porcelain", "-z"], { cwd: root })).toEqual(before);
    expect(fs.readFileSync(path.join(parent, "external tree", "untracked.txt"), "utf8")).toBe("preserve me\n");
  });

  it("prints the requested default pretty layout and accepts explicit pretty mode", () => {
    const root = path.join(fixture(), "repo");
    repo(root);
    git(root, ["remote", "add", "origin", "https://example.invalid/acme/widget-store.git"]);
    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`\u{1f4e6} acme/widget-store \ue0b1 ${root}\n\u{1f333} \ue0b1 main ${root}\n`);
    const explicit = run(root, ["--pretty"]);
    expect(explicit.status).toBe(0);
    expect(explicit.stdout).toBe(result.stdout);
  });

  it("resolves the primary root when invoked from a linked worktree subfolder", () => {
    const parent = fixture();
    const root = path.join(parent, "repo");
    const linked = path.join(parent, "linked");
    repo(root);
    git(root, ["worktree", "add", "--quiet", "-b", "feature/list", linked]);
    fs.mkdirSync(path.join(linked, "subfolder"));
    const result = run(path.join(linked, "subfolder"), ["--raw"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      { branch_name: "main", org: null, repo: "repo", root_path: root, worktree_path: root },
      { branch_name: "feature/list", org: null, repo: "repo", root_path: root, worktree_path: linked },
    ]);
  });

  it("preserves unusual paths in JSON and escapes terminal controls in pretty output", () => {
    const parent = fixture();
    const root = path.join(parent, "repo");
    const linked = path.join(parent, 'space \tline\nquote"\\\u2603');
    repo(root);
    git(root, ["worktree", "add", "--quiet", "--detach", linked]);
    const result = run(root, ["--raw"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)[1]).toEqual({ branch_name: null, org: null, repo: "repo", root_path: root, worktree_path: linked });
    const pretty = run(root);
    expect(pretty.status).toBe(0);
    expect(pretty.stdout).toContain(`\u{1f333} \ue0b1 (detached) ${parent}/space \\u0009line\\u000aquote"\\\u2603\n`);
  });

  it("lists bare repositories with a null branch and a bare display label", () => {
    const root = path.join(fixture(), "bare.git");
    fs.mkdirSync(root);
    git(root, ["init", "--quiet", "--bare"]);
    const raw = run(root, ["--raw"]);
    expect(raw.status).toBe(0);
    expect(JSON.parse(raw.stdout)).toEqual([{ branch_name: null, org: null, repo: "bare.git", root_path: root, worktree_path: root }]);
    const pretty = run(root);
    expect(pretty.status).toBe(0);
    expect(pretty.stdout).toContain(`\u{1f333} \ue0b1 (bare) ${root}\n`);
  });

  it.each([
    ["ssh://git@example.invalid:2222/acme/widget-store.git", "acme", "widget-store"],
    ["https://example.invalid/team/subgroup/widget-store.git/", "team/subgroup", "widget-store"],
    ["/local/remotes/project.git", null, "repo"],
  ])("derives identity from %s without remote requests", (origin, org, name) => {
    const root = path.join(fixture(), "repo");
    repo(root);
    git(root, ["remote", "add", "origin", origin]);
    const result = run(root, ["--raw"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)[0]).toEqual({ branch_name: "main", org, repo: name, root_path: root, worktree_path: root });
  });

  it("reports malformed origin URLs without leaking their contents", () => {
    const root = path.join(fixture(), "repo");
    repo(root);
    git(root, ["remote", "add", "origin", "https://[invalid/acme/repo.git"]);
    const result = run(root, ["--raw"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(`worktree_list: invalid origin URL in ${root}\n`);
  });

  it("includes depth three and excludes deeper repositories", () => {
    const parent = fixture();
    const included = path.join(parent, "one", "two", "three");
    repo(included);
    repo(path.join(parent, "deep", "two", "three", "four"));
    const result = run(parent, ["--raw"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      { branch_name: "main", org: null, repo: "three", root_path: included, worktree_path: included },
    ]);
  });

  it("handles an empty scope in both modes", () => {
    const root = fixture();
    const raw = run(root, ["--raw"]);
    expect(raw.status).toBe(0);
    expect(raw.stdout).toBe("[]\n");
    const pretty = run(root);
    expect(pretty.status).toBe(0);
    expect(pretty.stdout).toBe("No Git repositories found.\n");
  });

  it.each(["--help", "-h"])("shows %s without inspecting Git", (flag) => {
    const result = run(fixture(), [flag], { PATH: "" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: worktree_list [--raw | --pretty]");
    expect(result.stderr).toBe("");
  });

  it.each([["--unknown"], ["--raw", "--pretty"]])("rejects invalid arguments %s", (...args) => {
    const result = run(fixture(), args);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("worktree_list:");
  });

  it("installs a runnable worktree_list payload and removes it through the shared installer", async () => {
    const home = fixture();
    const context = vm.createContext({
      fs,
      path,
      BASE_HOMEDIR_LINUX: home,
      IS_DRY_RUN: false,
      readText: async (strings, ...values) => fs.readFileSync(path.join(ROOT, String.raw(strings, ...values)), "utf8"),
      writeText: async (target, content) => fs.writeFileSync(target, content),
      log: () => {},
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, "software/scripts/git-functions.js"), "utf8"), context);
    await vm.runInContext("doWork()", context);
    const installed = path.join(home, ".local", "bin", "worktree_list");
    const result = spawnSync(process.execPath, [installed, "--raw"], { cwd: home, encoding: "utf8", timeout: 10000 });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("[]\n");
    expect(fs.statSync(installed).mode & 0o777).toBe(0o755);
    await vm.runInContext("undoWork()", context);
    expect(fs.existsSync(installed)).toBe(false);
  });

  it("reports unavailable Git instead of returning an empty inventory", () => {
    const result = run(fixture(), ["--raw"], { PATH: "" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("ENOENT");
  });
});
