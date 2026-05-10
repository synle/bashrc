List open pull requests across all repos, grouped by readiness.

Argument: $ARGUMENTS (optional — the PR author to filter by: a GitHub username, a full name, or empty.)

## Resolving the author

1. If `$ARGUMENTS` is empty, whitespace, or one of `me`/`mine`/`self`, filter by the current user (`--author=@me`) — this is the default.
2. If `$ARGUMENTS` is a clear GitHub handle (single token, no spaces), use it directly (`--author=<handle>`).
3. If `$ARGUMENTS` is ambiguous (e.g. a full name with spaces, or unclear), ask the user: "Whose PRs should I list? Please provide a GitHub username or a full name." Then resolve:

- If the user gives a handle, use it directly.
- If the user gives a full name, try `gh api "search/users?q=<name>" --jq '.items[0].login'` to resolve to a handle, and confirm the match with the user before proceeding.

## Steps

1. Fetch open PRs for the resolved author:
   `gh search prs --author=<resolved> --state=open --json number,title,repository,isDraft,url,headRefName,createdAt`

2. For each PR, fetch detailed status:
   - CI/build status: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup` -> passing / failing / pending
   - Approval status: `gh pr view <number> --repo <owner/repo> --json reviews,reviewDecision` -> approved (count) / changes requested / pending review
   - Merge readiness: all checks pass + approved + no conflicts

3. **Classify each PR into one of two groups:**

- **READY** — title does NOT contain `WIP` or `DO NOT MERGE` AND `isDraft` is false. These are ready for review.
- **WIP / DRAFT** — title contains `WIP` or `DO NOT MERGE`, OR `isDraft` is true. Still in progress.

4. **Sort within each group** using this order (each tiebreaker applies only when the previous is equal):
   a. Repo name (alphabetical).
   b. Dependency order — if PR A must merge before PR B (e.g. B's branch is based on A's branch, or B's description references A), put A first.
   c. `createdAt` ascending — oldest PR first, newest last.

5. Present **two separate tables**, READY first then WIP / DRAFT, each with these columns:
   | PR | Repo | Title | Link | CI Status | Approvals | Ready to Merge? |
   - PR column: PR number and branch name on separate lines (e.g. `#123` then `feature-branch` below it)
   - CI Status: passing / failing / pending
   - Approvals: approved (count) / changes requested / pending review
   - Ready to Merge: yes (all green + approved + mergeable) or no (with reason)
   - In the WIP / DRAFT table, mark titles with `[WIP]` (title contains WIP / DNM) or `[Draft]` (GitHub draft). A PR can have both tags.

6. Above each table, print a heading: `## Ready for review (N)` and `## WIP / Draft (N)` with the count.
