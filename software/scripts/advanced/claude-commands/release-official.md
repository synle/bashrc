Trigger an official release from the main branch.

Argument: $ARGUMENTS (optional — repo in owner/repo format. If empty, use the current repo.)

## Steps

1. Determine the repo:
   - If `$ARGUMENTS` is provided, use it as the repo.
   - Otherwise, run `git remote get-url origin` to detect the current repo.
2. Identify the default branch (`main` or `master`): `gh repo view <owner/repo> --json defaultBranchRef --jq '.defaultBranchRef.name'`
3. List release workflows: `gh workflow list --repo <owner/repo>` and find the official release workflow (look for names containing "release-official", "release official", "release", or "publish").
4. Confirm with the user: "About to trigger <workflow name> on <default branch> in <owner/repo>. Proceed? (yes/no)"
   - If no: stop.
5. Trigger: `gh workflow run <workflow-id> --repo <owner/repo> --ref <default-branch>`
6. Wait a few seconds, then find the new run: `gh run list --repo <owner/repo> --workflow=<workflow-id> --limit 1 --json databaseId,status,url`
7. Report the run URL and status to the user.
