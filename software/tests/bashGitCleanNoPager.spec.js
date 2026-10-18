/** Git clean helper pager-safety checks. */
import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_PATH = path.join(ROOT_DIR, "software/scripts/bash-git-helpers.profile.bash");
const profileSource = fs.readFileSync(PROFILE_PATH, "utf-8");
const claudeCleanupSource = profileSource
  .split("function _clean_claude_worktrees() {", 2)[1]
  .split("\n}\n\n# _clean_background_tail", 1)[0];
const backgroundTailSource = profileSource
  .split("function _clean_background_tail() {", 2)[1]
  .split("\n}\n\n# Safely resets the current branch to origin's default branch.", 1)[0];
const cleanSource = profileSource.split("function clean() {", 2)[1].split("\n}\n\n# Creates an empty commit", 1)[0];

/**
 * Runs the extracted `clean()` implementation under bash with stubbed git helpers so the spec can
 * assert whether the function returns before the cleanup tail finishes.
 * @param {string[]} args - Arguments passed to `clean`.
 * @returns {string} Stdout from the bash process.
 */
function runCleanWithStubs(args = []) {
  const script = `
repo_root=$(mktemp -d)
trap 'rm -rf "$repo_root"' EXIT
cd "$repo_root"
mkdir -p .claude/worktree-empty/nested .claude/worktree-kept .claude/worktree-old
: > .claude/worktree-empty/nested/empty.txt
printf 'active\n' > .claude/worktree-kept/state.txt
touch -t 202001010000 .claude/worktree-old
function echo_and_set_terminal_title() { echo "$*"; }
function is_help_arg() { return 1; }
function _get_default_branch() { echo master; }
function _log_progress_step() { shift; echo "$*"; }
function worktree_clean() { sleep 0.05; echo TAIL_WORKTREE; }
function _clean_claude_worktrees() {${claudeCleanupSource}
}
function git() {
  if [ "${"$"}1" = "--no-pager" ]; then
    shift
  fi

  case "${"$"}1" in
  stash | merge | rebase | cherry-pick | am | fix-identity | clean-and-fetch | gc-if-stale | checkout | del)
    return 0
    ;;
  rev-parse)
    if [ "${"$"}2" = "--show-toplevel" ]; then
      pwd
    fi
    return 0
    ;;
  branch)
    if [ "${"$"}2" = "--show-current" ]; then
      echo master
    fi
    return 0
    ;;
  clean-stale-branches)
    sleep 0.05
    echo TAIL_STALE
    return 0
    ;;
  clean-merged-branches-and-tags)
    echo TAIL_MERGED
    return 0
    ;;
  lastd)
    echo TAIL_LASTD
    return 0
    ;;
  worktree)
    return 0
    ;;
  esac

  return 0
}
function _clean_background_tail() {${backgroundTailSource}
}
function clean() {${cleanSource}
}
clean ${args.map((arg) => JSON.stringify(arg)).join(" ")}
[ ! -e .claude/worktree-empty ] && echo CLAUDE_EMPTY_REMOVED
[ -e .claude/worktree-kept ] && echo CLAUDE_NONEMPTY_KEPT
[ -e .claude/worktree-old ] && echo CLAUDE_OLD_KEPT
echo AFTER_CLEAN
wait
`;

  return execFileSync("bash", ["-lc", script], { encoding: "utf-8", cwd: ROOT_DIR });
}

describe("clean git commands", () => {
  it("disables the pager for every executed git command", () => {
    const executedGitLines = cleanSource.split("\n").filter((line) => /^\s*git\s/.test(line) || /\$\(git\s/.test(line));
    const commandsWithoutNoPager = executedGitLines.filter(
      (line) => /^\s*git\s+(?!--no-pager)/.test(line) || /\$\(git\s+(?!--no-pager)/.test(line),
    );

    expect(executedGitLines.length).toBeGreaterThan(0);
    expect(commandsWithoutNoPager).toEqual([]);
  });

  it("routes non-force worktree cleanup through the standalone cleaner only", () => {
    expect(backgroundTailSource).toMatch(/\n\s+worktree_clean\n/);
    expect(backgroundTailSource).not.toContain("git --no-pager clean-worktree");
  });

  it("cleans empty Claude worktree folders but keeps non-empty folders", () => {
    const output = runCleanWithStubs();

    expect(output).toContain("CLAUDE_EMPTY_REMOVED");
    expect(output).toContain("CLAUDE_NONEMPTY_KEPT");
    expect(output).toContain("CLAUDE_OLD_KEPT");
    expect(output).toContain("older than 3 months");
    expect(profileSource).toContain("function _clean_claude_worktrees()");
    expect(profileSource).toContain("-mtime +90");
    expect(profileSource).toContain("-size 0c");
    expect(profileSource).toContain("-type l");
  });

  it("keeps the cleanup tail in a helper function and runs it synchronously by default", () => {
    expect(profileSource).toContain("function _clean_background_tail() {");
    expect(cleanSource).toContain('  _clean_background_tail "$total_steps" "$repo_root" "$force_worktrees" "$default_branch"');
    expect(cleanSource).not.toContain('  _clean_background_tail "$total_steps" "$repo_root" "$force_worktrees" "$default_branch" &\n}');
    expect(cleanSource).not.toContain("rej_cleanup_log");
    expect(cleanSource).not.toContain("ds_store_cleanup_log");
  });

  it("waits for the cleanup tail before returning by default", () => {
    const output = runCleanWithStubs();

    expect(output.indexOf("TAIL_LASTD")).toBeGreaterThan(-1);
    expect(output.indexOf("AFTER_CLEAN")).toBeGreaterThan(output.indexOf("TAIL_LASTD"));
  });

  it("still supports explicit background cleanup", () => {
    const output = runCleanWithStubs(["--background"]);

    expect(output).toContain("background cleanup offloaded");
    expect(output.indexOf("AFTER_CLEAN")).toBeLessThan(output.indexOf("TAIL_LASTD"));
  });
});
