[Sy] Review a single pull request. Repo-, language-, and framework-agnostic. Default bias is APPROVE or COMMENT — REQUEST_CHANGES is reserved for show-stoppers only.

Argument: $ARGUMENTS (optional — a PR URL or PR number. If empty, use the current branch's PR.)

## Steps

1. **Determine which PR to review:**
   - If `$ARGUMENTS` is provided (a PR URL like `https://github.com/<owner>/<repo>/pull/123` or a PR number), use that.
   - If `$ARGUMENTS` is empty, detect from the current working directory:
     - `git remote get-url origin` → resolve the authoritative `<owner>/<repo>` (per global rule 46, never derive from the folder name).
     - `git branch --show-current` → current branch.
     - `gh pr view --json number,title,url,headRefName,baseRefName` → find the PR for the current branch.
     - If no PR exists for the current branch, tell the user and stop.

2. **Announce:** Repo + PR number + title + URL + author.

3. **Step 0 — Scope skip checks.** Fetch state:
   `gh pr view <number> --repo <owner/repo> --json number,title,headRefName,isDraft,state,reviews,statusCheckRollup,mergeable,baseRefName,author,commits,body`
   - **Skip if `isDraft == true`.** Report `"PR is a draft — skipping"` and stop.
   - **Skip if title or `headRefName` contains `WIP` / `DRAFT` / `DO NOT MERGE`** (case-insensitive). Report and stop.
   - **Skip if `state == "MERGED"` or `state == "CLOSED"`.** Nothing to review.
   - **Skip if I already reviewed this PR and no new commits have landed since my last review.** Resolve "me" via `gh api user --jq .login`. Walk `reviews[]` for entries authored by me; take the latest `submittedAt`. Compare against the latest commit's `committedDate`. If the latest commit is at or before my last review timestamp, skip. Report `"Already reviewed at <ts>, no new commits since — skipping"`.
   - **Stale approval — I previously approved but new commits landed:** do NOT skip. Re-review the diff since my last reviewed commit (use `gh api repos/<owner>/<repo>/compare/<my-last-reviewed-sha>...<head-sha>` or `gh pr diff <number> --repo <owner/repo>` filtered to the new commits). If the new changes are still acceptable → re-approve. If they introduce new concerns → switch to COMMENT instead. Never silently leave a stale approval standing.

4. **Step 1 — Pre-flight author flags (always leave as PR comments, never as the review verdict).** These are coordination signals to the author, NOT blockers. Post each via `gh pr comment <number> --repo <owner/repo> --body "..."`. Skip any flag already raised in an existing comment (see Step 2's de-dup rule).
   - **Diff doesn't match the PR title or description.** Read `body` + the diff (`gh pr diff <number> --repo <owner/repo>`). If the implemented changes diverge from what the title / description promises (extra scope, missing scope, different feature), comment: `"The diff appears to diverge from the PR title / description. Could you update the title or description so they match what landed?"`.
   - **Merge conflict with the base branch.** If `mergeable == "CONFLICTING"`, comment: `"This PR currently conflicts with `<baseRefName>` — please merge base in and resolve."`. If `mergeable == "UNKNOWN"`, re-fetch after 5s before flagging.
   - **Any CI check is failing.** Walk `statusCheckRollup[]` for entries with `conclusion == "FAILURE"` or `status == "FAILURE"`. Comment with the failing check names: `"CI check(s) failing: <names>. Please address before this can merge."`.
   - **Database migration checks** (if the diff touches migrations — see migration-path detection below). See the **Migration checks** section.

5. **Step 2 — Read existing comments to avoid duplicates.** Before writing any review or PR comment:
   `gh api repos/<owner>/<repo>/pulls/<number>/comments`
   `gh api repos/<owner>/<repo>/issues/<number>/comments`
   - Build a set of points already raised (by ANY reviewer — human OR AI bots like CodeRabbit, Copilot review, SonarCloud, etc.). Match on substance, not exact wording. If a point is already covered, do NOT restate it — even partially.

6. **Step 3 — Read the diff and review.**
   - `gh pr diff <number> --repo <owner/repo>` → full diff.
   - For stale-approval cases (step 0), restrict to the new commits since your last review.
   - **What to review:** correctness, safety, architectural issues, security holes, data-loss risks, broken core invariants, load-bearing test gaps.
   - **What NOT to review (skip):**
     - Nitpicks — style drift, naming preferences, formatting, doc wording (unless wrong/misleading).
     - Anything another reviewer already covered (step 2 de-dup).
     - Speculative refactors / "you could also..." suggestions that aren't load-bearing.
     - Bot-style "consider extracting this" / "consider adding a comment" suggestions.

7. **Step 4 — Pick the review verdict.** Apply the bias strictly: APPROVE or COMMENT is the default; REQUEST_CHANGES is a hard block reserved for show-stoppers.
   - **REQUEST_CHANGES** — only when the code is **critically wrong**. Specifically:
     - Security hole (auth bypass, injection, credential leak, privilege escalation, secrets in code).
     - Data-loss risk (destructive query without safeguards, irreversible migration without rollback, lost-write race).
     - Broken core invariant (function contract violated, type-system bypass that breaks callers, removed validation on a trust boundary).
     - Production-breaking regression with no test.
   - **COMMENT** — for everything between approve and request-changes:
     - Open questions about intent.
     - Missing test coverage on a non-critical path.
     - Style drift that's worth noting but not blocking.
     - Partial-fix concerns ("this addresses the symptom but the root cause is X").
     - Anything you'd want the author to see but wouldn't hold the PR over.
   - **APPROVE** — code is correct, safe, and acceptable. Default to this when the diff is fine.

8. **Step 5 — Post the review.** Single call:
   `gh pr review <number> --repo <owner/repo> {--approve | --comment | --request-changes} --body "<summary>"`
   - The body summarizes your overall take in 1–3 sentences. Per-line concerns go in line comments (use `gh api repos/<owner>/<repo>/pulls/<number>/reviews` with a `comments[]` array, or `gh pr review --body-file` for multi-comment reviews).
   - For stale-approval re-reviews: explicitly note that this is a re-review of new commits since `<sha>`.

9. **Final report:** Verdict + key points raised + any author-flags posted as PR comments + skip reason (if any).

## Migration checks

Run these only when the diff includes new database migration files. Detect by path:

- **Alembic** (Python / SQLAlchemy): `alembic/versions/*.py`, `*/alembic/versions/*.py`, `migrations/versions/*.py`.
- **Django**: `*/migrations/[0-9]*_*.py` (skip `__init__.py`).
- **Rails / ActiveRecord**: `db/migrate/[0-9]*_*.rb`.
- **Knex** (Node): `migrations/[0-9]*_*.{js,ts}`, `knex/migrations/`.
- **golang-migrate / sql-migrate**: `migrations/[0-9]*_*.{up,down}.sql`.
- **Prisma**: `prisma/migrations/*/migration.sql`.
- **Liquibase**: `db/changelog/*.{xml,yaml,json,sql}`.
- **Flyway**: `db/migration/V*__*.sql`, `*/flyway/*`.
- **TypeORM**: `*/migration/[0-9]*-*.{ts,js}`.
- **Generic SQL migration folders**: any `migrations/` or `schema/` folder containing newly-added `.sql` files with timestamp- or sequence-prefixed names.

**Check 1 — Stale-head detection.** Verify the new migration is stacked on the **current** head of the default branch, not on a head that has since been superseded.

- **Alembic:** the new migration's `down_revision` must equal the head on the latest default branch.
  - Fetch the default branch's head: `gh api repos/<owner>/<repo>/contents/<alembic-versions-path>?ref=<default-branch>` to list current migrations, or check out the repo and run `alembic heads` against the default branch state.
  - Read the new migration's `down_revision = "..."` from the PR diff.
  - If they don't match: flag the author — `"This migration's `down_revision`points to`<X>`but the current Alembic head on`<default-branch>`is`<Y>`. The PR was branched before a newer migration landed and needs to be rebased on the latest base (and the `down_revision` updated)."`.
- **Django / Rails / Knex / golang-migrate / Prisma / Flyway / Liquibase / TypeORM:** apply the equivalent framework-specific check (Django: `dependencies`; Rails / Knex / golang-migrate / Flyway: timestamp ordering — new file's timestamp must be after every migration currently on default; Prisma: presence in `migration_lock.toml` and folder ordering; TypeORM: timestamp prefix). When in doubt, fall back to **"is there any migration on default that isn't in this PR's history?"** — if yes, flag a rebase.

**Check 2 — Concurrent in-flight migrations across other open PRs.** Two open PRs each adding a migration will collide whichever lands second.

1. `gh search prs --repo <owner/repo> --state=open --json number,title,url,headRefName` to list other open PRs.
2. For each other PR, list changed files: `gh pr diff <other-number> --repo <owner/repo> --name-only` (or `gh api repos/<owner>/<repo>/pulls/<other-number>/files --jq '.[].filename'`).
3. If any other open PR adds a new migration file (same detection paths as above): leave a comment on the CURRENT PR — `"In-flight migration conflict: PR <other-url> also adds a migration. Whichever PR merges second will need to either rebase its `down_revision` (Alembic), bump its timestamp (Rails/Knex/golang-migrate), or add a merge migration. Coordinate merge order with that PR's author."`. Also leave the symmetric comment on the OTHER PR, addressed to that author.

## Rules

- **Default bias: APPROVE or COMMENT.** REQUEST_CHANGES is a hard block reserved for show-stoppers — security holes, data loss, broken core invariants, production-breaking regressions. Anything less (open questions, missing tests, partial fixes, style drift) → COMMENT instead.
- **Skip drafts, WIP titles, DO NOT MERGE titles, and PRs you already reviewed with no new commits since.** Stale-approval PRs (new commits after your prior approve) are NOT skipped — re-review the new diff and either re-approve or downgrade to COMMENT.
- **No duplicate comments.** Read every existing review thread and issue comment (human AND bot — CodeRabbit, Copilot, SonarCloud, Coderabbitai, etc.) before posting. Match on substance, not wording.
- **Stay consistent across follow-up reviews — no flip-flopping.** Your prior reviews on this PR are the baseline. Before posting a new review or comment:
  1. **Read every comment and review you previously authored on this PR** (filter `gh api repos/<owner>/<repo>/pulls/<number>/comments` and `.../issues/<number>/comments` and `gh pr view --json reviews` by your own login).
  2. **Honor every prior recommendation.** If you previously suggested "go with Option 1 (approach A) over Option 2 (approach B)" and the author followed Option 1, do NOT now ask them to switch to Option 2. If you raised concern X in an earlier review and the author addressed it, do NOT raise a contradictory concern Y on the same code.
  3. **Only revise a prior position when you have a concrete new reason** — new information has surfaced (e.g. a related PR landed, a security advisory dropped, the author asked you to reconsider). When you do reverse, **explicitly call it out** in the new comment: `"Updating my earlier suggestion (#<comment-id>) — <new reason>"`. Never silently contradict yourself.
  4. **If your prior comment was vague or ambiguous and the author picked one reasonable interpretation, accept it.** Don't relitigate just because a different reading was possible.
  5. Same rule applies to verdict flips. If you APPROVED earlier and the new commits are still acceptable, re-APPROVE. Don't downgrade to COMMENT unless the new commits introduce genuinely new concerns (and call out which ones).
- **No nitpicks.** Correctness, safety, and architecture only. Style / naming / formatting / doc wording is not your job unless it's actually wrong.
- **Pre-flight author flags are PR comments, not review verdicts.** Diff-vs-description mismatch, merge conflicts with base, failing CI checks, and migration coordination issues → leave a comment addressed to the author. Do NOT use REQUEST_CHANGES for these.
- **Migration coordination is proactive.** When you see two open PRs both adding migrations, comment on BOTH PRs (symmetric flag) so each author knows about the merge-order risk before either lands.
- **Always resolve the repo via `git remote get-url origin`** (global rule 46) — never derive `<owner>/<repo>` from the folder name.
