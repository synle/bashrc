[Sy] Babysit a single pull request **you authored** to the merge line — you act as the author, not a reviewer. Delegate branch syncing to `/sy-sync-pr-branch`, which merges default plus every ancestor branch for stacked PRs. Preserve existing approval by default. Address only blocker-related review comments when CI fails, the base conflicts, or the migration head is stale. Also address them for blocking reviewer requests or `<<SY_PR_REVIEW_CHANGE_THRESHOLD>>` or more unresolved actionable change comments. Run local checks, fix failing builds, and wait until CI passes. Run all git work in a **dedicated worktree**, never your primary checkout. Keep the loop working for a fixed run budget. Poll cheaply between passes and react immediately to state changes. Enable automerge on the first pass for standalone prose-only PRs (docs / comments / whitespace). Wait for open companion PRs. Never self-enable automerge for executable lines.

**Scope.** This command **changes the PR** — it pushes commits, merges the base in, replies to review threads, and can arm automerge. That is why it belongs to PRs you own: pushing to someone else's branch rewrites work that is not yours, and answering their reviewers speaks for them. To leave a verdict on **someone else's** PR without touching it, use `/sy-review-pr`. Take a PR authored by someone else only when it is explicitly handed to you — then say whose it is and exactly what you pushed.

Argument: $ARGUMENTS (optional — a PR URL or PR number. If empty, use the current branch's PR. A caller dispatching a batch, e.g. `/sy-babysit-prs`, may also pass the full list of sibling PR URLs in that batch; Step 2a's companion check treats them as companions. A slot driver holding several PRs may pass `pass=single` — see the Step 12 loop gate.)

## Execution mode

Top-level default: one self-contained background worker owning workspace recovery, cadence, pushes, and reporting. Match stable key `sy-babysit-pr:<owner>/<repo>#<number>` against live jobs first: retain running owner, resume idle owner, create only when unowned; cancel a confirmed duplicate, keeping the older. Record the handle and await the dispatched work before ending the turn, per shared PR instructions. Run inline when already dispatched or when `pass=single` is present. Also run inline for explicit `foreground`, `fg`, `inline`, `blocking`, `synchronous`, `sync`, or `wait`. Strip mode tokens. Placement changes no scope, ownership, recovery, sync, checks, or pass order.

## Run clock overrides

Strip trailing `budget=<value>` and `keepalive=<duration>` before resolving scope. Durations accept `<n>s`, `<n>m`, `<n>h`, or combinations (`6h40m`); budget also accepts `<n>r` / `<n>rounds`, preferred in examples. Bare numbers are invalid. Resolve keepalive first, then convert rounds to `n × keepalive`, never a pass quota. Defaults: `<<SY_PR_RUN_BUDGET_ROUNDS>>` rounds and `<<SY_PR_KEEPALIVE_INTERVAL_SECONDS>>` seconds. Clamp budget to `[10m, 24h]`, then keepalive to `[5m, budget]`; report clamps or parse failures, retaining defaults for invalid values. Natural-language cadence maps to these tokens (`10 rounds 25 mins apart` → `budget=10r keepalive=25m`). Probe/retry policy stays unchanged. Drivers own the clock and do not forward overrides to `pass=single` workers.

**Announce the schedule before the first pass — every run that owns its clock, overrides or not (a `pass=single` worker skips it — its driver already announced).** Before dispatching or starting anything, print one short block so the user knows exactly what is running and when it ends:

```
Schedule — <command name>
  First round: <HH:MM local> (now)
  Last round:  ~<HH:MM local> (deadline <HH:MM>)
  Duration:    <H>h <M>m · <n> rounds × <keepalive> keepalive
  Source:      budget=<as given | default> · keepalive=<as given | default>
```

`<n>` is `ceil(budget / keepalive)` when the budget was a duration; when a clamp changed anything, add a `Clamped:` line naming it. Times come from a real `date` call at launch, never estimated. The same numbers seed `started_at` / `deadline_at`, and the final report repeats the actual first and last round times beside the planned ones.

## Steps

1. **Determine which PR to babysit:**
   - If `$ARGUMENTS` is provided (a PR URL like `https://github.com/org/repo/pull/123` or a PR number), use that.
   - If `$ARGUMENTS` is empty, detect from the current working directory:
     - `git remote get-url origin` to determine the repo.
     - `git branch --show-current` to get the current branch.
     - `gh pr view --json number,title,url,headRefName,baseRefName` to find the PR for the current branch.
     - If no PR exists for the current branch, tell the user and stop.

2. **Announce:** Tell the user which repo and PR you are babysitting (repo name, PR number, title, URL).

2a. **Placeholder-draft skip gate — before memory, worktree, or sync.** Fetch `gh pr view <number> --repo <owner/repo> --json isDraft,title,url`. If `isDraft` is true **and** the title contains `Placeholder` (case-insensitive), this is still the pre-implementation placeholder PR. Report `"placeholder draft pending implementation — skipping babysit until code lands and the PR is marked ready"` with the full URL and stop immediately. Do not create babysit memory, do not allocate a worktree, do not sync, and do not consume a watch-loop budget on it. Once the placeholder markers are removed and the PR is readied, a later invocation babysits it normally.

2c. **Create or resume babysit memory before changing the PR.** Stable identity is `<owner>/<repo>#<number>`. Under `<<LLM_ROOT_FOLDER>>/pr_babysits/`, find an existing file by identity in its heading or full PR URL and by historical filename aliases. Otherwise create `<repo-name>_<number>_<slug>.md`. Resolve `<owner>/<repo>` and `<repo-name>` from GitHub, preserving repository-name punctuation. Derive a short lowercase snake_case slug from the title after stripping status / repo prefixes. One same-kind match is reused without renaming; multiple matches create no new file, so report the conflict and use the newest verified snapshot until consolidation is approved. Read title, body, commits, changed files, and full diff; write a 2–3 sentence `## TLDR` covering feature goal, implementation, affected contracts, and main risk. Scan root and changed-path `AGENTS.md` / `CLAUDE.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `DEV.md`, `.cursorrules`, and relevant linked/component docs. Widen to another repo only when those sources identify a concrete consumer. Put only applicable hard rules and non-obvious context in `## Relevant Rules`. Initialize/update `## Context` with URL, owner/repo identity, head SHA, status, last-verified time, and stable job key. The diff wins over title/body; saved context and author claims remain hypotheses. If an old worktree journal exists, distill any still-current resume state once, then leave it untouched.

2b. **Replay and revalidate any `needs_user` claim left by an earlier run — before deciding anything else.** A fresh invocation remembers nothing, so the only record that this PR was handed to the human is the `needs_user` block in babysit memory. Read it on every run's first pass and treat it as a hypothesis, not fact. A withdrawal, answer, or later push may have superseded the source comment hours ago.

    - **Re-fetch the source, do not trust the summary.** The block records `needs_user_source_id` (the comment / review / thread / check it came from), `needs_user_source_updated_at`, and `needs_user_head_sha`. Re-read that item by id, re-read the PR's current reviews, review threads, checks, head SHA, and body, and read everything posted since that timestamp.
    - **Resolve to exactly one verdict:**
      - `current`: the claim still stands.
      - `cleared`: it no longer stands.
      - `changed`: a human is still needed for a different reason.
      - `conflicted`: later comments disagree.
      - `stale_unknown`: the source is gone or unreadable, preventing verification either way.
    - **Print the prior claim and the verdict together, always with a `Next:` line.** Use `Prior:` for the last run's question. Use `Current:` for the verdict and evidence; quote the comment and timestamp. Use `Next:` for the concrete step:
      - Claim stands: name the decision the human owes.
      - Claim clears: name the work this run resumes.
      - Comments conflict: identify the two disagreeing comments.
      - Verification fails: name the check to run.
    - **`cleared` resumes the PR normally** — drop `needs_user` from babysit memory, name the comment that cleared it, and carry on into Step 3. `current`, `changed`, and `conflicted` keep it, refreshed with the new source id and timestamp. `stale_unknown` keeps it and says plainly that it could not be verified.
    - **This is display, never a prompt.** Print it and keep working. Ask no interactive question and never block waiting for an answer. Write nothing to GitHub purely for scheduler state: no label, status, review, or comment. The PR stays exactly as mergeable to everyone else as it was.

2a. **Prose-only automerge gate — runs on the first pass, before the CI check.** A standalone docs / comment PR should not wait on a human to click merge, so babysit flips `--auto` on itself the moment it picks one up. It runs here, ahead of Step 3, because enabling automerge is safe while CI is still running — `--auto` is a queued instruction, not a merge. The one branch that re-runs on later passes is the deferred-companion case below.

    Fetch: `gh pr view <number> --repo <owner/repo> --json state,isDraft,title,body,author,autoMergeRequest,headRefName,baseRefName`.

    - **Skip the gate entirely** when any condition below holds. Report why once; never re-check.
      - `state != "OPEN"`.
      - `isDraft` is true.
      - The title contains `WIP` or `DO NOT MERGE`, case-insensitive.
      - `author.login` is not you (`gh api user --jq .login`).
      - `autoMergeRequest != null`: someone already enabled it; leave that decision alone. **"Never re-check" has exactly one exception: a Step 4a wave promotion.** Promotion removes draft state and WIP titles, both skip reasons. Re-run this gate once during the promotion pass. Otherwise, an obsolete condition permanently disqualifies a wave-2 prose-only PR.
    - **Classify the diff** — `gh pr diff <number> --repo <owner/repo>`, and read every changed line, not just the file list. **Prose-only** requires every `+`/`-` line to belong to one allowed category; see the Automerge is opt-in rule:
      - Docs-file content: `*.md`, `*.mdx`, `*.rst`, `*.txt`, `docs/**`, `README*`, `CHANGELOG*`, `LICENSE*`.
      - A source-file comment line.
      - A docstring / JSDoc block.
      - Pure whitespace. A single executable line — code, config, schema, lockfile, CI workflow, test — disqualifies the whole PR, however small. A file-name check alone is not enough in either direction: a `.md` file can hold an executed snippet the repo tests, and a `.py` file can hold a comment-only fix.
    - **Companion check — only a STANDALONE prose-only PR self-merges.** Merging docs before the code they describe is the failure this prevents, so a prose-only PR that belongs to a set waits for that set. Gather companions from all four signals, then keep only those still `OPEN`:
      - **Batch siblings** — if the dispatcher passed a sibling PR list (`/sy-babysit-prs` Step 4 hands each job the full dispatched set), every other PR in it is a companion. This is the strongest signal and needs no API call.
      - **Branch group** — read `headRefName`. If it has three or more segments (`<username>/<group-slug>/<feature>`), the group prefix is the first two. Same repo: `gh pr list --repo <owner/repo> --state open --json number,url,title,headRefName,author --limit 100`, keep rows whose `headRefName` starts with `<username>/<group-slug>/`. Other repos (best effort — `gh search prs --json` exposes no `headRefName`, so match on text): `gh search prs --author @me --state open --json number,repository,url,title --limit 50 "<group-slug>"`.
      - **Explicit references** — read the title and body for another PR path (`.../pull/<n>`), or the words "depends on", "part of", "stacked on", or a shared plan slug. Resolve each and keep the open ones.
      - **Stacked** — `baseRefName` is another open PR's head branch.
    - **Prose-only AND standalone → enable it:** `gh pr merge <number> --squash --auto`, then report `"Standalone prose-only diff (<n> files, docs/comments only) — automerge enabled; CI and any required approval still gate the merge."` Then continue the normal loop at Step 3. Still sync and handle active blockers. Leave ordinary review comments untouched unless the remediation gate activates.
    - **Prose-only but NOT standalone → defer, and re-check every later pass.** Leave `--auto` off and report `"Prose-only diff, but <n> companion PR(s) still open — automerge deferred so the docs don't land before the code: <full PR links>."` This is the one gate decision that is **not** final: what blocks is a companion still being open, not the PR being grouped. Re-resolve the companion list every later pass. Once all companions are `MERGED` or `CLOSED`, enable `--auto`. Report `"Last companion (<link>) landed — automerge enabled on the prose-only PR."`
      If any companion remains open after babysit's passes, report that in Step 13 and leave the merge to the human.
    - **Not prose-only → leave it off,** report `"Diff touches <what> — automerge stays off until you say otherwise."`, and do not reconsider on later passes. Automerge is opt-in everywhere except a standalone prose-only diff.
    - **If `gh` rejects `--auto`**, report the exact error once and continue the loop. Causes include disabled auto-merge, disallowed squash, or branch protection missing a required check. Never fall back to a bare `gh pr merge` without `--auto` — that would merge on the spot — and never retry on later passes.
    - **Revoke it if the PR stops qualifying.** Babysit pushes its own commits in Steps 5–10. A CI fix or new test turns a docs PR into a code PR. A companion PR can also open after this gate enables `--auto`. On every later pass, if automerge is on **because this gate enabled it**, re-check both conditions:
      - The diff now contains an executable line → `gh pr merge <number> --disable-auto`, report `"PR is no longer prose-only (<what changed>) — automerge disabled; merge is yours again."`, and treat it as opt-in from then on.
      - A companion PR has since opened (re-run the companion check) → `gh pr merge <number> --disable-auto`, report `"A companion PR opened since automerge was enabled (<link>) — automerge revoked so the docs don't land first; it will be re-enabled once that PR merges or closes."`, and fall back to the deferred branch above.

      Never revoke automerge the user or `/sy-create-pr` enabled — only what this gate turned on.

3. **Skip if a BUILD is currently running — a pending human review gate is not a build.** Before any other check, fetch state:
`gh pr view <number> --repo <owner/repo> --json statusCheckRollup`

- **Classify every non-`COMPLETED` entry before deciding anything.** A pending entry is a `CheckRun` whose `status` is `IN_PROGRESS` / `QUEUED` / `WAITING` / `PENDING` / `REQUESTED`, or a `StatusContext` whose `state` is `PENDING` / `EXPECTED`. Sort each one into exactly one bucket:
  - **Blocking — a self-resolving build.** A job is executing and will reach a conclusion on its own: test, lint, type-check, build, scan, deploy. Pushing into it wastes CI cycles and merging into it is unsafe, so it ends the pass.
  - **Non-blocking — a human gate, or a stalled entry.** A check that cannot finish without a person clicking something never resolves on a timer, so "wait for CI" means wait forever. Mark an entry non-blocking when ANY of:
    1.  Its display name matches a review-gate pattern, case-insensitive: `approv`, `review`, `sign-?off`, `codeowner`, `resolution`, `ack`, `attestation`, `waiver`. Use `name` (+ `workflowName`) for a `CheckRun` and `context` for a `StatusContext`. `gh pr view --json statusCheckRollup` returns those fields, not `description`; match its actual output. Apps report approval gates as checks that sit `IN_PROGRESS` **by design** until a human acts.
    2.  It is a `StatusContext` in `PENDING` with no `targetUrl` — nothing is executing behind it.
    3.  **Staleness backstop** — it has been pending longer than **60 minutes**. Read age from `startedAt`, which `gh` emits for **both** node types. For `StatusContext`, `gh` renames GraphQL's `createdAt`; do not look for `createdAt` in `gh` output. Babysit has one bounded run window. Do not wait out a check unchanged for an hour; treating it as blocking makes every remaining round a no-op. Name it in the report as `"stalled check treated as non-blocking"` so a genuinely slow build is visible rather than silently stepped over.
- **End the pass ONLY if the blocking bucket is non-empty.** Report `"PR build is currently running (<blocking check names>) — skipping this pass"` and take no other action: do not merge, do not address comments, do not push. Then fall through to the **Step 12 loop gate** (sleep 30 min, re-enter at Step 3) instead of exiting babysit.
- **If every pending entry is non-blocking, DO NOT end the pass.** Report `"<n> check(s) pending on a human gate (<names>) — not a build; continuing the pass"` and go to Step 4. A review gate blocks the _merge_, not status polling or required blocker handling. Do not activate comment remediation for a human gate alone. Leave ordinary comments untouched unless a completed CI failure, base conflict, or stale migration head also exists. An active `CHANGES_REQUESTED` review or `<<SY_PR_REVIEW_CHANGE_THRESHOLD>>` or more unresolved actionable change comments also qualifies.
- Carry the non-blocking list through the remaining pass. Step 4 interprets "all CI checks passing" as _all blocking checks passing_. Step 11 stops polling when only non-blocking entries remain. Step 13 names every pending gate.
- CI is fully idle only when every entry is `COMPLETED` (or there are no checks). A non-blocking gate means "proceed", never "green".

4. **Early-exit check.** Fetch state:
   `gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable,state,autoMergeRequest,baseRefName,headRefName`
   - If `state == "MERGED"`, report the merge SHA and **reap the leftovers**; see _A merged PR gets cleaned up_. Run `git clean-worktree`, then `git clean-stale-branches`. Confirm any skipped detached-HEAD worktree is clean before removing it with `git worktree remove <path>`. **Keep babysit memory**. **Do NOT trigger a release** — release is expensive and stays a manual `/sy-release` the user invokes; never auto-dispatch it after a merge. Stop babysit entirely — merged is the one terminal state that skips the remaining Step 12 passes. A worktree carrying unpushed commits or a dirty tree is never reaped silently: report the path and leave it for the human.
   - **Merge-conflict override — check `mergeable` BEFORE either early-exit branch below.** A PR with conflicts against its base branch is NEVER "done", even when CI is green and reviewers have approved.
     - If `mergeable == "CONFLICTING"` (or any non-`MERGEABLE`, non-`UNKNOWN` value indicating a base-branch conflict): report `"PR is green + approved BUT conflicts with <baseRefName> — falling through to Step 5 to resolve"` and continue to **Step 5**. Step 5 will perform the actual merge + conflict resolution; the rest of the loop (tests, local checks, CI monitor) handles the rebuild.
     - If `mergeable == "UNKNOWN"`: GitHub is still computing mergeability. Wait 5s and re-fetch — **cap at 6 retries (~30s total)**. If still `UNKNOWN` after the cap, treat as `CONFLICTING` and fall through to **Step 5** (the merge attempt will surface the real state). Never treat `UNKNOWN` as `MERGEABLE`.
   - **Migration-head override — check this BEFORE the green + approved early-exit below, and re-check it EVERY pass.** Apply the same logic as the merge-conflict override above. A migration parented on a superseded head is NEVER "done", regardless of green CI or reviewer approvals. Every early-exit signal can say "ready" while this merge still breaks default. Sibling migration revisions occupy different files, so the DAG conflict leaves `mergeable` at `MERGEABLE`. This branch's CI never tested the head that landed while the PR waited.
     - **Applies to any PR whose diff touches a migration path** (detection table: `/sy-sync-pr-branch` Step 7 — do not restate it here). No migration in the diff → skip this bullet entirely, no API calls.
     - **Cheap read-only probe first.** Compare the migration parent with the floor branch's current head without checking anything out. For Alembic, read the new revision's `down_revision` from `gh pr diff <number> --repo <owner/repo>`. Read the floor's head from `gh api repos/<owner>/<repo>/contents/<versions-path>?ref=<floor>`. For other frameworks, apply the equivalent ordering check. In doubt, fall back to **"is there a migration on the floor branch that is not in this PR's history?"** — if yes, treat it as stale.
     - **Stale → do NOT early-exit.** Report `"PR is green + approved BUT its migration is parented on <old-head> and <floor> is now at <new-head> — falling through to Step 5 to re-parent"` and continue to **Step 5**. Delegate the fix to sync's Step 7: merge the floor and re-stamp onto its head. **Never `alembic merge`**, never rebase. The merge-conflict override similarly delegates the merge itself. Babysit implements neither.
     - **Single head → carry on** to the wave-block check and the early-exit below, and say `migration head current (<head>)` in the report so a pass that skipped is auditable.
     - **Never re-parent an ancestor PR's migration** — the sync enforces downhill-only; on a stack, this branch's revision re-parents onto the ancestor's.

   - **Wave-block check — do this before judging CI, and do it every pass.** Read the PR body for a `## Blocked on` section (see the _Hard dependencies phase into waves_ rule). It names the PRs this later-wave branch waits on, so it decides whether this pass has any work in it at all. Resolve each named PR's real state with `gh pr view <link> --json state` rather than trusting the section, which goes stale by design.
     - **Any named PR still `OPEN`** → this branch legitimately lacks its required migration / column / field. Red CI is expected and is not yours to fix. Report `"PR is wave-blocked on <link> — CI stays red until it merges; skipping this pass"` and **end the pass** (skip Steps 5–11), exactly as a running build does. Do not push, attempt fixes, touch Step 11 attempt counters, or escalate. This is a documented skip, not a terminal state. The next pass catches the blocker landing.
     - **Every named PR `MERGED`** → the block is over and this pass has real work in it. Do not end the pass; carry on to **Step 4a**, which owns the promotion end to end. Do not drop the title prefix, undraft, or rewrite the body from here — one implementation, and it is Step 4a's.
     - **A named PR is `CLOSED` without merging** → stop and ask. The dependency this branch was built on is not coming, so the wave plan itself is wrong and no amount of syncing fixes it.
     - **No `## Blocked on` section** → not a wave PR; skip this bullet entirely and carry on. Most PRs are wave 1 and never mention it.
   - Use Step 3's classification for this condition: **all blocking CI checks pass** AND `reviewDecision` is `APPROVED` AND `mergeable == "MERGEABLE"`. Pending human gates neither pass nor fail this test and do not hold the branch back. Name them in the report; never claim an unclicked gate is "green". When the condition holds:
     - **Do NOT enable automerge here.** Only Step 2a's prose-only gate may flip `--auto`. That decision is already complete here. Leave a green non-prose PR for the user to merge.
     - If `autoMergeRequest` is `null`: report `"PR is green + approved — ready for you to merge with 'gh pr merge <number> --squash' (or enable automerge if appropriate)"` and **end the pass** (skip Steps 5–11). Fall through to the **Step 12 loop gate** — a later pass catches CI or blocker state changes that land after this moment. **Exception — a Step 2a deferred prose-only PR:** re-run Step 2a's companion check first. If every companion is now `MERGED`/`CLOSED`, enable `--auto` here and follow the branch below; if any is still open, report `"green + approved, waiting on <n> companion PR(s): <links>"` instead and end the pass.
     - **Stacked PR — green + approved is not mergeable yet.** Cheap check: `gh pr list --repo <owner/repo> --head <baseRefName> --state open --json number,url,title`. A hit means this PR's base is another open PR, so merging now would land this work into the parent's branch, not the default branch. Report `"green + approved, but stacked on <parent link> — that PR merges first; this one retargets automatically when it does"`, do **not** merge, do **not** enable automerge, and end the pass. Keep running the remaining passes: the parent landing is exactly the event a later pass is there to catch.
     - If `autoMergeRequest` is NOT `null` (Step 2a's prose-only gate, or the user earlier via UI or `/sy-create-pr` Step 10): the merge will land on its own. Poll `gh pr view --json state,mergeable` every 30s until `state == "MERGED"`. Then run `git clean-worktree` and `git clean-stale-branches`, keeping babysit memory. Leave dirty/unpushed worktrees for the human, per terminal-MERGED handling above, and stop. **Do NOT trigger a release** — release stays manual. If `mergeable` flips to `CONFLICTING` mid-wait (base advanced), break out and fall through to **Step 5**.
       - **On a migration PR, re-run the migration-head override on every poll cycle, not once on entry.** This wait is the most dangerous place for a stale head. Automerge lands the PR without anyone watching. The head can move between checking and merging. A `--auto` PR is a queued instruction, so the window is exactly as long as the slowest required check. If the head goes stale mid-wait, break out of the poll and fall through to **Step 5** — same as a `CONFLICTING` flip. Do **not** revoke `--auto` unless this command enabled it (`automerge_decision == enabled_by_me`). Pushing the re-parented migration re-triggers CI and safely re-queues automerge without changing someone else's decision.

4a. **Wave promotion — when the wave below lands, make THIS PR mergeable.** A later-wave PR is parked in a deliberately unmergeable shape: a `WIP: DO NOT MERGE — ` title prefix, a `## Blocked on` section, often draft state. **GitHub undoes none of that when the blocker merges**. Without this step, a wave-2 PR ends green and unblocked but still unmergeable. A human must notice the earlier state change. This step is what turns "wave 1 merged" into "wave 2 is ready". Run it **every pass**, **even when Step 4 ended the pass early**. "Skip Steps 5–11" never skips this step. A green + approved PR still titled `WIP` needs promotion.

- **Resolve the blocker set from all three signals**, then keep only the ones still open:
  - the `## Blocked on` section in the body — the canonical signal (see the _Hard dependencies phase into waves_ rule);
  - **wave context handed down by the dispatcher** — `/sy-babysit-prs` Step 4 passes each job the blocking PR links for every PR it holds. No API call, and it is the only signal available when the body was never annotated;
  - dependency prose in the body: `depends on <link>`, `part of <link>`, `blocked by <link>`, a shared plan slug.

  Resolve every candidate's **real** state with `gh pr view <link> --json state --jq .state`. The body goes stale by design and is never trusted — that staleness is the whole reason this step re-checks instead of reading a flag.

- **Any blocker still `OPEN` → not promotable.** Say which one and leave the PR exactly as it is: prefix, section, and draft state all stay. Same documented skip as Step 4's wave-block check.
- **A blocker `CLOSED` without merging → stop and ask** (Step 12 terminate-early). The dependency is not coming, so the wave plan itself is wrong; no promotion and no sync fixes that.
- **Every blocker `MERGED` → promote, in this order, never out of it:**
  1.  **Sync** — fall through to Step 5 so `/sy-sync-pr-branch` merges the default branch in and the branch finally _contains_ the migration / column / field it was waiting on. Nothing below may run before the code is actually there.
  2.  **CI green** — let the loop re-run checks. A red branch is never promoted; the next pass resumes the promotion where this one left off.
  3.  **Undraft** — `gh pr ready <number> --repo <owner/repo>` when `isDraft` is true. Third and not first on purpose: readying requests reviewers, and pinging a team onto a red branch is exactly what draft state existed to prevent.
  4.  **Drop the WIP prefix** — `gh pr edit <number> --repo <owner/repo> --title "<new>"`, stripping only a leading `WIP` / `DO NOT MERGE` prefix and preserving the `[<repo>] ` prefix and everything after it.
  5.  **Rewrite the body** — replace the `## Blocked on` section with a one-line note that it landed (`Blocked on <link> — merged`), and clear any `TODO —` marker that blocker owned. Every other section is left alone (_PR body tracks the branch_), and the payload goes through `--body-file` (_Every GitHub body payload uses a temporary file_).
- **A wrong sequence number in the title is corrected here, and only here.** Check titles carrying `wave <W> - pr <i>/<N>` for dispatcher-reported out-of-order, duplicated, or stale `<i>` values against `<N>`. Fix reported values in the same `gh pr edit --title` call that drops the prefix. If no prefix needs removal, fix them separately. `<i>` expresses merge order and increases monotonically with the wave; see _A sequence number in a title is MERGE order_. A wrong-direction merge instruction is worse than no number. Never renumber from `createdAt` or the PR number, and never touch a branch to do it.
- **A follow-up PR cut from a review comment joins the wave set, and the set is reassessed before it is announced.** When Step 7 opens a separate PR to answer a reviewer, place it in the wave its dependencies require, usually this same wave. Never append it last merely because you wrote it last. Re-derive ordering and retitle moved PRs. Update the affected `## Blocked on` sections on both sides. Reply in the requesting thread with the new PR's link **and** current position, preventing superseded numbering. See the _A PR joining the set mid-flight_ rule.
- **Promote per reason — the other reasons are the author's call.** Check whether WIP or draft state has a stated reason _besides_ the wave block. Examples include open `TODO —` markers, unfinished work in the body, or explicit "keep this draft" instructions. If another reason exists, sync anyway and report the blocker's merge. **Leave the prefix and draft state alone**. Promoting past a reason you did not resolve ships work its author called unfinished.
- **Idempotent and re-entrant.** Complete only outstanding work each pass. Resume promotions interrupted between steps 3 and 5 next pass without starting over. Never repeat completed actions: - Leave titles without prefixes alone. - Do not re-ready already-ready PRs. - Do not rewrite bodies without a `## Blocked on` section.
- **Re-run the Step 2a automerge gate once, on the pass that promotes.** Draft state and WIP titles trigger two Step 2a skip reasons. Promotion clears both. Without this recheck, an expired condition keeps promoted prose-only PRs disqualified.
- **Report it explicitly** — which blocker landed, which of the five actions ran, and which did not and why: `promoted: blocked-on github.com/acme/api/pull/40 merged → synced, CI green, undrafted, prefix dropped, body updated`, or `blocker landed, WIP kept — 2 open TODO markers`.

5. **Set up the workspace, then DELEGATE the sync to `/sy-sync-pr-branch`.** Babysit does not implement branch syncing. Every Sy command shares `/sy-sync-pr-branch` for the ancestor walk, merge order, conflict resolution, migration-head check, and pre-push gate. Babysit owns the workspace (Steps 6–11 keep using it) and consumes the sync's result block.
   **⚠️ MERGE ONLY — NEVER REBASE**, in this step and every later one. `git pull --rebase`, `git rebase`, and `--squash` rewrite pushed history and force `--force-with-lease` on the next push.
   a. **Resolve an isolated worktree for this PR — ALWAYS a worktree, NEVER the user's primary checkout** (see Never do PR-branch work in the primary checkout). Resolve the PR head branch first: `BR="$(gh pr view <number> --repo <owner/repo> --json headRefName --jq .headRefName)"`.
   - **Create or reuse it with one command: `WT="$(worktree_create "$BR")"; cd "$WT"`** (see One rigid worktree path). The command prints the folder on stdout and diagnostics on stderr, so that line is the entire setup. Do not hand-roll `git worktree add`, assemble paths yourself, or `mkdir` anything. `worktree_create` already prunes stale admin records and reuses linked worktrees on `$BR`. It refuses primary-checkout reuse and preserves unpushed commits. When primary already has the branch checked out, it falls back to a detached worktree.
   - **Update babysit memory immediately after resolving the workspace.** Record the workspace path/kind and pass number in `## State`; never create a worktree-adjacent journal. Memory persists across passes and re-invocations and is not a temporary API payload.
   - **Check which case you landed in — the alias reports it on stderr — and pay what each one owes:**
     1. **`reusing worktree already on '<branch>'`** — a worktree from an earlier run (or the user's own). `git fetch origin`, then go straight to the recovery pass below. Compare the path with `worktree_create --path-only "$BR"`. Treat any mismatch as a pre-existing noncanonical worktree, possibly user-owned or from an older helper. Report it; never migrate or delete it automatically. If it is dirty, stop for human input. The canonical `--path-only` output still names new work; babysit memory remains under the shared LLM root.
     2. **`created a DETACHED worktree`** — the branch is checked out in the primary checkout, so git refuses a second checkout of it. Work detached and push with `git push origin HEAD:"$BR"` (Step 5i) — never `git push` bare from a detached HEAD.
     3. **`keeping <n> unpushed local commit(s)`** — a previous interrupted run committed without pushing, so the alias checked the branch out **as-is, no reset**. Reconcile forward with `git merge "origin/$BR" --no-edit`; those commits are recovered work and Step 5i pushes them. Never reset or drop them.
     4. **`created worktree on '<branch>'`** — a clean start from `origin/$BR`, nothing owed.
   - **If cwd is NOT the target repo**, clone outside `$HOME/.worktrees/<owner>/<repo>/`. Then run `worktree_create "$BR"` inside that clone. This commonly follows invocation with an explicit PR URL from elsewhere. Do not assemble the path, create the container, or invent a temp dir.
   - **⚠️ Recover interrupted work BEFORE the clean guard — assume a previous pass was killed mid-flight.** This command sleeps between polls and polls CI inside a pass, so being terminated mid-run (Ctrl-C, session timeout, reboot, OOM, a fan-out job cancelled) is normal, not exceptional. A reused worktree is _expected_ to hold unfinished work of ours, and a deleted worktree is expected to have left commits on the local branch. In `$WT`, check all four in order and resolve each **before** merging:
     1. **In-progress git operation.** Read `git status`, or look in `$(git rev-parse --git-dir)` for `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `rebase-merge/`, `rebase-apply/`. A left-over `MERGE_HEAD` means the last run died mid-conflict-resolution: finish the resolution per Step 5e and `git commit --no-edit`. Do not `git merge --abort` a resolution that is already complete, and do not start a new merge on top (git refuses anyway). A left-over `rebase-*` is not ours — this command never rebases — so `git rebase --abort` and say so in the report.
     2. **Uncommitted / staged changes** (`git status --porcelain`). At the **canonical** path, these edits belong to our interrupted pass. Read the diff. Commit complete work, or finish incomplete edits before committing. Describe actual hunks in the message; see the commit-message rule. At a **non-canonical** path — case 1, the user's own worktree — they are the user's: **STOP and ask.** Never stash, `reset`, `checkout --`, or merge on top of either.
     3. **Untracked files** — same canonical/non-canonical split, ignoring build artifacts and anything already `.gitignore`d.
     4. **Unpushed local commits** (`git log --oneline "origin/$BR..HEAD"`). A run that committed and died before pushing leaves these; a run whose worktree was deleted leaves them on the local branch. Never reset or drop them — they ride out through the normal pre-push gate at Step 5i.
        Report each recovery in the final report (`Recovered from interrupted run: <what>`), and account for it when scoping Steps 6–10 — do not redo work that is already committed in the worktree.
   - **Guard, after recovery: the workspace must be clean before the merge.** Re-run `git status --porcelain` — it must come back empty. If it is still dirty (the user's own worktree, or work you could not confidently finish), STOP and ask the user. Never stash, reset, or merge on top of in-progress work.
   - `cd "$WT"` and run **every subsequent git / `gh` command from there**. The user's primary checkout stays untouched — never `git checkout`, `git switch`, or `gh pr checkout` in it.
   - On final exit — **after the last pass (Step 12), not between passes** — clean up **only the workspace this run created**:
     - Worktree created by this run: `git worktree remove "$WT"`. Only pass `--force` after confirming no uncommitted work to preserve.
     - Clone created by this run: `rm -rf "$WT"` after the same confirmation.
     - **Pre-existing worktree (case 1) at a non-canonical path: leave it in place.** Report the path in the final report; do not remove it.
     - Anything left behind is still reachable via `ls "$HOME/.worktrees"` and reapable by the `git clean-worktree` alias (skips dirty worktrees; skips detached HEADs, so remove those explicitly).
       b. **Confirm the workspace is on the PR head.** `git rev-parse HEAD` should match `gh pr view <number> --repo <owner/repo> --json headRefOid --jq .headRefOid`; if not, fast-forward it (`git merge --ff-only "origin/$BR"`). Skip `gh pr checkout` in worktree mode — it can collide with the branch being checked out elsewhere.
       c. **Delegate the whole sync to `/sy-sync-pr-branch` — do not merge anything yourself.** Invoke it with the workspace already resolved, local-only, and machine-readable:

     `/sy-sync-pr-branch <PR-URL> workspace=$WT server-side=never report=structured`

   - `workspace=$WT` — the sync runs in babysit's worktree and never creates, cleans, or removes one; babysit owns its lifecycle across all passes.
   - `server-side=never` — `gh pr update-branch` would merge remotely, leaving the local worktree behind and useless for Steps 6–11.
   - Defaults handle the remaining steps in order:

- Resolve the ancestor chain fresh.
- Merge the floor, then every ancestor root-most → immediate parent, one merge per source.
- Resolve conflicts.
- Run the migration-head check.
- Run the pre-push gate.
- Push.
- **Re-invoke it every pass.** The chain is re-resolved each time — parents push, merge, and get retargeted between passes.
  d. **Consume the sync result block** (`/sy-sync-pr-branch` Step 8) and act on it before continuing:
- `flags: stopped-for-human` or `migrations: needs-human` → the branch is **not** synced. Do not proceed to Steps 6–11 as if it were: report what the sync asked for, end the pass, and fall through to the Step 12 loop gate.
- `flags: orphaned-base <link>` (an ancestor PR closed without merging) or `retargeted` → carry it into the Step 13 report; the sync already handled the merge itself.
- `stack`, `floor`, `sources`, `migrations`, `pushed` → quote them verbatim in the Step 13 report. Babysit does not re-derive the stack shape.
- **`migrations: re-parented <what>` + a non-empty `pushed` → re-request review from everyone who already approved.** Re-parenting creates a new commit. With "dismiss stale approvals" branch protection, that commit silently dismisses every approval and removes the PR from `APPROVED`. Left alone, the green PR remains unmergeable until a human notices. The next early-exit sees `reviewDecision != "APPROVED"` and hides the cause by merely reporting missing approval.
  - Resolve the prior approvers from the Step 4 fetch: `reviews[]` entries with `state == "APPROVED"`, deduped by `user.login`, excluding yourself and bots. None → nothing to do.
  - Re-request them in one call: `gh pr edit <number> --repo <owner/repo> --add-reviewer <login>[,<login>...]`. If `gh` rejects a login, report it and continue with the rest. Causes include removed collaborators or an API refusal to re-request authors. Never let one bad login skip others.
  - Post one comment identifying the mechanical change to make re-approval a glance, not a reread:
    `"Re-parented this branch's migration onto <floor>'s current head (<old> → <new>) after merging <floor> in — no behavior change, no source edits. Re-requesting approval since the new commit dismissed the earlier one(s)."`
    Use the same body-file transport and memory update as every other comment this command posts.
  - **Ping once per re-parent, not once per pass.** Record it in the `## State` block's `reping` marker keyed on the re-parent SHA (the same marker Step 7 uses for fix pings). A later pass re-pings only if it pushed a **further** re-parent; three passes must never produce three notifications for one push.
  - **Only for a re-parent this loop pushed.** `migrations: single-head` means nothing changed and nobody is pinged. `migrations: needs-human` already ended the pass above.
- If the push changed what the PR does, re-check the PR body against the new diff and update it — see the _PR body tracks the branch_ rule.
- Note: the sync creates regular merge commits on the PR branch. The eventual PR-level merge into the base must still be a **squash merge** per repo policy.

6. **Remediate review comments only when a heavy blocker requires it.**
   - **Preserve approval by default.** Set `comment_remediation_required=1` only when the current PR meets at least one condition:

- A completed CI failure.
- A base-branch merge conflict.
- A stale migration head.
- An active non-self `CHANGES_REQUESTED` review.
- `<<SY_PR_REVIEW_CHANGE_THRESHOLD>>` or more unresolved actionable change comments from other reviewers. Before counting, read every unresolved review comment and classify it. Count only distinct comments requesting concrete code, configuration, test, documentation, or other PR changes. Exclude reactions, praise, questions, duplicates, and comments explicitly requiring no change. Also exclude your own comments, resolved/outdated threads, and bot noise without concrete actionable findings. A running build, pending human approval, fewer than `<<SY_PR_REVIEW_CHANGE_THRESHOLD>>` change comments, or a green/approved PR does not activate this gate.
- When `comment_remediation_required=0`, do not fetch, reply to, resolve, dismiss, or re-request review comments, and do not push code merely to address feedback. Keep the existing approval and use the pass only for status polling, required branch/migration blocker handling, or merge readiness.
- When `comment_remediation_required=1`, inspect review comments. Address only comments directly explaining or fixing the active CI failure, merge conflict, migration-head conflict, or requested blocking change. Also address each concrete change requested by comments that triggered the 5-comment threshold. Do not use the trigger as permission to clean up unrelated review feedback; preserve approval everywhere else.
- **Fetch once:** review comments `gh api repos/<owner>/<repo>/pulls/<number>/comments` + issue comments `gh api repos/<owner>/<repo>/issues/<number>/comments`. Track each comment's `user.type` / `user.login` to distinguish bots from humans. Identify bots by `user.type == "Bot"` or known patterns: `*[bot]`, `coderabbitai*`, `copilot*`, `dependabot*`, `sonarcloud*`, `github-actions*`, `renovate*`. This affects a suggestion's weight, not whether you respond.
- **Disposition only the relevant unresolved comments.** Skip comments already resolved, outdated, unrelated to the active blocker, or on stale SHAs. Capture each fix SHA right after it lands: `SHA=$(git rev-parse --short HEAD)`. Bot suggestions remain proposals, not orders; apply only a clear blocker fix in scope, otherwise reply with the concrete reason. Anything that would reshape the PR or is genuinely ambiguous is a **stop-and-ask**.
- **Stop-and-ask remains narrow for active blocker work.** Use it for split requests, repeated stack requests, or changes to the PR's stated scope or public contract. Conflicts / migrations flagged `needs-human` by sync also qualify. Do not broaden this active-blocker pass into general comment cleanup.
- **A comment is dispositioned once, on the pass that first sees it.** Re-verifying the same comment on pass after pass and deferring it again each time is not diligence — it is nine rounds of no-ops. If you read it, you decide it: fix, decline with a reason, or escalate by name. Carry the disposition in the `## State` block so a later pass never re-litigates a settled one.
- **Authorization is not required for an active blocker fix.** Once the remediation gate is active, a relevant comment on the PR is the request; babysit does not wait for separate approval. Outside that gate, preserve approval and do not act on ordinary comments.
- **After each applied fix: reply `Fixed — <one-line summary> (<sha>)` (include the short hash), then resolve the thread.** Line comments → reply via `gh api -X POST repos/<owner>/<repo>/pulls/<number>/comments/<comment-id>/replies --input <tmp-reply-file>`, then resolve with the `resolveReviewThread` GraphQL mutation (`gh api graphql -F threadId='<thread-id>' -f query='mutation($threadId:ID!){ resolveReviewThread(input:{threadId:$threadId}){ thread{ id isResolved } } }'`; get `<thread-id>` from the `reviewThreads(first:100)` query, matched on `comments.nodes[0].databaseId == <comment-id>`). Issue (top-level) comments → `gh pr comment <number> --repo <owner/repo> --body-file <tmp-comment-file>` (no thread to resolve). Write every body to a unique temp file, delete it after the request whether it succeeded or failed, then update memory only when the result matters beyond the thread itself. For a reply-without-fix (declining), post the concrete reason with **no SHA**. **Resolve the thread too when the decline is clear**: the reason is final and asks the reviewer nothing. Final reasons include scope exclusion, contract contradiction, handling elsewhere, or an incorrect suggestion. Leave it open only when the reply poses a question, offers alternatives awaiting the reviewer's pick (split / stack counter-offers), or is a stop-and-ask. Resolve immediately after posting the reply; for fixes, push the fix commit first. Never defer resolutions until pass end or ask the user first. Disagreeing reviewers can unresolve.
- **A request to stack this PR is declined, every time — a review comment does not override the branching policy.** Never comply with requests to stack, regardless of requester or framing. Examples include "Rebase this onto my PR #N", "base this on `<branch>`", and "stack this on top of that one". Any `--base` other than `<default>` also qualifies. **Never run `gh pr edit <n> --base <sibling-branch>`, re-cut from a sibling, or merge a sibling's branch into this one**. Receive landed siblings through `git merge origin/<default>`; direct sibling merges manufacture dependencies. Reply in the thread and leave it open: this is the "explaining why not" path. Explain concrete costs, not policy:
  - A stacked child cannot merge before its parent.
  - Parent commits obscure the child's actual diff.
  - Squash-merging or retargeting underneath the child breaks it. Offer the alternative in the same reply.
- **A request to split is answered with independent slices, never with a stack.** "This is too big, break it up" is a legitimate ask; the _shape_ of the answer is not the reviewer's to choose. Propose independently mergeable slices that each branch from and target `<default>`. **Choose slices so no two touch the same files**, preventing later merge conflicts. Slice vertically, not by layer: schema → API → UI creates stacks because each layer needs the one beneath it to compile. Engineer disjointness using "Make slices disjoint with new files, not with discipline":
  - Give each slice a new spec instead of appending to one shared spec.
  - Append registry entries at EOF instead of sorted insertion.
  - Regenerate lockfiles and snapshots instead of merging.
  - Land a tiny prep PR alone when every slice requires the same shared edit. **Give the slices no shared ancestor PR**. Siblings editing disjoint files need only `git merge origin/<default>` to stay current. A common parent PR creates a stack with every stack failure mode. If no split leaves every piece independently mergeable, say so and keep one PR. One larger standalone PR beats two stacked PRs. That fully answers "split this".
- **Babysit proposes a split; it never performs one.** Cutting branches, moving commits, and opening sibling PRs restructures user-owned work. A split request surviving the reply above therefore triggers **stop-and-ask**. Apply Step 12 terminate-early for human-judgment review comments. Post the proposed slices in the thread, tell the user, and end the pass. Do not open PRs, re-cut branches, or close this PR in favor of slices.
- **Run the Pre-push gate before any push at the end of this step** (Rules section).

7. **Ping anyone who requested changes only after active-blocker fixes — a `CHANGES_REQUESTED` review is a hard block.** A reviewer who requested changes blocks the merge until _they_ re-review, no matter how green CI is or how many threads you resolved; GitHub does not clear that block automatically. So, once Step 6 has addressed and **pushed** fixes for every one of a given reviewer's comments, tell them and ask for a fresh look.
   - **Identify the blockers.** `gh api repos/<owner>/<repo>/pulls/<number>/reviews` → take the **latest** review per `user.login`, keep only those whose latest `state == "CHANGES_REQUESTED"`, dropping yourself (`gh api user --jq .login`) and any bot (`user.type == "Bot"` or a known bot login pattern). If none remain, skip this step entirely.
   - **Re-request the review** for each such login to return it to their queue:
     `gh api -X POST repos/<owner>/<repo>/pulls/<number>/requested_reviewers -f 'reviewers[]=<login>'`
     A 422 "cannot request from the author / already requested" is acceptable; report it and continue.
   - **Post ONE top-level comment @-mentioning all of them together**, after the fixes are pushed. Write it to a unique temporary Markdown file. Post with `gh pr comment <number> --repo <owner/repo> --body-file <tmp-reping-file>`. Capture the result and immediately delete the file, on success or failure. Then update babysit memory with the re-review state. Body (plain prose, never persona-styled — a human reads it):
     `@<login1> @<login2> — I've addressed your review comments (<comma-separated fix SHAs>); the threads are resolved and pushed. Since your review currently requests changes and blocks the merge, could you take another look and re-review when you get a chance? Thanks!`
   - **Net-new only — ping once per set of fixes, not once per pass.** Post it only for reviewers whose threads you actually resolved with a pushed fix _this pass_. Do not re-ping on a later pass unless you pushed further fixes for their comments since the last ping (see the _Every review comment must be net new_ rule). A reviewer you only replied "why not" to — no fix — is **not** pinged; leave their block in place so they can respond. In `pass=single` slot mode, carry a `reping` marker in the `## State` block (which reviewers were pinged at which SHA) so a later round does not re-ping without new fixes.

8. **Add / update tests only for active-blocker changes from Steps 6 and 7:**
   - For every code change introduced while addressing bot comments (Step 6) and human comments (Step 7), check whether existing tests cover the new behavior. If not, **add a new test or extend an existing one**. This is language-agnostic — unit tests, integration tests, snapshot tests, table-driven tests, doctests, whatever the repo uses.
   - Look for gaps: new branches / conditions, new error paths, renamed / relocated APIs, edge cases the comment specifically called out, regression coverage for the bug a reviewer flagged.
   - **Run the downstream audit before pushing any removal or rename of caller-read data.** This includes APIs, endpoints, response fields, events, props, config keys, env vars, exported symbols, and columns. **Never treat a green suite as that audit.** Tests cover only tested callers within their own repositories. They miss other UIs, services, jobs, or scripts reading that name. Silent degradation often turns no check red: read-only UI, disabled controls, blank panels, or permission checks reading `undefined`. Grep every reachable layer for the removed name **as a string** and as a symbol. Include `obj["field"]`, serializer allowlists, GraphQL queries, schema / type / spec files, fixtures, and templates. Then, in the PR body, list each consumer with its verdict (`updated in <link>` / `unaffected because <reason>` / `unreachable — deprecated instead`). When you cannot reach or enumerate consumers, **keep serving the old shape and deprecate it** rather than deleting. Optimization or refactor side-effect removals most often skip this safeguard. Add a test asserting the consumer-visible shape you kept. Full rules: the Risky Changes section of the always-loaded instructions.
   - Place tests in the repo's existing test folder / file convention (e.g. `software/tests/`, `__tests__/`, `tests/`, `*_test.go`, `spec/`, etc.). Don't invent a new test framework — reuse what's already there.
   - If a comment was a pure doc / typo fix with no behavior change, skip — no test needed.
   - Skip if the change is genuinely untestable (e.g. CI YAML, formatting-only). Note it in the final report.
   - Commit the new/updated tests.
   - **After adding tests, verify coverage didn't regress (best-effort, language-agnostic).** Detect the repo's coverage entrypoint in this order — use the first one that exists:
     1. Repo-defined Make targets: `make test_coverage`, `make coverage`, `make cover`.
     2. `package.json` scripts: `npm run coverage`, `npm test -- --coverage`, or a script literally named `coverage` / `test:coverage`.
     3. Python: `pytest --cov` if `.coveragerc` or `pyproject.toml` `[tool.coverage]` is present.
     4. Rust: `cargo llvm-cov` or `cargo tarpaulin` if either is configured.
     5. Go: `go test -cover ./...` (always available where Go is the language).
     6. README / CONTRIBUTING.md / DEV.md mention of a coverage command — honor that one.
   - If a coverage entrypoint is found, run it once. Most repositories with configured thresholds fail their entrypoint on regression. Check `vitest.config`, `.coveragerc`, `pyproject.toml`, `codecov.yml`, and CI config. Report failures in the final report and fix them before pushing.
   - If no coverage entrypoint is found, **skip silently** and note `"no coverage tooling detected"` in the final report. Do NOT block on a missing coverage entrypoint — coverage is best-effort; tests being added at all is the primary gate.
   - **Run the Pre-push gate before any push at the end of this step** (Rules section).

9. **Pull current CI state and pre-emptively fix any visible failures (language-agnostic):**
   - Before running local checks, fetch the latest CI status: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup`.
   - For any check already failing (lint, test, type-check, build, config validation, security scan, custom step — any language), pull the logs: `gh run view <run-id> --repo <owner/repo> --log-failed`.
   - Fix what you can locally: lint / format violations, syntax errors, type errors, broken config (`tsconfig.json`, `pyproject.toml`, `Cargo.toml`, `.golangci.yml`, etc.), simple test failures. Same generic posture as Step 11 — diagnose by category, not by language.
   - If a failure is clearly infra / flaky / approval-gated (network timeout, missing secret, queued runner), note it for the final report and move on.
   - Commit any fixes here so they get re-validated by the local checks in the next step.
   - **Run the Pre-push gate before any push at the end of this step** (Rules section).

10. **Run local checks before pushing any new commit (language-agnostic):**

- Detect project type from repo files and run whatever the repo defines. Order of preference:
  1.  **Use repo-defined entrypoints first:**
  - Makefile: `make validate` / `make test` / `make lint` / `make check`.
  - `just test` or `pre-commit run --all-files`.
  - Scripts in `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`.
  - Commands specified by `README` / `CLAUDE.md` / `CONTRIBUTING.md`.
  2.  **Otherwise fall back to language-native tooling**, e.g.:
      - Node/TS: `npm test` (or `yarn`/`pnpm`), `npx tsc --noEmit`, `npx prettier --check .`, `npx eslint .`
      - Python: `pytest`, `ruff check .`, `ruff format --check .`, `mypy .`
      - Rust: `cargo test`, `cargo fmt --check`, `cargo clippy`
      - Go: `go test ./...`, `gofmt -l .`, `go vet ./...`
      - Shell: `shellcheck`, `shfmt -d`, `bash -n`
      - Config: `tsc --noEmit` for `tsconfig.json`, `yamllint`, `jsonlint`, `cargo check`, etc.
- If any fail, **fix them before pushing** — including lint/format violations, syntax errors, type errors, broken config (`tsconfig.json`, `pyproject.toml`, `Cargo.toml`, etc.), and unit/integration test failures. Re-run until green locally.
- **Self-review your own diff before the pre-push gate — one pass, four lenses.** Read `git diff origin/<base>...HEAD` as another author's work, using `/sy-review-pr` Step 7's lenses:
  - **Correctness & logic:** off-by-one, unhandled boundaries, races, null dereferences, falsy-vs-absent distinctions, and assumptions the code cannot guarantee.
  - **Security & data integrity:** interpolated queries/commands, unvalidated trust-boundary inputs, moved or fail-open permission checks, and credentials reaching logs.
  - **Performance & regressions:** queries in loops, unbounded fetches, increased complexity classes, and work added to hot paths.
  - **Testing:** new paths without tests and regression tests that pass against unfixed code. Linters and type checkers catch none of these, which is exactly why this runs after them and not instead of them.
  - Fix what you find, then re-run the checks above — a self-review fix is a code change like any other.
  - **Anything you find and deliberately do not fix is named in the final report**, with the reason. A known defect pushed silently is worse than one nobody looked for, because the PR now carries an implicit "I read this and it is fine".
  - This is one pass on your own diff, not a review loop, and it never posts anything to the PR.
- **Run the Pre-push gate** (commit-author check + secret scan).
- Commit and push the fixes.

11. **Monitor CI and fix any failure (language-agnostic)** — poll every **15 minutes**, max **10 polls (~2.5 hours)**: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable`.
    - **Track two counters across the loop:**
      - **Global poll counter**, hard-capped at 10.
      - **Per-check fix-attempt counter** — `attempts[<check-name>]`, hard-capped at **2 fix attempts per individual check name**. Same check failing → same fix tried twice with no result usually means more pushes just churn CI. Stop trying that one.
    - On poll 11: STOP and post the **resumable escalation comment** (template below). Exit.
    - If all checks pass: go back to **Step 4 (early-exit)** to confirm green + approved.
    - If checks are still pending: **re-apply Step 3's classification before spending a poll.** A still-running _blocking_ build → keep polling (counts toward the 10-poll cap). If only non-blocking entries remain pending (human gates or checks stalled past 60 min), **stop polling**. Timers cannot resolve them. Exhausting polls creates false `poll-cap` escalation 2.5 hours later. Treat CI as settled, name the gate(s), and go back to **Step 4**.
    - If any check is failing:
      a. Get failing run IDs from `statusCheckRollup`.
      b. Examine logs: `gh run view <run-id> --repo <owner/repo> --log-failed`.
      c. **Unfixable-base checks (do these BEFORE diagnosing as a PR-side bug).** Two situations make a red check something other than a defect in this PR, and both waste the whole attempt budget if you diagnose them as code bugs.
      - **Broken main.** Check whether the same check is also failing on `origin/<default>`'s latest commit: `gh run list --repo <owner/repo> --branch <default> --limit 1 --json conclusion,name,headSha`. If the same check name has `conclusion == "failure"` on the latest default-branch commit, this is broken main — **STOP babysit**. Post the escalation comment (template below) with `Stop reason: broken-main`, tell the user, and exit. Do not retry-fix-retry against an unfixable base.
      - **Wave-blocked.** If `## Blocked on` names a still-open PR, the unmerged dependency causes this failure, not this branch. Editing code here cannot fix it. Step 4's wave check already ends such passes. Reaching this point means the section appeared or changed mid-pass. Re-run that check and end the pass instead of diagnosing. Never spend an attempt-counter slot on a wave-blocked failure.
        d. **Per-check attempt cap.** If `attempts[<check-name>] >= 2`, do NOT try to fix this check again. Mark it `UNFIXABLE_AFTER_2_ATTEMPTS` in state and continue polling other checks. **If ALL currently failing checks are at the cap, STOP** and post the escalation comment with `Stop reason: all-checks-at-attempt-cap`.
        e. Otherwise diagnose failures in every category:
      - Test failures.
      - Lint/format violations.
      - Syntax or type errors.
      - Misconfigured `tsconfig.json` / `pyproject.toml` / `Cargo.toml` / similar files.
      - Missing dependencies.
      - Build errors in any language. Read the relevant code/config, fix it, and re-run the matching local check from Step 10 to confirm. **Run the Pre-push gate** (Rules section). Commit and push. Increment `attempts[<check-name>]`.
        f. **Go back to Step 3** and re-run the full loop in order:
        skip-if-running → early-exit → merge → bot comments → human comments → tests → pre-emptive CI fix → local checks → CI monitor.

    **Escalation comment template (resumable state).** Write the rendered template to a unique temporary Markdown file and post via `gh pr comment <number> --repo <owner/repo> --body-file <tmp-escalation-file>`. Capture the result, delete the file immediately whether it succeeded or failed, then update babysit memory with the escalation and result. Used on: poll-11 cap, all-failing-checks-at-attempt-cap, or broken-main detection.

    ```
    Babysit handing off — PR needs hands-on attention.

    Stop reason: <poll-cap | all-checks-at-attempt-cap | broken-main>
    Passes used: <N> full passes, <M> probes (elapsed <H:MM> of the run budget)
    Watch ticks: <N> (blocked on <what>, or "none — watch never armed")
    Polls used: <N>/10 (in-pass CI polls)
    Per-check fix attempts:
      - <check-name-1>: <attempts> (status: FAILING | UNFIXABLE_AFTER_2_ATTEMPTS | PENDING)
      - <check-name-2>: ...

    Last failing logs:
      - <check-name>: <gh run view URL>

    Commits pushed this session: <comma-separated short SHAs>
    Worktree: <path> (<reused | created-this-run>)
    Recovered from interrupted run: <none | what was recovered>
    Human comments addressed: <N> threads resolved
    Bot comments addressed: <N> fixes applied, <M> declined with reason
    Outstanding human comments: <N> (require judgment)

    To resume: re-invoke `/sy-babysit-pr <PR-URL>`. Counters reset on re-invocation; the prior state above shows what was already tried.
    ```

    Include enough state that a re-invocation OR a human picking up the PR can see exactly what was tried and where the loop gave up.

12. **Loop gate — the run is bounded by a CLOCK, not by a pass count.** One pass only ever sees the PR as it was at that instant; reviewers, bots, and CI post asynchronously. So the loop keeps working for a fixed budget and reacts to what actually changes, instead of spending a fixed number of expensive passes on a PR nobody has touched.
    - **The run budget is `<<SY_PR_RUN_BUDGET_ROUNDS>>` rounds (one round = one keepalive interval).** Record `started_at` on the first pass and `deadline_at = started_at + <<SY_PR_RUN_BUDGET_ROUNDS>> × keepalive`. Everything below runs until that deadline or a terminal state; a stop-and-ask parks the PR but keeps polling. There is no pass quota: a busy PR may take dozens of passes and a quiet one two, and both are correct.
    - **Round 1 is always a full pass.** Sync, automerge gate, comment triage, and CI all happen there, so a run that starts by polling has done no work at all.
    - **Between passes the loop POLLS, it does not sleep out a fixed round.** Every `<<SY_PR_POLL_INTERVAL_SECONDS>>` seconds, run the Step 12a read-only probe. Fingerprint moved → run a full pass immediately, then resume polling. Fingerprint identical → the poll was the whole round; sleep and poll again. A poll is two `gh` calls, so a one-minute cadence is cheaper than a single pass was.
    - **A full pass runs on a keepalive even when nothing moved** — at least every `<<SY_PR_KEEPALIVE_INTERVAL_SECONDS>>` seconds, and always as the last thing before the deadline. The digest is a proxy, not a proof; the keepalive catches what it cannot see, and the final pass stops a run from ending on an unverified probe.
    - **Inbound work never interrupts a pass in flight.** A probe firing during a full pass does not cancel it. Set `dirty_after_pass = 1`. Finish at a safe point: commit edits, run the targeted check, and leave nothing half-applied. Start the next pass **immediately**, without sleep. Several probes collapse into one follow-up pass, so a reviewer posting six comments costs one pass, not six. Debounce a burst by one poll interval rather than firing per comment.
    - **Your own writes are not inbound work.** Exclude comments, reactions, pushes, and status updates this run produced from the change decision, or the loop re-triggers itself forever.
    - **The sleep is a real blocking command, not a note in the report.** Run `sleep <<SY_PR_POLL_INTERVAL_SECONDS>>` in the shell — one foreground, self-terminating command — and let the turn block on it. Never substitute a shorter sleep and never claim elapsed time you did not wait out; if the harness kills the command early, re-issue it for the remainder.
    - **Never end the run because the harness has no detached timer.** None of these conditions is terminal:

- "No background job outlives the turn".
- "No wall clock has elapsed".
- "Two probes were byte-identical".
- "The PR is quiescent, re-invoke me later".
  Use poll sleep for these conditions. Nothing-changed is the expected result of most polls. Never close a turn by asking whether to continue; the answer is yes until the deadline or `MERGED` / `CLOSED`.
  - **Terminate early ONLY on:** `state == "MERGED"` / `"CLOSED"` (report it and stop; no release is triggered), broken-main escalation, all-checks-at-attempt-cap escalation, poll-cap escalation, or the unreachable-service stop below. Everything else loops — **including a stop-and-ask.**
  - **A stop-and-ask parks the PR; it does not end the run.** Save Step 2b's `needs_user` block in babysit memory and print it for the operator. Never prompt or mark GitHub. Continue sleeping and polling until the deadline, like any round. While parked, never act on the blocked decision itself. Re-run Step 2b revalidation for every fingerprint change and keepalive. User answers, reviewer withdrawals, pushes, or approvals may clear it. `cleared` → resume normal passes in the same run, naming the comment that cleared it. Still `current` → reprint nothing new, sleep again. The final report repeats the outstanding question. Rationale: the answer usually arrives on GitHub while the run is asleep, and a run that exits on the question can never see it.
  - **Stop when GitHub or the model service is unreachable, and only after retrying.** One flaky call is not an outage: retry up to `<<SY_PR_RETRY_MAX_FAILURES>>` consecutive times, sleeping `<<SY_PR_RETRY_INTERVAL_SECONDS>>` seconds between attempts. If every attempt fails, stop and report `"GitHub or model service unreachable — stopping with resumable state"`. Never name a local network cause you cannot verify. A single failure that recovers on retry resets the counter and the loop continues.
  - **Write resumable state to babysit memory on every stop, regardless of reason**. Include `started_at`, `deadline_at`, `last_full_pass_at`, `last_poll_at`, the last fingerprint, `dirty_after_pass`, and the `## State` block below. That is what lets a fresh invocation pick up instead of restarting from zero, and it is the only reason an interrupted run is not lost work.
  - The poll interval is between rounds and is independent of Step 11's in-pass CI polling — they nest, they don't replace each other.
  - **`pass=single` — one pass, no clock.** For `pass=single`, run exactly one pass **inline in the calling job; never dispatch a background agent**. See _A pass that runs inside a job runs in that job_. Report and return without sleeping or re-entering Step 3. This lets a **slot driver** holding several PRs own cadence (`/sy-babysit-prs` Step 4). Under the same run budget, it polls and calls each PR when its state changes. The budget is not waived — it moves up to the caller, which is responsible for honoring it. An agent never adds `pass=single` on its own initiative: a human asking "babysit this PR" gets the full budgeted run. If a human types it explicitly, honor it.

    **Argument grammar.** Trailing `key=value` tokens are parameters, the bare token is the PR ref — the same shape Step 5c already uses when delegating (`/sy-sync-pr-branch <PR-URL> workspace=$WT server-side=never report=structured`). Slot mode uses two: `pass=single` and `round=<n>`, plus optional `last=true` on the pass the driver knows is final. All are single whitespace-free tokens. **`pass=single` with no `round=` means `round=1` and `last=true`** — one round, and it is the last one, so cleanup runs normally. This serves humans typing `pass=single` manually. It also defines `completed_round` and the cleanup gate below without requiring a slot-driver-only argument. Unrecognized `key=value` tokens are reported and ignored, never treated as a PR ref.

    **State handoff — the caller is the memory.** Fresh invocations lack prior memory. Resetting `loop_count`, `attempts[<check-name>]`, poll counts, and Step 2c automerge actions each round defeats their caps. A 2-attempt check would retry forever. The command could revoke `--auto` it never enabled. So `pass=single` **returns a state block and accepts it back**:
    - End every `pass=single` report with a `## State` block. **Pass it as a block inside the job's prompt, never as a `state=` argument token**. Whitespace-splitting argument grammar cannot carry multiline blocks. Single-token encoding invents a useless quoting scheme. The caller pastes the previous round's block into the next round's prompt under a `## Prior state` heading; no prior-state block present means round 1, and say so rather than guessing.
    - Preserve these fields:
- `completed_round`: fully finished rounds, distinct from the current `round=`. Resume a round interrupted by job death; never skip it.
- `attempts` per check name, `polls` used, and any `UNFIXABLE_AFTER_2_ATTEMPTS` marks.
- `reping`: reviewers pinged and their SHAs. Include change-requesting reviewers after fixes (Step 7) and prior approvers after migration re-parenting (Step 5d). Later rounds must not re-ping without new work.
- `migration_head`: the last checked floor head parenting this branch's migration and whether this loop re-parented it. Without this, rounds repeat probes and mistake pushed re-parents for new drift.
- **Step 12a probe fields:** `started_at`, `deadline_at`, `last_full_pass_at`, `last_poll_at`, `watch_fingerprint`, `probe_count`, `consecutive_noops`, `dirty_after_pass`, `externally_blocked`. Without them, jobs re-derive clocks every round and turn cheap polls into full passes.
- **Step 2b `needs_user` fields:** `needs_user`, `needs_user_reason`, `needs_user_message`, `needs_user_source`, `needs_user_source_id`, `needs_user_source_updated_at`, `needs_user_head_sha`, `needs_user_validation`, `needs_user_next_step`. Only this record survives closed sessions; the next run revalidates it instead of restating it.
- The two ownership records below.
  - **`automerge_decision` is an enum, not a boolean.** Do not act on `false`; it conflates five outcomes requiring different follow-ups:
- `enabled_by_me`: the only value permitting this command to revoke automerge.
- `deferred_companion`: a companion remains open. **Re-check every round**; the last companion landing clears the block immediately.
- `ineligible`: not a standalone prose-only diff. This decision is settled; never reconsider.
- `failed`: `--auto` errored; do not retry.
- `pre_existing`: the user enabled it; never touch it. Store the value, not a bit.
  - **`workspace` records path _and_ kind** — `worktree` or `clone` — plus whether this run created it. Their teardowns differ: `git worktree remove "$WT"` vs `rm -rf "$WT"`. A bare "I made it" boolean cannot choose correctly. Using `rm -rf` on a real worktree leaves stale admin records.
  - **Checkpoint immediately after any ownership-changing action, not only at end of pass.** Automerge, workspace creation, and pushed fixes outlive the job. Job death between enabling automerge and reporting can hide its revocable ownership. Report those the moment they happen so the slot's ledger has them.
  - If the slot dies and loses the block, use the PR's **resumable escalation comment** as the durable backstop. Escalation paths alone post it. It contains only counters, neither ownership record. It recovers a stalled loop, not ownership; that is why the ledger holds the block.
  - **Cleanup waits for the last round.** `last=true` tells you whether this is it. Perform Step 5a teardown only if the caller marked this round last or the PR reached terminal state. Earlier rounds must preserve the workspace exactly for reuse.

  **In slot mode the CI monitor observes and yields — it does not hold the lane.** Step 11's 10-poll / 2.5-hour budget assumes the job owns its own time. Under `pass=single`, it does not. Polling delays other PRs in the lane. Three poll-capped passes delay the slot's third PR five hours, recreating the head-of-line starvation this design removes. With `pass=single`, take **at most one** CI observation and at most one fix attempt per pass, then return. Carry poll counts in `## State`. Let the next slot round observe again. The caps still apply across rounds, they just accrue in the handed-back state instead of inside one long pass. A slot holding exactly one PR may poll normally — nothing is waiting behind it.

12a. **The read-only state probe — what a poll actually costs, and what counts as a change.** Between passes the loop is a cheap probe, not an agent: two `gh` calls, no worktree, no diff, no writes. This is what makes a one-minute cadence affordable, and it is what fires a full pass the instant a human, a bot, or CI moves the PR. **This is the canonical definition — `/sy-review-pr`, `/sy-babysit-prs`, and `/sy-review-prs` reference it rather than restating it.**

    - **A probe is read-only and capped at two `gh` calls for the PR**, plus one `gh pr view <link> --json state --jq .state` per named blocker (wave PR, companion, stacked parent). No worktree, no `gh pr diff`, no comment bodies, no clone, no sub-agent — and nothing that writes: a probe never pushes, posts, reacts, merges, or touches automerge.
    - **Classify a PR as `externally blocked` only when the pass leaves no work behind while waiting externally**, in one of these cases:

- (a) Step 3 ended the pass on a blocking build.
- (b) Step 4 wave-blocked on an open `## Blocked on` PR.
- (c) Step 4 found green + approved with `autoMergeRequest == null`, awaiting a human click.
- (d) Step 4 found a stack with an open parent.
- (e) Step 2c deferred prose-only automerge for open companions.
- (f) Only a pending human review gate classified non-blocking in Step 3 holds the merge. Steps 5–11 found nothing actionable.
- (g) Only a parked Step 2b `needs_user` question remains, already printed for the operator. Nothing else counts. The label never changes polling cadence; poll every PR the same way. Fan-out uses it to release this PR's worker slot (`/sy-babysit-prs` Step 4b).
  - **Never classify a PR as externally blocked while anything remains actionable:**
- An undispositioned comment.
- A failing check below its attempt cap.
- `mergeable != "MERGEABLE"`.
- A stale migration head.
- Unpushed commits or a dirty workspace.
- A stop-and-ask not yet saved to memory and printed. Being unsure means not applying the label.
  - **The fingerprint — two commands, compared as strings:**

    ```bash
    gh pr view <number> --repo <owner/repo> --json state,isDraft,title,reviewDecision,mergeable,mergeStateStatus,headRefOid,autoMergeRequest,baseRefName,updatedAt,statusCheckRollup,comments,reviews \
      --jq '[.state,(.isDraft|tostring),(.reviewDecision//"none"),.mergeable,.mergeStateStatus,.headRefOid[0:7],(if .autoMergeRequest then "auto" else "noauto" end),.baseRefName,.updatedAt,((.statusCheckRollup//[])|map((.name//.context)+"="+((.conclusion//.state//.status)//"?"))|sort|join(",")),((.comments//[])|length|tostring),((.reviews//[])|length|tostring)]|join("|")'

    gh api "repos/<owner>/<repo>/pulls/<number>/comments?per_page=1&sort=updated&direction=desc" \
      --jq 'if length == 0 then "none" else "\(.[0].id):\(.[0].updated_at)" end'
    ```

    `--jq` reduces locally, so the probe costs two short lines of output however large the PR is. The second call catches line comments: **`comments` contains only issue comments**. Watched PRs most often gain new review threads. Sorting by `updated` and taking one row makes it pagination-proof: a PR with 200 line comments still answers in one row, and an edited comment sorts back to the top. `gh pr view` has no `reviewThreads` field — do not look for one.

  - **Fingerprint changed → run a FULL pass immediately, in this same round.** Reset `consecutive_noops` to 0 and name the field that flipped (`probe: rollup changed — unit-tests SUCCESS→FAILURE — running a full pass`). A probe never judges a change uninteresting; judging is the pass's job.
  - **Fingerprint identical → the probe IS the round.** Report one line — `probe <N> — no change (<blocker>) · next check <ETA> · <HH:MM> left`, sleep `<<SY_PR_POLL_INTERVAL_SECONDS>>` seconds, and probe again.
  - **Probes never quietly replace passes.** Always run full passes on round 1 and the **last** round before deadline. Also run full passes at least every `<<SY_PR_KEEPALIVE_INTERVAL_SECONDS>>` seconds, even without changes. The fingerprint is a cheap proxy, not a proof.
  - **Report every probe — a silent probe is indistinguishable from a dropped round.** The probe line prints per round, and Step 13 carries `<N> passes, <M> probes over <elapsed> of <budget>`.
  - **State fields.** Carry `started_at`, `deadline_at`, `last_full_pass_at`, `last_poll_at`, `watch_fingerprint` (both digest strings, verbatim), `probe_count`, `consecutive_noops`, `dirty_after_pass`, and `externally_blocked` in the `## State` block beside the other counters. Without them a `pass=single` job re-derives its whole clock every round.
  - **Under `pass=single`, the caller owns the probe**. The per-PR job returns its fingerprint in the state block after its pass. The slot driver owns sleep and comparison. An entirely externally blocked slot costs a handful of `gh` calls per round and holds no worker (`/sy-babysit-prs` Step 4b).

13. **Final report:** Include each item below.

- Workspace setup: worktree path, reused/created status, recovery from interrupted runs, and cleanup status.
- Step 2c automerge decision:
  - `enabled — standalone prose-only`
  - `deferred — prose-only, <n> companion PR(s) open: <links>`
  - `enabled on pass <N> — last companion landed`
  - `left off — <what the diff touches>`
  - `skipped — <draft | WIP | not yours | already enabled>`
  - `revoked — no longer prose-only`
  - `revoked — companion PR opened: <link>`
- Passes: `<N> passes, <M> probes over <elapsed> of <budget>`. Name what the probes awaited, per Step 12a.
- **Quote `/sy-sync-pr-branch`'s sync result block verbatim**. Preserve its `stack` / `floor` / `sources` / `migrations` / `pushed` / `flags` lines; never re-derive or paraphrase them.
- **Name every check Step 3 classified non-blocking and stepped over**. Use `pending human gate: <names>` / `stalled check treated as non-blocking: <names>`. These still block merging; never call the PR green while one remains open.
- Comments addressed, both bot and human.
- **Per-author dispositions that add up**: `human: <n> total — <f> fixed, <d> declined-with-reason, <e> escalated (<which stop-and-ask case>)`. Use the same format for bots. The three counts must sum to the total. Report any remainder as unaddressed with a reason; never round it into "addressed".
- **Change-requesting reviewers pinged for re-review**: `re-review requested from @<reviewer> (<fix SHAs>)`. The reviewer must clear their `CHANGES_REQUESTED` block.
- **Migration-head state**:
  - `migration head current (<head>)`
  - `re-parented <old> → <new>, re-approval re-requested from @<a>, @<b>`
  - `no migrations in diff`
    Never call a migration PR green without naming its head.
- **Stack or split requests declined in Step 7**: `declined stack request from @<reviewer>: <link>` / `proposed <n> independent slices, stopped for human`. A hidden decline is not a stance.
- Tests added / updated.
- Coverage tooling detected, or `"no coverage tooling detected"`.
- Pre-emptive CI fixes and local checks run.
- **Step 10 self-review result**: `self-review: 1 correctness fix, 1 perf finding left — <reason>` / `self-review: clean`. Name every unfixed finding; never omit it.
- CI fixes applied, per-check fix-attempt counts, and merge outcome. **No release is triggered — `/sy-release` stays a manual user action.** **Wave state, for PRs with `## Blocked on`:** name every blocking PR and state. Report whether the pass skipped as wave-blocked or promoted the PR. For promotions, report prefix removal or explain its retention.

After producing the report, rewrite babysit memory as the last verified snapshot. Keep only meaningful fixes, pushed SHAs, sync/migration decisions, and CI root causes not obvious from PR comments in `## Progress`. Put unresolved ownership or `None` in `## Open Items`. Preserve exact resume fields in `## State`. Record latest verified status, head SHA, validation, and remaining owner in `## Final Snapshot`. Omit unchanged polls, routine commands, raw logs, and self-explanatory thread text.

## Rules

- **A fix that removes or renames something owes a downstream audit, and local green never discharges it (Step 8).** Review fixes routinely delete fields, trim payloads, or rename keys. UI and other-service consumers silently degrade instead of failing. This repository's local suites and CI cannot see those consumers. Audit the consumers, record them in the PR body, and deprecate instead of deleting when the search is inconclusive.

- **After Step 2c's automerge gate, Step 3 is the first check that may touch the PR**. Step 3 skips running builds. **Steps 2a/2b only read and persist local memory.** The automerge gate queues an instruction rather than acting (`--auto` waits for the same CI). A **running build** ends the pass: never merge, comment, or push while a job is executing. A **pending human review gate is not a build**. App-reported approval / sign-off / changes-resolution checks intentionally stay `IN_PROGRESS` until a human clicks. Calling this "CI is running" wastes every pass and leaves changes unaddressed. Only self-resolving checks end the pass; human gates, and anything pending past 60 minutes, are named in the report and stepped over. Ending a pass ends the **pass**, not the babysit — fall through to the Step 12 loop gate, resume polling, and re-enter at Step 3 when the probe moves.
- Run the loop in this order:
  - Step 2a: memory/context.
  - Step 2b: prior stop revalidation.
  - Step 2c: prose-only automerge gate on the first pass. Re-check the deferred-companion branch every pass.
  - Step 3: skip-if-running.
  - Step 4: early-exit, or wait-for-merge when automerge is already on.
  - Step 5: worktree setup and delegated `/sy-sync-pr-branch`. This covers ancestor chain, chain merge, conflicts, migration head, pre-push gate, and push.
  - Step 6: bot comments.
  - Step 7: human comments.
  - Step 8: add/update tests and best-effort coverage check.
  - Step 9: pre-emptive CI fix.
  - Step 10: local checks.
  - Step 11: CI monitor. On failure, return to Step 3.
  - Step 12: loop gate for run budget and cheap polling.
    Use Step 12a's read-only probe between passes. On `state == "MERGED"`: report the merge SHA and stop. **Do NOT trigger a release — `/sy-release` stays manual.**
- **The run is bounded by a clock, not a pass count (Step 12).** A single pass is never "done" unless the PR merged or babysit escalated. Run for `<<SY_PR_RUN_BUDGET_ROUNDS>>` rounds; each round equals one keepalive interval. Probe every `<<SY_PR_POLL_INTERVAL_SECONDS>>` seconds. Run full passes on probe changes, at least every `<<SY_PR_KEEPALIVE_INTERVAL_SECONDS>>` seconds, and once finally before deadline. In-pass CI polling (Step 11) nests inside a pass — it does not count as a round. The budget is waived only by `pass=single` (Step 12), which does not shorten it but **moves it to the caller**: a slot driver holding several PRs owns the clock itself.
- **A round with nothing to do costs two read-only `gh` calls, never a full pass (Step 12a).** Between passes the loop is a probe: any change in that fingerprint fires the real pass on the spot, and no change means the probe was the round. Never let probes write to GitHub or count your writes as inbound changes. Always run full passes on round 1, keepalive, and immediately before deadline. The digest is a proxy, not proof. This is the canonical definition; the other Sy PR commands reference it.
- **A stop-and-ask is surfaced, never prompted (Step 2b).** It pauses the PR for the operator, not on GitHub. Save `needs_user` in babysit memory and print it. Include the reason, exact message, source, and next step. No interactive question, no blocking wait, no label / status / review / comment posted to record it — the PR stays as mergeable to everyone else as it was.
- **A `needs_user` claim from a previous run is revalidated before it is shown again (Step 2b).** Re-fetch the source by id, read everything posted since, and resolve to `current` / `cleared` / `changed` / `conflicted` / `stale_unknown`. Print the prior claim beside the verdict and the evidence, always with a `Next:` line; a cleared claim names the comment that cleared it and the PR resumes normally.
- **Inbound work never interrupts a pass in flight (Step 12).** A comment, review, or push landing mid-pass sets `dirty_after_pass`; the current pass finishes to its safe point and the next one starts immediately with no sleep. Several events collapse into one follow-up pass, so a reviewer posting six comments costs one pass, not six.
- **An unreachable GitHub or model service ends the run, but only after `<<SY_PR_RETRY_MAX_FAILURES>>` consecutive failed retries `<<SY_PR_RETRY_INTERVAL_SECONDS>>` seconds apart (Step 12).** One flaky call is not an outage. On the real stop, report `"GitHub or model service unreachable — stopping with resumable state"` and write the state block to babysit memory; never name a local network cause you cannot verify.
- **ALWAYS work in a git worktree — never the user's primary checkout** (see Never do PR-branch work in the primary checkout). One rigid path: **`$HOME/.worktrees/<owner>/<repo>/<sanitized-branch>`** (see One rigid worktree path). Step 5a never hand-rolls that path or `git worktree add` — `WT="$(worktree_create "$BR")"` does the resolution order itself, and it never returns the primary checkout. When cwd is not the target repo, clone outside the worktree container, then run `worktree_create` inside that clone. Never `git checkout` / `git switch` / `gh pr checkout` in the user's main checkout. Clean up only what this run created; a reused worktree at a non-canonical path is the user's — leave it. The worktree persists across all 10+ passes.
- **Always assume the last run was interrupted; resume its work, never discard it (Step 5a).** Termination mid-run is the normal case here — the loop sleeps between probes and polls CI inside a pass. Before merging anything, recover reused-worktree state in order:
  - In-progress merge: `MERGE_HEAD` → finish resolution and `git commit --no-edit`.
  - Uncommitted / staged edits: finish and commit at the canonical path. At **non-canonical** paths, these belong to the user; stop and ask.
  - Untracked files.
  - Unpushed local commits: `origin/<branch>..HEAD` → push through Step 5i's pre-push gate. Ban both work-loss paths:
  - `git worktree add -B` on branches holding unpushed commits: it hard-resets.
  - `stash` / `reset` / `checkout --` to "clean up" dirty worktrees. Step 5a uses `worktree_create` to avoid both. It checks unpushed commits before choosing `-B`. It prunes orphan records first, preventing deleted folders from breaking `git worktree add`.
- **⚠️ NEVER REBASE.** Always use `git merge` to sync branches. Never use `git pull --rebase`, `git rebase`, `gh pr update-branch --rebase`, or interactive rebase on a PR branch. Rebasing rewrites pushed history and forces `--force-with-lease` on next push. Always merge.
- **Babysit never implements branch syncing — it delegates to `/sy-sync-pr-branch` (Step 5c).** The ancestor-chain walk, the merge order, the conflict resolver, the migration-head check, and the pre-push gate all live there, once, for every Sy command. Never hand-roll a `git merge origin/<base>` in this loop, never re-derive the stack shape, and never copy the sync algorithm back in here. Babysit's own contribution is the workspace (Step 5a–5b, reused across all passes) and reading the result block.
- **Delegated sync guarantees every pass:**
  - Resolve the chain fresh; parents can push, merge, or retarget mid-run.
  - Merge the floor first, then every ancestor root-most → immediate parent, one merge per source.
  - Resolve conflicts between sources.
  - Merge downhill only. Never push ancestor branches or merge/retarget ancestor PRs to unblock this PR. Cross-stack ordering falls out of the polling loop — a parent that pushes after this pass read it is picked up on the next probe. Never wait on, message, or poll a sibling job.
- **Read the sync result block before continuing (Step 5d).** `flags: stopped-for-human` or `migrations: needs-human` means the branch is NOT synced: end the pass there rather than running Steps 6–11 on a half-merged tree. `orphaned-base` / `retargeted` flags and the `stack` / `floor` / `sources` / `migrations` / `pushed` lines are quoted verbatim in the Step 13 report.
- **A stacked PR that is green + approved is still not yours to merge (Step 4).** Its base is another open PR, so merging would land the work into the parent's branch. Report the blocking parent link and leave automerge alone. End the pass and continue looping. Later passes catch the parent's merge and GitHub's automatic retarget.
- **No reviewer can authorize a stack (Step 6).** Read these canonical global-instruction rules there:
  - "Every PR branches off the default branch".
  - "Split by slice, never by layer".
  - "Overlap is resolved by ordering, never by stacking".
    Do not restate, re-derive, or renegotiate them here. Babysit only enforces this boundary in the review thread. Decline retargeting and propose independently mergeable slices against `<default>` with **no shared ancestor PR**. Stop-and-ask rather than restructuring. Prevent stacks while _describing_ the split. Do not wait for two branches to diverge on shared files and create real conflicts. Step 4 and delegated ancestor-chain sync maintain **already-stacked** PRs. Neither permits creating stacks. Never interpret "the tooling supports stacks" as "stacking is fine".
- **A green + approved migration PR is not done until its head is current (Step 4).** Run the migration-head override every pass before early-exit. Ready signals can hide a default-breaking merge. Sibling revisions use separate files, leaving `mergeable` at `MERGEABLE`. This branch's CI never tested the head that landed while it waited. PRs with `--auto` merge unattended. Re-check the head on **every poll cycle** of Step 4's wait, not merely on entry. Babysit implements neither checking nor fixing. `/sy-sync-pr-branch` Step 7 owns detection and re-parenting. The override only prevents early-exit so sync runs. Never resolve drift by rebasing, and never `alembic merge` when re-parenting is available.
- **A re-parent dismisses approvals, so babysit re-requests them (Step 5d).** `migrations: re-parented` plus a push means every prior approval was silently dropped by branch protection and the PR left `APPROVED` with nobody told. Re-request each prior approver by login and post one comment saying the change was mechanical (`<old> → <new>`, no source edits). Once per re-parent SHA, tracked in `reping` — three passes never send three pings for one push.
- **A wave-blocked PR is a documented skip, never a build to fix (Step 4).** A later-wave branch lacks its required migration or field, producing expected red CI, not a defect. See _Hard dependencies phase into waves, never into a stack_. Skip while `## Blocked on` PRs remain open and re-check every pass. Never rebase onto the blocking PR to resolve a wave block. That creates a forbidden stack.
- **A merged blocker is an event this command acts on, not one it reports (Step 4a).** GitHub preserves `WIP: DO NOT MERGE — `, `## Blocked on`, and draft state after the preceding wave lands. Without promotion, a green wave-2 PR remains permanently unmergeable. Promote every pass, even after Step 4 early-exit. Follow this fixed order:
  sync → CI green → `gh pr ready` → drop prefix → rewrite body → re-run Step 2c's automerge gate once. It is idempotent, it promotes **per reason** (a WIP kept alive by an open `TODO —` marker keeps its prefix), and it is reported action by action.
- **Pre-push gate runs before every `git push` in this command — no exceptions.** Two checks, both blocking:
  1. **Commit-author identity check.** Compare each pending commit's `author.email` and `author.name` to local config (`.gitconfig`): `git log @{u}..HEAD --format='%H %ae %an'` vs `git config --get user.email` / `user.name`. On mismatch, flag the SHA(s) + identities side-by-side and ask the user whether to proceed with the existing author. **Default = "no"** → run `git commit --amend --reset-author --no-edit` (single commit) or `git rebase <base> --exec 'git commit --amend --reset-author --no-edit'` (multiple). **Preserve `Co-Authored-By:` trailers** — `--reset-author` only touches the author field; trailers in the message body survive. Only push without `--reset-author` on explicit user "yes".
  2. **Secret scan.** Scan all unpushed changes — `git log @{u}..HEAD -p` plus `git diff --cached` (if anything staged). Check for:
     - **Filename allowlist** — flag staged paths matching any category:
  - `.env*`, except `.example` / `.sample` / `.template`.
  - `**/credential*`, `**/secret*`, `**/*.pem`.
  - `**/*.key`, except `.pub.key`.
  - `**/*.p12` / `.pfx` / `.keystore`.
  - SSH keys: `id_rsa*` / `id_ed25519*` / `id_ecdsa*` / `id_dsa*`.
  - `*.kdbx`, `service-account*.json`, `gha-creds-*.json`.
  - `.npmrc` / `.pypirc` / `.netrc` containing auth lines.
  - `.aws/credentials`, `.kube/config`, `.docker/config.json`, `terraform.tfstate*`.
    - **Content patterns** — check each category:
  - AWS: `AKIA|ASIA[0-9A-Z]{16}`, `aws_secret_access_key\s*=`.
  - GitHub: `gh[pous]_[A-Za-z0-9]{36,}`, `github_pat_`.
  - Anthropic/OpenAI: `sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}`.
  - Slack: `xox[abprs]-`.
  - Google: `AIza[0-9A-Za-z_-]{35}`.
  - Private keys: `-----BEGIN .* PRIVATE KEY-----`.
  - JWTs: `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`.
  - Assignments: `(password|api[_-]?key|token|secret)\s*=\s*["'][^"']{6,}`.
    Skip placeholders: `<...>` / `xxx` / `***` / `example`.
    - On hit: redact the value (e.g. `AKIA****REDACTED****`), show path + line + matched pattern, ask the user. **Default = "no"** → STOP, do not push, tell the user to remove the commit (`git reset HEAD~N` or rebase) and re-stage clean. Proceed only on explicit "yes" + user confirms false positive.
- Never skip local checks before pushing — it wastes CI cycles.
- **Bot comments follow Step 6.** Fix verified, in-scope defects regardless of author; decline unsupported redesigns with a concrete reason, and escalate only the enumerated stop-and-ask cases. Non-trivial does not mean skippable.
- **Every behavior-changing fix from Step 6 or 7 needs test coverage in Step 8.** Doc/typo/format-only changes are exempt. Coverage verification at the end of Step 8 is best-effort and language-agnostic — skip silently if no entrypoint is detected; do NOT block.
- Fix CI failures of every kind (tests, lint, type-check, build, config) regardless of language — do not assume JS/Node.
- **Broken-main detection runs before every fix attempt.** If the same check is failing on `origin/<default>`'s latest commit, the PR can't go green until default is fixed — stop, post the escalation comment, flag the user.
- Poll CI every 15 minutes; do not spam `gh` calls. Each wake runs the full loop (comments + CI) in one pass. Hard cap at 10 polls (~2.5 hours) — escalate via the resumable escalation comment after that.
- **Per-check fix-attempt cap = 2.** A single CI check failing twice with no result usually means the fix path needs human judgment. Don't churn CI with a third attempt — mark it `UNFIXABLE_AFTER_2_ATTEMPTS` and surface in the escalation comment.
- **After every applied fix: reply `Fixed — <one-liner> (<short-sha>)` and resolve the thread** (mechanics in Step 6). Clear decline → post the reason (no SHA) and resolve the thread too; leave open only when the reply asks the reviewer something or awaits their pick. Never ask the user before resolving a fixed or clearly-declined thread.
- **Human comments are auto-fixed, exactly like bot comments (Step 6).** Never use "surface it to the user and move on" as a disposition. That creates nine rounds of verified-but-untouched feedback despite clean-pass claims. Every comment leaves the pass fixed-and-replied, declined-with-a-reason, or escalated under one of the four enumerated stop-and-ask cases, and the Step 13 counts must sum to the number of open comments.
- **A `CHANGES_REQUESTED` review is a hard block that only the reviewer clears — ping them once you've addressed it (Step 6).** Resolving threads and going green does not lift a requested-changes review; GitHub keeps the merge blocked until that reviewer re-reviews. After pushing fixes for all of a blocker's comments this pass, re-request their review. Post ONE top-level @-mention comment confirming those fixes with SHAs and requesting re-review. Net-new only: ping a reviewer once per set of fixes, never once per pass, and never ping someone you only replied "why not" to. The comment body is human-facing prose — never persona-styled.
- **Release dispatch is NEVER automatic.** Releases are expensive and stay a manual `/sy-release` the user invokes deliberately. When babysit observes `state == "MERGED"`, report the merge and stop — do not dispatch a release, and do not offer to.
- **A merged PR is reaped, not left to rot (Step 4).** Terminal `MERGED` stops babysit before Step 5 teardown. Clean the dead branch and worktree immediately:
  - Run `git clean-worktree`: remove merged/gone-branch worktrees, skipping dirty worktrees and detached HEADs.
  - Then run `git clean-stale-branches`: delete local branches whose upstream became `[gone]` on squash-merge. Remove a skipped detached-HEAD worktree with `git worktree remove <path>` only after confirming it is clean. **Never `--force` past a dirty tree or delete babysit memory**. Unpushed commits or uncommitted work did not enter the merged PR. Report the path and preserve it for the human; see _A merged PR gets cleaned up_.
- **Never enable automerge on babysit's own behalf — with one carve-out: a STANDALONE prose-only diff (Step 2c).** For docs/comments/docstrings/whitespace only, **with no open companion PR**, run `gh pr merge <n> --squash --auto` on the first pass before checking CI. Report this action. CI and required approvals still gate merging. Any executable line in the diff and automerge stays off until the user says otherwise. **Defer, never enable**, prose-only PRs belonging to a set. Sets include batch siblings, shared `<username>/<group-slug>/` branch prefixes across repositories, explicit references to other open PRs, or stacked bases. Re-check each pass. Flip `--auto` only after the last companion merges/closes, so docs never precede their code. If babysit's own later commits make the PR non-prose-only, it runs `--disable-auto` and hands the merge back. Automerge the user or `/sy-create-pr` enabled is never touched — babysit observes it and waits (Step 4).
- **Migration head stays single — checked and fixed inside the delegated sync** (`/sy-sync-pr-branch` Step 7). Check once after merging the whole chain. Require exactly one head descending from the floor. Re-parent instead of creating merge revisions; never re-parent ancestor PR migrations. `/sy-review-pr` warns about cross-PR migration conflicts; the sync fixes them. Babysit only reports the `migrations:` line it gets back.
