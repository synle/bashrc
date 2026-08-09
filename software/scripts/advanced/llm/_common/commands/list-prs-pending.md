[Sy] List my pending pull requests in the git repos at or below the current folder, grouped by feature and numbered `pr1`, `pr2`, … so a feature spanning several repos reads side by side. Same PR set `/sy-babysit-prs` and `/sy-review-prs` pick up with no arguments.

Argument: none. Scope is always PWD, author is always `@me`, format is always `clusters`. For anything else, call `/sy-list-prs` directly.

**Pending = still needs something.** Every open `@me` PR in scope except the fully-green ones (CI passing + approved + no conflicts + zero unresolved threads) — those just need a merge button, which is the same group `/sy-babysit-prs` skips as "already green".

## Steps

1. **Resolve the PR set exactly the way `/sy-babysit-prs` does** — run `/sy-list-prs clusters pwd`. `/sy-babysit-prs` Step 1a delegates to `/sy-list-prs short pwd`: same scope, same author, so the **same PR set** — only the render format differs (`clusters` here, `short` there). Scope resolution therefore stays identical: repos discovered two levels deep, each resolved to `<owner>/<repo>` via `git remote get-url origin` (never the folder name — see Repo Identification), then one `gh search prs --author=@me --state=open` across them.

2. **Drop group 5, `READY TO MERGE`** — the fully-clear one (CI passing + approved + no conflicts + zero unresolved threads). Keep the other four groups, including the separate `READY TO MERGE (with comments)` group, which still has threads to resolve and so is still pending. Drop it **before** clustering, so a cluster's rank and repo list describe only the work that is actually left; a cluster whose every member was green disappears with them.

3. **Print the `clusters` render and nothing else** — feature clusters first (most urgent cluster on top), each with its repo list, then the standalone block, numbered `pr1`…`pr<N>` straight through. Every line carries the same four fields in the same order: URL, handle, what the PR does, status.

   ```
   ### oauth-migration (2) — owner/repo-a, owner/repo-b
   - https://github.com/owner/repo-a/pull/123 — pr1 — issue refresh tokens on the token endpoint — 🔴 CI FAILED — unit-tests
   - https://github.com/owner/repo-b/pull/456 — pr2 — swap the login form to the new flow — 🟡 AWAITING REVIEW

   ### Standalone (1)
   - https://github.com/owner/repo-c/pull/789 — pr3 — cache the org lookup in the sync job — 🟡 BUILD IN PROGRESS (2 running)
   ```

   No summary line, no counts beyond the heading's, no code fence. `<description>` is ≤8 words of what the PR does — never the PR title pasted in, and inside a cluster it is what that PR contributes rather than a repeat of the heading. Zero pending PRs → print nothing.

## Rules

- **Thin wrapper — `/sy-list-prs` owns everything** (discovery, fetch, classification, clustering, sort, `clusters` layout). This command adds only the fixed scope and the pending filter. Layout and clustering-signal changes go in `/sy-list-prs`.
- **Never re-implement repo discovery here.** Matching `/sy-babysit-prs` is the entire point: this answers "what would babysit pick up right now?", and the output pastes straight into `/sy-babysit-prs` or `/sy-review-prs` as an explicit PR list — those read the `https://` token off each line and skip the `###` headings.
- **Grouping is the value; ranking is the order.** The same feature landing in three repos is three PRs one merge order applies to, so they print together with their repo list, and the cluster carrying the most urgent PR prints first. Never re-sort by repo after clustering.
- **`pr<N>` handles are per-render pointers, not identifiers.** They exist so the next message can say "babysit pr2 and pr4"; they change on every run and are never stored, quoted back later, or written into a PR body.
- **Output stays paste-clean** — `###` headings and the `—` annotation tail are the only decoration, and every PR line leads with the full URL as its first field after `- `, so a line stays clickable and greppable wherever it lands.
