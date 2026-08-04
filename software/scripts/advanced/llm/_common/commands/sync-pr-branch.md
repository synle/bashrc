[Sy] Bring a single PR branch up to date with its base (merge, not rebase). Same idea as GitHub's "Update branch" button. Never rebases shared branches — always merge to avoid rewriting pushed history.

Argument: $ARGUMENTS (optional — a PR URL, PR number, or `<owner>/<repo>#<n>` shorthand. If empty, use the current branch's PR.)

## When to use

- A PR is behind its base branch and CI requires "up to date with base" before merging.
- `gh pr merge` reports `MERGEABLE: BEHIND` and you don't want to launch the full `/sy-babysit-pr` loop.
- You want a one-shot branch sync without the comment-remediation / CI-fix / poll behavior babysit-pr does.

For full address-comments + drive-CI-green work, use `/sy-babysit-pr` instead. This skill is the lightweight sibling.

## Steps

1. **Resolve the target PR:**
   - If `$ARGUMENTS` is provided (URL / number / `owner/repo#n`), parse it.
   - If empty, resolve via `git remote get-url origin` (see Repo Identification) + `git branch --show-current` + `gh pr view --json number,headRefName,baseRefName,url`. If no PR exists for the current branch, report and stop.

2. **Fetch state:**
   `gh pr view <number> --repo <owner/repo> --json number,title,headRefName,baseRefName,isDraft,state,mergeable,mergeStateStatus,url`
   - **Skip if `state == "MERGED"` or `state == "CLOSED"`.** Nothing to sync.
   - **Skip if `mergeStateStatus == "CLEAN"` or `mergeStateStatus == "HAS_HOOKS"`.** Already up to date.
   - **Warn and confirm if `isDraft == true`.** Draft branches usually don't need sync; proceed only on explicit yes.

3. **Try the GitHub-side update first:**
   - Run `gh pr update-branch <number> --repo <owner/repo>` (uses merge strategy by default; never `--rebase`).
   - If it succeeds, skip to step 5.
   - If it fails with merge conflicts (`mergeable == "CONFLICTING"`), proceed to step 4.

4. **Manual merge fallback (only on conflict) — in a dedicated worktree, never the primary checkout:**
   - Resolve the worktree at the canonical path (see One rigid worktree path): `WT="$HOME/.worktrees/<owner>/<repo>/pr-<number>"; mkdir -p "$(dirname "$WT")"`. Reuse a linked worktree already on `<headRefName>` (`git worktree list --porcelain`) if one exists; else `git fetch origin <headRefName> && git worktree add "$WT" -B <headRefName> origin/<headRefName>`; else — if `<headRefName>` is checked out in the MAIN worktree — `git worktree add --detach "$WT" origin/<headRefName>`. When cwd is not the target repo, `gh repo clone <owner/repo> "$WT"` and `gh pr checkout <number>` there. `cd "$WT"` and run everything below from there.
   - `git fetch origin <baseRefName>`.
   - `git merge origin/<baseRefName>` and resolve conflicts. Never rebase.
   - Commit the merge (`git commit` — the editor will pre-fill the merge message; accept it).
   - Author-check the merge commit — compare commit author to local `.gitconfig`; reset author if mismatch.
   - Push: `git push`, or `git push origin HEAD:<headRefName>` when the worktree is detached.
   - Clean up only the worktree/clone this run created (`git worktree remove` / `rm -rf`); a reused pre-existing worktree stays. `/sy-babysit-pr` uses this same path, so leaving it in place is also fine — `git clean-worktree` reaps it once the branch merges.

5. **Report:**
   - PR number + URL.
   - New `mergeStateStatus` from a fresh `gh pr view`.
   - Whether the sync was server-side (step 3) or manual (step 4).
   - If CI re-triggered: the run URL from `gh run list --branch <headRefName> --limit 1`.

## Rules

- **Merge, never rebase.** `git pull --rebase`, `gh pr update-branch --rebase`, or interactive rebase on a PR branch are all forbidden — rebasing rewrites pushed history and forces `--force-with-lease` on next push. Always merge.
- **The manual fallback (Step 4) runs in a dedicated worktree at `$HOME/.worktrees/<owner>/<repo>/pr-<number>` — never the user's primary checkout** (see Never do PR-branch work in the primary checkout / One rigid worktree path). Step 3's server-side `gh pr update-branch` needs no checkout at all, which is why it's tried first.
- **Don't touch the comment threads or CI.** That's babysit's job. This skill exits after the sync push, regardless of CI state.
- **One PR per invocation.** For fan-out across all open PRs, use `/sy-babysit-prs` (which includes per-PR sync as step 1) instead of looping this skill.
- **Resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name (see Repo Identification).**
