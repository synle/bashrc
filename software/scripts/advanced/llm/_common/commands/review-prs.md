[Sy] Run `/sy-review-pr` on EVERY open PR in scope. Fan-out wrapper — finds matching open PRs and dispatches them **all at once, in parallel background jobs**, delegating the full per-PR review (skip checks, author flags, diff review, verdict, post) to `/sy-review-pr`. Each job runs **at least 3 passes, 30 minutes apart**. Repo-, language-, and framework-agnostic.

**Recommended order.** Run `/sy-review-prs` first (verdict pass — no code changes), then `/sy-babysit-prs` (apply fixes, drive CI green). Reversing wastes babysit cycles on PRs that would otherwise be requested-changes and rewritten. Both commands now run the same 3-pass / 30-minute cadence, so both are hour-plus fan-outs by design.

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

4a. **Open the ping-pong pulse — emit the FIRST one before dispatching anything.** Render `/sy-list-prs pingpong <same-scope-token>` with every Agent cell at `⚪ NOT STARTED`. Reviews post no code, but they still run 3 passes 30 minutes apart and still fan out in waves, so the same rule holds: never let the user stare at a silent terminal wondering whether anything is running. Layout lives in `/sy-list-prs` — do not hand-roll it.

Start the **agent ledger** here: one row per resolved PR holding job state, loop number, **dispatch wave number**, first dispatch time, last pass start / end, next pass ETA, and the **last rendered pulse snapshot** (Status color emoji, component lines, counters strip) that `/sy-list-prs pingpong` diffs to pick its change marker and `Δ` line — overwrite it after every pulse. Record the wave number for every PR at dispatch, queued ones included; the pulse groups its board by feature set and prints `🌊 wave <N>` on every row. Record every timestamp the moment it happens (dispatch, pass start, pass end, next-pass ETA); the pulse's `started 17:12 · running 6m` clock is read from them and cannot be reconstructed later. `/sy-review-pr` runs ≥3 passes (its Step 10 loop gate), so Agent cells carry the `(loop N/3)` counter — `🔄 IN PROGRESS`, `⏸️ WAITING`, `✅ COMPLETED`, `⏭️ SKIPPED`, `❌ FAILED`.

5. **Fan out to `/sy-review-pr <PR-URL>` for EVERY resolved PR at once — in parallel, as background jobs.** Do NOT walk the list sequentially. Launch one background job per PR in a single dispatch, **capped at 8 per wave** (GitHub API rate limits); more than 8 → run in waves of 8, each wave launched **10 minutes after the previous one (one pulse apart), not when a slot frees**. These jobs sleep 30 minutes between passes, so slot-based queueing would hold the tail PRs for hours while buying no rate-limit headroom. If one job fails, the others keep going — record it and move on.

   **Dispatch mechanics — this is the step agents get wrong.** "In parallel" is a hard requirement, not a hint:
   - **Emit every job in ONE assistant message with N tool calls in that same message.** One sub-agent / Task / background-shell invocation per PR, all in a single block. A second message per PR is a sequential loop wearing a parallel costume — that is the failure mode this section exists to prevent.
   - **Never** `for pr in ...; do ...; done`, never "start job 1, wait, start job 2", never a single job that iterates the PR list internally.
   - **One job = one PR = one independent context.** Jobs share nothing: no cwd, no state file, no conversation. A job must never read another job's result or wait on it.
   - **Each job's prompt is self-contained.** Pass, explicitly: the full PR URL, the resolved `<owner>/<repo>` (from `git remote get-url origin`, never the folder name), the PR number, any migration-conflict pairing from Step 4, and the instruction to run the complete `/sy-review-pr` flow — **all 3 passes** — and report back its Step 11 final report. Sub-agents start with a fresh context — anything you don't pass, they don't have.
   - **Waves.** More than 8 PRs → run in waves of 8. A wave is still one message with 8 tool calls; only the _next_ wave waits.
   - **Report the fan-out the moment it's launched** — list every PR with its job — so the user can see N jobs running, not one job N times.

   The per-PR skill owns the full behavior:
   - Skip drafts / WIP / DO NOT MERGE / already-reviewed-no-new-commits / blocked-by-other-reviewer.
   - Load repo rules and culture context (`CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` / `.cursorrules`).
   - Pre-flight author flags (diff-vs-description mismatch, merge conflict with base, failing CI with run-URL pinpoint, migration coordination) as PR comments.
   - De-dup against existing review threads and their reactions (human + bot + own past comments) — 👍 what's already covered, reply in-thread with the delta when a comment misses a case, new top-level comment only for genuinely new findings.
   - Read the diff (or just the new commits for stale-approval re-reviews).
   - Pick verdict — APPROVE / COMMENT (default bias) / REQUEST_CHANGES (show-stoppers only). Cap at COMMENT when another reviewer's `REQUEST_CHANGES` is open or CI is failing.
   - Post the review — or post nothing at all when a re-review turns up nothing new.
   - Loop the whole flow ≥3 times, 30 minutes apart (`/sy-review-pr` Step 10), terminating early only on `MERGED` / `CLOSED` or a stop-and-ask.

   **Expect long runtimes.** Each job does at least 3 passes 30 minutes apart, so a wave takes 1h+ by design. That is the point — do not shorten it, do not collapse a job to a single pass, and do not poll the jobs in a busy loop. Collect each result when its job reports back.

   Review is read-only — it works off `gh pr diff` / `gh api` and needs no checkout, so parallel jobs never collide. **If a review genuinely needs the code on disk** (building the branch, running a tool over the tree, reproducing a failure), that job checks out into a worktree at the canonical path — **`$HOME/.worktrees/<owner>/<repo>/<repo>__pr-<number>`** (see One rigid worktree path) — with `WT="$(git create-worktree "$BR" <number>)"`, which reuses a linked worktree already on that branch when one exists and creates it there otherwise; only when cwd is not the target repo does it `gh repo clone` into that same leaf. Same path babysit uses, so the two commands share one worktree per PR instead of each making its own. Never `git checkout` / `git switch` / `gh pr checkout` in the user's primary checkout (see Never do PR-branch work in the primary checkout). The worktree persists across all 3 passes; remove only worktrees the job created.

   Do NOT re-implement any of the per-PR logic here — if per-PR behavior needs to change, edit `/sy-review-pr`.

5a. **Ping-pong every 10 minutes until every job reports.** The fan-out runs an hour-plus by design (≥3 passes, 30 min apart), so the dispatcher's job while it waits is to keep a pulse on the wall — not to sit silent, and not to busy-poll the jobs.

- **Cadence: one pulse every 10 minutes**, from dispatch until the last verdict lands. Three pulses per review pass, so a sleeping job still shows a live heartbeat with its next-loop ETA. A wave of 8 reviews plus a queued second wave routinely outlives many pulses — keep pulsing until the board is fully terminal.
- **Render with `/sy-list-prs pingpong <same-scope-token>`, passing the current agent ledger.** Same scope token as Step 4a so every pulse covers exactly the dispatched set.
- **Refresh the Status column from GitHub, not from the jobs.** Re-run the cheap `gh pr view` status calls `/sy-list-prs` already uses. **Never message or interrupt a running job to ask its progress** — that wakes a sleeping pass and corrupts its 30-minute cadence. Read job state only from verdicts already reported. Queued PRs waiting on the next wave stay `⚪ NOT STARTED — queued, wave <N>`, and keep their wave number on the PR cell's group line so they still read inside their feature set rather than in a queue bucket.
- **Update the ledger from reports as they land** — a job finishing pass N moves that row to `⏸️ WAITING (loop N/3)` with `next loop <ETA>`; a job's final report moves it to `✅ COMPLETED` / `⏭️ SKIPPED` / `❌ FAILED`. Between reports, derive `IN PROGRESS` vs `WAITING` and the next-loop ETA from the known cadence (pass end + 30 min) rather than leaving the cell blank.
- **A pulse is display-only.** It never dispatches, retries, posts a review, or changes a verdict.
- Stop pulsing when every row is terminal (`✅ COMPLETED` / `⏭️ SKIPPED` / `❌ FAILED`), then go to Step 6.

6. **Final report:** emit the **closing ping-pong** — one last `/sy-list-prs pingpong <same-scope-token>` with the final ledger and `Next ping-pong: — (final)` — then summarize per PR: author (when the set is mixed), passes run (`<N>/3`), verdict (APPROVE / COMMENT / REQUEST_CHANGES / SKIPPED + reason), author flags posted, and any cross-PR migration coordination notes. The run therefore always brackets itself: pulse at the start (Step 4a), pulse every 10 min (Step 5a), pulse at the end.

## Rules

- **This command is a dispatcher. The per-PR logic lives in `/sy-review-pr` — do not re-implement it here.**
- **Every job writes to GitHub — there is no report-only mode** (see `/sy-review-pr` Output surface). Verdicts, author flags, line comments, threaded replies, and 👍 reactions land on the PRs themselves; the Step 6 summary reports what was posted, it does not replace posting. Never stop to ask the user whether to post or report, and never route findings to a `/sy-critique-*` command — no such command exists.
- **Parallel means one message, N tool calls (Step 5 Dispatch mechanics).** If the transcript shows jobs starting one message at a time, the fan-out was sequential and must be relaunched.
- **Review all resolved PRs at once, in parallel background jobs — never a sequential for-loop** (see Fan out multi-PR work in parallel). Cap at 8 per wave to stay under GitHub API rate limits, and stagger each later wave 10 minutes behind the last rather than waiting for a slot to free — these jobs are sleep-dominated, so slot-based queueing delays the tail PRs by hours for no rate-limit gain. Collect verdicts as jobs finish and report once at the end.
- **Any job that needs the code on disk uses a worktree at the canonical path** — `$HOME/.worktrees/<owner>/<repo>/<repo>__pr-<number>`, always via `git create-worktree` (see One rigid worktree path) — never the user's primary checkout (see Never do PR-branch work in the primary checkout). Reviews are normally checkout-free; treat a checkout as the exception, not the default.
- **Show the author on every row when the set is mixed** (see Show PR authors). This command defaults to ALL authors in the current repo, so mixed sets are the norm, not the exception — the final report (Step 6) carries the author alongside each verdict too.
- **Honor `/sy-review-pr`'s skip rules** — never pre-filter drafts / WIP / already-reviewed PRs in this wrapper. Let the per-PR skill decide and report `SKIPPED + reason` so the audit trail is complete. A per-pass skip is not terminal there — a job that skips pass 1 on a draft still runs passes 2 and 3. **The announced count is the dispatched count**: 10 in-scope PRs of which 5 are drafts is 10 jobs, not 5. A draft that gets marked ready between passes is exactly what the later passes exist to catch.
- **Each job runs ≥3 passes, 30 minutes apart** (`/sy-review-pr` Step 10). Never instruct a job to do "just one pass", never treat the first verdict as the job's final report, and never cancel a job because it went quiet — between passes it is asleep by design.
- **Default bias inherits from `/sy-review-pr`**: APPROVE or COMMENT — REQUEST_CHANGES is reserved for show-stoppers only.
- **Silent jobs are a success, not a failure.** A job that posts nothing because the re-review turned up nothing new reports `NO-OP` in the final summary. Don't retry it and don't nudge it into commenting to prove it ran.
- **Ping-pong is mandatory, not optional (Steps 4a / 5a / 6).** Every run pulses before dispatch, every 10 minutes while jobs run, and once at the end. The pulse is read-only — it refreshes PR status from `gh` and reads already-reported verdicts; it never messages or interrupts a running job, and it never acts on what it finds.
- **Ping-pong layout is owned by `/sy-list-prs pingpong`.** This command owns the agent ledger (job state, loop number, dispatch / pass times, next-pass ETA, wave number, last rendered pulse snapshot) and passes it in; `/sy-list-prs` owns the three columns, the icons, the change marker, the feature-set grouping, and the sort. `/sy-review-pr` loops ≥3 passes, so Agent cells here carry the `(loop N/3)` counter — same form as `/sy-babysit-prs`.
- **Multi-repo workspaces** (e.g. a bundle like `myapp-frontend`, `myapp-backend` or `myapp-lib`): pass each repo as a `<owner>/<repo>` token. The cross-PR migration check (Step 4) runs across the full union **before** any job is dispatched, so coordination flags surface before any verdict is posted.
- **Always resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name (see Repo Identification).**
