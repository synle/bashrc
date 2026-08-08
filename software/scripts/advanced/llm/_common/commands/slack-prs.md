[Sy] Draft a short Slack message asking the team to review open pull requests, grouped by readiness.

Argument: $ARGUMENTS (optional — the PR author to filter by: a GitHub username, a full name, or empty.)

## Resolving the author

1. If `$ARGUMENTS` is empty, whitespace, or one of `me`/`mine`/`self`, filter by the current user (`--author=@me`) — this is the default.
2. If `$ARGUMENTS` is a clear GitHub handle (single token, no spaces), use it directly (`--author=<handle>`).
3. If `$ARGUMENTS` is ambiguous (e.g. a full name with spaces, or unclear), ask the user: "Whose PRs should I share? Please provide a GitHub username or a full name." Then resolve:

- If the user gives a handle, use it directly.
- If the user gives a full name, try `gh api "search/users?q=<name>" --jq '.items[0].login'` to resolve to a handle, and confirm the match with the user before proceeding.

## Steps

1. Fetch open PRs for the resolved author:
   `gh search prs --author=<resolved> --state=open --limit 1000 --json number,title,repository,isDraft,url,createdAt,updatedAt,author`
   - **`gh search prs` has no `headRefName`, `baseRefName`, or `body`** — asking for any of them exits 1 with `Unknown JSON field` (see the `gh` field traps in `/sy-list-prs`). All three come from `gh pr view`, and this command needs all three for **every** PR, not conditionally: each rendered row is `<repo> — <branch> — <title> — <url>`, and the dependency tiebreaker in step 3b compares one PR's `baseRefName` against another's `headRefName` and scans the body for references. So follow the search with one call per PR, before sorting:
     `gh pr view <url> --json headRefName,baseRefName,body`
   - Pass `--limit` explicitly or the search silently returns just 30, so the message under-reports the queue. At exactly the limit, treat the set as possibly truncated and say so.

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
   - "Friendly title" = the PR title with any `WIP:`, `DO NOT MERGE`, or `[Draft]` prefixes stripped for readability, plus a leading `[<repo>] ` prefix stripped when it matches the repo already shown in the same line — the repo is its own field here, so keeping it in the title prints it twice.
   - Omit a group entirely (including its header) if it has zero PRs.
   - If BOTH groups are empty, output just: `No PRs to share right now.`
   - Use Slack-flavored formatting (`*bold*`, not `**bold**`).
   - **Attribute anything that isn't yours** (see Show PR authors). Compare each `author.login` against `gh api user --jq .login`:
     - All yours → opener stays `Hi team, can I have a review on these PRs? 🙏`, no author on any line.
     - All one other person's → opener becomes `Hi team, can I have a review on <handle>'s PRs? 🙏`, still no per-line author (it'd repeat).
     - Mixed → keep the generic opener and add the author as a fifth field on **every** line: `- <repo> — <branch> — <friendly title> — <@author> — <url>`. A Slack reader can't guess who to ping otherwise, and asking the channel to review a PR while implying it's yours is a misattribution in front of the whole team.

5. Print the final message inside a fenced code block so the user can copy it directly into Slack.
