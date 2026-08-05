[Sy] Run `/sy-babysit-pr` on EVERY open PR in scope. This command is a fan-out wrapper — it resolves a list of target PRs (from `$ARGUMENTS`) and dispatches them **all at once, in parallel background jobs**, one `/sy-babysit-pr` per PR, each in its own git worktree.

**Recommended order.** Run `/sy-review-prs` first (verdict pass), then `/sy-babysit-prs` (this command). Reversing wastes babysit cycles on PRs that would be requested-changes anyway.

**This is the command for "sync all my PRs with main, babysit them, address comments — all at once, in the background, with worktrees."** Every part of that ask is already in scope: base-branch merge is `/sy-babysit-pr` Step 5, comment remediation is Steps 6–7, background + worktree + all-at-once is Step 4 below. Route any plain-English phrasing of that request here — do not hand-roll a loop, and do not call `/sy-sync-pr-branch` first (babysit syncs as part of its own loop).

Argument: $ARGUMENTS (optional — selects scope; the first token decides the mode, no mixing).

- **Empty** — babysit every open PR authored by `@me` for git repos at or below cwd, two levels deep (see Repo discovery). (Default behavior.)
- **PWD keyword** — first token (case-insensitive, trimmed) is one of the PWD keyword set defined in `/sy-list-prs`. Scan repos up to 2 child levels below cwd and babysit `@me` open PRs in those repos only.
- **Explicit PR refs** — one or more whitespace-separated PR refs. Each ref is one of:
  - full URL: `https://github.com/<owner>/<repo>/pull/<n>`
  - shorthand: `<owner>/<repo>#<n>`
  - bare `#<n>` or bare digits `<n>` — only valid when the current working directory is a git repo with a GitHub `origin`; resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name (see Repo Identification).

## Steps

1. **Resolve target PR list from `$ARGUMENTS`.** Pick exactly one branch:

   a. **Empty `$ARGUMENTS` or PWD keyword** — delegate to `/sy-list-prs short pwd` (scope = pwd, format = short). Parse the emitted URLs (one full PR URL per line, grouped under `##` headings). Optionally skip the READY TO MERGE group (already green — no babysit needed). If zero PRs resolved, report it and stop.

   b. **Explicit PR refs** (any other `$ARGUMENTS` — treat as whitespace-separated tokens):
   - For each token, normalize to a full PR URL:
     - Full URL → use as-is.
     - `<owner>/<repo>#<n>` → expand to `https://github.com/<owner>/<repo>/pull/<n>`.
     - `#<n>` or bare digits → require cwd to be a git repo; resolve `<owner>/<repo>` via `git remote get-url origin` (never from the folder name), then expand. If cwd is not a git repo, error out naming the unresolvable token and ask the user to use a fully-qualified ref.
     - Anything else (not a URL, shorthand, `#<n>`, or digits) → error out, name the bad token, do NOT silently skip.
   - For each resolved URL, fetch metadata to match the search-result shape used downstream:
     `gh pr view <url> --json number,title,headRefName,baseRefName,isDraft,url,repository,author`.
   - De-duplicate by URL.

2. **Announce:** Tell the user which scope mode was resolved (`pwd scan of <N> repos` for empty/PWD args, or `explicit list of <N> PRs`), how many PRs were resolved, and list them (repo, PR number, title). If any resolved PR is authored by someone other than you (`gh api user --jq .login`), include the author on every listed PR and call the split out explicitly — explicit-ref mode does not filter by author, so babysitting someone else's PR is easy to do by accident.

3. **Render the resolved PR set as a table** so the user sees exactly what is about to be babysat. Delegate to `/sy-list-prs table <same-scope-token>` — `/sy-list-prs` accepts the same scope vocabulary as this command (empty / PWD keyword / explicit refs), so pass the same scope `$ARGUMENTS` (prefixed with `table`) and let it render. Single source of truth for the table layout lives in `/sy-list-prs`.

4. **Fan out to `/sy-babysit-pr <PR-URL>` for EVERY resolved PR at once — in parallel, as background jobs.** Do NOT walk the list sequentially.

   **Dispatch mechanics — this is the step agents get wrong.** "In parallel" is a hard requirement, not a hint:
   - **Emit every job in ONE assistant message with N tool calls in that same message.** One sub-agent / Task / background-shell invocation per PR, all in a single block. A second message per PR is a sequential loop wearing a parallel costume — that is the failure mode this section exists to prevent.
   - **Never** `for pr in ...; do ...; done`, never "start job 1, wait, start job 2", never a single job that iterates the PR list internally.
   - **One job = one PR = one worktree = one independent context.** Jobs share nothing: no cwd, no branch, no state file, no conversation. A job must never read another job's result or wait on it.
   - **Each job's prompt is self-contained.** Pass, explicitly: the full PR URL, the resolved `<owner>/<repo>` (from `git remote get-url origin`, never the folder name), the PR number, the canonical worktree path `$HOME/.worktrees/<owner>/<repo>/pr-<number>`, and the instruction to run the complete `/sy-babysit-pr` loop for that PR and report back its Step 13 final report. Sub-agents start with a fresh context — anything you don't pass, they don't have.
   - **Do not pre-create worktrees from the dispatcher.** Each job owns its own worktree lifecycle (`/sy-babysit-pr` Step 5a create/reuse, Step 5a cleanup after the last pass). The dispatcher never runs `git worktree add`, never `cd`s anywhere, and never touches the user's primary checkout.
   - **Report the fan-out the moment it's launched** — list every PR with its job and worktree path — so the user can see N jobs running, not one job N times.

   - Launch one background job per PR, all in the same dispatch. Each job runs the complete `/sy-babysit-pr` loop for its own PR URL and owns its own state.
   - **Parallelism is safe because every job gets its own git worktree** at a rigid, collision-free path — **`$HOME/.worktrees/<owner>/<repo>/pr-<number>`** (see One rigid worktree path). The PR number makes each job's path unique, so no two jobs share a working tree, and none of them touch your primary checkout or move its branch. Never let a job `git checkout` in the main repo.
   - **Cap concurrency at 8** to stay under GitHub API rate limits. More than 8 PRs → launch in waves of 8, starting the next wave as slots free up. A wave is still one message with 8 tool calls; only the _next_ wave waits.
   - Expect long runtimes: each job does **at least 3 passes 30 minutes apart** (`/sy-babysit-pr` Step 12), so a wave takes 1h+ by design. That is the point — do not shorten it, and do not poll the jobs in a busy loop. Collect each result when its job reports back.
   - If one job fails or escalates, the others keep running. Record the failure and carry on; never abort the whole fan-out for a single PR.
   - The per-PR command owns the full loop. This wrapper does not describe or duplicate per-PR behavior — if the per-PR flow needs to change, edit `/sy-babysit-pr`.

5. **Final report:** one last `/sy-list-prs table <same-scope-token>` render plus a short summary of which PRs were skipped (already green), which were processed, and which need human attention. Include each job's pass count (`<N>/3`) and worktree path (reused vs created), and note any worktrees left behind because they pre-existed.

## Rules

- This command is a dispatcher. The per-PR loop lives in `/sy-babysit-pr` — do not re-implement it here.
- **Base-branch sync is already included — never bolt it on.** `/sy-babysit-pr` Step 5 merges the default branch (and the parent PR, on stacked waves) into every PR branch before it does anything else. Do not run `/sy-sync-pr-branch` ahead of the fan-out, do not `git merge origin/main` from the dispatcher, and do not add a "sync pass" — that would double-merge and race the jobs' own worktrees.
- **Parallel means one message, N tool calls (Step 4 Dispatch mechanics).** If the transcript shows the jobs starting one message at a time, the fan-out was sequential and must be relaunched. One job per PR, self-contained prompt, no shared state.
- **Babysit all resolved PRs at once, in parallel background jobs — never a sequential for-loop** (see Fan out multi-PR work in parallel). One worktree per PR at `$HOME/.worktrees/<owner>/<repo>/pr-<number>` (`/sy-babysit-pr` Step 5a) is what makes this safe: the PR number keys the path, so jobs can't collide, nothing is shared, and the user's primary checkout is never touched. Cap at 8 concurrent jobs and queue the rest.
- **A fan-out run is long by design.** Every job does ≥3 passes 30 minutes apart, so budget an hour-plus per wave. Don't truncate jobs, don't busy-poll them, and don't declare the fan-out done until every job has reported.
- **Table output is owned by `/sy-list-prs`.** Both the pre-flight render (Step 3) and the final report (Step 5) reuse its `table` format. Pass the same scope `$ARGUMENTS` to `/sy-list-prs table` so the rendered set matches the resolved PR set exactly. Do not hand-roll a different table layout.
- **First token of `$ARGUMENTS` decides the mode — no mixing.** PWD-keyword + explicit refs in the same call is an error; pick one. Empty and PWD-keyword modes both scan cwd + nested repos; explicit-list mode does not filter by author (you asked for those specific PRs).
- **Surface authors when the resolved set isn't all yours** (see Show PR authors). Explicit-ref mode is author-agnostic, so it can silently pull in someone else's PR — name the author on every row and in the summary whenever the set is mixed. The `/sy-list-prs table` renders (Steps 3 and 5) already add an `Author` column in that case.
- **Always resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name (see Repo Identification).** Applies to PWD scan (delegated to `/sy-list-prs`) and to bare-`#<n>` ref expansion.
- **Wave sync is automatic.** `/sy-babysit-pr` detects stacked PRs (base branch is itself a PR) and merges both the default branch and the parent PR before every push. No manual intervention needed for waves.
