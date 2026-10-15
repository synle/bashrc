[Sy] Merge latest code into a working branch. Plain-English asks like "pull latest code", "pull latest code from master", or "pull latest code from main" mean this fixed merge workflow: first merge repo floor/default changes, then any ancestor wave or feature branches the branch sits on, then `upstream/<default>` when the repo is a fork. Merge only — never rebase.

## Purpose

This is the user-facing "bring my branch up to date" command. It does NOT invent a second branch-sync implementation. Repo-local sync still belongs to `/sy-sync-pr-branch`, which resolves the floor, walks ancestor PRs, merges in the right order, handles conflicts, and runs the migration and pre-push gates. This command adds one thing on top: if the repo is a fork with an `upstream` remote, merge that remote's default branch too, and do it LAST.

Use when the user asks in plain English to pull or merge the latest code into a non-default working branch. For full PR babysitting, use `/sy-babysit-pr` instead.

## Steps

1. **Resolve target and repo.**
   - Target defaults to current branch. If `$ARGUMENTS` names a PR URL, PR number, `<owner>/<repo>#<n>`, or branch name, use that target instead.
   - Resolve authoritative `owner/repo` from git / GitHub, never from the folder name.
   - Resolve the repo default branch from `origin/HEAD` or `gh repo view`.
   - Resolve whether an `upstream` remote exists and whether it points at a different repo than `origin`. No `upstream`, or same repo as `origin` → not a fork for this command.

2. **Guard the default branch exception.**
   - If the target branch **is the repo default branch itself**, stop and say so. Do NOT use this command there.
   - Reason: the shared git workflow rule says syncing the default branch itself is the fast-forward path (`git pull --rebase` then push), not a merge-commit path. This command is for working branches.

3. **Delegate repo-local sync to `/sy-sync-pr-branch`.**
   - Invoke `/sy-sync-pr-branch` for the target and consume its result block rather than re-implementing any branch-sync logic here.
   - That delegated sync already does the first two parts of the workflow safely:
     - merges repo-local floor / default-branch changes first;
     - then, when the branch is stacked or wave-based, merges every ancestor branch from root-most down to the immediate parent.
   - Important nuance: when the branch sits on a long-lived non-default floor branch, `/sy-sync-pr-branch` merges that floor instead of forcing `origin/<default>`. Keep that behavior. Do not override it here.
   - If `/sy-sync-pr-branch` reports `stopped-for-human` or `needs-human`, stop here. Do not continue to upstream.

4. **Merge upstream default branch LAST when this repo is a fork.**
   - Only when `upstream` exists and resolves to a different repo than `origin`.
   - Resolve upstream's default branch from `refs/remotes/upstream/HEAD`, falling back to `gh repo view --repo <upstream-owner/repo> --json defaultBranchRef -q .defaultBranchRef.name`.
   - `git fetch upstream <upstream-default>`
   - `git merge --no-edit upstream/<upstream-default>`
   - Resolve conflicts before doing anything else. Never start another merge while one is in progress.
   - If there is no upstream remote, or `upstream` is the same repo as `origin`, report `upstream: none` and finish.

5. **Report exactly what happened.**
   - Name the target branch or PR.
   - Quote the `/sy-sync-pr-branch` result block for the repo-local part.
   - Then append one upstream line: `upstream: none`, `upstream: already up to date`, `upstream: merged <branch>`, or `upstream: conflicts resolved (<n> files)`.
   - Say plainly that the phrase "pull latest code" was interpreted as this merge workflow.

## Safety

Never:
- never rebase (`git rebase`, `git pull --rebase`, `gh pr update-branch --rebase`, interactive rebase);
- never hand-roll repo-local sync logic that `/sy-sync-pr-branch` already owns;
- never merge `upstream` first — upstream comes LAST in this command's workflow;
- never run this on the repo default branch itself;
- never merge ancestor branches upward or push ancestor branches;
- never continue to the upstream step after `/sy-sync-pr-branch` stopped for human input.

Stop and ask when conflict resolution or migration repair needs judgment you do not have.

## Verification

Show evidence for all three layers:
- repo-local sync result block from `/sy-sync-pr-branch`;
- whether `upstream` existed and which repo it resolved to;
- upstream merge outcome (`already up to date`, merged SHA/branch, or conflicts resolved).

If nothing changed, say so explicitly rather than implying a merge happened.
