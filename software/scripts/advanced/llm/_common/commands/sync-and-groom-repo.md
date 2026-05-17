[Sy] Sync a single git repo with its remote and groom it: fetch + prune, drop dead branches and worktrees, fast-forward the default branch, and merge the default branch into every other local branch (resolving conflicts as we go) so nothing is left stale.

Argument: $ARGUMENTS (optional — a path to a git repo. If empty, use the current working directory.)

## Steps

1. **Resolve the target repo:**
   - If `$ARGUMENTS` is provided, treat it as a path and `cd` there.
   - If `$ARGUMENTS` is empty, use `$PWD`.
   - Verify it's a git repo via `git rev-parse --show-toplevel`. If not, report and stop.
   - `cd` to the repo root for the rest of the run.

2. **Announce:** Repo path, current branch (or "detached HEAD"), and whether the working tree is clean (`git status --porcelain=v2 -b`).

3. **Stash dirty work — only if dirty:**
   - If `git status --porcelain` is non-empty, run `git stash push -u -m "sync-and-groom-repo: auto-stash <ISO timestamp>"` and remember that we stashed.
   - If clean, skip stash entirely. Do NOT stash unconditionally — popping an empty stash later would surprise the user.

4. **Detect the default branch:**
   - Try `git symbolic-ref refs/remotes/origin/HEAD` and strip the `refs/remotes/origin/` prefix.
   - If that fails, try `git rev-parse --verify origin/main` then `origin/master`. First match wins.
   - If still nothing, report "could not determine default branch" and stop. Do not guess.

5. **Fetch everything and prune:**
   - First check whether any local tags are NOT on origin: `comm -23 <(git tag | sort) <(git ls-remote --tags origin | awk '{print \$2}' | sed 's|refs/tags/||;s|\^{}\$||' | sort -u)`. If non-empty, list them and skip `--prune-tags` to protect hand-made local tags.
   - Run `git fetch --all --prune` (add `--prune-tags` only when the previous check found no local-only tags).

6. **Prune stale worktrees:**
   - Run `git worktree list` for the report.
   - Run `git worktree prune` — removes bookkeeping entries for worktree directories that no longer exist on disk. Do NOT delete any live worktree directory; that's a manual decision.

7. **Drop local branches whose remote tracking branch is gone:**
   - `git branch -vv | awk '/: gone\]/ {print \$1}' | xargs -r git branch -D`
   - These are typically squash-merged branches whose commits have different SHAs from `main` — `git branch -d` would refuse, so `-D` is correct here.
   - Report which branches were deleted; reflog still has them for ~90 days if recovery is needed.

8. **Switch to the default branch and update it:**
   - `git checkout <default>` (skip if already on it).
   - `git pull --rebase` — fast-forward, or rebase any rare local commits.
   - If pull fails (diverged in a way rebase can't auto-resolve): stop and report. Never force-push the default branch.

9. **Merge the default into every remaining local branch — the main grooming loop:**

   For each local branch B where B != default:

   a. Skip if B is already up to date — `git merge-base --is-ancestor <default> B` returns 0.

   b. Otherwise: `git checkout B`.

   c. Merge the default in (regular merge commit — NEVER rebase, never `--squash`):
   `git merge <default> --no-edit`

   d. **If conflicts occur, resolve them. This is the primary value of the skill** — the whole reason we run this is to surface and fix drift before it becomes someone else's problem.
   - `git status` to list conflicted files.
   - For each: read both sides of `<<<<<<<` / `=======` / `>>>>>>>` markers, understand each side's intent, produce a correct merged result, remove all markers.
   - Lockfiles / generated files (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `.build/` artifacts): regenerate after accepting the default-branch version (re-run `npm install`, `cargo build`, `make build`) rather than hand-editing.
   - Stop and ask the user only if resolution requires judgment you don't have (conflicting semantics, diverging feature logic). Don't bail on conflicts you CAN reason through.
   - `git add <files>` and `git commit --no-edit` to finalize.
   - Verify clean tree: `git status` should show no "unmerged paths".

   e. **Push if upstream exists.** Check `git rev-parse --abbrev-ref --symbolic-full-name @{u}` — if it returns a value, `git push`. If `fatal: no upstream`, skip the push and don't auto-set one.

10. **Worktrees on other branches:** `git worktree list --porcelain` enumerates every worktree. For each additional worktree (not the main one) whose HEAD is on a branch (not detached), `cd` into its directory and run the same merge-default-into-branch flow as step 9 there. Git enforces "one branch per worktree" so step 9 in the main worktree could not have touched these branches.

11. **Garbage-collect lightly:** `git gc --auto` — cheap if nothing to do. Do NOT run `git gc --aggressive` or `--prune=now`; rarely worth the slowdown. Skip entirely if `[maintenance] auto = true` is set (background job already handles it).

12. **Return to the default branch** so the user lands somewhere predictable: `git checkout <default>`.

13. **Pop the auto-stash from step 3 — only if we stashed:**
    - `git stash pop`.
    - If the pop conflicts (working tree changed under us), leave the stash in place and tell the user. Do NOT auto-resolve a stash-pop conflict — too easy to lose work.

14. **Final report.** Concise block:
    - Repo path + default branch
    - Branches deleted (gone-tracked)
    - Worktree records pruned
    - Tags pruned (or "skipped — N local-only tags kept: …")
    - Branches synced with default (with vs. without conflicts that we resolved)
    - Branches skipped (no upstream / already current)
    - Whether the auto-stash popped successfully

## Rules

- **Always merge to sync, never rebase.** Branches in this loop may already be pushed; rewriting history would force `--force-with-lease` next push.
- **Never `--squash` when merging the default into a feature branch.** Squashing here would erase the linkage and break the next groom run's ancestor check.
- **Never force-push.** This skill never produces `git push --force` or `--force-with-lease`. If a normal push fails, stop and report.
- **Never delete a worktree directory.** `git worktree prune` only cleans bookkeeping for already-removed dirs. Removing a live worktree is the user's call.
- **Stash is opt-in based on dirty state.** Only stash when there's something to stash; only pop what we stashed.
- **Don't auto-resolve a stash-pop conflict.** Leave the stash, report it.
- **Tag pruning is opt-in.** Default to plain `--prune` when any local-only tags exist; `--prune-tags` only when local tags are a strict subset of remote.
- **Default branch's pull is `--rebase`** (matches global `pull.rebase = true`). Feature branches use merge.
- **Detached HEAD short-circuit.** If step 2 reports detached HEAD, do steps 5 (fetch), 6 (worktree prune), 7 (gone-branch cleanup), 11 (gc) only. Skip the default-branch checkout and the merge loop — the user is mid-something; do not move HEAD out from under them.
