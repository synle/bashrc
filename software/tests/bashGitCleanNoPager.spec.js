/** Git clean helper pager safety and optional worktree cleanup checks. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
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
 * Runs `clean()` with disposable files, accepted confirmation, and stubbed Git/refresh executables.
 * A FIFO gates refresh completion on cleanup returning, without timing-based assertions.
 * @param {string[]} args - Arguments passed to `clean`.
 * @param {{codegraph?: boolean, refresh?: boolean, rebaseStatus?: number, refreshStatus?: number}} options - Optional tool and failure scenarios.
 * @returns {string} Captured stdout; fixture files are removed after background jobs finish.
 * @throws {Error} When the shell times out, fails, or leaks stderr.
 */
function runCleanWithStubs(args = [], { codegraph = false, refresh = true, rebaseStatus = 0, refreshStatus = 0 } = {}) {
  const script = `
repo_root=$(mktemp -d)
trap 'rm -rf "$repo_root"' EXIT
export CLEAN_TEST_ROOT="$repo_root" CLEAN_TEST_REFRESH_STATUS=${refreshStatus}
mkdir -p "$repo_root/bin" "$repo_root/nested folder"
for tool in mkdir touch date rm find grep sleep mkfifo cat chmod; do
  command ln -s "$(type -P "$tool")" "$repo_root/bin/$tool"
done
PATH="$repo_root/bin"
mkfifo "$repo_root/refresh-gate"
exec 3<> "$repo_root/refresh-gate"
if ${codegraph}; then
  printf '#!/bin/bash\nexit 0\n' > "$repo_root/bin/codegraph"
  chmod +x "$repo_root/bin/codegraph"
fi
if ${refresh}; then
  command cat > "$repo_root/bin/codegraph_refresh" <<'REFRESH_STUB'
#!/bin/bash
printf 'REFRESH_STDOUT\n'
printf 'REFRESH_STDERR\n' >&2
if IFS= read -r input; then
  printf 'REFRESH_STDIN_LEAK\n' >> "$CLEAN_TEST_ROOT/refresh-result"
fi
if [ "$#" -eq 1 ] && [ "$1" = "$CLEAN_TEST_ROOT" ] && [ -f "$CLEAN_TEST_ROOT/rebased" ]; then
  printf 'REFRESH_ROOT_AFTER_REBASE\n' >> "$CLEAN_TEST_ROOT/refresh-result"
fi
if IFS= read -r -t 2 release < "$CLEAN_TEST_ROOT/refresh-gate"; then
  printf 'REFRESH_RELEASED_AFTER_CLEAN\n' >> "$CLEAN_TEST_ROOT/refresh-result"
else
  printf 'REFRESH_BLOCKED_CLEAN\n' >> "$CLEAN_TEST_ROOT/refresh-result"
fi
exit "$CLEAN_TEST_REFRESH_STATUS"
REFRESH_STUB
  chmod +x "$repo_root/bin/codegraph_refresh"
fi
cd "$repo_root"
mkdir -p .claude/worktree-empty/nested .claude/worktree-kept .claude/worktree-old
: > .claude/worktree-empty/nested/empty.txt
printf 'active\n' > .claude/worktree-kept/state.txt
touch -t 202001010000 .claude/worktree-old
function echo_and_set_terminal_title() { echo "$*"; }
function is_help_arg() { return 1; }
function prompt_yes_no() { return 0; }
function _get_default_branch() { echo master; }
function _log_progress_step() { echo "TOTAL:$1"; shift; echo "$*"; }
function worktree_clean() { sleep 0.05; echo "TAIL_WORKTREE:$*"; }
function _clean_claude_worktrees() {${claudeCleanupSource}
}
function git() {
  if [ "${"$"}1" = "--no-pager" ]; then
    shift
  fi

  case "${"$"}1" in
  rebase)
    if [ "${"$"}2" != "--abort" ]; then
      : > "$CLEAN_TEST_ROOT/rebased"
      return ${rebaseStatus}
    fi
    return 0
    ;;
  stash | merge | cherry-pick | am | fix-identity | clean-and-fetch | gc-if-stale | checkout | del)
    return 0
    ;;
  rev-parse)
    if [ "${"$"}2" = "--show-toplevel" ]; then
      echo "$CLEAN_TEST_ROOT"
    elif [ "${"$"}2" = "--git-path" ]; then
      echo "$CLEAN_TEST_ROOT/index.lock"
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
    echo TAIL_PRUNE
    return 0
    ;;
  esac

  return 0
}
function _clean_background_tail() {${backgroundTailSource}
}
function clean() {${cleanSource}
}
cd "$repo_root/nested folder"
clean ${args.map((arg) => JSON.stringify(arg)).join(" ")}
clean_status=$?
[ ! -e "$repo_root/.claude/worktree-empty" ] && echo CLAUDE_EMPTY_REMOVED
[ -e "$repo_root/.claude/worktree-kept" ] && echo CLAUDE_NONEMPTY_KEPT
[ -e "$repo_root/.claude/worktree-old" ] && echo CLAUDE_OLD_KEPT
echo AFTER_CLEAN
printf 'release\n' >&3
wait
[ -f "$repo_root/refresh-result" ] && command cat "$repo_root/refresh-result"
echo CLEAN_STATUS:$clean_status
exit "$clean_status"
`;

  const result = spawnSync("bash", ["--noprofile", "--norc", "-c", script], {
    encoding: "utf-8",
    cwd: ROOT_DIR,
    env: { ...process.env, BASH_ENV: "" },
    input: "UNEXPECTED_STDIN\n",
    timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  return result.stdout;
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

  it.each([{ args: [] }, { args: ["--background"] }])("includes worktree cleanup by default $args", ({ args }) => {
    const output = runCleanWithStubs(args);

    expect(output).toContain("TAIL_WORKTREE:\n");
    expect(output).not.toMatch(/^\s+->/m);
    expect(output).not.toContain("TAIL_PRUNE");
    expect(output).toContain("TOTAL:17");
    expect(output).toContain("CLEAN_STATUS:0");
  });

  it.each([{ args: ["--force"] }, { args: ["-f", "-b"] }])("preserves forced worktree cleanup $args", ({ args }) => {
    const output = runCleanWithStubs(args);

    expect(output).toContain("TAIL_WORKTREE:--force\n");
    expect(output).toContain("--force also deletes dirty worktrees; their uncommitted work is NOT backed up");
    expect(output).not.toMatch(/^\s+->/m);
    expect(output).toContain("TAIL_PRUNE");
    expect(output).toContain("TOTAL:17");
    expect(output).toContain("CLEAN_STATUS:0");
  });

  it.each([
    { args: ["--skip-worktree-clean"] },
    { args: ["--skip-worktree-clean", "--background"] },
    { args: ["--force", "--skip-worktree-clean"] },
    { args: ["--skip-worktree-clean", "-f", "-b"] },
  ])("skips worktree cleanup but preserves the rest of clean $args", ({ args }) => {
    const output = runCleanWithStubs(args);

    expect(output).not.toContain("TAIL_WORKTREE");
    expect(output).not.toContain("TAIL_PRUNE");
    expect(output).toContain("TOTAL:16");
    expect(output).not.toContain("TOTAL:17");
    expect(output).toContain("TAIL_STALE");
    expect(output).toContain("TAIL_MERGED");
    expect(output).toContain("TAIL_LASTD");
    expect(output).toContain("CLEAN_STATUS:0");
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

  it.each([{ args: [] }, { args: ["--background"] }])(
    "subprocess: refreshes the repo root quietly without blocking clean $args",
    ({ args }) => {
      const output = runCleanWithStubs(args, { codegraph: true });

      expect(output).toContain("CodeGraph refresh started in background");
      expect(output.indexOf("CodeGraph refresh started in background")).toBeGreaterThan(output.indexOf("\ud83d\udd00 Rebasing onto"));
      expect(output.indexOf("CodeGraph refresh started in background")).toBeLessThan(output.indexOf("\ud83d\uddd1\ufe0f Deleting temp/"));
      expect(output).toContain("REFRESH_ROOT_AFTER_REBASE");
      expect(output).toContain("REFRESH_RELEASED_AFTER_CLEAN");
      expect(output).not.toContain("REFRESH_BLOCKED_CLEAN");
      expect(output).not.toContain("REFRESH_STDOUT");
      expect(output).not.toContain("REFRESH_STDIN_LEAK");
      expect(output).toContain("CLEAN_STATUS:0");
    },
  );

  it.each([{ codegraph: false }, { codegraph: true, refresh: false }, { codegraph: true, rebaseStatus: 1 }])(
    "subprocess: skips optional indexing when prerequisites fail %j",
    (options) => {
      const output = runCleanWithStubs([], options);

      expect(output).not.toContain("CodeGraph refresh started in background");
      expect(output).not.toContain("REFRESH_");
      expect(output).toContain("TAIL_LASTD");
      expect(output).toContain("CLEAN_STATUS:0");
    },
  );

  it("subprocess: keeps successful cleanup independent from refresh failure", () => {
    const output = runCleanWithStubs([], { codegraph: true, refreshStatus: 1 });

    expect(output).toContain("REFRESH_RELEASED_AFTER_CLEAN");
    expect(output).toContain("TAIL_LASTD");
    expect(output).toContain("CLEAN_STATUS:0");
  });
});
