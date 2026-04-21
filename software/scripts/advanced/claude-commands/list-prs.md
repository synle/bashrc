List all my open pull requests across all repos.

## Steps

1. Run `gh search prs --author=@me --state=open --json number,title,repository,isDraft,url,headRefName` to find all open PRs.

2. For each PR, fetch detailed status:
   - CI/build status: use `gh pr view <number> --repo <owner/repo> --json statusCheckRollup` to determine passing/failing/pending
   - Approval status: use `gh pr view <number> --repo <owner/repo> --json reviews,reviewDecision` to determine approved/changes requested/pending review
   - Merge readiness: all checks pass + approved + no conflicts

3. Sort results: **ready PRs first** (no WIP/DNM prefix), then **WIP PRs** (title contains WIP or DO NOT MERGE).

4. Present as a table with these columns:
   | PR | Repo | Title | Link | CI Status | Approvals | Ready to Merge? |
   - PR column: show PR number and branch name on separate lines (e.g. `#123` then `feature-branch` below it)
   - CI Status: passing, failing, or pending
   - Approvals: approved (count), changes requested, or pending review
   - Ready to Merge: yes (all green + approved + mergeable) or no (with reason)
   - WIP PRs should be marked with `[WIP]` in the title column
   - If a PR is a GitHub draft (isDraft=true), add `[Draft]` tag in the title column. Otherwise omit it.
