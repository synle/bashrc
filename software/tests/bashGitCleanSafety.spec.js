/** Verify clean's backup boundary with real Git and disposable working trees. */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

/** Repository root containing the profile source. */
const ROOT_FOLDER = path.resolve(import.meta.dirname, "../..");
/** Production function body executed by each isolated shell. */
const CLEAN_SOURCE = fs
  .readFileSync(path.join(ROOT_FOLDER, "software/scripts/bash-git-helpers.profile.bash"), "utf8")
  .split("function clean() {", 2)[1]
  .split("\n}\n\n# Creates an empty commit", 1)[0];
/** Disposable folders owned by this spec. */
const TEMP_FOLDERS = [];

afterEach(() => {
  for (const folder of TEMP_FOLDERS.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

/**
 * Exercise clean with a real index and stash, replacing only confirmation and downstream cleanup.
 * @param {Record<string, string>} options - Environment switches for rejection, failures, and worktrees.
 * @returns {{stdout: string, stderr: string, status: number | null}} Shell results and observable state markers.
 * @throws {Error} If the isolated shell cannot start or exceeds its deadline.
 */
function runCleanScenario(options = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "clean-backup-"));
  TEMP_FOLDERS.push(folder);
  const script = `
set -e
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=Fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=Fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR
mkdir primary
cd primary
command git init -q
printf 'base\n' > tracked.txt
printf 'ignored.txt\n' > .gitignore
command git add tracked.txt .gitignore
command git -c commit.gpgsign=false commit -qm base
if [ "$LINKED" = yes ]; then
  command git worktree add --detach -q ../linked HEAD
  printf 'primary-lock\n' > .git/index.lock
  cd ../linked
fi
repo_root="$PWD"
printf 'staged\n' > tracked.txt
command git add tracked.txt
printf 'unstaged\n' >> tracked.txt
mkdir 'nested folder'
printf 'untracked\n' > 'nested folder/new file.txt'
printf 'ignored\n' > ignored.txt
lock=$(command git rev-parse --git-path index.lock)
if [ "$LOCK" = file ]; then printf 'stale\n' > "$lock"; fi
if [ "$LOCK" = folder ]; then mkdir "$lock"; fi
if [ "$CONFLICT" = yes ]; then
  blob=$(command git rev-parse HEAD:tracked.txt)
  printf '0 0000000000000000000000000000000000000000\ttracked.txt\n100644 %s 1\ttracked.txt\n100644 %s 2\ttracked.txt\n100644 %s 3\ttracked.txt\n' "$blob" "$blob" "$blob" | command git update-index --index-info
  printf 'operation-in-progress\n' > "$repo_root/.git/MERGE_HEAD"
fi
function is_help_arg() { return 1; }
function prompt_yes_no() { printf 'CONFIRM:%s DEFAULT:%s\n' "$1" "$2"; return "$CONFIRM_STATUS"; }
function _log_progress_step() { shift; printf 'STEP:%s\n' "$*"; }
function _get_default_branch() { echo main; }
function _clean_background_tail() { echo CLEANUP_DONE; }
function git() {
  [ "$1" = --no-pager ] && shift
  case "$1" in
  stash)
    if [ "$STASH_FAILURE" = yes ]; then echo 'fixture stash failure' >&2; return 1; fi
    command git "$@" || return $?
    if [ "$REMAINING" = yes ]; then printf 'late\n' > "$repo_root/late.txt"; fi
    ;;
  status)
    if [ "$STATUS_FAILURE" = yes ] || { [ "$STATUS_FAILURE" = after-stash ] && command git rev-parse --verify refs/stash >/dev/null 2>&1; }; then
      echo 'fixture status failure' >&2
      return 1
    fi
    command git "$@"
    ;;
  rev-parse | branch) command git "$@" ;;
  *) printf 'EFFECT:%s\n' "$*" >> "$repo_root/effects" ;;
  esac
}
function clean() {${CLEAN_SOURCE}
}
cd 'nested folder'
set +e
clean --skip-worktree-clean
status=$?
printf 'CLEAN_STATUS:%s\n' "$status"
cd "$repo_root"
[ -e "$repo_root/effects" ] && echo EFFECTS_PRESENT
[ -e "$repo_root/.git/MERGE_HEAD" ] && echo OPERATION_PRESENT
[ -e "$lock" ] && echo LOCK_PRESENT
[ -e "$repo_root/../primary/.git/index.lock" ] && echo PRIMARY_LOCK_PRESENT
if [ "$status" -eq 0 ]; then
  command git stash apply --index >/dev/null || echo RESTORE_FAILED
  printf 'INDEX:'; command git show :tracked.txt
  printf 'FILE:'; command cat tracked.txt
  printf 'NEW:'; command cat 'nested folder/new file.txt'
fi
printf 'IGNORED:'; command cat ignored.txt
printf 'TRACKED:'; command cat tracked.txt
[ -f 'nested folder/new file.txt' ] && echo UNTRACKED_PRESENT
command git stash list --format=%s
exit "$status"
`;
  const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", script], {
    cwd: folder,
    encoding: "utf8",
    env: {
      ...process.env,
      BASH_ENV: "",
      CONFIRM_STATUS: "0",
      LOCK: "none",
      LINKED: "no",
      CONFLICT: "no",
      STASH_FAILURE: "no",
      STATUS_FAILURE: "no",
      REMAINING: "no",
      ...options,
    },
    timeout: 5000,
  });
  if (result.error) throw result.error;
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

describe("clean safety backup", () => {
  it.each([
    { options: { LOCK: "none", CONFIRM_STATUS: "1" }, confirmations: 0 },
    { options: { LOCK: "none", LINKED: "yes", CONFIRM_STATUS: "1" }, confirmations: 0 },
    { options: { LOCK: "file" }, confirmations: 1 },
    { options: { LOCK: "file", LINKED: "yes" }, confirmations: 1 },
  ])("subprocess: restores work with confirmation only for the current index lock %j", ({ options, confirmations }) => {
    const result = runCleanScenario(options);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.match(/^CONFIRM:/gm) ?? []).toHaveLength(confirmations);
    expect(result.stdout).toContain("CLEANUP_DONE");
    expect(result.stdout).toContain("INDEX:staged\nFILE:staged\nunstaged\nNEW:untracked\n");
    expect(result.stdout).toContain("IGNORED:ignored\n");
    expect(result.stdout).toMatch(/clean backup \d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}/);
    expect(result.stdout).not.toMatch(/^\s+->/m);
  });

  it("subprocess: leaves the primary index lock alone in a linked worktree", () => {
    const result = runCleanScenario({ LOCK: "file", LINKED: "yes" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PRIMARY_LOCK_PRESENT");
    expect(result.stdout).toContain("DEFAULT:N");
    expect(result.stdout).toContain("NEW:untracked");
  });

  it("subprocess: rejection preserves the lock and all local work without cleanup", () => {
    const result = runCleanScenario({ CONFIRM_STATUS: "1", LOCK: "file" });

    expect(result.status).toBe(1);
    expect(result.stdout.match(/^CONFIRM:/gm)).toHaveLength(1);
    expect(result.stdout).toContain("LOCK_PRESENT");
    expect(result.stdout).toContain("TRACKED:staged\nunstaged\nUNTRACKED_PRESENT");
    expect(result.stdout).not.toContain("EFFECTS_PRESENT");
    expect(result.stdout).not.toContain("clean backup");
  });

  it.each([{ STASH_FAILURE: "yes" }, { CONFLICT: "yes" }])(
    "subprocess: failed stash preserves work and never reaches cleanup %j",
    (options) => {
      const result = runCleanScenario(options);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("clean: safety stash failed; cleanup stopped");
      expect(result.stdout).toContain("TRACKED:staged\nunstaged\nUNTRACKED_PRESENT");
      expect(result.stdout).not.toContain("EFFECTS_PRESENT");
      expect(result.stdout).not.toContain("recover with:");
    },
  );

  it("subprocess: conflicted-index rejection preserves operation metadata", () => {
    const result = runCleanScenario({ CONFLICT: "yes" });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("OPERATION_PRESENT");
    expect(result.stdout).not.toContain("EFFECTS_PRESENT");
  });

  it.each([{ STATUS_FAILURE: "yes" }, { STATUS_FAILURE: "after-stash" }, { REMAINING: "yes" }, { LOCK: "folder" }])(
    "subprocess: stops before cleanup when backup verification or lock removal fails %j",
    (options) => {
      const result = runCleanScenario(options);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("cleanup stopped");
      expect(result.stdout).not.toContain("EFFECTS_PRESENT");
      expect(result.stdout).not.toContain("CLEANUP_DONE");
    },
  );
});
