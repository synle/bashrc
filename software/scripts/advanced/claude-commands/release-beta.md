Trigger a beta release from a specific commit SHA.

Argument: $ARGUMENTS (required — a commit SHA or branch name to release from.)

## Steps

1. Determine the repo from `git remote get-url origin`.
2. Resolve the target SHA:
   - If `$ARGUMENTS` looks like a SHA (hex string), use it directly.
   - If `$ARGUMENTS` is a branch name, resolve it: `git rev-parse origin/<branch>` or `gh api repos/<owner/repo>/git/ref/heads/<branch> --jq '.object.sha'`
   - If `$ARGUMENTS` is empty, ask the user for a branch name or SHA.
3. List release workflows: `gh workflow list --repo <owner/repo>`.
   - **Select** the beta workflow — names containing `release-beta`, `release beta`, `beta`, `prerelease`, `pre-release`, `canary`, or `nightly`.
   - **Reject** any workflow that is the official/stable release (names like `release-official`, `release official`, `official-release`, `publish`, or bare `release` with no modifier). If the only matches are official, stop and report "no beta release workflow found — aborting". This command must never trigger an official release.
   - If multiple beta candidates remain, ask the user which one to trigger.
4. Confirm with the user: "About to trigger BETA release `<workflow name>` at SHA `<sha>` (<short description>) in `<owner/repo>`. This is NOT an official release. Proceed? (yes/no)"
   - If no: stop.
5. Trigger: `gh workflow run <workflow-id> --repo <owner/repo> --ref <sha>`
6. Wait a few seconds, then find the new run: `gh run list --repo <owner/repo> --workflow=<workflow-id> --limit 1 --json databaseId,status,url`
7. Report the run URL and status to the user.
