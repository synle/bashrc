/** Real PR renderer color policy under captured stdout, without network access. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

/** Actual installed CLI source, invoked through Node. */
const CLI = path.resolve("software/scripts/git.pr_list.cjs");
/** Owned GraphQL response exercising human color and machine output. */
const PR = {
  data: {
    repository: {
      pullRequest: {
        url: "https://github.com/acme/widget-store/pull/1",
        number: 1,
        title: "Example change",
        isDraft: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        headRefName: "topic",
        baseRefName: "main",
        author: { login: "example" },
        repository: { nameWithOwner: "acme/widget-store" },
        reviewDecision: "REVIEW_REQUIRED",
        reviewThreads: { nodes: [] },
        commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS", contexts: { nodes: [] } } } }] },
      },
    },
  },
};

/**
 * Run the real CLI against a narrow owned GitHub executable boundary.
 * @param {string[]} [args=[]] - Public output flags.
 * @param {object} [colorEnv={}] - Explicit color-policy environment overrides.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and exact output.
 * @throws {Error} On fixture failure; always removes the owned sandbox.
 */
function runCli(args = [], colorEnv = {}) {
  const folder = mkdtempSync(path.join(os.tmpdir(), "pr-colors-"));
  try {
    const bin = path.join(folder, "bin");
    mkdirSync(bin);
    writeFileSync(path.join(folder, "pr.json"), JSON.stringify(PR));
    writeFileSync(path.join(folder, "search.json"), JSON.stringify([{ number: 1, repository: { nameWithOwner: "acme/widget-store" }, url: PR.data.repository.pullRequest.url }]));
    writeFileSync(path.join(bin, "gh"), `#!/bin/bash
case "$1" in
--version) printf 'gh fixture\n' ;;
search) command cat "$SEARCH_RESPONSE" ;;
api)
  if [ "$2" = user ]; then printf 'example\n'; else command cat "$PR_RESPONSE"; fi
  ;;
esac
`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, BASH_ENV: "/dev/null", TERM: "xterm-256color", SEARCH_RESPONSE: path.join(folder, "search.json"), PR_RESPONSE: path.join(folder, "pr.json") };
    delete env.NO_COLOR;
    delete env.FORCE_COLOR;
    return spawnSync(process.execPath, [CLI, "--me=1", "--all", "acme/widget-store", ...args], { cwd: folder, env: { ...env, ...colorEnv }, encoding: "utf8", timeout: 5000 });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe("PR renderer captured color policy", () => {
  it.each(["", "1", "2", "3"])("keeps human formatting with FORCE_COLOR=%j", (forceColor) => {
    const result = runCli([], { FORCE_COLOR: forceColor });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("\x1b[36mtopic");
    expect(result.stdout).toContain("\x1b]8;;https://github.com/acme/widget-store/pull/1");
  });

  it.each([{}, { FORCE_COLOR: "0" }, { FORCE_COLOR: "invalid" }, { FORCE_COLOR: "1", NO_COLOR: "1" }])("keeps capture plain for policy %j", (env) => {
    const result = runCli([], env);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("topic");
    expect(result.stdout).not.toContain("\x1b");
  });

  it("keeps forced-color URL-only output free of escapes", () => {
    const result = runCli(["--links"], { FORCE_COLOR: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("https://github.com/acme/widget-store/pull/1\n");
  });

  it("keeps forced-color JSON parseable and free of escapes", () => {
    const result = runCli(["--json"], { FORCE_COLOR: "1" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("\x1b");
    expect(JSON.parse(result.stdout)[0].title).toBe("Example change");
  });
});
