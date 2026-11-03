/** Exercise the manual snapshot workflow's patch and publication contracts with private Git fixtures. */
import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync, execFileSync } from "child_process";
import { parse } from "yaml";

/** Parsed workflow is the same artifact consumed by GitHub Actions. */
const WORKFLOW = parse(fs.readFileSync(".github/workflows/reset-inline-snapshots.yml", "utf8"));
/** Private fixture roots owned by this spec. @type {string[]} */
const roots = [];
/** Real Git commands use no host configuration or hooks. */
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1", BASH_ENV: os.devNull };
/** Publication shell records GitHub CLI arguments and returns a fixture PR URL. */
const GH_STUB = `function gh() {
  printf '%s\\n' "$@" > "$RUNNER_TEMP/gh-args"
  if [ "\${FAIL_PR:-0}" = 1 ]; then return 1; fi
  printf '%s\\n' 'https://example.invalid/pull/1'
}
`;

/**
 * Execute native Git against one isolated repository.
 * @param {string} folder - Fixture repository.
 * @param {...string} args - Git arguments.
 * @returns {string} Trimmed stdout; throws on command failure or timeout.
 */
function git(folder, ...args) {
  return execFileSync("git", args, { cwd: folder, env: GIT_ENV, encoding: "utf8", timeout: 5000 }).trim();
}

/**
 * Create a private repository and bare push destination with root and nested specs.
 * @param {string} base - Default branch name.
 * @returns {{folder: string, remote: string, env: object}} Fixture paths and workflow environment.
 * @throws {Error} When fixture Git setup fails.
 */
function fixture(base = "main") {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-workflow-"));
  roots.push(folder);
  const remote = path.join(folder, "remote.git");
  git(folder, "init", "-q", "-b", base);
  git(folder, "config", "user.name", "Fixture");
  git(folder, "config", "user.email", "fixture@example.invalid");
  fs.mkdirSync(path.join(folder, "software/tests/integration"), { recursive: true });
  fs.writeFileSync(path.join(folder, "software/tests/root.spec.js"), "old root\n");
  fs.writeFileSync(path.join(folder, "software/tests/integration/nested.spec.js"), "old nested\n");
  fs.writeFileSync(path.join(folder, "README.md"), "unchanged\n");
  git(folder, "add", "software", "README.md");
  git(folder, "commit", "-qm", "Base");
  git(folder, "init", "-q", "--bare", remote);
  git(folder, "remote", "add", "origin", remote);
  fs.writeFileSync(path.join(folder, "summary"), "");
  return {
    folder,
    remote,
    env: {
      ...GIT_ENV,
      RUNNER_TEMP: folder,
      GITHUB_OUTPUT: path.join(folder, "outputs"),
      GITHUB_STEP_SUMMARY: path.join(folder, "summary"),
      GITHUB_RUN_ID: "123",
      GITHUB_RUN_ATTEMPT: "2",
      DEFAULT_BRANCH: base,
      GH_REPO: "acme/widget-store",
    },
  };
}

/**
 * Run a workflow step with GitHub Actions' fail-fast shell semantics.
 * @param {object} data - Private fixture.
 * @param {string} script - Parsed workflow command.
 * @returns {import("child_process").SpawnSyncReturns<string>} Status and captured output.
 */
function run(data, script) {
  return spawnSync("/bin/bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", GH_STUB + script], {
    cwd: data.folder,
    env: data.env,
    encoding: "utf8",
    timeout: 5000,
  });
}

afterEach(() => {
  roots.splice(0).forEach((folder) => fs.rmSync(folder, { recursive: true, force: true }));
});

describe("manual snapshot refresh", () => {
  it("runs only by dispatch on default and separates generation from publication", () => {
    expect(WORKFLOW.on).toEqual({ workflow_dispatch: null });
    expect(WORKFLOW.jobs.refresh.if.trim()).toBe("github.ref == format('refs/heads/{0}', github.event.repository.default_branch)");
    expect(WORKFLOW.permissions).toEqual({ contents: "read" });
    expect(WORKFLOW.jobs.publish.permissions).toEqual({ contents: "write", "pull-requests": "write" });
    expect(WORKFLOW.jobs.publish.needs).toBe("refresh");
    expect(WORKFLOW.jobs.publish.if).toBe("needs.refresh.outputs.changed == 'true'");
    expect(WORKFLOW.jobs.refresh.steps.find((step) => step.name === "Reset all inline snapshots").run).toBe("npm run resetTestSnapshots");
  });

  it("parses every workflow shell step under the oldest supported Bash", () => {
    const scripts = Object.values(WORKFLOW.jobs).flatMap((job) => job.steps.filter((step) => step.run).map((step) => step.run));
    scripts.forEach((script) => {
      const result = spawnSync("/bin/bash", ["-n"], { input: script, encoding: "utf8", env: GIT_ENV });
      expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
    });
  });

  it.each(["main", "master"])("publishes root and nested spec changes against %s without unrelated files", (base) => {
    const data = fixture(base);
    fs.writeFileSync(path.join(data.folder, "software/tests/root.spec.js"), "new root\n");
    fs.writeFileSync(path.join(data.folder, "software/tests/integration/nested.spec.js"), "new nested\n");
    fs.writeFileSync(path.join(data.folder, "README.md"), "unrelated\n");
    expect(run(data, WORKFLOW.jobs.refresh.steps.find((step) => step.id === "patch").run).status).toBe(0);
    expect(fs.readFileSync(path.join(data.folder, "outputs"), "utf8")).toContain("changed=true\n");
    git(data.folder, "restore", "software", "README.md");
    const result = run(data, WORKFLOW.jobs.publish.steps.at(-1).run);
    expect({ status: result.status, stderr: result.stderr.includes("fatal:") }).toEqual({ status: 0, stderr: false });
    expect(git(data.remote, "show", "automation/reset-inline-snapshots-123-2:software/tests/root.spec.js")).toBe("new root");
    expect(git(data.remote, "show", "automation/reset-inline-snapshots-123-2:software/tests/integration/nested.spec.js")).toBe(
      "new nested",
    );
    expect(git(data.remote, "show", "automation/reset-inline-snapshots-123-2:README.md")).toBe("unchanged");
    expect(fs.readFileSync(path.join(data.folder, "gh-args"), "utf8")).toContain(
      `--base\n${base}\n--head\nautomation/reset-inline-snapshots-123-2\n`,
    );
    expect(fs.readFileSync(path.join(data.folder, "summary"), "utf8")).toBe("Pull request: https://example.invalid/pull/1\n");
    expect(fs.existsSync(path.join(data.folder, "inline-snapshots-pr.md"))).toBe(false);
  });

  it("marks no changes without a publication artifact", () => {
    const data = fixture();
    const result = run(data, WORKFLOW.jobs.refresh.steps.find((step) => step.id === "patch").run);
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(data.folder, "outputs"), "utf8")).toContain("changed=false\n");
    expect(fs.readFileSync(path.join(data.folder, "inline-snapshots.patch"), "utf8")).toBe("");
    expect(git(data.remote, "for-each-ref", "--format=%(refname)")).toBe("");
    expect(fs.existsSync(path.join(data.folder, "gh-args"))).toBe(false);
  });

  it("stops before push or PR creation when the patch cannot apply", () => {
    const data = fixture();
    fs.writeFileSync(path.join(data.folder, "inline-snapshots.patch"), "invalid patch\n");
    const result = run(data, WORKFLOW.jobs.publish.steps.at(-1).run);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("No valid patches in input");
    expect(git(data.remote, "for-each-ref", "--format=%(refname)")).toBe("");
    expect(fs.existsSync(path.join(data.folder, "gh-args"))).toBe(false);
    expect(fs.readFileSync(path.join(data.folder, "summary"), "utf8")).toBe("");
  });

  it("does not push when an artifact contains only unrelated changes", () => {
    const data = fixture();
    fs.writeFileSync(path.join(data.folder, "README.md"), "unrelated\n");
    fs.writeFileSync(path.join(data.folder, "inline-snapshots.patch"), git(data.folder, "diff", "--binary") + "\n");
    git(data.folder, "restore", "README.md");
    const result = run(data, WORKFLOW.jobs.publish.steps.at(-1).run);
    expect(result.status).toBe(0);
    expect(git(data.remote, "for-each-ref", "--format=%(refname)")).toBe("");
    expect(fs.existsSync(path.join(data.folder, "gh-args"))).toBe(false);
    expect(fs.readFileSync(path.join(data.folder, "summary"), "utf8")).toContain("No inline snapshot changes");
  });

  it("reports PR failure while retaining the pushed repair branch", () => {
    const data = fixture();
    fs.writeFileSync(path.join(data.folder, "software/tests/root.spec.js"), "new root\n");
    expect(run(data, WORKFLOW.jobs.refresh.steps.find((step) => step.id === "patch").run).status).toBe(0);
    git(data.folder, "restore", "software");
    data.env.FAIL_PR = "1";
    const result = run(data, WORKFLOW.jobs.publish.steps.at(-1).run);
    expect(result.status).toBe(1);
    expect(git(data.remote, "show", "automation/reset-inline-snapshots-123-2:software/tests/root.spec.js")).toBe("new root");
    expect(fs.readFileSync(path.join(data.folder, "summary"), "utf8")).toBe("");
    expect(fs.existsSync(path.join(data.folder, "inline-snapshots-pr.md"))).toBe(false);
  });
});
