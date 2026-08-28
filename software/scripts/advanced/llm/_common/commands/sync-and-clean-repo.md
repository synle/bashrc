[Sy] Sync and clean a single git repository — fetch, prune remote-tracking branches, delete local branches whose upstream is `[gone]`, prune stale worktree records, fast-forward the default branch, merge the default into every other local branch (resolving conflicts), and push where an upstream exists.

Argument: $ARGUMENTS (optional — a target repo path or owner/repo. Defaults to current folder.)

## When to use

- A local checkout has drifted behind its remote — branches deleted on the remote still exist locally, the default branch is behind origin, or feature branches need the latest default-branch commits.
- Before starting work in a repo, so you branch from an up-to-date default.
- Part of a larger cleanup (see `/sy-sync-and-clean-repos` for multi-repo).

This skill owns **all** destructive git actions for a single repo. Other commands delegate to this rather than hand-rolling `git fetch`, `git merge`, or `git branch -D`.

## Invocation contract

**Target** (first token, optional):

- A path to a git repo — runs there.
- An `<owner>/<repo>` — resolves via `gh repo view`, clones if missing, runs there.
- Empty → current folder (must be a git repo).

## Steps

1. **Resolve target.** If an `<owner>/<repo>`: `gh repo view <owner/repo> --json nameWithOwner,sshUrl --jq '.sshUrl'` to get the clone URL. If the folder doesn't exist, `git clone <url> <path>` into a temp location. If a path: `cd` there and verify `.git` exists.

2. **Fetch + prune.** `git fetch --all --prune` — updates all remote-tracking branches and removes refs for branches deleted on the remote.

3. **Drop `[gone]` local branches.** `git branch -vv | grep '\[gone\]' | awk '{print $1}' | xargs -r git branch -D`. Only local branches whose upstream ref no longer exists on the remote. Never touches the default branch or the current branch.

4. **Prune worktree records.** `git worktree prune` — removes stale administrative entries for worktrees that were deleted without `git worktree remove`.

5. **Fast-forward default branch.** Resolve the default branch (`git symbolic-ref --short refs/remotes/origin/HEAD | sed 's#^origin/##'`). If the local default branch exists and is behind its upstream, `git checkout <default>` then `git merge --ff-only @{u}`. If it doesn't exist locally, create it tracking the remote. If it has local commits not on the remote, report and skip the fast-forward (requires manual resolution).

6. **Merge default into every other local branch.** For each local branch (except the default): `git checkout <branch>`, then `git merge <default> --no-edit`. Resolve conflicts if any:
   - Lockfiles / generated files / snapshots: accept incoming and regenerate.
   - Append-only files (barrels, registries, config lists): keep both entries, re-sort if file is sorted.
   - Test files: keep both new tests.
   - Stop and ask only when resolution needs judgment.
   - After resolving: `git add <files>` and `git commit --no-edit`.

7. **Push where upstream exists.** For each branch that was merged and has an upstream: `git push`. Never force-push. Branches without an upstream are left for the user to push manually.

8. **Report.** Emit a summary per repo:
   - Default branch: fast-forwarded / already current / skipped (local commits)
   - Branches deleted (`[gone]`)
   - Worktree records pruned
   - Branches merged cleanly
   - Branches with conflicts resolved (count + files)
   - Branches skipped (no upstream / already current / diverged)
   - Push status per branch

## Rules

- **Merge, never rebase.** No `git pull --rebase`, no `git rebase`, no `gh pr update-branch --rebase`.
- **Merges flow downhill only.** Default → feature branches. Never push the default branch unless it was fast-forwarded.
- **No branch deletion on the remote.** Only local `[gone]` branches are deleted. Remote branches are left so `gh pr reopen` stays possible.
- **Never force-push, never `git gc --aggressive`.**
- **Human-in-the-loop on conflicts.** The conflict resolver stops and asks only when it cannot reason through the resolution.
- **One repo per invocation.** For multi-repo, use `/sy-sync-and-clean-repos`.

## Safety

Never:

- Delete a branch that isn't marked `[gone]`
- Force-push any branch
- Rebase a shared branch
- Delete remote branches
- Run `git gc --aggressive`
- Skip the conflict resolver's stop-and-ask

Stop and ask when:

- The default branch has local commits not on the remote (fast-forward impossible)
- A conflict needs judgment you don't have
- The target is not a git repo and not a valid owner/repo
