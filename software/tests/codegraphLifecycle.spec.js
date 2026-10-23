import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { createInstrumenter } from "istanbul-lib-instrument";
import { createCoverageMap } from "istanbul-lib-coverage";

/** Actual executable payloads; tests execute copies through their public CLI. */
const REFRESH = path.resolve("software/scripts/git.codegraph_refresh.cjs");
const CREATE = path.resolve("software/scripts/git.worktree_create.cjs");
let sandbox;
let workspace;
let bin;
let env;

/**
 * Run Git against this test's isolated repository.
 * @param {string[]} args Git arguments.
 * @returns {string} Git stdout; throws if the fixture cannot be prepared.
 */
function git(args) {
  const result = spawnSync("/usr/bin/git", args, { cwd: workspace, env, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

/**
 * Install the exact payload, optionally instrumented for child-process coverage.
 * @param {string} source Original payload path.
 * @param {string} name Installed command name.
 * @returns {void} Writes only inside the test sandbox.
 */
function installPayload(source, name) {
  let content = fs.readFileSync(source, "utf8");
  if (process.env.BASHRC_TEST_COVERAGE === "1") {
    content = createInstrumenter({ coverageVariable: "__VITEST_COVERAGE__", esModules: false }).instrumentSync(content, source);
    content += `\nprocess.on("exit", () => require("fs").writeFileSync(${JSON.stringify(path.join(sandbox, `${name}.coverage.json`))}, JSON.stringify(globalThis.__VITEST_COVERAGE__)));\n`;
  }
  fs.writeFileSync(path.join(bin, name), content, { mode: 0o755 });
}

/**
 * Execute an installed payload and collect instrumentation from the real child.
 * @param {string} name Command name.
 * @param {string[]} args Literal CLI arguments.
 * @returns {import("child_process").SpawnSyncReturns<string>} Captured command result.
 */
function invoke(name, args) {
  const result = spawnSync(process.execPath, [path.join(bin, name), ...args], { cwd: workspace, env, encoding: "utf8", timeout: 15000 });
  const coverageFile = path.join(sandbox, `${name}.coverage.json`);
  if (fs.existsSync(coverageFile)) {
    const map = createCoverageMap(globalThis.__VITEST_COVERAGE__ || {});
    map.merge(JSON.parse(fs.readFileSync(coverageFile, "utf8")));
    for (const file of map.files()) globalThis.__VITEST_COVERAGE__[file] = map.fileCoverageFor(file).toJSON();
  }
  return result;
}

/** Run refresh and assert the externally visible readiness result. */
function refresh() {
  const result = invoke("codegraph_refresh", [workspace]);
  return { ...result, outcome: JSON.parse(result.stdout) };
}

beforeEach(() => {
  sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codegraph-lifecycle-")));
  workspace = path.join(sandbox, "repo with spaces");
  bin = path.join(sandbox, "bin");
  fs.mkdirSync(workspace);
  fs.mkdirSync(bin);
  fs.symlinkSync(process.execPath, path.join(bin, "node"));
  fs.symlinkSync("/usr/bin/git", path.join(bin, "git"));
  env = {
    ...process.env,
    HOME: sandbox,
    PATH: bin,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    CODEGRAPH_DIR: "",
    CODEGRAPH_TELEMETRY: "1",
  };
  git(["init", "--quiet", "--initial-branch=main"]);
  git(["config", "user.name", "Test"]);
  git(["config", "user.email", "test@example.com"]);
  fs.writeFileSync(path.join(workspace, "source.js"), "export function original() {}\n");
  git(["add", "source.js"]);
  git(["commit", "--quiet", "-m", "fixture"]);
  installPayload(REFRESH, "codegraph_refresh");
  installPayload(CREATE, "worktree_create");
  // This owned CLI fixture checks our process contract. Live integration separately
  // verifies the real pinned executable's indexing and MCP behavior.
  fs.writeFileSync(
    path.join(bin, "codegraph"),
    `#!/usr/bin/env node
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
fs.writeFileSync(path.join(process.env.HOME, "request.json"), JSON.stringify({args, cwd:process.cwd(), telemetry:process.env.CODEGRAPH_TELEMETRY}));
process.stdout.write("graph progress\\n");
if (process.env.GRAPH_FIXTURE_FAIL === "1") { process.stderr.write("fixture failure\\n"); process.exit(1); }
if (process.env.GRAPH_FIXTURE_NO_DB === "1") process.exit(0);
fs.mkdirSync(path.join(args[1], ".codegraph"), {recursive:true});
fs.writeFileSync(path.join(args[1], ".codegraph/codegraph.db"), "fixture database");
`,
    { mode: 0o755 },
  );
});

afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

describe("CodeGraph lifecycle CLI integration", () => {
  it("initializes the exact worktree non-interactively and disables telemetry", () => {
    const result = refresh();
    expect(result.status).toBe(0);
    expect(result.outcome).toEqual({ status: "initialized", workspace, reason: "Worktree-local refresh completed." });
    expect(JSON.parse(fs.readFileSync(path.join(sandbox, "request.json"), "utf8"))).toEqual({
      args: ["init", workspace, "--yes"],
      cwd: workspace,
      telemetry: "0",
    });
    expect(result.stderr).toContain("graph progress");
    expect(fs.existsSync(path.join(workspace, ".git/codegraph-refresh.lock"))).toBe(false);
  });

  it("incrementally syncs an existing database on reuse", () => {
    refresh();
    const result = refresh();
    expect(result.status).toBe(0);
    expect(result.outcome.status).toBe("refreshed");
    expect(JSON.parse(fs.readFileSync(path.join(sandbox, "request.json"), "utf8"))).toEqual({
      args: ["sync", workspace],
      cwd: workspace,
      telemetry: "0",
    });
  });

  it("initializes an incomplete index folder rather than borrowing a parent", () => {
    fs.mkdirSync(path.join(workspace, ".codegraph"));
    expect(refresh().outcome.status).toBe("initialized");
  });

  it.each(["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD"])(
    "defers during %s without starting CodeGraph",
    (marker) => {
      fs.writeFileSync(path.join(workspace, ".git", marker), "unfinished");
      const result = refresh();
      expect(result.status).toBe(2);
      expect(result.outcome.status).toBe("deferred");
      expect(fs.existsSync(path.join(sandbox, "request.json"))).toBe(false);
      expect(fs.existsSync(path.join(workspace, ".codegraph"))).toBe(false);
    },
  );

  it("defers on unmerged paths even without an operation marker", () => {
    const blob = git(["rev-parse", "HEAD:source.js"]);
    git(["update-index", "--force-remove", "source.js"]);
    const result = spawnSync("/usr/bin/git", ["update-index", "--index-info"], {
      cwd: workspace,
      env,
      input: `100644 ${blob} 1\tsource.js\n100644 ${blob} 2\tsource.js\n`,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(refresh().outcome.status).toBe("deferred");
    expect(fs.existsSync(path.join(sandbox, "request.json"))).toBe(false);
  });

  it.each(["shared", "dangling"])("rejects a %s index symlink without touching its target", (kind) => {
    const target = path.join(sandbox, kind);
    fs.symlinkSync(target, path.join(workspace, ".codegraph"));
    const result = refresh();
    expect(result.status).toBe(1);
    expect(result.outcome.status).toBe("failed");
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(path.join(sandbox, "request.json"))).toBe(false);
  });

  it("rejects a database symlink", () => {
    fs.mkdirSync(path.join(workspace, ".codegraph"));
    fs.symlinkSync(path.join(sandbox, "foreign.db"), path.join(workspace, ".codegraph/codegraph.db"));
    expect(refresh().outcome.status).toBe("failed");
    expect(fs.existsSync(path.join(sandbox, "foreign.db"))).toBe(false);
  });

  it("rejects a file where the index folder belongs", () => {
    fs.writeFileSync(path.join(workspace, ".codegraph"), "foreign");
    expect(refresh().outcome.status).toBe("failed");
    expect(fs.readFileSync(path.join(workspace, ".codegraph"), "utf8")).toBe("foreign");
  });

  it("refuses custom index routing", () => {
    env.CODEGRAPH_DIR = "../other-tree";
    expect(refresh().outcome.status).toBe("failed");
    expect(fs.existsSync(path.join(sandbox, "request.json"))).toBe(false);
  });

  it("reports unavailable executable and releases its lock", () => {
    fs.unlinkSync(path.join(bin, "codegraph"));
    const result = refresh();
    expect(result.status).toBe(1);
    expect(result.outcome.status).toBe("unavailable");
    expect(fs.existsSync(path.join(workspace, ".git/codegraph-refresh.lock"))).toBe(false);
  });

  it("preserves a concurrent owner's refresh lock", () => {
    fs.mkdirSync(path.join(workspace, ".git/codegraph-refresh.lock"));
    expect(refresh().outcome.status).toBe("deferred");
    expect(fs.existsSync(path.join(workspace, ".git/codegraph-refresh.lock"))).toBe(true);
    expect(fs.existsSync(path.join(sandbox, "request.json"))).toBe(false);
  });

  it.each(["GRAPH_FIXTURE_FAIL", "GRAPH_FIXTURE_NO_DB"])("never reports readiness when %s", (mode) => {
    env[mode] = "1";
    const result = refresh();
    expect(result.status).toBe(1);
    expect(result.outcome.status).toBe("failed");
    expect(fs.existsSync(path.join(workspace, ".git/codegraph-refresh.lock"))).toBe(false);
    expect(git(["status", "--porcelain"])).toBe("");
  });

  it("rejects missing arguments and nonexistent workspaces", () => {
    expect(JSON.parse(invoke("codegraph_refresh", []).stdout).status).toBe("failed");
    expect(JSON.parse(invoke("codegraph_refresh", [path.join(sandbox, "absent")]).stdout).status).toBe("failed");
  });

  it("rejects subfolder routing without indexing the parent", () => {
    const child = path.join(workspace, "child");
    fs.mkdirSync(child);
    expect(JSON.parse(invoke("codegraph_refresh", [child]).stdout).status).toBe("failed");
    expect(fs.existsSync(path.join(sandbox, "request.json"))).toBe(false);
  });

  it("refreshes newly created and reused worktrees without contaminating stdout", () => {
    git(["remote", "add", "origin", path.join(sandbox, "acme/widget.git")]);
    const first = invoke("worktree_create", ["feature/codegraph"]);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout.trim()).toBe(path.join(sandbox, ".worktrees/acme/widget/feature_codegraph"));
    expect(first.stderr).toContain('"status":"initialized"');
    const reused = invoke("worktree_create", ["feature/codegraph"]);
    expect(reused.stdout).toBe(first.stdout);
    expect(reused.stderr).toContain('"status":"refreshed"');
  });

  it("keeps successful worktree creation when graph refresh fails", () => {
    git(["remote", "add", "origin", path.join(sandbox, "acme/widget.git")]);
    env.GRAPH_FIXTURE_FAIL = "1";
    const result = invoke("worktree_create", ["topic"]);
    expect(result.status).toBe(0);
    expect(fs.existsSync(result.stdout.trim())).toBe(true);
    expect(result.stderr).toContain("CodeGraph not ready");
    expect(result.stderr).toContain('"status":"failed"');
  });

  it("keeps Git creation usable when the refresh helper is not installed", () => {
    git(["remote", "add", "origin", path.join(sandbox, "acme/widget.git")]);
    fs.unlinkSync(path.join(bin, "codegraph_refresh"));
    const result = invoke("worktree_create", ["topic"]);
    expect(result.status).toBe(0);
    expect(fs.existsSync(result.stdout.trim())).toBe(true);
    expect(result.stderr).toContain("CodeGraph not ready");
    expect(fs.existsSync(path.join(sandbox, "request.json"))).toBe(false);
  });

  it("path-only resolution creates neither a worktree nor graph", () => {
    git(["remote", "add", "origin", path.join(sandbox, "acme/widget.git")]);
    const result = invoke("worktree_create", ["--path-only", "topic"]);
    expect(result.status).toBe(0);
    expect(fs.existsSync(result.stdout.trim())).toBe(false);
    expect(fs.existsSync(path.join(sandbox, "request.json"))).toBe(false);
  });
});
