[Sy] Periodic repo maintenance: close stale PRs, then sync and clean up every git repo under the current folder.

Argument: $ARGUMENTS (optional — passed straight through to `/sy-close-stale-prs` in Phase 1. Typically a staleness threshold in days, e.g. `90`, or a scope like `acme/widget-store`. Defaults to that skill's own defaults: `@me`, 60 days.)

## When to use

- Periodic "cleanup day" — the PR dashboard has gone noisy and local checkouts have drifted behind their defaults.
- After a project pivot left a backlog of abandoned WIP PRs plus a pile of merged-but-undeleted local branches.
- Before starting a large piece of work, so you branch from an up-to-date default instead of a three-week-old one.

This is a thin orchestrator. It owns **no** git or `gh` logic of its own — both phases delegate wholesale to the skills below. Read those files for the actual behavior.

## Steps

### Phase 0 — Pre-flight

1. Record the starting folder; every phase runs from here and returns here:

   ```bash
   ROOT="$PWD"; echo "maintenance-day root: $ROOT"
   ```

2. Confirm both dependencies are available and authenticated — Phase 1 is pure `gh`, so a missing auth token wastes the whole run:

   ```bash
   gh auth status
   gh api user --jq .login
   ```

   If `gh auth status` fails, stop and report. Do NOT fall back to Phase 2 only without saying so.

3. Inventory what Phase 2 will touch, so the final report can be diffed against it (see Repo discovery):

   ```bash
   cd "$ROOT" && for d in . */ */*/; do git -C "$d" rev-parse --show-toplevel; done 2>/dev/null | sort -u
   ```

   Zero repos → skip Phase 2 entirely and say so.

### Phase 1 — GitHub PR cleanup

Run `/sy-close-stale-prs $ARGUMENTS` and let it own the whole loop — candidate search, the always-skip filters, the per-PR `y / n / s / q` confirmation, and the close comment.

- **Do not** call `gh pr close` yourself here. That skill requires per-PR consent and never deletes branches; bypassing it is how a bulk wipe happens.
- If the user answers `s` or `q` mid-loop, that ends Phase 1 only — continue to Phase 2.
- Capture the closed / skipped tally for the summary.

### Phase 2 — Repo cleanup

Run `/sy-sync-and-clean-repos` from `$ROOT`. That skill fans out `/sy-sync-and-clean-repo` across every repo it discovers (fetch + prune, drop `[gone]` branches, prune worktree records, fast-forward the default, merge the default into every other local branch, resolve conflicts, push where an upstream exists).

- **Do not** run `git fetch` / `git merge` / `git branch -D` yourself here. Cleanup is human-in-the-loop on conflicts and stays sequential inside that skill.
- A repo that fails (diverged default, unresolvable conflict, detached HEAD) is reported and skipped — it does not abort the remaining repos.
- Return to `$ROOT` when done: `cd "$ROOT"`.

### Phase 3 — Consolidated report

Print one **Maintenance Summary** block:

- **Phase 1** — PRs closed (full `github.com/<owner>/<repo>/pull/<n>` links), PRs skipped with reason, PRs that errored.
- **Phase 2** — per repo: default branch, branches deleted, worktree records pruned, branches merged cleanly, branches that needed conflict resolution, branches skipped (no upstream / already current), stash pop status.
- **Errors / warnings** — anything either phase surfaced, named per repo or per PR.
- **Follow-ups** — remote branches left behind by closed PRs (deliberately not deleted; `git push origin --delete <branch>` when you're sure), and any repo left on a non-default branch.

## Rules

- **Phases run in order, and Phase 2 runs even if Phase 1 was aborted.** Closing PRs is opt-in and interruptible; cleaning up local checkouts is independent of it.
- **Delegate, never re-implement.** Every destructive action belongs to `/sy-close-stale-prs` or `/sy-sync-and-clean-repo`. This command's only job is sequencing and the consolidated report.
- **No branch deletion on the remote.** Phase 1 leaves branches so `gh pr reopen <n>` stays a one-liner; Phase 2 only deletes _local_ branches whose upstream is already `[gone]`.
- **Never force-push, never rebase a shared branch, never `git gc --aggressive`** — all inherited from the cleanup skill; do not add them here.
- **One `$ROOT` per invocation.** To clean up a different tree, `cd` there and rerun rather than passing multiple roots.
