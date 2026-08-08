[Sy] Close open PRs with no activity for N days (default 60). Each candidate is confirmed individually before closing — no bulk wipe without consent.

Argument: $ARGUMENTS (optional — `<days>` threshold, `<owner>/<repo>` scope, `me` / `mine` to filter to your own PRs, or a combination. Defaults to all open PRs authored by `@me` across all repos, 60-day staleness threshold.)

## When to use

- After a project pivot leaves a backlog of WIP PRs nobody will finish.
- End-of-quarter cleanup to keep the dashboard signal-to-noise high.
- Onboarding a new repo and finding a long tail of forgotten branches with open PRs.

For a single PR you want to abandon, just use `gh pr close <n> --comment "..."` directly. This skill is for the multi-PR cleanup case.

## Steps

1. **Parse arguments.** From `$ARGUMENTS`, extract:
   - **Days threshold** — first bare integer token (e.g. `30`, `90`). Default `60` if none.
   - **Author filter** — `me` / `mine` / `self` (case-insensitive) → `@me`; a single bare handle → that user; default `@me`.
   - **Repo scope** — any `<owner>/<repo>` token; multiple allowed (comma- or space-separated). If none and invoked from inside a git checkout, default to the current repo (resolve via `git remote get-url origin`, never from the folder name — see Repo Identification). Otherwise default to "all repos".
   - **Reason override** — quoted string (`"reason text"`) becomes the close-comment body; otherwise use the template below.

2. **Fetch candidates:**
   `gh search prs --state=open --author=<author> [--repo <r>...] --limit 1000 --json number,title,url,repository,updatedAt,author,isDraft,labels,createdAt`
   - **`gh search prs` does not accept the same `--json` fields as `gh pr view`** — it has no `headRefName`, `baseRefName`, `reviews`, `statusCheckRollup`, `commits`, or `mergeStateStatus`, and asking for any of them exits 1 with `Unknown JSON field`, killing the run before a single candidate is listed (the full accepted list is in the `gh` field traps in `/sy-list-prs`). Those all live on `gh pr view`, so fetch them per PR — and only for the PRs that survive the `staleDays` filter below, which is what keeps a wide scope from turning into hundreds of calls:
     `gh pr view <url> --json headRefName,baseRefName,reviews,statusCheckRollup,commits,mergeStateStatus`
     Step 3 renders the last commit author and Step 4 shows the last commit subject and current `mergeStateStatus`, so `commits` and `mergeStateStatus` are required, not optional.
   - Pass `--limit` explicitly or the search silently stops at 30, quietly under-reporting how much is stale. If the count comes back exactly at the limit, treat the set as possibly truncated and say so.
   - Compute `staleDays = (now - updatedAt) / 86400`. Keep only PRs with `staleDays >= <threshold>`.
   - **Always skip** PRs with: an open `APPROVED` review whose state still holds (they're ready to merge — close requires a different decision), title containing `BLOCKED` / `KEEP-OPEN` / `pinned`, or label `do-not-close` / `pinned` / `keep-open`.

3. **Announce.** Print a table: PR url + title + author + staleDays + last commit author + last review state. Order by `staleDays` descending (most stale first). Include count + filter summary at the top. If any candidate's author is not you (`gh api user --jq .login`), say so on its own line before the table — closing someone else's PR is a different decision from closing your own, and the per-PR prompt in step 4 must not be answered on autopilot.

4. **Per-PR confirmation loop.** For each candidate, in stale-first order:
   - Show: title, url, author (always — this loop is destructive, so never let a foreign PR read as your own), last activity (`updatedAt`), last commit subject, current `mergeStateStatus`.
   - Ask: `"Close this PR? (y / n / s=skip-rest / q=quit)"`. Default = `n`.
   - **y** → post the close comment (step 5) and run `gh pr close <n> --repo <owner/repo>`. Note success.
   - **n** → skip this PR; move to next.
   - **s** → break the loop; do not touch any remaining candidates.
   - **q** → same as `s`.

5. **Close comment template** (used unless `$ARGUMENTS` overrode with a quoted reason):

   ```
   Closing this PR — no activity for <N> days.

   If this work is still relevant, reopen with `gh pr reopen <n>` or open a fresh PR rebased on the current default branch. Branch will be left on the remote; delete with `git push origin --delete <headRefName>` when ready.
   ```

   Substitute `<N>` with the actual `staleDays`, `<n>` with the PR number, `<headRefName>` with the branch name.

6. **Final report:** Tally: closed (with PR urls), skipped (with reason — `user said no` / `loop quit`), and any failures from `gh pr close` (e.g. permission denied). Do NOT delete the branches — leave that as a follow-up so accidental closes can be undone with `gh pr reopen`.

## Rules

- **No bulk close without per-PR consent.** Every candidate requires an explicit `y` before closing. `s` / `q` aborts the rest; default on Enter is `n`.
- **Never delete the branch.** `gh pr close` alone leaves the branch on the remote, which means `gh pr reopen` is a one-liner if the close was a mistake. Branch deletion is a separate, explicit follow-up.
- **Respect pinned / approved PRs.** Always-skip filters in step 2 are hard exclusions — do not present them as candidates even with confirmation.
- **Resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name (see Repo Identification).**
- **One staleness threshold per invocation.** Don't try to compute different thresholds per repo; rerun the skill if you need different cutoffs for different scopes.
