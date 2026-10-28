/** Fast public-shell contracts for keyword worktree navigation and cleanup aliases. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Worktree shell entry points without unrelated profile startup behavior. */
const SOURCE = fs
  .readFileSync("software/scripts/bash-git-helpers.profile.bash", "utf8")
  .split("# worktree_cd: change to a worktree matching branch and optional repository keywords.")[1]
  .split("# --- Git Patch Transfer ---")[0];

/**
 * Run the actual shell function against a deterministic inventory provider.
 * @param {Array<object>} records Inventory records with relative fixture folder names.
 * @param {string[]} args Literal keyword arguments.
 * @param {object} [options] Inventory, environment, caller, or fixture overrides.
 * @returns {{status: number|null, stdout: string, stderr: string}} Captured process result with normalized root paths.
 * @throws {Error} Fixture setup fails; always removes the owned fixture.
 */
function navigate(records, args, options = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-cd-")));
  try {
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin);
    const inventory = records.map((record) => ({
      branch_name: "feature/task",
      repo: "widget-store",
      org: "acme",
      root_path: root,
      worktree_path: path.join(root, record.folder || "destination"),
      ...record,
    }));
    if (!options.missingFolder) inventory.forEach((row) => fs.mkdirSync(row.worktree_path, { recursive: true }));
    fs.writeFileSync(path.join(root, "navigation.bash"), SOURCE);
    if (!options.missingList) {
      fs.writeFileSync(
        path.join(bin, "worktree_list"),
        '#!/bin/sh\n[ "$#" -eq 1 ] && [ "$1" = --raw ] || exit 99\nprintf "%s" "$WORKTREE_INVENTORY"\nexit "${LIST_STATUS:-0}"\n',
        { mode: 0o755 },
      );
    }
    const result = spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `
function is_help_arg() { [ "\${1:-}" = --help ]; }
function safe_source() { /bin/bash -n "$1" && builtin source "$1"; }
function print_action_summary() { printf 'SUMMARY:%s:FROM:%s\\n' "$1" "$PWD"; return "\${SUMMARY_STATUS:-0}"; }
safe_source ./navigation.bash || exit $?
safe_source ./navigation.bash || exit $?
${options.invocation || 'worktree_cd "$@"'}
status=$?
printf 'RESULT:%s\\n' "$PWD"
IFS= read -r line
printf 'INPUT:%s\\n' "$line"
exit "$status"
`,
        "test",
        ...args,
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 10000,
        input: "PIPE_UNTOUCHED\n",
        env: {
          ...process.env,
          BASH_ENV: os.devNull,
          HOME: root,
          PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
          WORKTREE_INVENTORY: options.inventory ?? JSON.stringify(inventory),
          ...options.env,
        },
      },
    );
    return { status: result.status, stdout: result.stdout.replaceAll(root, "<root>"), stderr: result.stderr.replaceAll(root, "<root>") };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("worktree_cd", () => {
  it("navigates a unique case-insensitive branch substring and prints the summary before cd", () => {
    const result = navigate([{ folder: "target space" }], ["TURE/TAS"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("SUMMARY:<root>/target space:FROM:<root>\nRESULT:<root>/target space\nINPUT:PIPE_UNTOUCHED\n");
  });

  it("filters by repository and organization without preferring an exact branch match", () => {
    const result = navigate(
      [
        { folder: "first", repo: "api", branch_name: "task" },
        { folder: "second", repo: "web" },
      ],
      ["task", "ACME/WEB"],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("RESULT:<root>/second\n");
  });

  it("searches every listed repository when the optional filter is absent", () => {
    const result = navigate(
      [
        { folder: "first", repo: "api" },
        { folder: "second", repo: "web" },
      ],
      ["task"],
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("1) feature/task acme/api");
    expect(result.stderr).toContain("2) feature/task acme/web");
    expect(result.stderr).toContain("multiple matches require a terminal");
    expect(result.stdout).toBe("RESULT:<root>\nINPUT:PIPE_UNTOUCHED\n");
  });

  it("limits ambiguous menus to ten choices", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ folder: `folder-${index}`, branch_name: `feature/task-${index}` }));
    const result = navigate(rows, ["task"]);
    expect(result.status).toBe(1);
    expect(result.stderr.match(/^  \d+\)/gm)).toHaveLength(10);
    expect(result.stderr).toContain("10) feature/task-9");
    expect(result.stderr).not.toContain("11)");
    expect(result.stdout).toBe("RESULT:<root>\nINPUT:PIPE_UNTOUCHED\n");
  });

  it("passes literal metacharacters and preserves unusual path bytes including a trailing newline", () => {
    const result = navigate([{ branch_name: "feature/[$()]", folder: 'space "quote"\\\u2603\n' }], ["[$()]"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULT:<root>/space "quote"\\\u2603\n\nINPUT:PIPE_UNTOUCHED\n');
  });

  it("supports the worktree_navigate alias after repeated profile loads", () => {
    const result = navigate([{}], ["task"], { invocation: 'worktree_navigate "$@"' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("RESULT:<root>/destination\n");
  });

  it.each([
    [[], ["task"]],
    [[{ branch_name: null }], ["task"]],
    [[{}], ["missing"]],
    [[{}], ["task", "missing"]],
  ])("keeps the working folder when no matching named branch exists", (rows, args) => {
    const result = navigate(rows, args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no matching worktrees");
    expect(result.stdout).toBe("RESULT:<root>\nINPUT:PIPE_UNTOUCHED\n");
  });

  it.each([[], [""], ["one", "two", "three"]])("rejects invalid argument counts without navigation", (...args) => {
    const result = navigate([{}], args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("expected <branch_keyword> [repo_keyword]");
    expect(result.stdout).toBe("RESULT:<root>\nINPUT:PIPE_UNTOUCHED\n");
  });

  it("shows help without requiring an installed inventory command", () => {
    const result = navigate([], ["--help"], { missingList: true });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: worktree_cd <branch_keyword> [repo_keyword]");
  });

  it.each(["{", "{}", "[null]", '[{"branch_name":"task","org":null,"repo":"x","worktree_path":"relative"}]'])(
    "rejects malformed or unsafe inventory %s without effects",
    (inventory) => {
      const result = navigate([], ["task"], { inventory });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("worktree_cd: invalid");
      expect(result.stdout).toBe("RESULT:<root>\nINPUT:PIPE_UNTOUCHED\n");
    },
  );

  it("propagates inventory failure without trusting its stdout", () => {
    const result = navigate([{}], ["task"], { env: { LIST_STATUS: "23" } });
    expect(result.status).toBe(23);
    expect(result.stdout).toBe("RESULT:<root>\nINPUT:PIPE_UNTOUCHED\n");
  });

  it("rejects a vanished destination without printing a summary or changing folders", () => {
    const result = navigate([{}], ["task"], { missingFolder: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("selected folder no longer exists");
    expect(result.stdout).toBe("RESULT:<root>\nINPUT:PIPE_UNTOUCHED\n");
  });

  it("defines explicit cleanup-mode aliases without executing cleanup", () => {
    const result = navigate([], [], { invocation: "alias worktree_purge worktree_clean_interactive" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("alias worktree_purge='worktree_clean --mode purge'");
    expect(result.stdout).toContain("alias worktree_clean_interactive='worktree_clean --mode interactive'");
  });

  it("does not navigate when the summary function fails", () => {
    const result = navigate([{}], ["task"], { env: { SUMMARY_STATUS: "7" } });
    expect(result.status).toBe(7);
    expect(result.stdout).toBe("SUMMARY:<root>/destination:FROM:<root>\nRESULT:<root>\nINPUT:PIPE_UNTOUCHED\n");
  });
});
