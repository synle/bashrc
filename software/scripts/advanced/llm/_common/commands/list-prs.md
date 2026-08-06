[Sy] List open pull requests across repos, grouped by readiness. Defaults to `short` format (just full links).

## Inputs

`$ARGUMENTS` is a free-form string that may carry three independent dimensions: a **format keyword**, a **scope**, and an **author**.

- **Format keyword** (one of, case-insensitive): `short`, `long`, `table`, `links`, `clusters`, `pingpong`. Defaults to `short` if absent. `links` (alias `link`) prints bare PR URLs with no headings at all. `clusters` (aliases `cluster`, `grouped`, `feature`) prints the same URLs bucketed by **feature cluster** — one feature that spans several repos reads as one block — with a running `pr<N>` handle on every line; it is what `/sy-list-prs-pending` renders. `pingpong` (aliases `ping-pong`, `pulse`) is the agent-status heartbeat render used by `/sy-babysit-prs` and `/sy-review-prs`.
- **Scope** — pick exactly one (first match wins):
  - **PWD** (default, no scope token present) — scan for git repos at or below cwd, two levels deep (depth chosen because PRs often live in nested repo folders), and list `@me` open PRs in those repos only. PWD scope forces author = `@me` (ignores any author token).
  - **All** — one of: `all`, `every`, `global` (case-insensitive). Every open PR for the resolved author across all repos.
  - **PWD keyword** — one of the PWD keyword set (see below, case-insensitive). Same as default PWD scope above.
  - **Explicit PR refs** — one or more PR refs: full URL (`https://github.com/<owner>/<repo>/pull/<n>`), shorthand `<owner>/<repo>#<n>`, `#<n>`, or bare digits `<n>`. Bare `#<n>` / digits require cwd to be a git repo (resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name — see Repo Identification). Explicit-refs scope is author-agnostic (you asked for those PRs).
- **Author** (only meaningful in `all` scope): a GitHub handle, a full name, or one of `me`/`mine`/`self` (= current user). Defaults to `@me`.

**PWD keyword set:** `pwd`, `.`, `./`, `here`, `cwd`, `this folder`, `this-folder` (case-insensitive, trimmed). This vocabulary is defined here and referenced by `/sy-babysit-prs`.

Examples:

- `/sy-list-prs` → short format, `@me` PRs in repos under cwd (default)
- `/sy-list-prs short` → short format, `@me` PRs in repos under cwd
- `/sy-list-prs all` → short format, all `@me` PRs across all repos
- `/sy-list-prs long all` → long format, all `@me` PRs across all repos
- `/sy-list-prs table` → table format, `@me` PRs in repos under cwd
- `/sy-list-prs alice` → short format, author `alice` (scope = all, since alice is an author token)
- `/sy-list-prs long alice` → long format, author `alice`
- `/sy-list-prs alice table` → table format, author `alice`
- `/sy-list-prs pwd` → short format, `@me` PRs in repos under cwd (2 levels)
- `/sy-list-prs table here` → table format, `@me` PRs in repos under cwd
- `/sy-list-prs long https://github.com/acme/widget-store/pull/42 acme/api#7` → long format, those two PRs only
- `/sy-list-prs #42` → short format, PR #42 in cwd's repo (cwd must be a git repo)
- `/sy-list-prs pingpong` → ping-pong pulse render, `@me` PRs in repos under cwd
- `/sy-list-prs pingpong pwd` → same, explicit PWD scope (what `/sy-babysit-prs` passes on every pulse)
- `/sy-list-prs links` → bullet list of PR URLs (`- <url>` per line) — `@me` PRs in repos under cwd
- `/sy-list-prs links all` → bullet list of every `@me` PR URL across all repos
- `/sy-list-prs clusters` → `@me` PRs under cwd, bucketed by feature cluster, numbered `pr1`, `pr2`, …
- `/sy-list-prs clusters all` → same clustering across every repo

## Parsing $ARGUMENTS

1. Tokenize `$ARGUMENTS` on whitespace. (Quoted multi-word author names — e.g. `"Alice Doe"` — preserve as one token.)
2. **Extract the format keyword** — pick the first token (case-insensitive) that matches `short`, `long`, `table`, `links` / `link` (both normalize to `links`), `clusters` / `cluster` / `grouped` / `feature` (all four normalize to `clusters`), or `pingpong` / `ping-pong` / `pulse` (all three normalize to `pingpong`). Remove it from the token list. If no match, format = `short`.
3. **Determine scope from remaining tokens** (first match wins):
   - **Explicit PR refs** — every remaining token is a PR ref (URL, `<owner>/<repo>#<n>`, `#<n>`, or pure digits) → scope = explicit. Normalize each to a full URL per the `/sy-babysit-prs` rules (bare `#<n>` / digits require cwd is a git repo with GitHub `origin`; resolve `<owner>/<repo>` via `git remote get-url origin` — never from the folder name; bad tokens error out — do NOT silently skip).
   - **PWD keyword** — first remaining token (case-insensitive) is one of the PWD keyword set → scope = pwd. Any extra tokens after the keyword are an error (PWD mode takes no author or refs).
   - **`all` / `every` / `global`** — scope = all.
   - **Otherwise** → scope = all (default for author tokens). The remaining tokens form the author:
     - Empty → current user (`--author=@me`).
     - Single token of `me`/`mine`/`self` (case-insensitive) → current user.
     - Single token (no spaces) → treat as a GitHub handle (`--author=<token>`).
     - Multiple tokens → treat as a full name. Resolve via `gh api "search/users?q=<name>" --jq '.items[0].login'` and confirm the match with the user before proceeding.
4. **No mixing.** PWD keyword + explicit refs in the same call is an error; pick one.

## Fetch PR data

1. **Fetch the open PR list — branch on scope:**

   a. **Scope = pwd** (default):
   - Discover git repo roots two levels deep (see Repo discovery) — each output line is already a repo root, no `dirname` step:

     ```bash
     for d in . */ */*/; do git -C "$d" rev-parse --show-toplevel; done 2>/dev/null | sort -u
     ```

   - For each root, resolve `<owner>/<repo>` (see Repo Identification — never from the folder name):

     ```bash
     git -C "<root>" remote get-url origin | sed -E 's#(git@|https://)github.com[:/]##; s#\.git$##'
     ```

     Skip roots with no `origin` or a non-GitHub remote.

   - De-duplicate the `<owner>/<repo>` list. If empty, print `No git repos found within 2 levels of $(pwd).` and stop.
   - Query in one call:
     `gh search prs --author=@me --state=open --repo <o1>/<r1> --repo <o2>/<r2> ... --json number,title,repository,isDraft,url,headRefName,createdAt,author`

   b. **Scope = all**:
   `gh search prs --author=<resolved> --state=open --json number,title,repository,isDraft,url,headRefName,createdAt,author`

   c. **Scope = explicit refs**:
   - For each normalized PR URL, fetch metadata:
     `gh pr view <url> --json number,title,headRefName,baseRefName,isDraft,url,repository,createdAt,author`
   - De-duplicate by URL. Order preserves the user's input order; classification + sort still happen below.

2. **For each PR, fetch detailed status:**
   - CI/build status: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup` → `CI PASSED` / `CI FAILED` (name the first failing check) / `BUILD IN PROGRESS` (count the still-running checks)
   - Reviews: `gh pr view <number> --repo <owner/repo> --json reviews,reviewDecision` → `APPROVED` (with approval count) / `CHANGES REQUESTED` / `AWAITING REVIEW`
   - Unresolved review comments: `gh pr view <number> --repo <owner/repo> --json reviewThreads --jq '[.reviewThreads[] | select(.isResolved == false)] | length'` → count of open threads
   - Resolved review comments (`pingpong` only, for the counters strip): same call with `select(.isResolved == true)` → count of resolved threads
   - Mergeability / conflicts: `gh pr view <number> --repo <owner/repo> --json mergeable,mergeStateStatus`

## Classification — 5 groups

Classify each PR into exactly one group. Evaluate in this priority order (first match wins):

1. **NOT READY / WIP / DRAFT** — `isDraft` is true OR title contains `WIP` or `DO NOT MERGE` (case-insensitive). Tag titles with `[Draft]` and/or `[WIP]` in the output.
2. **NEEDS ATTENTION** (🔴) — would otherwise be ready (not draft, no WIP/DNM in title) BUT one or more of:
   - `CI FAILED` (any required check failed).
   - `reviewDecision == "CHANGES_REQUESTED"` (reviewer left blocking comments).
   - `mergeable == "CONFLICTING"` (merge conflicts).
3. **NEED APPROVAL** (🟡) — the yellow catch-all: nothing red, but not all-clear. No merge conflicts and no failing check, but either `reviewDecision != "APPROVED"` (still awaiting review) or `BUILD IN PROGRESS` (checks still running, even if already approved).
4. **READY TO MERGE (with comments)** (🟢) — `CI PASSED`, `APPROVED`, no conflicts, but unresolved review threads > 0.
5. **READY TO MERGE** (🟢) — `CI PASSED`, `APPROVED`, no conflicts, zero unresolved review threads. Fully clear to merge.

The color in parentheses is the same roll-up the `long`, `table`, and `pingpong` formats render, so a group and its color never disagree: groups 4 and 5 are exactly the 🟢 set, group 2 is exactly the 🔴 set, group 3 is 🟡. Group 1 takes whichever color its own signals earn — a draft with failing CI is still 🔴.

Group 3 is deliberately the catch-all rather than a third specific rule: green requires CI passed **and** approved **and** no conflict, so anything that clears group 2 without clearing all three lands here. That closes the hole where an already-approved PR with a still-running build matched no group at all — it is 🟡 `NEED APPROVAL`, waiting on the build rather than on a human, and the `BUILD IN PROGRESS` line in the rendered status says which.

## Sort within each group

Apply in order; each tiebreaker applies only when the previous is equal:

a. Repo name (alphabetical).
b. Dependency order — if PR A must merge before PR B (e.g. B's branch is based on A's branch, or B's description references A's PR number), put A first.
c. `createdAt` ascending — oldest PR first, newest last.

## Feature clustering

One feature routinely needs a PR in several repos — the API change, the client change, the docs change — and those PRs are one unit of work even though nothing in GitHub says so. Clustering recovers that grouping so the set reads side by side instead of scattered across five repo-sorted rows. It is computed for **every** scope and format but only _rendered_ by `clusters` (and by `/sy-list-prs-pending`, which delegates here); `short`, `long`, `table`, `links`, and `pingpong` keep their existing repo-then-date sort untouched, because `/sy-babysit-prs` parses those line-by-line.

**Cluster key — take the first signal that fires, strongest first.** Signals 1–3 are declarations by the author and are trusted alone; 4–5 are inference and need the whole normalized phrase to match, not one shared word.

1. **Branch group slug** — branch is `<username>/<group-slug>/<feature-name>` (three segments, see Branch naming). The middle segment is the key. This is the author saying "these belong together", so it wins outright.
2. **Plan slug** — the PR body references the same `plan-<slug>.md` / `plan-<slug>.diff` artifact (see Plans & Wrap-Ups). Key is `<slug>`.
3. **Shared ticket or cross-reference** — both PRs name the same issue / ticket key (`ABC-1234`, `github.com/<owner>/<repo>/issues/<n>`), or one PR's body or title references the other's full PR path. Key is the ticket / issue reference.
4. **Matching feature branch name** — identical final branch segment across repos (`syle/retry-token-refresh` in three repos). Key is that segment.
5. **Matching normalized title** — strip the leading `[<repo>] ` prefix, lowercase, drop punctuation and stop words, then require the remaining significant terms to match. Key is the normalized phrase.

**Rules that keep clusters honest:**

- **Clustering is transitive.** If A clusters with B and B clusters with C, all three are one cluster, even when A and C share no signal directly.
- **Never cluster on a generic word.** `fix`, `update`, `bump`, `cleanup`, `docs`, `deps`, `dependabot`, a bare repo name, or a lone version number are not features. When only signal 5 fires and the shared phrase is one such word, the PRs stay separate.
- **A cluster of one is not a cluster.** Anything with no partner is a standalone PR and renders in the trailing `Standalone` block.
- **Label** = the cluster key, kebab-cased, ≤5 words — `oauth-migration`, `ABC-1234`, `retry-token-refresh`. Never invent a prettier name than the signal produced.
- **Say which signal fired** whenever the cluster came from inference (signals 4–5) and the repos differ, so a wrong guess is visible and correctable rather than silently authoritative.

**Cluster ordering** (the "prioritize" half of the job) — apply in order:

a. Readiness of the cluster's **most urgent** member — a cluster containing a NEEDS ATTENTION PR outranks one whose best member is NEED APPROVAL, using the same group priority as the display order below. One red PR blocks the whole feature, so the whole feature sorts red.
b. Cluster size descending — the widest fan-out first; that is the one where a missed repo costs the most.
c. Earliest member `createdAt` ascending.

Standalone PRs always come last, ordered by the normal group display order and within-group sort.

**Within a cluster:** dependency order first (a PR whose branch or body says it must land before a sibling goes above it — the same signal as within-group sort rule b), then group priority, then repo name, then `createdAt`.

## Output format

Print groups in this fixed display order. Skip empty groups (don't print the heading if `N == 0`). Each group heading is `## <Group Name> (N)`.

### Mixed-author disclosure

Before rendering, resolve your own handle once (`gh api user --jq .login`) and compare it against every PR's `author.login`.

- **All PRs are yours** → omit the author entirely. It's noise.
- **Any PR has a different author** → the list is mixed. Surface authors in every format, and lead the output with one line: `Mixed authors: <handle> (N), <handle> (N), …`.

Where the author goes, per format:

| Format     | Placement                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `short`    | Group heading only — `## NEEDS ATTENTION (2 — @me 1, @alice 1)`. **URL lines stay bare.**                        |
| `long`     | In the description line, right after the repo: `#123 [owner/repo] @alice — <title> — <status>`                   |
| `table`    | A dedicated `Author` column, inserted after `Repo`                                                               |
| `links`    | Nowhere — `links` is pure machine input and carries no author, heading, or summary line                          |
| `clusters` | Cluster heading only — `### oauth-migration (3 — @me 2, @alice 1) — acme/api, acme/web`. **PR lines stay bare.** |
| `pingpong` | Second line of the `PR` cell — the author is always shown, mixed or not                                          |

**`short` URL lines are machine input — never decorate them.** `/sy-babysit-prs` consumes `/sy-list-prs short` line-by-line as full PR URLs. Adding a handle, prefix, or suffix to those lines breaks it. Group headings and the leading summary line are already skipped by that parser, so that's where mixed-author information belongs.

Display order:

1. **NEEDS ATTENTION** — fix these first.
2. **READY TO MERGE** — go merge these.
3. **READY TO MERGE (with comments)** — approved but resolve comments first.
4. **NEED APPROVAL** — waiting on reviewers.
5. **NOT READY / WIP / DRAFT** — still in progress.

### Format: `short` (default)

For each PR in each group, print just the full URL on its own line:

```
## NEEDS ATTENTION (2)
https://github.com/owner/repo-a/pull/123
https://github.com/owner/repo-b/pull/456

## READY TO MERGE (1)
https://github.com/owner/repo-c/pull/789
```

Mixed-author lists carry the breakdown in the heading; the URL lines are unchanged:

```
Mixed authors: @me (1), @alice (1)

## NEEDS ATTENTION (2 — @me 1, @alice 1)
https://github.com/owner/repo-a/pull/123
https://github.com/owner/repo-b/pull/456
```

### Format: `long`

For each PR, print a short description line, then the full URL, then a blank line:

```
## NEEDS ATTENTION (2)
#123 [owner/repo-a] Add user signup flow — 🔴 CI FAILED — unit-tests
https://github.com/owner/repo-a/pull/123

#456 [owner/repo-b] Refactor auth middleware — 🔴 CHANGES REQUESTED
https://github.com/owner/repo-b/pull/456

## READY TO MERGE (1)
#789 [owner/repo-c] Bump deps to latest — 🟢 CI PASSED · APPROVED
https://github.com/owner/repo-c/pull/789
```

The short description line is: `#<number> [<owner/repo>] <title> — <color emoji> <status>`. On a mixed-author list, insert the author after the repo: `#<number> [<owner/repo>] @<author> — <title> — <color emoji> <status>`. Strip a leading `[<repo>] ` prefix from `<title>` when it matches the repo already printed on that line — the repo is its own field, so keeping it in the title prints it twice.

`<color emoji>` and `<status>` use the same vocabulary and the same roll-up rule as the `pingpong` Status cell — 🔴 for CI failed / changes requested / merge conflict, 🟡 for build running or awaiting review, 🟢 only when CI passed **and** approved **and** no conflict. `<status>` is the component tokens that justify the color, `·`-separated on one line: `CI FAILED — <check>`, `CHANGES REQUESTED`, `MERGE CONFLICT`, `BUILD IN PROGRESS (<n> running)`, `AWAITING REVIEW`, `CI PASSED`, `APPROVED`. Print every token that applies, in that fixed order, so a red row says which of the three reds it is. For NOT READY / WIP / DRAFT, prepend tags `[Draft]` / `[WIP]` to the title.

### Format: `table`

Print one markdown table per group with these columns:

| PR | Repo | Title | Link | CI Status | Approvals | Comments | Ready to Merge? |

On a mixed-author list, insert an `Author` column immediately after `Repo`, filled in for **every** row (including your own) so the rows stay comparable.

- **PR**: PR number and branch name on separate lines (e.g. `#123` then `feature-branch` below it).
- **CI Status**: `CI PASSED` / `CI FAILED — <check>` / `BUILD IN PROGRESS (<n> running)` — same vocabulary as the `pingpong` Status cell, so one reader learns one set of words for the whole command.
- **Approvals**: `APPROVED (<n>)` / `CHANGES REQUESTED` / `AWAITING REVIEW`.
- **Comments**: count of unresolved review threads (`0` if none).
- **Ready to Merge?**: `🟢 yes` if group 5 (READY TO MERGE), `🟢 yes — <n> open comments` if group 4, otherwise `🔴 no — <blocker>` (CI failed / changes requested / merge conflict) or `🟡 no — <what it waits on>` (build running / awaiting review). Same three colors and the same roll-up rule as `pingpong`: green needs CI passed **and** approved **and** no conflict; red wins over yellow.
- In the NOT READY / WIP / DRAFT table, prepend `[WIP]` and/or `[Draft]` tags to the Title column.

### Format: `links`

A bare bullet list of PR URLs — one `- <url>` per line. **Nothing else** — no group headings, no counts, no blank lines between groups, no `Mixed authors:` line, no titles, no status. The whole output is a clean link list you can paste into Slack, a PR body, or notes, and that another command can read line-by-line after stripping the `- ` prefix.

```
- https://github.com/owner/repo-a/pull/123
- https://github.com/owner/repo-b/pull/456
- https://github.com/owner/repo-c/pull/789
```

- Every line is exactly `- ` followed by the URL. No numbering, no nesting, no indentation, no trailing punctuation.
- Classification still runs — it only drives the **order**. Emit the groups in the same display order as every other format (NEEDS ATTENTION → READY TO MERGE → READY TO MERGE (with comments) → NEED APPROVAL → NOT READY / WIP / DRAFT), with the same within-group sort, then flatten to one bullet per line.
- Print the full `https://github.com/<owner>/<repo>/pull/<number>` form here — `links` output is meant to be consumed by other commands, and the scheme keeps every consumer happy.
- Zero PRs → print nothing at all (empty output). No "no PRs found" line: an empty list is the correct machine answer, and a prose line would be parsed as a link by whatever is reading.
- `links` is the strictest machine-input format in this file. The `- ` prefix is the only decoration — never add a handle, title, status, annotation, or code fence.

### Format: `clusters`

The cross-repo view. Same URLs as `links`, bucketed by **feature cluster** (see Feature clustering) so one feature that needed a PR in four repos reads as one block, and every line carries a running `pr<N>` handle you can point at in the next sentence ("babysit pr2 and pr3 first").

```
### oauth-migration (3) — acme/api, acme/web, acme/widget-store
- pr1 https://github.com/acme/api/pull/51 — 🔴 CI FAILED — unit-tests
- pr2 https://github.com/acme/web/pull/7 — 🟡 AWAITING REVIEW
- pr3 https://github.com/acme/widget-store/pull/109 — 🟢 CI PASSED · APPROVED

### ABC-1234 (2) — acme/api, acme/web
- pr4 https://github.com/acme/api/pull/60 — 🟡 BUILD IN PROGRESS (2 running)
- pr5 https://github.com/acme/web/pull/18 — 🟡 AWAITING REVIEW

### Standalone (2)
- pr6 https://github.com/acme/widget-store/pull/113 — 🔴 MERGE CONFLICT
- pr7 https://github.com/acme/api/pull/42 — 🟢 CI PASSED · APPROVED
```

- **Cluster heading**: `### <label> (<n>) — <repo>, <repo>, …`, repos comma-separated in the order their PRs appear. The repo list is the whole point of the heading: it answers "which repos does this feature still need" without reading a single URL. Single-repo clusters (two PRs in the same repo) still print the repo once.
- **Standalone block**: everything with no partner, under a literal `### Standalone (<n>)` heading, always last, no repo list. Print it even when it holds every PR — an all-standalone list is a real answer, not an error.
- **PR line**: `- pr<N> <full URL> — <color emoji> <status>`. `<color emoji>` and `<status>` use the exact vocabulary and roll-up rule as `long` (`CI FAILED — <check>`, `CHANGES REQUESTED`, `MERGE CONFLICT`, `BUILD IN PROGRESS (<n> running)`, `AWAITING REVIEW`, `CI PASSED`, `APPROVED`, `·`-separated). Prepend `[Draft]` / `[WIP]` before the emoji when they apply.
- **Numbering is global, continuous, and display-ordered** — `pr1` through `pr<N>` across the whole render, never restarting per cluster. The handle is stable only within one render; it is a pointer for the next message, not an identifier to store.
- **Consumers read the `https://` token from each line.** That token is always the full `https://github.com/<owner>/<repo>/pull/<number>` form and always the third whitespace-separated field. Heading lines carry no `https://` token, so a URL-extracting parser skips them for free — the same property that lets `/sy-babysit-prs` read `short` past its `##` headings.
- **Ordering is Feature clustering's, not this section's** — cluster rank by most-urgent member, then size, then age; within a cluster, dependency order first. Do not re-sort here.
- When a cluster came from inference (Feature clustering signals 4–5), append ` — grouped by <signal>` to its heading, e.g. `### retry-token-refresh (2) — acme/api, acme/web — grouped by matching branch name`. A guess says it's a guess.
- Zero PRs → print nothing at all, same as `links`.

### Format: `pingpong`

The heartbeat / pulse render. One flat board — no per-group tables — answering "what is going on right now, and what are the agents doing about it". `/sy-babysit-prs` and `/sy-review-prs` emit this on a fixed cadence so a long async fan-out is never a black box.

Structure: a header block (scope counts, then a one-sentence-per-PR pulse), then one table. The pulse lines are the only prose in this render — keep every table cell terse, fragments not sentences. This is a status board.

```
🏓 Agent Status Ping-Pong — 2026-08-05 17:34 PDT
Next ping-pong: 2026-08-05 17:44 PDT (in 10 min)

Repos Scanned (3): acme/widget-store, acme/api, acme/web
PRs Scanned (5):
- acme/widget-store: 2
- acme/api: 2
- acme/web: 1

Pulse (2 moved, 2 steady, 1 new):
- Δ github.com/acme/widget-store/pull/109 — CI just went red on unit-tests; agent is mid loop 1.
- ▫️ github.com/acme/web/pull/7 — still conflicting with main; agent gave up and wants a human.
- 🆕 github.com/acme/api/pull/51 — new to the board, CI still running; queued for wave 2.
- ▫️ github.com/acme/widget-store/pull/113 — still 2 open threads and no review; agent sleeps until 17:28.
- Δ github.com/acme/api/pull/42 — cleared its last 4 threads and picked up an approval; ready to merge.

| PR | Status | Agent |
| --- | --- | --- |
| github.com/acme/widget-store/pull/109<br>@alice — Retry token refresh on 401<br>Δ CI green→failing · +2 open threads | Δ 🔴<br>CI FAILED — `unit-tests`<br>AWAITING REVIEW | 🔄 IN PROGRESS (loop 1/3) — started 17:12 · running 22m<br>💬 3 open · ✔ 5 resolved · ⚠️ 0 need attention |
| github.com/acme/web/pull/7<br>@me — [WIP] Split auth middleware<br>▫️ No change since last ping-pong | ▫️ 🔴<br>CI PASSED<br>CHANGES REQUESTED<br>MERGE CONFLICT | ⚠️ ESCALATED (loop 2/3) — stopped 17:01 · ran 19m — needs human<br>💬 1 open · ✔ 3 resolved · ⚠️ 1 need attention |
| github.com/acme/api/pull/51<br>@bob — Add signup flow<br>🆕 First ping-pong — no prior snapshot | 🆕 🟡<br>BUILD IN PROGRESS (3 running)<br>AWAITING REVIEW | ⚪ NOT STARTED — queued, wave 2<br>💬 0 open · ✔ 0 resolved · ⚠️ 0 need attention |
| github.com/acme/widget-store/pull/113<br>@me — Drop dead feature flag<br>▫️ No change since last ping-pong | ▫️ 🟡<br>CI PASSED<br>AWAITING REVIEW | ⏸️ WAITING (loop 2/3) — ended 16:58 · ran 26m · next 17:28<br>💬 2 open · ✔ 0 resolved · ⚠️ 1 need attention |
| github.com/acme/api/pull/42<br>@me — Bump deps to latest<br>Δ 4 threads resolved · +1 approval | Δ 🟢<br>CI PASSED<br>APPROVED | ✅ COMPLETED (loop 3/3) — ended 17:05 · 48m total<br>💬 0 open · ✔ 4 resolved · ⚠️ 0 need attention |
```

**Header block:**

- Line 1: `🏓 Agent Status Ping-Pong — <current timestamp>` (local time, with zone).
- Line 2: `Next ping-pong: <timestamp> (in <N> min)`. On the final pulse of a run, write `Next ping-pong: — (final)` instead.
- `Repos Scanned (<count>): <owner/repo>, <owner/repo>, …` — the resolved scope, comma-separated.
- `PRs Scanned (<count>):` followed by one `- <owner>/<repo>: <n>` line per repo. Repos with zero matching PRs still get a line with `0` — a scanned-but-empty repo is a real answer.
- `Pulse (<n> moved, <n> steady, <n> new):` followed by **one sentence per PR** — the high-level read, before anyone looks at the table. This is the part a human skims on a phone; the table is where they go when a sentence makes them want detail.

  Each line is `- <change marker> <full PR path> — <one sentence>`. Stay high level and plain English: what moved (or that nothing did) and what the agent is doing about it, in one sentence, ≤20 words, no counters, no `Δ` fragments, no status tokens. The counts and the tokens are the table's job; duplicating them here just makes the top of the pulse as dense as the bottom, which is the thing this block exists to avoid.

  Order matches the table (same sort), so the reader can drop from a sentence straight to its row. The `(<n> moved, <n> steady, <n> new)` tally counts `Δ` / `▫️` / `🆕` rows respectively — a one-glance answer to "did anything happen in the last 10 minutes?".

**Columns — exactly three, in this order.** Cells are multi-line; use `<br>` for the line break so the markdown table survives rendering.

- **PR** — line 1 is the full clickable path, `github.com/<owner>/<repo>/pull/<number>` (scheme optional, nothing else dropped — see Render every PR / issue reference as a full clickable path). Line 2 is `@<author> — <TLDR>`: a ≤10-word plain-English summary of what the PR does, written from the title and body, not a copy of the title when the title is uninformative. Author is always shown here, mixed-author list or not — the whole point of the pulse is knowing whose work is moving. Prepend `[WIP]` / `[Draft]` tags to the TLDR when they apply.

  **Line 3 — the delta, always present.** It sits directly under the TLDR because "what does this PR do" and "what happened to it since you last looked" are the same question one beat apart; the reader gets both without crossing columns. One of three forms, matching the Status change marker:

  | Marker row | Line 3                                                |
  | ---------- | ----------------------------------------------------- |
  | `Δ`        | `Δ <fragment> · <fragment> · …` — what actually moved |
  | `▫️`       | `▫️ No change since last ping-pong`                   |
  | `🆕`       | `🆕 First ping-pong — no prior snapshot`              |

  Each changed signal is one `·`-separated fragment: old→new form where a value flipped, signed form where a counter moved — `Δ CI green→failing · +2 open threads`, `Δ 4 threads resolved · +1 approval · CI failing→green`. Cap at the three most significant fragments and append ` · +N more` rather than letting the cell sprawl. When the PR moved but no agent touched it (someone else pushed, a reviewer commented), prefix the fragments `Δ (external)`. Never leave line 3 blank — an unchanged row says so out loud, because a silent cell is indistinguishable from a pulse that failed to diff.

- **Status** — the PR's own state, independent of any agent. **One color emoji, then up to three plain-text component lines, in a fixed order.** Never a comment dump, never a prose reason, never the word "GREEN" / "RED" / "YELLOW" spelled out — the emoji _is_ the roll-up and the component lines are the evidence. The per-thread counts live in the Agent cell, because acting on them is the agent's job.

  ```
  <change marker> <color emoji>
  <CI line>
  <review line>            ← only when there is something to say
  MERGE CONFLICT           ← only when conflicting
  ```

  Joined with `<br>` in the rendered cell, same as every other column. All applicable component lines print — a PR that is conflicting _and_ has changes requested shows both, because the color already collapsed them into one signal and the lines are there to say which.

  **Line 1 — `<change marker> <color emoji>`.** The change marker leads, so a scan down the column answers "what moved since the last pulse?" before anything else.

  | Marker | When                                                              |
  | ------ | ----------------------------------------------------------------- |
  | `Δ`    | Anything about this PR differs from its previous pulse — it moved |
  | `▫️`   | Identical to the previous pulse — nothing moved                   |
  | `🆕`   | First pulse for this PR — no prior snapshot to compare against    |

  A "change" is any difference in the color emoji, any component line, **or any counter in the Agent cell's counters line** — a resolved thread, a new approval, one more green check all count. The marker lives in the Status column but diffs the whole row. Never render `▫️` on a PR you have no prior snapshot for; that is `🆕`.

  **The color emoji** is the whole verdict, rolled up from the component lines below. Evaluate top-down, first match wins:

  | Emoji | When                                                                                         |
  | ----- | -------------------------------------------------------------------------------------------- |
  | `🔴`  | **Any** of: CI failed, reviewer requested changes, merge conflict                            |
  | `🟡`  | Nothing red, but not yet all-clear: build still running, or nobody has reviewed it yet       |
  | `🟢`  | CI passed **and** approved **and** no merge conflict — the only combination that earns green |
  | `❓`  | Status fetch failed — cannot roll up. Component lines say which call failed (see Edge cases) |

  Red is checked before yellow so a failing check on a still-running build reads red, not yellow. Green is a conjunction of all three conditions — a PR that is CI-green and unreviewed is `🟡`, never `🟢`.

  **Line 2 — CI, always printed.** Exactly one of:

  | Line                              | When                                                           |
  | --------------------------------- | -------------------------------------------------------------- |
  | `CI PASSED`                       | Every required check succeeded (neutral / skipped count as ok) |
  | `CI FAILED — <check>`             | Any required check failed. Name the first failing check        |
  | `BUILD IN PROGRESS (<n> running)` | Checks still queued or running, none failed yet                |

  **Line 3 — review, printed whenever the review state is known.** Exactly one of:

  | Line                | When                                                                 |
  | ------------------- | -------------------------------------------------------------------- |
  | `APPROVED`          | `reviewDecision == "APPROVED"`                                       |
  | `CHANGES REQUESTED` | `reviewDecision == "CHANGES_REQUESTED"`                              |
  | `AWAITING REVIEW`   | `reviewDecision` is null or `REVIEW_REQUIRED` — nobody has ruled yet |

  `AWAITING REVIEW` is printed rather than omitted because "waiting on a reviewer" is one of the two things `🟡` can mean, and a yellow row showing only `CI PASSED` leaves the reader guessing which. Omit line 3 entirely only when the review state could not be fetched.

  **Line 4 — `MERGE CONFLICT`, printed only when `mergeable == "CONFLICTING"`.** Absent means no conflict; there is no "no conflict" line, because a clean merge is the default and printing it on every row is noise.

  Nothing else goes in this cell. No open-thread counts (Agent cell), no timestamps (Agent cell), no free-form reason clause.

- **Agent** — what the dispatched job is doing. **Two lines, not three:** line 1 is the state token plus its clock, line 2 is the counters line. The timing used to sit on its own line; it is folded into line 1 because "which state, since when, for how long" is one thought and reads worse split across two rows. No delta here — that lives under the TLDR in the PR cell.

  **Line 1 — `<state token>[ (loop N/M)] — <clock>`.**

  | Token            | When                                               | Clock                                        |
  | ---------------- | -------------------------------------------------- | -------------------------------------------- |
  | `⚪ NOT STARTED` | Resolved but not dispatched (queued behind a wave) | `queued, wave 2` (no clock; nothing started) |
  | `🔄 IN PROGRESS` | Job actively working this pass                     | `started 17:12 · running 22m`                |
  | `⏸️ WAITING`     | Pass done, sleeping until the next one             | `ended 16:58 · ran 19m · next 17:28`         |
  | `✅ COMPLETED`   | Job finished all passes, or the PR merged          | `ended 17:05 · 48m total`                    |
  | `⏭️ SKIPPED`     | Per-PR skill skipped it (draft / already reviewed) | `17:02 — draft`                              |
  | `⚠️ ESCALATED`   | Job stopped and needs human judgment               | `stopped 17:01 · ran 19m — needs human`      |
  | `❌ FAILED`      | Job errored out                                    | `failed 16:44 · ran 4m — worktree conflict`  |

  **Clock grammar.** Times are local `HH:MM`, 24-hour, no date (the header block already carries the date). Durations are `<N>m` under an hour, `<N>h <N>m` over it, always whole minutes — a pulse is a 10-minute heartbeat, so seconds are noise.

  - `running <N>m` on `🔄 IN PROGRESS` is **elapsed since the current loop started**, recomputed at render time (`now − loop start`), not the total across loops. That is the number a human actually wants: "has this pass been stuck for 45 minutes?"
  - `ran <N>m` on a finished-pass state is that pass's own wall time (`pass end − pass start`).
  - `<N>m total` on `✅ COMPLETED` is the whole job, first dispatch to final pass end, across every loop.
  - A clock field with no data prints nothing rather than `0m` or `--`; drop the field and its `·` separator. Never invent a start time to fill the slot.

  The loop counter is `(loop N/M)` whenever the per-PR command loops. Both looping commands run ≥3 passes 30 min apart, so `M = 3` for `/sy-babysit-pr` and for `/sy-review-pr` alike. Drop the counter entirely only for a genuinely single-pass per-PR command (`🔄 IN PROGRESS — started 17:12 · running 6m`).

  **The clock is excluded from the change-marker diff.** Elapsed time moves on every pulse by definition, so counting it as a change would render `Δ` on every running row forever and destroy the marker's only job. Diff the state token, the loop number, the Status cell, and the counters line — never `running <N>m`, never a recomputed `next <HH:MM>`. A row whose only difference is the clock ticking is `▫️`.

  **Line 2 — counters line.** One line, always printed, always all three fields, always this order, `·`-separated:

  `💬 <n> open · ✔ <n> resolved · ⚠️ <n> need attention`

  | Field                   | Meaning                                                                                                                                                                         |
  | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `💬 <n> open`           | Unresolved review threads still on the PR — the agent's remaining queue                                                                                                         |
  | `✔ <n> resolved`        | Review threads resolved — what the agent (or the author) has already worked through                                                                                             |
  | `⚠️ <n> need attention` | Threads the agent read but **cannot** act on alone: no good option is obvious, the fix is a product/design call, the reviewer and the code disagree, or it needs human judgment |

  Zeros are printed, never omitted — a fixed three-field line is what makes two pulses diffable at a glance, and a missing field reads as "not measured" rather than "none". `⚠️ need attention` is a strict subset of `💬 open` (a thread the agent is stuck on is by definition still open), so `need attention ≤ open` always; a pulse where it exceeds `open` is a bookkeeping bug, not a render choice. It counts **comment threads**, not CI failures or conflicts — those are already the Status color. A non-zero `⚠️` is the signal a human has to read this PR themselves; pair it with `⚠️ ESCALATED` on line 1 when the job stopped over it.

  Counts come from the caller's ledger where the agent tracked them; standalone with no ledger, fill `💬` / `✔` from `reviewThreads` and print `⚠️ 0 need attention` (nothing has judged them). On a failed fetch, print `?` in the affected field rather than guessing `0`.

**Agent state comes from the caller.** `/sy-list-prs` owns the layout, not the job bookkeeping. The dispatcher passes its agent ledger (per PR: job state, loop number, first dispatch time, last pass start / end, next pass ETA, and the open / resolved / need-attention thread counts) alongside the scope. Every clock field on the Agent line is read from that ledger — `/sy-list-prs` computes only the elapsed subtraction (`now − loop start`), never the timestamps themselves. Invoked standalone with no ledger, every Agent cell renders `⚪ NOT STARTED — no agent dispatched` plus a counters line derived straight from `reviewThreads` — the pulse still works as a read-only board.

**The previous snapshot comes from the caller too.** The change marker is a diff, so it needs the prior pulse to diff against: the ledger carries, per PR, the last rendered color emoji, component lines, and counters line. After rendering, the dispatcher overwrites that snapshot with what was just printed, so the next pulse compares against the immediately preceding one — not against the run's opening state. With no prior snapshot (standalone invocation, first pulse of a run, or a PR that entered the set mid-run), the row is `🆕` with `🆕 First ping-pong — no prior snapshot` on line 3 of the PR cell.

**Sort:** `🔴` first, then `🟡`, then `🟢`, then `❓`; within one color, `Δ` rows come before `🆕` before `▫️`; ties broken by repo name then PR number. Red work reads first because that is the row a human has to act on, and moved work reads before parked work because that is the row that changed since they last looked.

**Never** decorate the PR path line with extra prefixes or suffixes, and never split the pulse into per-group tables — the flat board is the format.

## Edge cases

- **Scope = all**, author has zero open PRs → print `No open PRs found for <author>.` and stop.
- **Scope = pwd**, zero git repos under cwd → print `No git repos found within 2 levels of $(pwd).` and stop. If repos resolved but zero matching PRs → print `No open PRs found for @me in <N> repos under $(pwd).` and stop.
- **Format = `links` or `clusters`, any zero-result case** → print nothing and stop. The "no PRs found" / "no git repos found" prose above is suppressed in both, because a consumer reading the output line-by-line would treat that sentence as a link.
- **Format = `clusters`, nothing clusters** → every PR is standalone; print only the `### Standalone (<n>)` block, numbering unchanged. Never fabricate a cluster to avoid an all-standalone render, and never drop the heading.
- **Format = `clusters`, a PR matches two cluster keys** → clustering is transitive, so the two clusters are one; label it with the strongest signal that fired (lowest signal number) and say so in the heading when that signal was inference.
- **Scope = explicit refs**, a bare `#<n>` / digits token and cwd is not a git repo → error out, name the unresolvable token, ask the user to use a fully-qualified ref. Unparseable token (not a URL, shorthand, `#<n>`, or digits) → error out, name the bad token, do NOT silently skip.
- PWD keyword + explicit refs in the same call → error (no mixing).
- **Format = `pingpong`, zero PRs resolved** → still print the header block (counts of `0`, an empty `Pulse (0 moved, 0 steady, 0 new):` line, repo list intact) and skip the table. A pulse that prints nothing is indistinguishable from a dead agent, which defeats the purpose.
- **Format = `pingpong`, no prior snapshot** (standalone call, or the run's opening pulse) → every row is `🆕`, never `▫️`. `▫️` is a positive claim that nothing moved; only render it when you actually have a previous pulse to compare against.
- **Format = `pingpong`, a PR dropped out of the set** (merged, closed, or no longer matches the scope) → keep it for one final pulse with its last known Status, `✅ COMPLETED` in the Agent cell, and a `Δ merged` / `Δ closed` line, then drop it. A row that silently vanishes reads as a lost job.
- **Format = `pingpong`, a status fetch failed** → the row renders `❓` as its color emoji and names the call that failed in place of the component lines (`STATUS FETCH FAILED — statusCheckRollup`). Never guess a color from partial data, and never drop the row: a missing row reads as "merged", which is the opposite of "we don't know".
- **Format = `pingpong`, the ledger has no clock for a state that normally carries one** (dispatcher lost the timestamp, or the job predates the ledger) → print the state token with no clock at all. Do not backfill `0m`, `--`, or the pulse's own timestamp; an absent clock is honest, an invented one sends someone chasing a job that never ran that long.
- If a single PR's status fetch fails, include it under NEEDS ATTENTION with the reason `status fetch failed` rather than dropping it silently.
- If `reviewDecision` is `null` (no reviews requested yet), treat as `NEED APPROVAL` (not READY).
- **Scope = explicit refs** is author-agnostic, so it's the scope most likely to come back mixed — always run the mixed-author check on it. PWD scope forces `--author=@me` and can never be mixed; `all` scope with an explicit author token is single-author but that author may not be you, in which case say whose PRs these are rather than repeating one handle on every row.
