Sy Skill - Draft a short Slack message asking the team to review open pull requests, grouped by readiness.

Argument: $ARGUMENTS (optional — the PR author to filter by: a GitHub username, a full name, or empty.)

## Resolving the author

1. If `$ARGUMENTS` is empty, whitespace, or one of `me`/`mine`/`self`, filter by the current user (`--author=@me`) — this is the default.
2. If `$ARGUMENTS` is a clear GitHub handle (single token, no spaces), use it directly (`--author=<handle>`).
3. If `$ARGUMENTS` is ambiguous (e.g. a full name with spaces, or unclear), ask the user: "Whose PRs should I share? Please provide a GitHub username or a full name." Then resolve:

- If the user gives a handle, use it directly.
- If the user gives a full name, try `gh api "search/users?q=<name>" --jq '.items[0].login'` to resolve to a handle, and confirm the match with the user before proceeding.

## Steps

1. Fetch open PRs for the resolved author:
   `gh search prs --author=<resolved> --state=open --json number,title,repository,isDraft,url,headRefName,createdAt`

2. **Classify each PR into one of two groups:**

- **READY** — title does NOT contain `WIP` or `DO NOT MERGE` AND `isDraft` is false. These are ready for review.
- **WIP / DRAFT** — title contains `WIP` or `DO NOT MERGE`, OR `isDraft` is true. Still in progress.

3. **Sort within each group** using this order (each tiebreaker applies only when the previous is equal):
   a. Repo name (alphabetical).
   b. Dependency order — if PR A must merge before PR B (e.g. B's branch is based on A's branch, or B's description references A), put A first.
   c. `createdAt` ascending — oldest PR first, newest last.

4. **Compose a short Slack message** (plain text, copy-pasteable — no tables, no markdown headers):

   ```
   Hi team, can I have a review on these PRs? 🙏

   *Ready for review*
   - <repo> — <branch> — <friendly title> — <url>
   - <repo> — <branch> — <friendly title> — <url>

   *WIP / Draft (early feedback welcome)*
   - <repo> — <branch> — <friendly title> — <url>
   ```

   Rules:
   - Keep it short. Just the four fields per line — no CI, approvals, or merge status.
   - "Friendly title" = the PR title with any `WIP:`, `DO NOT MERGE`, or `[Draft]` prefixes stripped for readability.
   - Omit a group entirely (including its header) if it has zero PRs.
   - If BOTH groups are empty, output just: `No PRs to share right now.`
   - Use Slack-flavored formatting (`*bold*`, not `**bold**`).

5. Print the final message inside a fenced code block so the user can copy it directly into Slack.
