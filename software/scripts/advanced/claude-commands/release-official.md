Trigger an OFFICIAL release from the repo's default branch (main / master).

This command triggers **ONLY** the official / stable release workflow.
It must NEVER trigger a beta, prerelease, canary, nightly, or unofficial release.
Aliases: /release-official, /release-main, /release-master — all three do the same thing.

Argument: $ARGUMENTS (optional — repo in owner/repo format. If empty, use the current repo.)

## Steps

1. Determine the repo:
   - If `$ARGUMENTS` is provided, use it as the repo.
   - Otherwise, run `git remote get-url origin` to detect the current repo.
2. Identify the default branch (`main` or `master`): `gh repo view <owner/repo> --json defaultBranchRef --jq '.defaultBranchRef.name'`
3. List release workflows: `gh workflow list --repo <owner/repo>`.
   - **Select** the official release workflow — names containing `release-official`, `release official`, `official-release`, `publish`, or a bare `release` with no modifier.
   - **Reject** any workflow whose name contains `beta`, `prerelease`, `pre-release`, `canary`, `nightly`, `rc`, `alpha`, `dev`, `snapshot`, `draft`, or `unofficial`. If the only matches are these, stop and report "no official release workflow found — aborting".
   - If multiple candidates remain after filtering, ask the user which one to trigger. Never guess.
4. Confirm with the user: "About to trigger OFFICIAL release `<workflow name>` on `<default branch>` in `<owner/repo>`. This is NOT a beta. Proceed? (yes/no)"
   - If no: stop.
5. Trigger: `gh workflow run <workflow-id> --repo <owner/repo> --ref <default-branch>`
6. Wait a few seconds, then find the new run: `gh run list --repo <owner/repo> --workflow=<workflow-id> --limit 1 --json databaseId,status,url`
7. Report the run URL and status to the user.

## Rules

- Official release only. If you cannot find a non-beta workflow, stop and tell the user.
- Always run on the repo's **default branch** (main or master). Do not accept a SHA or non-default ref — that's what `/release-beta` is for.
