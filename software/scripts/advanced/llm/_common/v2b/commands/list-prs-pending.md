[Sy] List my pending pull requests under the current folder, grouped by feature and numbered `pr1`, `pr2`, …; exclude fully clear PRs and placeholder drafts.

Argument: none. Scope is always PWD, author is always `@me`, format is always `clusters`. For anything else, call `/sy-list-prs` directly.

**Pending = still needs something.** Keep open `@me` PRs except fully clear ones (passing CI, approved, no conflicts, zero unresolved threads) and placeholder drafts (`isDraft == true`, title contains `Placeholder`). Babysitting still enrolls fully clear PRs for watching; this pending view deliberately filters them.

## Steps

1. **Resolve the PR set exactly the way `/sy-babysit-prs` does** — run `/sy-list-prs clusters pwd`. `/sy-babysit-prs` Step 1a delegates to `/sy-list-prs short pwd`: same scope, same author, so the **same PR set** — only the render format differs (`clusters` here, `short` there). Scope resolution therefore stays identical: repos discovered two levels deep, each resolved to `<owner>/<repo>` via `git remote get-url origin` (never the folder name — see Repo Identification), then one `gh search prs --author=@me --state=open` across them.

2. **Drop group 5, `READY TO MERGE`, and drop placeholder drafts**. Group 5 means CI passing + approved + no conflicts + zero unresolved threads. Placeholder drafts have `isDraft` true and `Placeholder` in the title. Keep the other four groups, including the separate `READY TO MERGE (with comments)` group, which still has threads to resolve and so is still pending. Drop them **before** clustering so a cluster's rank and repo list describe only remaining work. Remove clusters whose every member was green or placeholder-only.

3. **Print the `clusters` render and nothing else** — feature clusters first (most urgent cluster on top), each with its repo list, then the standalone block, numbered `pr1`…`pr<N>` straight through. Every line carries the same four fields in the same order: URL, handle, what the PR does, status.

   ```
   ### oauth-migration (2) — owner/repo-a, owner/repo-b
   - https://github.com/owner/repo-a/pull/123 — pr1 — issue refresh tokens on the token endpoint — 🔴 CI FAILED — unit-tests
   - https://github.com/owner/repo-b/pull/456 — pr2 — swap the login form to the new flow — 🟡 AWAITING REVIEW

   ### Standalone (1)
   - https://github.com/owner/repo-c/pull/789 — pr3 — cache the org lookup in the sync job — 🟡 BUILD IN PROGRESS (2 running)
   ```

   No summary line, no counts beyond the heading's, no code fence. Use ≤8 words for `<description>` to explain what the PR does. Never paste in the PR title. Inside a cluster, describe that PR's contribution, not the heading again. Zero pending PRs → print nothing.

## Rules

- **Thin wrapper — `/sy-list-prs` owns everything** (discovery, fetch, classification, clustering, sort, `clusters` layout). This command adds only the fixed scope and the pending filter, including dropping placeholder drafts so its set stays aligned with `/sy-babysit-prs`. Layout and clustering-signal changes go in `/sy-list-prs`.
- **Never re-implement repo discovery here.** Match `/sy-babysit-prs` to answer "what would babysit pick up right now?" Output must paste straight into `/sy-babysit-prs` or `/sy-review-prs` as an explicit PR list. Those commands read each line's `https://` token and skip `###` headings.
- **Grouping is the value; ranking is the order.** A feature landing in three repos has three PRs with one merge order. Print them together with their repo list. Print the cluster carrying the most urgent PR first. Never re-sort by repo after clustering.
- **`pr<N>` handles are per-render pointers, not identifiers.** They exist so the next message can say "babysit pr2 and pr4"; they change on every run and are never stored, quoted back later, or written into a PR body.
- **Output stays paste-clean** — use only `###` headings and the `—` annotation tail as decoration. Start every PR line with the full URL as its first field after `- `. This keeps each line clickable and greppable wherever it lands.
