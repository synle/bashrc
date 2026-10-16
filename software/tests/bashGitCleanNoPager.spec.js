/** Git clean helper pager-safety checks. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_PATH = path.join(ROOT_DIR, "software/scripts/bash-git-helpers.profile.bash");
const profileSource = fs.readFileSync(PROFILE_PATH, "utf-8");
const backgroundTailSource = profileSource
  .split("function _clean_background_tail() {", 2)[1]
  .split("\n}\n\n# Safely resets the current branch to origin's default branch.", 1)[0];
const cleanSource = profileSource.split("function clean() {", 2)[1].split("\n}\n\n# Creates an empty commit", 1)[0];

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

  it("offloads slow cleanup through a helper function instead of an inline background subshell", () => {
    expect(profileSource).toContain("function _clean_background_tail() {");
    expect(cleanSource).toContain('  _clean_background_tail "$total_steps" "$repo_root" "$force_worktrees" "$default_branch" &');
    expect(cleanSource).not.toContain("rej_cleanup_log");
    expect(cleanSource).not.toContain("ds_store_cleanup_log");
  });
});
