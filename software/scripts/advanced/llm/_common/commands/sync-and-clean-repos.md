[Sy] Fan out `/sy-sync-and-clean-repo` across every git repository discovered under a root folder.

Argument: $ARGUMENTS (optional — a root folder path. Defaults to current folder.)

## When to use

- Periodic "cleanup day" — multiple local checkouts have drifted behind their remotes.
- After a project pivot left a backlog of merged-but-undeleted local branches across many repos.
- Before starting a large piece of work spanning multiple repos.

This is a thin orchestrator. It owns **no** git logic of its own — it discovers repos and delegates each to `/sy-sync-and-clean-repo`. Read that file for the actual behavior.

## Invocation contract

**Target** (first token, optional):

- A path to a folder containing git repos — runs discovery from there.
- Empty → current folder.

## Steps

1. **Record the root.** `ROOT="$PWD"` (or the provided path). Every repo runs from here and returns here.

2. **Discover repos.** `for d in . */ */*/; do git -C "$d" rev-parse --show-toplevel; done 2>/dev/null | sort -u`. Returns the repo roots. Zero repos → report and exit.

3. **Run cleanup per repo.** For each discovered repo root, invoke `/sy-sync-and-clean-repo <repo-path>`. Capture the output and any errors.

4. **Consolidated report.** Print one **Sync & Clean Summary** block:
   - Per repo: path, default branch, branches deleted, worktree records pruned, branches merged cleanly, branches with conflicts resolved, branches skipped, push status.
   - Errors / warnings — anything the per-repo run surfaced, named per repo.
   - Follow-ups — any repo left on a non-default branch, any remote branches left behind by merged PRs.

## Rules

- **Delegate, never re-implement.** Every destructive action belongs to `/sy-sync-and-clean-repo`. This command's only job is discovery, sequencing, and the consolidated report.
- **Phones run in order.** A repo that fails (diverged default, unresolvable conflict, detached HEAD) is reported and skipped — it does not abort the remaining repos.
- **No branch deletion on the remote.** Inherited from the per-repo skill.
- **Never force-push, never rebase a shared branch, never `git gc --aggressive`.** Inherited from the per-repo skill.
- **One `$ROOT` per invocation.** To clean up a different tree, `cd` there and rerun rather than passing multiple roots.

## Safety

Never:

- Run git logic directly (fetch, merge, branch -D) — delegate to `/sy-sync-and-clean-repo`
- Abort the fan-out because one repo failed
- Delete remote branches

Stop and ask when:

- The root folder is not a directory
- A per-repo run stops and asks (bubbles up through the orchestrator)
