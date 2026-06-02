[Sy] Run `/sy-review-pr` on EVERY open PR in scope. Fan-out wrapper — finds matching open PRs and delegates the full per-PR review (skip checks, author flags, diff review, verdict, post) to `/sy-review-pr` for each one. Repo-, language-, and framework-agnostic.

Argument: `$ARGUMENTS` (optional — scope filter; see "Resolving scope" below). Defaults to **all open PRs in the current repo, authored by anyone**, when invoked from inside a git checkout — otherwise **all open PRs authored by me**.

## Steps

1. **Resolve scope.** Parse `$ARGUMENTS` and build the `gh search prs` call:
   - **Empty `$ARGUMENTS`** — if invoked from inside a git checkout, default to the current repo (resolve via `git remote get-url origin` → `<owner>/<repo>`) and ALL authors: `gh search prs --repo <owner>/<repo> --state=open`. If not inside a repo, default to `--author=@me`.
   - **`me` / `mine` / `self`** (case-insensitive) → `--author=@me`.
   - **`<github-handle>`** (single bare token, no spaces) → `--author=<handle>`.
   - **`<full name>`** (multiple tokens, no slashes) → resolve via `gh api "search/users?q=<name>" --jq '.items[0].login'`, confirm with the user, then `--author=<resolved-handle>`.
   - **`<owner>/<repo>`** (single token containing `/`) → `--repo <owner>/<repo>`. Multiple `<owner>/<repo>` tokens (comma- or space-separated) → fan out one `gh search prs` call per repo and union the results.
   - **`org:<org-name>`** → `gh search prs --owner=<org-name> --state=open`.
   - **Combined** — repo / author tokens compose: e.g. `acme/api,acme/web alice` → search both repos for PRs by `alice`.
   - **Repo list** (e.g. workspace bundles like `tde-tool-backend, tde-tool-docs, tde-tool-ui, tde-agent, tde-grpc-proto-api`) — same as multiple `<owner>/<repo>` tokens; resolve each to its `<owner>/<repo>` (the user may pass bare repo names, in which case ask for the owner once and reuse it across the list).

2. **Fetch PRs:**
   `gh search prs <scope-flags> --state=open --json number,title,repository,isDraft,url,headRefName,baseRefName,author`

3. **Announce:** Tell the user how many open PRs were found and list them (repo, PR number, title, author). Skip PRs already filtered out by `/sy-review-pr`'s own skip rules in the per-PR step — don't pre-filter here.

4. **For each PR, delegate to `/sy-review-pr <PR-URL>`.** The per-PR skill owns the full behavior:
   - Skip drafts / WIP / DO NOT MERGE / already-reviewed-no-new-commits / blocked-by-other-reviewer.
   - Load repo rules and culture context (`CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` / `.cursorrules` / PR template).
   - Pre-flight author flags (diff-vs-description mismatch, merge conflict with base, failing CI with run-URL pinpoint, migration coordination) as PR comments.
   - De-dup against existing review threads (human + bot + own past comments).
   - Read the diff (or just the new commits for stale-approval re-reviews).
   - Pick verdict — APPROVE / COMMENT (default bias) / REQUEST_CHANGES (show-stoppers only). Cap at COMMENT when another reviewer's `REQUEST_CHANGES` is open or CI is failing.
   - Post the review.

   Do NOT re-implement any of that logic here — if per-PR behavior needs to change, edit `/sy-review-pr`.

5. **Concurrent-migration cross-check (only when scope is multi-repo or covers a workspace bundle).** Before kicking off the per-PR loop, scan ALL open PRs in scope for ones that add a database migration file (same detection paths as `/sy-review-pr`'s Migration checks). If two or more PRs each add a migration: note the migration-conflict pairs upfront in the announcement so the per-PR delegation can flag each author symmetrically.

6. **Final report:** Summarize per PR — verdict (APPROVE / COMMENT / REQUEST_CHANGES / SKIPPED + reason), author flags posted, and any cross-PR migration coordination notes.

## Rules

- **This command is a dispatcher. The per-PR logic lives in `/sy-review-pr` — do not re-implement it here.**
- **Honor `/sy-review-pr`'s skip rules** — never pre-filter drafts / WIP / already-reviewed PRs in this wrapper. Let the per-PR skill decide and report `SKIPPED + reason` so the audit trail is complete.
- **Default bias inherits from `/sy-review-pr`**: APPROVE or COMMENT — REQUEST_CHANGES is reserved for show-stoppers only.
- **Multi-repo workspaces** (e.g. a bundle like `tde-tool-backend, tde-tool-docs, tde-tool-ui, tde-agent, tde-grpc-proto-api`): pass each repo as a `<owner>/<repo>` token. The cross-PR migration check (Step 5) runs across the full union so coordination flags surface before any verdict is posted.
- **Always resolve `<owner>/<repo>` via `git remote get-url origin`** (global rule 46) when defaulting to the current repo — never derive from the folder name.
