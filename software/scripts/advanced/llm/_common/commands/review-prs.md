[Sy] Run `/sy-review-pr` on EVERY open PR in scope. Fan-out wrapper — finds matching open PRs and dispatches them **all at once, in parallel background jobs**, delegating the full per-PR review (skip checks, author flags, diff review, verdict, post) to `/sy-review-pr`. Repo-, language-, and framework-agnostic.

**Recommended order.** Run `/sy-review-prs` first (verdict pass — fast, no code changes), then `/sy-babysit-prs` (apply fixes, drive CI green). Reversing wastes babysit cycles on PRs that would otherwise be requested-changes and rewritten.

Argument: $ARGUMENTS (optional — scope filter; see "Resolving scope" below). Defaults to **all open PRs in the current repo, authored by anyone**, when invoked from inside a git checkout — otherwise **all open PRs authored by me**.

## Steps

1. **Resolve scope.** Parse `$ARGUMENTS` and build the `gh search prs` call:
   - **Empty `$ARGUMENTS`** — if invoked from inside a git checkout, default to the current repo (resolve via `git remote get-url origin` → `<owner>/<repo>`) and ALL authors: `gh search prs --repo <owner>/<repo> --state=open`. If not inside a repo, default to `--author=@me`.
   - **`me` / `mine` / `self`** (case-insensitive) → `--author=@me`.
   - **`<github-handle>`** (single bare token, no spaces) → `--author=<handle>`.
   - **`<full name>`** (multiple tokens, no slashes) → resolve via `gh api "search/users?q=<name>" --jq '.items[0].login'`, confirm with the user, then `--author=<resolved-handle>`.
   - **`<owner>/<repo>`** (single token containing `/`) → `--repo <owner>/<repo>`. Multiple `<owner>/<repo>` tokens (comma- or space-separated) → fan out one `gh search prs` call per repo and union the results.
   - **`org:<org-name>`** → `gh search prs --owner=<org-name> --state=open`.
   - **Combined** — repo / author tokens compose: e.g. `acme/api,acme/web alice` → search both repos for PRs by `alice`.
   - **Repo list** (e.g. workspace bundles like `myapp-frontend`, `myapp-backend` or `myapp-lib`) — same as multiple `<owner>/<repo>` tokens; resolve each to its `<owner>/<repo>` (the user may pass bare repo names, in which case ask for the owner once and reuse it across the list).

2. **Fetch PRs:**
   `gh search prs <scope-flags> --state=open --json number,title,repository,isDraft,url,headRefName,baseRefName,author`

3. **Announce:** Tell the user how many open PRs were found and list them (repo, PR number, title, author). When the set includes any author other than you (`gh api user --jq .login`), lead with a `Mixed authors: <handle> (N), …` line and keep the author on every row — reviewing your own PR and reviewing a teammate's are different acts, and the default scope here is "all authors in the current repo". Skip PRs already filtered out by `/sy-review-pr`'s own skip rules in the per-PR step — don't pre-filter here.

4. **Concurrent-migration cross-check (only when scope is multi-repo or covers a workspace bundle).** Run this BEFORE dispatching any review job — once the fan-out is in flight the jobs run concurrently and can't be handed shared context. Scan ALL open PRs in scope for ones that add a database migration file (same detection paths as `/sy-review-pr`'s Migration checks). If two or more PRs each add a migration: note the migration-conflict pairs upfront in the announcement, and pass the pairing to each affected job so it can flag its author symmetrically.

5. **Fan out to `/sy-review-pr <PR-URL>` for EVERY resolved PR at once — in parallel, as background jobs.** Do NOT walk the list sequentially. Launch one background job per PR in a single dispatch, **capped at 8 concurrent** (GitHub API rate limits); more than 8 → run in waves of 8. If one job fails, the others keep going — record it and move on. The per-PR skill owns the full behavior:
   - Skip drafts / WIP / DO NOT MERGE / already-reviewed-no-new-commits / blocked-by-other-reviewer.
   - Load repo rules and culture context (`CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` / `.cursorrules`).
   - Pre-flight author flags (diff-vs-description mismatch, merge conflict with base, failing CI with run-URL pinpoint, migration coordination) as PR comments.
   - De-dup against existing review threads and their reactions (human + bot + own past comments) — 👍 what's already covered, reply in-thread with the delta when a comment misses a case, new top-level comment only for genuinely new findings.
   - Read the diff (or just the new commits for stale-approval re-reviews).
   - Pick verdict — APPROVE / COMMENT (default bias) / REQUEST_CHANGES (show-stoppers only). Cap at COMMENT when another reviewer's `REQUEST_CHANGES` is open or CI is failing.
   - Post the review — or post nothing at all when a re-review turns up nothing new.

   Review is read-only — it works off `gh pr diff` / `gh api` and needs no checkout, so parallel jobs never collide. **If a review genuinely needs the code on disk** (building the branch, running a tool over the tree, reproducing a failure), that job checks out into a worktree at the canonical path — **`$HOME/.worktrees/<owner>/<repo>/pr-<number>`** (see One rigid worktree path) — reusing a linked worktree already on that branch if one exists, else creating it there, else `gh repo clone`-ing into that same path. Same path babysit uses, so the two commands share one worktree per PR instead of each making its own. Never `git checkout` / `git switch` / `gh pr checkout` in the user's primary checkout (see Never do PR-branch work in the primary checkout). Remove only worktrees the job created.

   Do NOT re-implement any of the per-PR logic here — if per-PR behavior needs to change, edit `/sy-review-pr`.

6. **Final report:** Summarize per PR — author (when the set is mixed), verdict (APPROVE / COMMENT / REQUEST_CHANGES / SKIPPED + reason), author flags posted, and any cross-PR migration coordination notes.

## Rules

- **This command is a dispatcher. The per-PR logic lives in `/sy-review-pr` — do not re-implement it here.**
- **Review all resolved PRs at once, in parallel background jobs — never a sequential for-loop** (see Fan out multi-PR work in parallel). Cap at 8 concurrent to stay under GitHub API rate limits; queue the rest. Collect verdicts as jobs finish and report once at the end.
- **Any job that needs the code on disk uses a worktree at the canonical path** — `$HOME/.worktrees/<owner>/<repo>/pr-<number>` (see One rigid worktree path) — never the user's primary checkout (see Never do PR-branch work in the primary checkout). Reviews are normally checkout-free; treat a checkout as the exception, not the default.
- **Show the author on every row when the set is mixed** (see Show PR authors). This command defaults to ALL authors in the current repo, so mixed sets are the norm, not the exception — the final report (Step 6) carries the author alongside each verdict too.
- **Honor `/sy-review-pr`'s skip rules** — never pre-filter drafts / WIP / already-reviewed PRs in this wrapper. Let the per-PR skill decide and report `SKIPPED + reason` so the audit trail is complete.
- **Default bias inherits from `/sy-review-pr`**: APPROVE or COMMENT — REQUEST_CHANGES is reserved for show-stoppers only.
- **Silent jobs are a success, not a failure.** A job that posts nothing because the re-review turned up nothing new reports `NO-OP` in the final summary. Don't retry it and don't nudge it into commenting to prove it ran.
- **Multi-repo workspaces** (e.g. a bundle like `myapp-frontend`, `myapp-backend` or `myapp-lib`): pass each repo as a `<owner>/<repo>` token. The cross-PR migration check (Step 4) runs across the full union **before** any job is dispatched, so coordination flags surface before any verdict is posted.
- **Always resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name (see Repo Identification).**
