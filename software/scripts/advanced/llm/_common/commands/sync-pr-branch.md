[Sy] Bring a single PR branch up to date with its base (merge, not rebase). Same idea as GitHub's "Update branch" button. Per global rule 3, never rebases shared branches.

Argument: $ARGUMENTS (optional — a PR URL, PR number, or `<owner>/<repo>#<n>` shorthand. If empty, use the current branch's PR.)

## When to use

- A PR is behind its base branch and CI requires "up to date with base" before merging.
- `gh pr merge` reports `MERGEABLE: BEHIND` and you don't want to launch the full `/sy-babysit-pr` loop.
- You want a one-shot branch sync without the comment-remediation / CI-fix / poll behavior babysit-pr does.

For full address-comments + drive-CI-green work, use `/sy-babysit-pr` instead. This skill is the lightweight sibling.

## Steps

1. **Resolve the target PR:**
   - If `$ARGUMENTS` is provided (URL / number / `owner/repo#n`), parse it.
   - If empty, resolve via `git remote get-url origin` (per global rule 51, never derive from folder name) + `git branch --show-current` + `gh pr view --json number,headRefName,baseRefName,url`. If no PR exists for the current branch, report and stop.

2. **Fetch state:**
   `gh pr view <number> --repo <owner/repo> --json number,title,headRefName,baseRefName,isDraft,state,mergeable,mergeStateStatus,url`
   - **Skip if `state == "MERGED"` or `state == "CLOSED"`.** Nothing to sync.
   - **Skip if `mergeStateStatus == "CLEAN"` or `mergeStateStatus == "HAS_HOOKS"`.** Already up to date.
   - **Warn and confirm if `isDraft == true`.** Draft branches usually don't need sync; proceed only on explicit yes.

3. **Try the GitHub-side update first:**
   - Run `gh pr update-branch <number> --repo <owner/repo>` (uses merge strategy by default; never `--rebase`).
   - If it succeeds, skip to step 5.
   - If it fails with merge conflicts (`mergeable == "CONFLICTING"`), proceed to step 4.

4. **Manual merge fallback (only on conflict):**
   - `git fetch origin <baseRefName>:<baseRefName>` (or `git fetch origin <baseRefName>` if local ref doesn't exist).
   - Check out the PR branch locally: `gh pr checkout <number> --repo <owner/repo>`.
   - `git merge origin/<baseRefName>` and resolve conflicts. Never rebase.
   - Commit the merge (`git commit` — the editor will pre-fill the merge message; accept it).
   - Author-check the merge commit per global rule 2; reset author if mismatch.
   - Push: `git push`.

5. **Report:**
   - PR number + URL.
   - New `mergeStateStatus` from a fresh `gh pr view`.
   - Whether the sync was server-side (step 3) or manual (step 4).
   - If CI re-triggered: the run URL from `gh run list --branch <headRefName> --limit 1`.

## Rules

- **Never rebase.** `git pull --rebase`, `gh pr update-branch --rebase`, or interactive rebase on a PR branch are all forbidden — global rule 3 (no rebase on shared branches). Always merge.
- **Don't touch the comment threads or CI.** That's babysit's job. This skill exits after the sync push, regardless of CI state.
- **One PR per invocation.** For fan-out across all open PRs, use `/sy-babysit-prs` (which includes per-PR sync as step 1) instead of looping this skill.
- **Resolve `<owner>/<repo>` via `git remote get-url origin`** (global rule 51) when defaulting to the current repo — never derive from the folder name.
