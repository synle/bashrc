[Sy] List my pending pull requests in the git repos at or below the current folder, as a bare bullet list of links. Same PR set `/sy-babysit-prs` and `/sy-review-prs` pick up with no arguments.

Argument: none. Scope is always PWD, author is always `@me`, format is always `links`. For anything else, call `/sy-list-prs` directly.

**Pending = still needs something.** Every open `@me` PR in scope except the fully-green ones (CI passing + approved + no conflicts + zero unresolved threads) — those just need a merge button, which is the same group `/sy-babysit-prs` skips as "already green".

## Steps

1. **Resolve the PR set exactly the way `/sy-babysit-prs` does** — run `/sy-list-prs links pwd`. `/sy-babysit-prs` Step 1a delegates to `/sy-list-prs short pwd`: same scope, same author, so the **same PR set** — only the render format differs (`links` here, `short` there). Scope resolution therefore stays identical: repos discovered two levels deep, each resolved to `<owner>/<repo>` via `git remote get-url origin` (never the folder name — see Repo Identification), then one `gh search prs --author=@me --state=open` across them.

2. **Drop group 5, `READY TO MERGE`** — the fully-clear one (CI passing + approved + no conflicts + zero unresolved threads). Keep the other four groups, including the separate `READY TO MERGE (with comments)` group, which still has threads to resolve and so is still pending.

3. **Print the `links` render and nothing else** — one `- <full PR URL>` per line, in `/sy-list-prs` display order:

   ```
   - https://github.com/owner/repo-a/pull/123
   - https://github.com/owner/repo-b/pull/456
   ```

   No headings, counts, titles, authors, or code fence. Zero pending PRs → print nothing.

## Rules

- **Thin wrapper — `/sy-list-prs` owns everything** (discovery, fetch, classification, sort, `links` layout). This command adds only the fixed scope and the pending filter. Layout changes go in `/sy-list-prs`.
- **Never re-implement repo discovery here.** Matching `/sy-babysit-prs` is the entire point: this answers "what would babysit pick up right now?", and the output pastes straight into `/sy-babysit-prs` or `/sy-review-prs` as an explicit PR list.
- **Output stays machine-clean** — the `- ` prefix is the only decoration.
