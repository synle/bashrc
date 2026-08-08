[Sy] Review a single pull request. Repo-, language-, and framework-agnostic. The full review loop runs **at least 3 passes, 30 minutes apart** (same cadence as `/sy-babysit-pr`). Default bias is APPROVE or COMMENT — REQUEST_CHANGES is reserved for show-stoppers only.

**Scope.** Verdict pass only — produces a review (APPROVE / COMMENT / REQUEST_CHANGES) plus optional author-facing flags. Does NOT apply fixes, address comment threads with code changes, or sync the branch. For fix-and-green-CI work, use `/sy-babysit-pr` after the review verdict lands.

**Output surface — this command writes to GitHub.** Findings land on the PR itself: the verdict via `gh pr review`, pre-flight author flags via `gh pr comment`, line comments via the reviews API, 👍 reactions on already-covered comments, and threaded replies. There is **no report-only / dry-run mode**, and no sibling "critique" command to route findings to the user instead — that command does not exist; do not invent one. Step 11's final report is a _summary of what was posted_, never a substitute for posting it. The only path to posting no review body is Step 9's stop-early gate (a re-review with genuinely nothing new), and even then the Step 6 reactions still land on GitHub.

Argument: $ARGUMENTS (optional — a PR URL or PR number. If empty, use the current branch's PR. A slot driver holding several PRs may pass `pass=single` — see the Step 10 loop gate.)

## Steps

1. **Determine which PR to review:**
   - If `$ARGUMENTS` is provided (a PR URL like `https://github.com/<owner>/<repo>/pull/123` or a PR number), use that.
   - If `$ARGUMENTS` is empty, detect from the current working directory:
     - `git remote get-url origin` → resolve the authoritative `<owner>/<repo>` (see Repo Identification).
     - `git branch --show-current` → current branch.
     - `gh pr view --json number,title,url,headRefName,baseRefName` → find the PR for the current branch.
     - If no PR exists for the current branch, tell the user and stop.

2. **Announce:** Repo + PR number + title + URL + author.

3. **Scope skip checks.** Fetch state:
   `gh pr view <number> --repo <owner/repo> --json number,title,headRefName,isDraft,state,reviews,statusCheckRollup,mergeable,baseRefName,author,commits,body`

   **A skip ends the PASS, not the review.** Every skip below except `MERGED` / `CLOSED` is a snapshot judgement — a draft gets marked ready, a `WIP` prefix gets dropped, new commits land, another reviewer's block gets dismissed. Report the skip, take no action, then fall through to the **Step 10 loop gate** (sleep 30 min, re-enter at Step 3) instead of exiting the review. `state == "MERGED"` / `state == "CLOSED"` is the one terminal skip — the PR is gone, so stop entirely and skip the remaining passes.
   - **Skip if `isDraft == true`.** Report `"PR is a draft — skipping this pass"` and end the pass.
   - **Skip if title or `headRefName` contains `WIP` / `DRAFT` / `DO NOT MERGE`** (case-insensitive). Report and end the pass.
   - **Stop entirely if `state == "MERGED"` or `state == "CLOSED"`.** Nothing to review, and no later pass can change that — terminal.
   - **Skip if I already reviewed this PR and no new commits have landed since my last review.** Resolve "me" via `gh api user --jq .login`. Walk `reviews[]` for entries authored by me; take the latest `submittedAt`. Compare against the latest commit's `committedDate`. If the latest commit is at or before my last review timestamp, skip. Report `"Already reviewed at <ts>, no new commits since — skipping"`.
   - **Skip if another reviewer has an open `REQUEST_CHANGES` and no new commits have landed since their block.** Walk `reviews[]` for non-me logins with `state == "CHANGES_REQUESTED"`. If the latest such review is still standing (no later `APPROVED` from the same reviewer dismissing it, no new commits after their block) → SKIP. Report `"Blocked by <login> — skipping, won't pile on"`. One flag at a time; don't re-raise concerns they've already raised.
   - **Already-approved-by-me triage** (I previously approved this PR — route by current state):
     - **No new commits + green CI + `mergeable == "MERGEABLE"`** → SKIP. Report `"Approved + clean — skipping"`. Do NOT re-comment.
     - **No new commits + `mergeable == "CONFLICTING"`** → skip the review, but post the rebase flag from Step 5 (if not already posted). Report `"Approved + conflicting — flagged rebase"`.
     - **No new commits + failing CI** → skip the review, but post the CI-failure flag from Step 5 with the specific failing check name + link to the failed run. Report `"Approved + CI failing — flagged failure"`.
     - **New commits since my approval (stale approval)** → do NOT skip. Re-review the diff since my last reviewed commit (use `gh api repos/<owner>/<repo>/compare/<my-last-reviewed-sha>...<head-sha>` or `gh pr diff <number> --repo <owner/repo>` filtered to the new commits). Acceptable → re-approve. New concerns → downgrade to COMMENT. Never silently leave a stale approval standing.

4. **Load repo rules and culture context.** Before reviewing, check the repo for review/contribution conventions:
   - `gh api repos/<owner>/<repo>/contents/CLAUDE.md`
   - `gh api repos/<owner>/<repo>/contents/AGENTS.md`
   - `gh api repos/<owner>/<repo>/contents/CONTRIBUTING.md`
   - `gh api repos/<owner>/<repo>/contents/.cursorrules`

   Skip silently if a file is missing. Use what you find to inform what counts as a violation in this repo (architectural rules, naming conventions, required tests, etc.). Repo-specific guardrails override generic review heuristics.

5. **Pre-flight author flags (always leave as PR comments, never as the review verdict).** These are coordination signals to the author, NOT blockers. Post each via `gh pr comment <number> --repo <owner/repo> --body "..."`. Skip any flag already raised in an existing comment (see Step 6's de-dup rule).
   - **Diff doesn't match the PR title or description.** Read `body` + the diff (`gh pr diff <number> --repo <owner/repo>`). If the implemented changes diverge from what the title / description promises (extra scope, missing scope, different feature), comment: `"The diff appears to diverge from the PR title / description. Could you update the title or description so they match what landed?"`.
   - **Merge conflict with the base branch.** If `mergeable == "CONFLICTING"`, comment: `"This PR currently conflicts with `<baseRefName>` — please merge base in and resolve."`. If `mergeable == "UNKNOWN"`, re-fetch after 5s before flagging. Flag it and move on — **never sync or merge the branch yourself**; resolving it is `/sy-sync-pr-branch`'s job (and runs automatically inside `/sy-babysit-pr`). A review never pushes to the PR branch.
   - **Any CI check is failing.** Walk `statusCheckRollup[]` for entries with `conclusion == "FAILURE"` or `status == "FAILURE"`. For each failing check, capture: the check name, its run URL (`detailsUrl` / `targetUrl`), and a short failure reason. Pinpoint with `gh run view <run-id> --log-failed | tail -50` (or pull the failed job's step output from `gh api repos/<owner>/<repo>/actions/runs/<run-id>/jobs`). Comment: `"CI check(s) failing: <names>. <one-line reason per check>. See <run-url>. Please address before this can merge."`. **Verdict consequence:** failing CI caps the review at COMMENT — do NOT APPROVE while CI is red.
   - **Database migration checks** (if the diff touches migrations — see migration-path detection below). See the **Migration checks** section.

6. **Read every existing comment — including its reactions — then decide net-new vs. react vs. augment.** Before writing any review or PR comment:
   `gh api repos/<owner>/<repo>/pulls/<number>/comments`
   `gh api repos/<owner>/<repo>/issues/<number>/comments`
   `gh api repos/<owner>/<repo>/pulls/<number>/reviews`
   - Read the **body AND the reactions** of every comment. Reactions come back on each comment object (`reactions.+1`, `reactions.-1`, `reactions.total_count`); pull the per-user detail when the counts matter:
     `gh api repos/<owner>/<repo>/pulls/comments/<comment-id>/reactions`
     `gh api repos/<owner>/<repo>/issues/comments/<comment-id>/reactions`
   - Include comments from **every author** — other humans, AI bots (CodeRabbit, Copilot review, SonarCloud, etc.), AND your own prior reviews / comments on this PR (`gh api user --jq .login`). Match on substance, not exact wording.
   - Treat reactions as signal. A comment already carrying 👍 from the author or a maintainer is accepted — never restate it. A comment carrying 👎 was rejected — do not resurrect the same point without a concrete new reason, and say what the new reason is when you do.
   - **Route every finding through this decision, in order:**
     1. **Finding is fully covered by an existing comment** → post nothing. React 👍 on that comment instead:
        `gh api -X POST repos/<owner>/<repo>/pulls/comments/<comment-id>/reactions -f content='+1'` (review/line comments) or
        `gh api -X POST repos/<owner>/<repo>/issues/comments/<comment-id>/reactions -f content='+1'` (issue-level comments).
        Skip the call if you already reacted — reactions are idempotent server-side, but re-posting is noise in the audit trail.
     2. **Finding overlaps an existing comment but that comment misses a case** (different call site, an edge case, a second file with the same bug, a wrong-but-close fix suggestion) → do NOT open a new top-level thread. **Reply in that comment's thread** with only the delta — the missed case and why it matters. Lead with the fact you're extending, not restating: `"Adding to the above — same issue also hits <X> because <reason>."` React 👍 on the original in the same pass.
        Reply via `gh api -X POST repos/<owner>/<repo>/pulls/<number>/comments -f body='...' -F in_reply_to=<comment-id>` (line comments) or `gh pr comment` quoting the original for issue-level threads.
     3. **Finding is genuinely new** → post it as a normal new comment / line comment.
   - **If every finding lands in bucket 1, post no review body and no comments at all.** See the stop-early rule in Step 9.

7. **Read the diff and review.**
   - `gh pr diff <number> --repo <owner/repo>` → full diff.
   - For stale-approval cases (Step 3), restrict to the new commits since your last review.
   - **What to review:** correctness, safety, architectural issues, security holes, data-loss risks, broken core invariants, load-bearing test gaps.
   - **YAGNI / ponytail violations** — flag where the diff adds a new abstraction layer, a new runtime dependency, or a new class / module / wrapper without a concrete caller in the same diff, OR where stdlib / a native platform feature / an already-installed dep would have covered the use case. Code shipped "for the future" with no current consumer counts. This is structural overhead, not a style nit — name the cheaper alternative when flagging (stdlib X, existing dep Y, inline one-liner, drop the wrapper).

     **Output format — one line per finding:** `L<line>: <tag> <what>. <replacement>.` or `<file>:L<line>: ...` for multi-file diffs.

     Tags:
     - `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
     - `stdlib:` hand-rolled thing the standard library ships. Name the function.
     - `native:` dependency or code doing what the platform already does. Name the feature.
     - `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
     - `shrink:` same logic, fewer lines. Show the shorter form.

     **Scoring:** end ponytail section with `net: -<N> lines possible.` If nothing to cut, skip the section entirely.

   - **What NOT to review (skip):**
     - Nitpicks — style drift, naming preferences, formatting, doc wording (unless wrong/misleading).
     - Anything another reviewer already covered (Step 6 de-dup).
     - Speculative refactors / "you could also..." suggestions that aren't load-bearing.
     - Bot-style "consider extracting this" / "consider adding a comment" suggestions.
     - YAGNI-style "you didn't need this" complaints when the new code has a concrete caller in the same diff — even one caller clears the ponytail ladder.

8. **Pick the review verdict.** Apply the bias strictly: APPROVE or COMMENT is the default; REQUEST_CHANGES is a hard block reserved for show-stoppers.
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
   - **Verdict caps (cannot APPROVE while any of these hold — max verdict is COMMENT):**
     - Another reviewer has an open `REQUEST_CHANGES` that has not been resolved (dismissed by the same reviewer with a later APPROVED, or newer commits land that address their block). Until they clear it, do NOT approve over their block — leave a COMMENT-level review noting we're holding for their resolution.
     - Any CI check is currently failing (`statusCheckRollup[]` entries with `conclusion == "FAILURE"` / `status == "FAILURE"`). The pre-flight CI flag goes out in Step 5; the verdict here drops to COMMENT until the author fixes CI.

9. **Post the review — or post nothing.**
   - **Stop-early gate (re-reviews).** If this is not your first review on this PR and Step 6 produced no bucket-2 and no bucket-3 findings, **post nothing**: no review verdict, no comment, no "still looks good", no re-approval. The 👍 reactions from Step 6 are the entire output. Report `"Re-review: nothing new — no comment posted"` to the user and **end the pass** (fall through to the Step 10 loop gate). Exception: a verdict cap flipped since your last review (a previously-approved PR now has failing CI or an open `REQUEST_CHANGES` from someone else) — post the Step 5 flag for exactly that change and nothing else.
   - Otherwise, single call:
     `gh pr review <number> --repo <owner/repo> {--approve | --comment | --request-changes} --body "<summary>"`
   - The body summarizes your overall take in 1–3 sentences. Per-line concerns go in line comments (use `gh api repos/<owner>/<repo>/pulls/<number>/reviews` with a `comments[]` array, or `gh pr review --body-file` for multi-comment reviews).
   - For stale-approval re-reviews: explicitly note that this is a re-review of new commits since `<sha>`.

10. **Loop gate — run the FULL review at least 3 times, 30 minutes apart.** One pass only ever sees the PR as it was at that instant; authors push, bots post, CI reruns, and other reviewers rule asynchronously. Three spaced passes let all of that land in batches instead of you re-reading the same diff on every incremental delta. Same cadence as `/sy-babysit-pr` Step 12 — when the user says "review this", they get 3 rounds, not one.
    - Track `loop_count` (starts at 1 on the first pass). When a pass finishes for ANY reason — verdict posted, nothing new so nothing posted, draft / WIP skip, blocked-by-another-reviewer skip, approved-and-clean skip — that ends the **pass**, not the review.
    - If `loop_count < 3`: report `"pass <N>/3 done — sleeping 30 minutes before pass <N+1>"`, **sleep 30 minutes**, then go back to **Step 3** and run the whole flow again (skip checks → repo rules → author flags → existing-comment de-dup → diff → verdict → post). Re-read the comments and reactions every pass — Step 6's de-dup is what keeps a second and third pass from restating the first.
    - After pass 3, stop and report. More passes are fine if the user asked for them; 3 is the floor, not the cap.
    - **Terminate early (skip the remaining passes) ONLY on:** `state == "MERGED"` or `state == "CLOSED"` (Step 3 terminal skip), or a stop-and-ask where the review needs human judgment before it can be posted. Everything else loops.
    - **A later pass is a re-review, so Step 9's stop-early gate governs it.** Passes 2 and 3 post nothing unless something genuinely changed since the pass before — new commits, a new comment worth a delta reply, or a flipped verdict cap. A three-pass review that posts once and then goes quiet twice is the expected shape, not a failure.
    - **`pass=single` — the one way to run fewer than 3 passes.** When the invocation carries `pass=single`, run exactly one pass, report it, and return without sleeping and without re-entering Step 3. This exists so a **slot driver** holding several PRs (`/sy-review-prs` Step 5) can own the cadence itself: it calls each of its PRs once per round, then sleeps 30 minutes once for the whole slot, so every PR it holds still gets ≥3 spaced passes. The 3-pass floor is not waived — it moves up to the caller, which is responsible for honoring it. An agent never adds `pass=single` on its own initiative: a human asking "review this PR" gets 3 rounds. If a human types it explicitly, honor it.

      **Argument grammar.** Trailing `key=value` tokens are parameters, the bare token is the PR ref. Slot mode uses two: `pass=single` and `round=<n>/<total>`, both single whitespace-free tokens. **`pass=single` with no `round=` means `round=1/1`**, which is what a human typing it by hand wants and keeps `completed_round` well-defined. Unrecognized `key=value` tokens are reported and ignored, never treated as a PR ref.

      **State handoff — the caller is the memory.** A fresh invocation remembers nothing, so `loop_count` and the record of what this review already posted would reset every round — and a reset de-dup ledger is exactly how pass 2 restates pass 1, which Step 9 exists to prevent. So `pass=single` ends its report with a `## State` block (`completed_round`, what was posted and where, the current verdict, whether a stop-and-ask is outstanding). **The block travels inside the job's prompt under a `## Prior state` heading, never as a `state=` argument token** — it is multi-line, so no whitespace-split argument grammar can carry it, and encoding it into one token would invent a quoting scheme for no benefit. No prior-state block present means round 1; say so rather than guessing. Step 6's on-PR de-dup is the durable backstop when the slot dies and the block is lost: the comments are still on the PR, so re-reading them recovers the ledger.

      **A skip under `pass=single` is not terminal.** It ends that round only, and the slot calls this PR again next round — the draft may be marked ready, the `WIP` prefix dropped, the blocking reviewer's request dismissed. Return the skip reason in the state block so the slot reports it as `WAITING_AFTER_SKIP`, not `SKIPPED`. Only `MERGED` / `CLOSED` is terminal and tells the slot to stop calling this PR at all.

11. **Final report:** Verdict + passes run (`<N>/3`) + key points raised + reactions left (👍 count and on whose comments) + threads you replied to + any author-flags posted as PR comments + skip reason (if any, per pass). When nothing was posted, say so explicitly.

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

1. `gh search prs --repo <owner/repo> --state=open --limit 1000 --json number,title,url` to list other open PRs (**`gh search prs` has no `headRefName`** — fetch branch names with a per-PR `gh pr view` when a comparison needs them).
2. For each other PR, list changed files: `gh pr diff <other-number> --repo <owner/repo> --name-only` (or `gh api repos/<owner>/<repo>/pulls/<other-number>/files --jq '.[].filename'`).
3. If any other open PR adds a new migration file (same detection paths as above): leave a comment on the CURRENT PR — `"In-flight migration conflict: PR <other-url> also adds a migration. Whichever PR merges second will need to re-parent its migration (re-stamp down_revision for Alembic, bump timestamp for Rails/Knex/golang-migrate/Flyway, renumber for Prisma/Liquibase/TypeORM). Coordinate merge order with that PR's author. Avoid adding merge migrations unless re-parenting is genuinely unsafe."`. Also leave the symmetric comment on the OTHER PR, addressed to that author.

## Rules

- **This command writes to GitHub — there is no report-only mode.** Verdicts, author flags, line comments, threaded replies, and 👍 reactions all land on the PR (see Output surface). Never quietly downgrade a run to "summarize back to the user instead of posting", never ask the user to choose between posting and reporting, and never reach for a sibling `/sy-critique-*` command — no such command exists. Step 9's stop-early gate is the only sanctioned way to post no review body, and it still leaves reactions on the PR. If a genuinely report-only review surface is ever wanted, that is a new command in `LLM_COMMAND_DEPLOY_MAP`, not a flag bolted onto this one.
- **Default bias: APPROVE or COMMENT.** REQUEST_CHANGES is a hard block reserved for show-stoppers — security holes, data loss, broken core invariants, production-breaking regressions. Anything less (open questions, missing tests, partial fixes, style drift) → COMMENT instead.
- **Minimum 3 full passes, 30 minutes apart (Step 10).** A single pass is never "done" — it is one snapshot of a PR that authors, bots, CI, and other reviewers are all still changing. Sleep 30 minutes between passes so that activity settles into batches instead of triggering a comment per incremental delta. `/sy-review-pr` and `/sy-babysit-pr` share this cadence deliberately: asking for either gets 3 rounds, 30 minutes apart. The only terminal early exits are `MERGED` / `CLOSED` and a stop-and-ask needing human judgment. The floor is waived only by `pass=single` (Step 10), which does not shorten it but **moves it to the caller**: a slot driver holding several PRs runs the 3 spaced rounds itself.
- **Skip drafts, WIP titles, DO NOT MERGE titles, and PRs you already reviewed with no new commits since — but a skip ends the PASS, not the review.** Report it, take no action, and fall through to the Step 10 loop gate; a later pass catches the un-drafted, un-WIP'd, or newly-pushed version. Only `MERGED` / `CLOSED` stops the whole review. Stale-approval PRs (new commits after your prior approve) are NOT skipped — re-review the new diff and either re-approve or downgrade to COMMENT.
- **Skip PRs already blocked by another reviewer's open `REQUEST_CHANGES` when there are no new commits since their block.** One flag at a time — don't pile on. Don't re-raise concerns they've already raised.
- **Already-approved-by-me + clean (green CI, no conflict, no new commits) → SKIP.** Don't re-comment to say "still good". For approved + conflict, post the rebase flag; for approved + CI failure, post the CI-failure flag with the specific failing check + link to the failed run. See Step 3 triage.
- **Cannot APPROVE while another reviewer's `REQUEST_CHANGES` is open or while CI is failing.** Max verdict in those states is COMMENT. The author-flag goes out as a PR comment; the review verdict separately drops to COMMENT.
- **Load repo rules before reviewing.** Check `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` / `.cursorrules` (Step 4). Repo-specific guardrails (architectural rules, naming) override generic review heuristics.
- **Every comment you post must be net new. Duplicates get a 👍, near-misses get a threaded reply.** Read every existing review thread and issue comment (human AND bot — CodeRabbit, Copilot, SonarCloud, etc.) **and their reactions** before posting. Match on substance, not wording. Already fully covered → react `+1` on the original, post nothing. Covered but missing a case → reply in that thread with only the delta, plus a 👍 on the original. Only a genuinely new point earns a new top-level comment. A 👎 on an existing comment means that point was rejected — don't resurrect it without a concrete new reason, stated out loud.
- **Re-review with nothing new posts nothing.** No verdict, no "still looks good", no re-approval, no restated summary. Reactions are the whole output; report the no-op to the user instead of the PR. Only exception: a verdict cap flipped since last time (CI went red, another reviewer blocked) — post that one flag and nothing else. Comment volume is a cost paid by every human who opens the PR.
- **Stay consistent across follow-up reviews — no flip-flopping.** Your prior reviews on this PR are the baseline. Before posting a new review or comment:
  1. **Read every comment and review you previously authored on this PR** (filter `gh api repos/<owner>/<repo>/pulls/<number>/comments` and `.../issues/<number>/comments` and `gh pr view --json reviews` by your own login).
  2. **Honor every prior recommendation.** If you previously suggested "go with Option 1 (approach A) over Option 2 (approach B)" and the author followed Option 1, do NOT now ask them to switch to Option 2. If you raised concern X in an earlier review and the author addressed it, do NOT raise a contradictory concern Y on the same code.
  3. **Only revise a prior position when you have a concrete new reason** — new information has surfaced (e.g. a related PR landed, a security advisory dropped, the author asked you to reconsider). When you do reverse, **explicitly call it out** in the new comment: `"Updating my earlier suggestion (#<comment-id>) — <new reason>"`. Never silently contradict yourself.
  4. **If your prior comment was vague or ambiguous and the author picked one reasonable interpretation, accept it.** Don't relitigate just because a different reading was possible.
  5. Same rule applies to verdict flips. If you APPROVED earlier and the new commits are still acceptable, re-APPROVE. Don't downgrade to COMMENT unless the new commits introduce genuinely new concerns (and call out which ones).
- **No nitpicks.** Correctness, safety, and architecture only. Style / naming / formatting / doc wording is not your job unless it's actually wrong.
- **YAGNI / ponytail violations are COMMENT-level, not REQUEST_CHANGES.** Flag the new abstraction / dep / class / wrapper with a concrete cheaper alternative (stdlib X, platform feature Y, already-installed dep Z, inline one-liner). Escalate only when the violation also carries real risk — unaudited third-party dep, supply-chain / license issue, abstraction that quietly bypasses a validation or trust boundary. And NEVER weaponize YAGNI against trust-boundary validation, data-loss handling, security controls, accessibility. If the PR removed validation, error handling, security checks, or a11y hooks claiming they're "not needed", that's show-stopper territory — REQUEST_CHANGES, not approve-with-a-ponytail-nod.
- **Pre-flight author flags are PR comments, not review verdicts.** Diff-vs-description mismatch, merge conflicts with base, failing CI checks, and migration coordination issues → leave a comment addressed to the author. Do NOT use REQUEST_CHANGES for these.
- **Migration coordination is proactive.** When you see two open PRs both adding migrations, comment on BOTH PRs (symmetric flag) so each author knows about the merge-order risk before either lands.
- **Always resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name (see Repo Identification).**
