/** Caller-facing navigation checks against the production Git helper partial. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Profile containing the navigation functions and aliases. */
const PROFILE = path.resolve("software/scripts/bash-git-helpers.profile.bash");

/**
 * Run navigation inside an isolated repository tree with native Git and Bash.
 * @param {string} operation Caller commands after fixture creation.
 * @returns {import("child_process").SpawnSyncReturns<string>} Exit status and captured output.
 * @throws {Error} On fixture creation failure; always removes the owned temporary folder.
 */
function navigate(operation) {
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "git-root-")));
  try {
    return spawnSync(
      "/bin/bash",
      [
        "--noprofile",
        "--norc",
        "-O",
        "expand_aliases",
        "-c",
        `
      function is_help_arg() { [ "\${1:-}" = --help ]; }
      function print_action_summary() { printf 'ACTION:%s:%s\\n' "$2" "$1"; }
      . "$PROFILE"
      git init -q "$HOME/outer repo" || exit
      mkdir -p "$HOME/outer repo/a/b" "$HOME/Downloads/subfolder"
      ${operation}
    `,
      ],
      {
        cwd: folder,
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, HOME: folder, PROFILE, BASH_ENV: "/dev/null", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      },
    );
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

describe("Git root navigation", () => {
  it.each(["gogitroot", "goroot"])("%s returns from a nested folder and preserves OLDPWD", (name) => {
    const result = navigate(`builtin cd "$HOME/outer repo/a/b"
      ${name} || exit
      test "$PWD" = "$HOME/outer repo" && test "$OLDPWD" = "$HOME/outer repo/a/b" && printf 'root reached\\n'`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("ACTION:cd:");
    expect(result.stdout).toContain("root reached\n");
  });

  it("selects the inner repository rather than its outer ancestor", () => {
    const result = navigate(`git init -q "$HOME/outer repo/a"
      builtin cd "$HOME/outer repo/a/b"
      gogitroot && test "$PWD" = "$HOME/outer repo/a" && printf 'inner root\\n'`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("inner root\n");
  });

  it("resolves a linked worktree whose .git is a file", () => {
    const result =
      navigate(`git -C "$HOME/outer repo" -c user.name=Test -c user.email=test@example.com -c commit.gpgsign=false commit --allow-empty -qm initial
      git -C "$HOME/outer repo" worktree add -q -b fixture "$HOME/linked tree" || exit
      mkdir -p "$HOME/linked tree/nested"
      builtin cd "$HOME/linked tree/nested"
      gogitroot && test "$PWD" = "$HOME/linked tree" && printf 'worktree root\\n'`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("worktree root\n");
  });

  it("fails outside a repository without moving or printing a navigation action", () => {
    const result = navigate(`if gogitroot; then exit 99; else status=$?; fi
      test "$PWD" = "$HOME" || exit 98
      exit "$status"`);
    expect(result.status).toBe(128);
    expect(result.stderr).toContain("not a git repository");
    expect(result.stdout).toBe("");
  });

  it("shows help without moving", () => {
    const result = navigate('gogitroot --help && test "$PWD" = "$HOME"');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Usage: gogitroot");
    expect(result.stdout).not.toContain("ACTION:");
  });

  it("godown forwards a subfolder to godownload", () => {
    const result = navigate(`function find_path() { printf '%s\\n' "$HOME/Downloads"; }
      godown subfolder
      test "$PWD" = "$HOME/Downloads/subfolder" && printf 'downloads reached\\n'`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("downloads reached\n");
  });
});
