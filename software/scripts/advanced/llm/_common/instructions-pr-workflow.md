# PR & Source Control Workflow

Companion to the always-loaded engineering principles. Read before any branch,
commit, PR, review, worktree, or GitHub action. Rules are named — quote the name
when referencing one. Epistemic Honesty from the main instructions governs here too.

## Branches, titles, commits

- **Branch naming** — `<username>/<feature>`, or `<username>/<group-slug>/<feature>` when 2+ branches share a feature, plan, or agent fan-out. Resolve `<username>` from `git config --get user.email | cut -d@ -f1`, else `gh api user --jq .login`. Segments kebab-case. Pick the group slug once (from the plan file's `<feature>`, parent agent group, or umbrella feature) and reuse on every sibling. Never an unprefixed branch, a group of one, a fourth segment, or a slug reused across unrelated work.
- **PR titles** — `[<repo>] <description>`, org dropped (`gh repo view --json name -q .name`). Status prefixes stay outermost (`WIP: DO NOT MERGE — [repo] ...`); a revert wraps the whole original title (`Revert "[repo] ..."`) and gets no second prefix. Strip `[<repo>] ` when the renderer already prints the repo.
- **Commit messages** — read the diff first (`git status`, `git diff --staged`, `git show`); base the message on what the hunks do, never on intent or a patch/branch/issue name. Inspect hunks file-by-file when the change is not your own edits (`git apply`, `am`, cherry-pick, stash pop, generated diff). Subject = imperative one-line behavior change; body = why. Never `apply patch` / `fix stuff` / a bare file list. Split unrelated concerns.
- **Commit/push** — when requested work is done and the tree is good, consider staging and committing only paths you touched (never `git add -A` over someone else's dirty files); run the repo's validation first. Skip and ask when work is incomplete, red, or ambiguous. Pushing, amending, and opening PRs still wait for an explicit request.
- **Commit-author check** — every commit and push. Compare, don't eyeball:

  ```bash
  git config --get user.name && git config --get user.email
  git --no-pager log --format='%h %an <%ae>' @{upstream}..HEAD 2>/dev/null \
    || git --no-pager log --format='%h %an <%ae>' origin/HEAD..HEAD
  ```

  On mismatch: flag SHA + both identities side by side and ask. Default "no" repairs with `git commit --amend --reset-author --no-edit` (or `git rebase <base> --exec '...'` for a run); proceed unchanged only on explicit "yes". `--reset-author` preserves `Co-Authored-By:` trailers — keep intentional LLM ones.

- **Sync** — `git merge origin/<default>`; never rebase or force-push a shared feature branch. Resolve default, don't assume `main`:

  ```bash
  DEF=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
  DEF=${DEF:-$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)}
  git fetch origin "$DEF" && git merge "origin/$DEF"
  ```

  Exception: pushing to default itself always `git pull --rebase` then fast-forward push — never a merge commit on default from local work.

- **Solo repos** — if `git log --format='%ae' -200 | sort -u` is only you plus known bots (`*[bot]@*`, the LLM noreply addresses), push straight to default; say so. An explicit "open a PR" overrides.

## PR bodies and payloads

- **Template** — `--body`/`--body-file` overrides GitHub's prefill, so check first (`git ls-files | grep -i pull_request_template`). Precedence: `.github/PULL_REQUEST_TEMPLATE.md` → root → `docs/` → `.github/PULL_REQUEST_TEMPLATE/*.md` (multi-template: pick best fit, say which, ask if two are equal). When found, the body **is** that template filled — every heading reproduced in order/wording/level, nothing dropped or invented, `<!-- -->` placeholders answered and deleted. Inapplicable section → `N/A` + half-line why (WIP → `TODO — <what's left>`), never deleted.
- **Payloads** — every GitHub body goes through a temporary file: Markdown + `--body-file` for `gh pr create`/`edit`/`comment`/`review`; JSON + `gh api --input` for REST comments, replies, reactions, reviews. Never `--body`, `-f body=`, a shell var, `echo`/`printf`, command substitution, or an inline heredoc — backticks, quotes, and `$` stay out of the shell. Delete each temp file after capturing the result, success or failure.
- **Durable journal** — every PR workflow keeps `pr<number>-<sanitized-branch>.md` beside its worktree under `$HOME/.worktrees/<owner>/<repo>/`; get the path from `worktree_create --path-only <head-branch>`, never a hand-built sanitizer. Record request, pass, actions, GitHub result, and next state after each pass; keep it across runs. No transient payloads in it; never delete it during cleanup.
- **Checklists** — tick only what the diff proves; call out gaps in the summary.
- **Body drift** — re-read the body after any push that changes what the PR does; diff it against `git diff <base>...HEAD` and amend only the drifted parts (`gh pr edit <n> --body-file <tmp>`). WIP→ready is the highest-drift moment: clear `TODO —` markers, tick now-true boxes, drop the WIP prefix in the same pass.

## No stacked PRs

- **Every PR branches off the default branch and targets it — no stacked PRs, ever.** Pass `--base <default>` explicitly; cut the branch from an up-to-date default. Pre-flight: `git log --oneline origin/<default>..HEAD` must list only this PR's commits. If it lists a sibling's, re-cut from default and re-apply only this branch's work — never point `--base` at the sibling. A stacked child is unmergeable until its parent lands, shows a polluted diff, and breaks when the parent squash-merges under it.
- **Split by slice, never by layer.** Each PR is one self-contained slice standing against default, touching the fewest files siblings also touch. Bundle tightly-coupled changes (API + schema + models) into one PR. If no split leaves every piece independently mergeable, ship one PR — a bigger standalone beats two stacked.
- **Independence is the test, not slice count — do not over-split.** A split earns its keep only when each slice truly stands alone. Two "independent" slices that both edit the same file — worse, the same line: a shared constant, a budget assertion, a registry, a barrel — are not independent, and splitting them rewrites that line per slice, re-derives the baseline on every rebase, and forces a merge order on peers meant to have none. That is *more* churn than one PR, not less — consolidate them. Price the split before making it: shared-line edits × slices = guaranteed conflicts, forced order = serialized review; when that cost outweighs the isolation, ship one standalone PR. "A bigger standalone beats two stacked" extends to "beats N churning peers".
- **Hard caps per round: at most 3 waves, at most 7 PRs.** Hitting either ceiling is the signal the split is too fine — not a licence to open a fourth wave or an eighth PR. Merge the cheapest-to-combine slices until under both. A genuinely larger change that cannot fit is phased across separate rounds, never fanned wider within one.
- **Overlap is resolved by ordering, not stacking** — land one, `git merge origin/<default>` into the other.
- **Make slices disjoint with new files, but check the discovery mechanism first.** A runner globbing `**/*.spec.ts` picks up a new file free; a barrel, registry, or manifest does not — there the conflict just moved.
  - Tests — one new spec per slice, named for the behavior, matching repo convention; duplicate a few setup lines rather than extract a shared helper.
  - Fixtures/factories — a new file per slice, never new keys in a shared one.
  - Genuinely unsplittable files (barrels, registries, enum blocks) — append at EOF, never in sorted position.
  - Lockfiles/snapshots/generated code — regenerate, never hand-merge; better, let one slice own the dependency change.
  - One migration per slice, uniquely named; never renumber a sibling's.
  - Shared edit every slice needs — land it alone and first as a tiny prep PR to default; siblings pick it up by merge. Not a stack: it targets default and merges before anything depends on it.
  - Assign every file to exactly one slice, said out loud in the plan/body. Verify: `git diff --name-only "origin/<default>...HEAD"` per branch, intersect — non-empty outside regenerable classes means redo the split.
- **Hard dependencies phase into waves, never a stack. A wave is a merge barrier, not a branch parent** — every PR in every wave is cut from and targets default; wave N+1's branch does not yet contain wave N's code.
  - Wave 1 depends on nothing (migration, schema, shared interface, config key). Within a wave, PRs are disjoint and merge in any order; waves are ordered, the PRs inside one are not.
  - Later waves open WIP (`WIP: DO NOT MERGE — ...`) with a `## Blocked on` section linking every PR they wait for. Reuse one group slug across waves.
  - A title number is MERGE order, never creation order: `wave <W> - pr <i>/<N>`, `<i>` monotonic against `<W>` (every wave-2 PR numbers above every wave-1 PR), `<N>` the whole set across all waves. Within a wave, any stable order (alphabetical by slug reads best).
  - Renumber the whole set whenever the graph changes, and say you did — a title edit per affected PR plus an announcement line naming old→new. A newcomer takes the wave its dependencies put it in and triggers a full re-derive, never appends to the end. Fix the prose too: `## Blocked on` sections, the thread reply that asked for the follow-up, the announcement.
  - A later-wave PR is expected red until its dependency lands — say so in the body (`"CI stays red until <link> lands"`); never spend a fix loop on it.
  - Promotion: blocker merged → `git merge origin/<default>` → CI green → drop WIP prefix, in that order, only when the blocked-on section was the sole WIP reason and no `TODO —` remains.
  - Migrations phase expand → migrate → contract, and **wave 1 must be backward compatible** (adds only — nullable column, new table/index — leaving deployed code untouched). Wave 2 backfills/dual-writes; wave 3 drops the old thing once wave 2 is fully deployed. A rename is never one PR: add-new → dual-write → backfill → read-new → drop-old. If wave 1 can't be backward compatible, the waves are wrong — one atomic PR or redesign.
- **An existing stack is damage to contain, not a pattern to follow.** Don't rewrite pushed history; sync it downhill and land bottom-up. Say out loud it's stacked and unintended. Sync the whole ancestor chain floor-first, immediate parent last: walk up to the floor (default, or a long-lived non-default release/integration line with no PR — then default is _not_ merged in), merge the floor, then each ancestor root-most down, one `git merge` each with conflicts resolved between them. No octopus, no rebase, max 10 hops, stop on repeat. **Merges flow downhill only** — never push an ancestor, merge child→parent, or retarget an ancestor's PR to unblock a child. A green+approved stacked PR is still blocked on its parent landing — report the link, don't merge. Where `/sy-sync-pr-branch` exists, delegate the sync to it.

## Worktrees and fan-out

- **Worktrees** — never do PR-branch work in the primary checkout. `worktree_create <branch>` is the only creator (`WT="$(worktree_create "$BR")"`): it fetches, reuses a linked worktree already on the branch, preserves unpushed commits, refuses the primary checkout, and falls back detached. Never hand-roll `git worktree add`, the path, or `mkdir`. Remove only worktrees you created. cwd not the target repo → clone it outside the container first, run `worktree_create` inside. Interactive: `git_create_worktree` adds a `cd`.
- **Canonical path** — `worktree_create --path-only <branch>` prints `$HOME/.worktrees/<owner>/<repo>/<sanitized-branch>` and touches nothing. Owner/repo from origin, never the folder name. Leaf keeps `[A-Za-z0-9._-]`, every other run → `_`, leading/trailing `._-` trimmed. An already-linked worktree may carry an older noncanonical leaf — reuse it without moving, report the legacy path, use `--path-only` as canonical for new work.
- **Parallel fan-out** — one worktree per PR, dispatched in a single assistant message with that many tool calls (one message per job is a sequential loop in disguise). Each prompt is self-contained: full PR URL, resolved `owner/repo`, number, canonical worktree path, and the full sibling list. The dispatcher never `cd`s, creates a worktree, or touches the primary checkout; report once at the end. Exception: repo-wide cleanup stays sequential in one shared checkout.
- **Capacity** — enroll every PR before launching; never drop scope. A declared harness concurrency cap is `S` (read by name, never hardcoded); no declaration means no cap. Rank by work owed: unshipped local work (only tier that can lose data) → awaiting reply → broken-and-ours → stale → bot nits → waiting-on-someone-else → drafts, ties to oldest untouched. Launch `min(N, S)` from the top; a finishing worker hands its slot to the next PR by rank. Age the queue so a low-ranked PR is serviced late, never never.
- **Stable job key** — derived from the work, not launch time: `<command>:slot<i>` or `<per-PR-command>:<owner>/<repo>#<number>`. Store it in the prompt, journal, and the dispatcher's ledger beside the resume handle the dispatch returned (record it immediately — it's the only address for the job later). Before dispatching, match the key against live jobs: running owner left alone, idle owner resumed, only an unowned key gets a new job. A duplicate on one PR double-pushes and double-comments — keep the older, cancel the newer, report it.
- **Resume idle, relaunch only dead.** A job that finished its turn is idle, not dead — it holds its worktrees, read threads, counters, context; resume it with a follow-up turn (one cheap turn, warm context). Relaunch only failed/cancelled/gone, confirmed first, seeded from the ledger's last state block, taking only the dead job's remaining PRs. Never fold a dead job's PRs into a live neighbour.
- **A pass runs inside its job.** A round is one pass, not a reason for a new worker; the per-PR command runs inline once inside a dispatched job. Spawning a child per PR per round makes `PRs × rounds` cold agents where one job would do. The job and ledger are long-lived; the pass is not.
- **Never end a turn with a dispatched job in flight** — a parent that stops first freezes the child's status at "running" forever. Await every job dispatched in a turn, land the final report, close each round before the next. A run hitting its deadline finishes its last round rather than issuing one it can't await.
- **Watch/review is clock-bounded, not pass-counted** — a fixed budget, read-only probes on a short interval, a full pass whenever the fingerprint moves, a periodic keepalive pass, and one final pass before the deadline. Inbound work never interrupts a pass in flight (mark dirty, finish to the safe point, re-run at the head of the queue); never count your own writes. Ends on deadline, all-PRs-terminal, an enumerated stop-and-ask, or GitHub/model service unreachable across a short retry window. Every stop writes resumable journal state. Intervals live in the command sources — never restate a number here.

## Merging and cleanup

- **Squash merge only** — `gh pr merge --squash`, one PR / one commit. Never merge commits or rebase merges; never squash local dev history.
- **Automerge is opt-in except a standalone prose-only diff, which enables itself.** Prose-only = every changed line is docs (`*.md/.mdx/.rst/.txt`, `docs/**`, `README*`, `CHANGELOG*`, `LICENSE*`), a comment, a docstring, or whitespace; one executable line (code/config/schema/lockfile/CI/test) disqualifies it. On a standalone prose-only diff, `gh pr merge <n> --squash --auto` the moment it exists, say so, don't ask. Elsewhere `--auto` is never yours on your own initiative — offer once for a tests-only/dependency-only/trivial diff and enable only on explicit "yes". Never on a WIP/`DO NOT MERGE`/draft/someone-else's PR; leave a pre-enabled one alone. Safe because `--auto` still waits for CI and required approval.
- **Prose-only self-merge requires the PR to be standalone — never merge docs ahead of the code they describe.** Not standalone (and `--auto` not yours) when: part of a multi-PR batch with any sibling open; sharing a `<group-slug>/` prefix with another open PR in any repo; referencing another open PR (link, "depends on", "part of", shared plan slug); or based on another open PR's head. Re-check every pass — enable `--auto` the moment the last companion merges/closes, naming which released it; while deferred, report the blocking links.
- **Clean up the moment a PR reaches `MERGED`** (you merged it, `--auto` landed it, or a poll saw it). Don't hand-roll `git branch -D` / `git worktree remove`; the aliases encode the safety checks:
  - `git clean-worktree` — prunes stale records, removes worktrees whose branch is merged/gone, skips dirty and detached-HEAD ones.
  - `git clean-stale-branches` — deletes locals whose upstream is `[gone]` (what squash-merge leaves); never the default or current branch.
  - A detached-HEAD worktree: `git worktree remove <path>` only after confirming no uncommitted work — never `--force` past a dirty one.
  - Never delete the journal — it's durable provenance. Remove the worktree, keep the journal.
  - A worktree with unpushed commits or a dirty tree is not reaped silently — work never reached the PR. Report the path and contents, leave it for the human.

## Stuck PRs — retrigger a frozen pipeline

- **Green Actions but a blocked merge is usually a missing check, not a failing one.** Approval, policy, lock, description, and custom-validation gates are check runs posted by org apps; a dropped webhook means the check is never _created_ on the head SHA — not red, not pending, absent — so the branch rule never satisfies and `mergeStateStatus` stays `BLOCKED`. Nothing to `rerequest`; a check never created can't be re-run.
- **Diagnose before touching the branch** — diff required contexts against what posted on the head SHA. Missing = dropped webhook; posted-and-failed = an ordinary red build:

  ```bash
  REPO=<owner>/<repo>; N=<number>
  DEF=$(gh repo view "$REPO" --json defaultBranchRef -q .defaultBranchRef.name)
  SHA=$(gh pr view "$N" --repo "$REPO" --json headRefOid --jq .headRefOid)
  gh api "repos/$REPO/rules/branches/$DEF" \
    --jq '[.[] | select(.type=="required_status_checks")] | .[].parameters.required_status_checks[].context' \
    | sort -u > /tmp/required.txt
  gh api "repos/$REPO/commits/$SHA/check-runs?per_page=100" --jq '.check_runs[].name' | sort -u > /tmp/posted.txt
  comm -23 /tmp/required.txt /tmp/posted.txt   # required but never posted → dropped webhook
  ```

- **The fix is an empty commit on the PR branch** — a new head SHA is what makes the apps re-evaluate. "Retrigger the PR build/checks/stats" means exactly this. Allow a full pipeline duration (~20 min) before judging it failed.

  ```bash
  git commit --allow-empty -m "Retrigger CI checks"
  git push
  ```

- **Empty means empty** — no whitespace tweak, bumped comment, or touch-and-revert; a dummy edit pollutes review/blame and can trip path filters. Say what it is in the subject so a scanner sees it changes nothing. **Confirm the branch first** — this runs on the PR's own branch, never default (an empty commit on default is noise no squash collapses).
- **Fresh approval is the known price, not a bug to engineer around.** Under `require_last_push_approval: true` any commit makes you the latest pusher and needs a new approval; budget for the ping. On an already-green, already-approved PR that isn't actually stuck, don't push at all.
- **A genuinely red Actions job is a different problem** — `gh run rerun <id> --failed` re-runs only the failed jobs, far cheaper than a push.

## Links and references

- **Never hand-build a PR/issue URL** — emit the `url`/`.html_url` field verbatim. Web path is singular `/pull/<n>`; `/pulls/<n>` is REST and 404s on github.com. Issues are `/issues/<n>` on both.
- **A link is four independent facts — owner, repo, `pull` vs `issues`, number — each verified.** Well-formed ≠ correct. Never derive `<repo>` from a folder basename, product name, ticket text, or a sibling repo (`-ui`/`-api`/`-service`/`-web` are _different_ repos with independent numbering) — resolve per Repo Identification. Never guess type; numbering is shared, so `<n>` is at most one of the two. One probe checks all four, and its output is what you print:

  ```bash
  gh api "repos/<owner>/<repo>/issues/<n>" --jq '{url: .html_url, is_pr: (.pull_request != null), state, title}'
  ```

  `.pull_request` is the type discriminator, `.html_url` the canonical path. A `404` means a wrong segment — try the sibling repo, say which candidates you tried, never print an unresolved link. Re-probe any link from memory, a paste, an earlier turn, a ticket, or a commit message — someone else's link is a hypothesis.

- **A bare `#<number>` is a rendering bug, not shorthand.** Clients and GitHub auto-link it relative to the repo in context — for an agent, the cwd, routinely an unrelated workspace repo. This applies to every word you emit, not just link lists: the common slip is a careful list of full URLs then "fixed in #1731". If a number sits next to `#`, write the full path instead, or name the PR with no number. Scan for `#`+digits before sending.
- **Render every reference as a full clickable path** — `github.com/<owner>/<repo>/pull/<number>`; only scheme and `www.` may drop. One per line in lists, path first (trailing context like `— retry on token refresh` is fine). Shorthand is allowed only in prose written _into_ GitHub itself.
- **Show authors when a list isn't all yours** — request `author` in the `gh --json` fields. All yours → omit as noise. Even one different → label the author on every row and say who in the summary. Machine-parseable bare-URL output stays untouched; put the breakdown in surrounding prose.

## Reviewing and babysitting

- **Babysitting is opt-in; creating the PR ends the task.** Plan, implement, validate, push, open the PR, report the full link — then stop. Do not poll CI, sleep-and-recheck, start a pass loop, fix an unrequested build, or enable automerge outside the prose-only carve-out. An unrequested watch loop burns unbudgeted hours and acts on the branch while the user's away.
- **Only an explicit instruction starts a watch loop** — `/sy-babysit-pr(s)`, `/sy-review-pr(s)`, or a plain ask that plainly means it ("keep an eye on it", "see it through", "watch CI until green", "babysit this"). "Fix the tests" or a follow-up after the PR exists is a fresh task, not a subscription. Unsure → finish, hand back the link, offer the loop in one sentence; never assume yes.
- **Every review comment is net new** — fetch all review threads, issue comments, and reactions from every author (humans, bots, your own past reviews) first. Route each finding: covered → post nothing, react `+1`; covered-but-missing-a-case → reply in that thread with only the delta (`-F in_reply_to=<id>`, opening "Adding to the above") and 👍 the original; genuinely new → top-level comment. A prior 👎 means already-rejected — don't resurrect without a concrete new reason, stated. A reworded duplicate is still a duplicate.
- **Verify load-bearing claims yourself.** "Unused", "no consumers", "behavior unchanged", "tests cover it", "CI is green", "I audited the callers" are hypotheses — grep the name (string _and_ symbol), open the cited test and read its asserts, fetch the check run, read the call site. What you can't verify from here (another repo, a runtime consumer, manual QA) is asked for by name, never granted. Applies to bot summaries and your own earlier passes.
- **Act on feedback — author identity sets weight, never whether you act.** Every actionable human/bot finding gets a disposition on the pass that first reads it: fixed and replied, declined with a concrete reason, or escalated as a named stop-and-ask. No "surface to the user and move on", no waiting for separate authorization, no deferring the same comment pass after pass. Your own findings likewise land on the PR (comment, thread, or 👍); one that ends up only in the user's terminal is reported as dropped.
- **Stop-and-ask is surfaced, never prompted** — it pauses that PR for you, not on GitHub. Record `needs_user` in the journal with the reason, the exact human message, the source (comment/review/thread/check id + its timestamp + the head SHA it was raised against), and the next step. Print that block, keep working the other PRs; never open an interactive prompt, block waiting, or express it on GitHub (no label, status, review, or comment for scheduler state). It's a narrow enumerated exit: restructuring the user's work (splitting, re-cutting branches, changing a base), a change to stated scope or public contract, a `needs-human` conflict/migration, or input you can't obtain. Size, tedium, opinion-shaped feedback, harsh tone, and code you didn't write don't qualify. End-of-run disposition counts sum to the number of open items.
- **Revalidate a prior `needs_user`** against live state before displaying or scheduling it — a fresh session remembers nothing and the thing may have resolved hours ago. Re-fetch the source by id, re-read current reviews/threads/checks/head SHA/body and everything posted since the recorded timestamp. Classify: current, cleared, changed, conflicted (show both), or stale-unknown. Print the prior claim and verdict together, always with a `Next:` line. A cleared claim re-queues the PR and says which comment cleared it.
- **A re-review with nothing new posts nothing** — no verdict, no "still looks good", no re-approval; reactions are the whole output and the no-op is reported to the user, not the PR. One exception: a state flip since last pass (CI red, another reviewer blocked, base conflict) → post that single flag and nothing else.
- **A round with nothing to move costs a cheap read-only probe** — a `gh pr view --json … --jq` digest plus one newest-comment call, compared as a string; any change fires the real pass, nothing else does. An externally-blocked PR (approval gate nobody clicked, unmerged wave blocker/companion, green-and-approved awaiting a click, open parent) holds no worker slot. Never probe the first round, while anything is actionable, or as a write; always a full pass on round one, on the keepalive, and before the deadline. A watched PR is a serviced PR — silence is how coverage disappears.
- **"CI is still running" means a job is executing — a pending human gate is not CI.** Approval, sign-off, codeowner, and changes-resolution gates sit `IN_PROGRESS` by design until a person clicks, and never resolve on a timer; skipping a pass on one is an infinite wait. Classify first: a self-resolving build (test/lint/type-check/build/scan/deploy) blocks; a review gate, or anything still pending after an hour, does not. Step over the non-blocking ones, name them in the report, and never call the PR green while one is open.
