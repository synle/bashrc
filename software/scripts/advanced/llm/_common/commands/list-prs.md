[Sy] List open pull requests across repos, grouped by readiness. Defaults to `short` format (just full links).

## Inputs

`$ARGUMENTS` is a free-form string that may carry three independent dimensions: a **format keyword**, a **scope**, and an **author**.

- **Format keyword** (one of, case-insensitive): `short`, `long`, `table`, `links`, `pingpong`. Defaults to `short` if absent. `links` (alias `link`) prints bare PR URLs with no headings at all. `pingpong` (aliases `ping-pong`, `pulse`) is the agent-status heartbeat render used by `/sy-babysit-prs` and `/sy-review-prs`.
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
- `/sy-list-prs long https://github.com/synle/bashrc/pull/42 synle/foo#7` → long format, those two PRs only
- `/sy-list-prs #42` → short format, PR #42 in cwd's repo (cwd must be a git repo)
- `/sy-list-prs pingpong` → ping-pong pulse render, `@me` PRs in repos under cwd
- `/sy-list-prs pingpong pwd` → same, explicit PWD scope (what `/sy-babysit-prs` passes on every pulse)
- `/sy-list-prs links` → bullet list of PR URLs (`- <url>` per line) — `@me` PRs in repos under cwd
- `/sy-list-prs links all` → bullet list of every `@me` PR URL across all repos

## Parsing $ARGUMENTS

1. Tokenize `$ARGUMENTS` on whitespace. (Quoted multi-word author names — e.g. `"Alice Doe"` — preserve as one token.)
2. **Extract the format keyword** — pick the first token (case-insensitive) that matches `short`, `long`, `table`, `links` / `link` (both normalize to `links`), or `pingpong` / `ping-pong` / `pulse` (all three normalize to `pingpong`). Remove it from the token list. If no match, format = `short`.
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
   - CI/build status: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup` → passing / failing / pending
   - Reviews: `gh pr view <number> --repo <owner/repo> --json reviews,reviewDecision` → approved (count) / changes requested / pending review
   - Unresolved review comments: `gh pr view <number> --repo <owner/repo> --json reviewThreads --jq '[.reviewThreads[] | select(.isResolved == false)] | length'` → count of open threads
   - Mergeability / conflicts: `gh pr view <number> --repo <owner/repo> --json mergeable,mergeStateStatus`

## Classification — 5 groups

Classify each PR into exactly one group. Evaluate in this priority order (first match wins):

1. **NOT READY / WIP / DRAFT** — `isDraft` is true OR title contains `WIP` or `DO NOT MERGE` (case-insensitive). Tag titles with `[Draft]` and/or `[WIP]` in the output.
2. **NEEDS ATTENTION** — would otherwise be ready (not draft, no WIP/DNM in title) BUT one or more of:
   - CI status is `failing` (any required check failed).
   - `reviewDecision == "CHANGES_REQUESTED"` (reviewer left blocking comments).
   - `mergeable == "CONFLICTING"` (merge conflicts).
3. **NEED APPROVAL** — CI is `passing` (or all checks neutral/skipped), no merge conflicts, but `reviewDecision != "APPROVED"` (still awaiting review).
4. **READY TO MERGE (with comments)** — CI passing, approved, no conflicts, but unresolved review threads > 0.
5. **READY TO MERGE** — CI passing, approved, no conflicts, zero unresolved review threads. Fully clear to merge.

Pending CI (no failures, but some checks still running) bubbles up alongside its other signals — it does not by itself force "NEEDS ATTENTION", but it does prevent the PR from being "READY TO MERGE" (it lands in "NEED APPROVAL" or stays in its current group based on review state).

## Sort within each group

Apply in order; each tiebreaker applies only when the previous is equal:

a. Repo name (alphabetical).
b. Dependency order — if PR A must merge before PR B (e.g. B's branch is based on A's branch, or B's description references A's PR number), put A first.
c. `createdAt` ascending — oldest PR first, newest last.

## Output format

Print groups in this fixed display order. Skip empty groups (don't print the heading if `N == 0`). Each group heading is `## <Group Name> (N)`.

### Mixed-author disclosure

Before rendering, resolve your own handle once (`gh api user --jq .login`) and compare it against every PR's `author.login`.

- **All PRs are yours** → omit the author entirely. It's noise.
- **Any PR has a different author** → the list is mixed. Surface authors in every format, and lead the output with one line: `Mixed authors: <handle> (N), <handle> (N), …`.

Where the author goes, per format:

| Format     | Placement                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `short`    | Group heading only — `## NEEDS ATTENTION (2 — @me 1, @alice 1)`. **URL lines stay bare.**      |
| `long`     | In the description line, right after the repo: `#123 [owner/repo] @alice — <title> — <status>` |
| `table`    | A dedicated `Author` column, inserted after `Repo`                                             |
| `links`    | Nowhere — `links` is pure machine input and carries no author, heading, or summary line        |
| `pingpong` | Second line of the `PR` cell — the author is always shown, mixed or not                        |

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
#123 [owner/repo-a] Add user signup flow — CI failing
https://github.com/owner/repo-a/pull/123

#456 [owner/repo-b] Refactor auth middleware — changes requested
https://github.com/owner/repo-b/pull/456

## READY TO MERGE (1)
#789 [owner/repo-c] Bump deps to latest
https://github.com/owner/repo-c/pull/789
```

The short description line is: `#<number> [<owner/repo>] <title> — <reason / status>`. On a mixed-author list, insert the author after the repo: `#<number> [<owner/repo>] @<author> — <title> — <reason / status>`. Strip a leading `[<repo>] ` prefix from `<title>` when it matches the repo already printed on that line — the repo is its own field, so keeping it in the title prints it twice. For NEEDS ATTENTION, include the specific blocker (`CI failing`, `changes requested`, `merge conflict`). For NOT READY / WIP / DRAFT, prepend tags `[Draft]` / `[WIP]` to the title.

### Format: `table`

Print one markdown table per group with these columns:

| PR | Repo | Title | Link | CI Status | Approvals | Comments | Ready to Merge? |

On a mixed-author list, insert an `Author` column immediately after `Repo`, filled in for **every** row (including your own) so the rows stay comparable.

- **PR**: PR number and branch name on separate lines (e.g. `#123` then `feature-branch` below it).
- **CI Status**: `passing` / `failing` / `pending` (and which check failed if applicable).
- **Approvals**: `approved (count)` / `changes requested` / `pending review`.
- **Comments**: count of unresolved review threads (`0` if none).
- **Ready to Merge?**: `yes` if group 5 (READY TO MERGE), `yes with N open comments` if group 4, otherwise `no` with the blocker.
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

### Format: `pingpong`

The heartbeat / pulse render. One flat board — no per-group tables — answering "what is going on right now, and what are the agents doing about it". `/sy-babysit-prs` and `/sy-review-prs` emit this on a fixed cadence so a long async fan-out is never a black box.

Structure: a header block, then one table. Keep every cell terse — fragments, not sentences. This is a status board, not prose.

```
🏓 Agent Status Ping-Pong — 2026-08-05 17:34 PDT
Next ping-pong: 2026-08-05 17:44 PDT (in 10 min)

Repos Scanned (3): acme/widget-store, acme/api, acme/web
PRs Scanned (5):
- acme/widget-store: 2
- acme/api: 2
- acme/web: 1

| PR | Status | Agent |
| --- | --- | --- |
| github.com/acme/widget-store/pull/109<br>@alice — Retry token refresh on 401 | ⛔ BLOCK<br>CI failing — `unit-tests` red | 🔄 IN PROGRESS (loop 1/3)<br>Loop 1 started 17:12 |
| github.com/acme/widget-store/pull/113<br>@me — Drop dead feature flag | 💬 COMMENT<br>2 open threads, awaiting review | ⏸️ WAITING (loop 2/3)<br>Loop 2 ended 16:58 — next loop 17:28 |
| github.com/acme/api/pull/42<br>@me — Bump deps to latest | ✅ APPROVE<br>green + approved, 0 open threads | ✅ COMPLETED<br>Loop 3 ended 17:05 |
| github.com/acme/api/pull/51<br>@bob — Add signup flow | ⏳ PENDING<br>CI still running (3 checks) | ⚪ NOT STARTED<br>Queued — wave 2 |
| github.com/acme/web/pull/7<br>@me — [WIP] Split auth middleware | ⛔ BLOCK<br>merge conflict with main | ⚠️ ESCALATED<br>Loop 2 stopped 17:01 — needs human |
```

**Header block:**

- Line 1: `🏓 Agent Status Ping-Pong — <current timestamp>` (local time, with zone).
- Line 2: `Next ping-pong: <timestamp> (in <N> min)`. On the final pulse of a run, write `Next ping-pong: — (final)` instead.
- `Repos Scanned (<count>): <owner/repo>, <owner/repo>, …` — the resolved scope, comma-separated.
- `PRs Scanned (<count>):` followed by one `- <owner>/<repo>: <n>` line per repo. Repos with zero matching PRs still get a line with `0` — a scanned-but-empty repo is a real answer.

**Columns — exactly three, in this order.** Cells are multi-line; use `<br>` for the line break so the markdown table survives rendering.

- **PR** — line 1 is the full clickable path, `github.com/<owner>/<repo>/pull/<number>` (scheme optional, nothing else dropped — see Render every PR / issue reference as a full clickable path). Line 2 is `@<author> — <TLDR>`: a ≤10-word plain-English summary of what the PR does, written from the title and body, not a copy of the title when the title is uninformative. Author is always shown here, mixed-author list or not — the whole point of the pulse is knowing whose work is moving. Prepend `[WIP]` / `[Draft]` tags to the TLDR when they apply.
- **Status** — the PR's own state, independent of any agent. Line 1 is one verdict token with its icon; line 2 is a short high-level reason (what is blocked / what was commented on). Never a comment dump — one clause.

  | Token         | When                                                    |
  | ------------- | ------------------------------------------------------- |
  | `✅ APPROVE`  | Approved, CI green, no conflicts (ready to merge)       |
  | `⛔ BLOCK`    | CI failing, `CHANGES_REQUESTED`, or merge conflict      |
  | `💬 COMMENT`  | Open review threads or a non-blocking review posted     |
  | `⏳ PENDING`  | CI still running, or no review yet                      |
  | `❓ UNKNOWN`  | Status fetch failed — say which call failed             |

- **Agent** — what the dispatched job is doing. Line 1 is the state token (with loop counter when the per-PR command loops); line 2 is the timing detail.

  | Token                        | When                                                 | Line 2 example                              |
  | ---------------------------- | ---------------------------------------------------- | ------------------------------------------- |
  | `⚪ NOT STARTED`             | Resolved but not dispatched (queued behind a wave)   | `Queued — wave 2`                           |
  | `🔄 IN PROGRESS (loop N/M)`  | Job actively working this pass                       | `Loop 1 started 17:12`                      |
  | `⏸️ WAITING (loop N/M)`      | Pass done, sleeping until the next one               | `Loop 2 ended 16:58 — next loop 17:28`      |
  | `✅ COMPLETED`               | Job finished all passes, or the PR merged            | `Loop 3 ended 17:05`                        |
  | `⏭️ SKIPPED`                 | Per-PR skill skipped it (draft / already reviewed)   | `Skipped 17:02 — draft`                     |
  | `⚠️ ESCALATED`               | Job stopped and needs human judgment                 | `Loop 2 stopped 17:01 — needs human`        |
  | `❌ FAILED`                  | Job errored out                                      | `Loop 1 failed 16:44 — worktree conflict`   |

  The loop counter is `N/M` only when the per-PR command loops — `/sy-babysit-pr` runs ≥3 passes 30 min apart, so `M = 3`. `/sy-review-pr` is a single pass: drop the counter entirely (`🔄 IN PROGRESS`, `✅ COMPLETED`).

**Agent state comes from the caller.** `/sy-list-prs` owns the layout, not the job bookkeeping. The dispatcher passes its agent ledger (per PR: job state, loop number, last pass start/end, next pass ETA) alongside the scope. Invoked standalone with no ledger, every Agent cell renders `⚪ NOT STARTED<br>no agent dispatched` — the pulse still works as a read-only board.

**Sort:** `⛔ BLOCK` first, then `⏳ PENDING`, `💬 COMMENT`, `✅ APPROVE`, `❓ UNKNOWN`; ties broken by repo name then PR number. Blocked work reads first because that is the row a human has to act on.

**Never** decorate the PR path line with extra prefixes or suffixes, and never split the pulse into per-group tables — the flat board is the format.

## Edge cases

- **Scope = all**, author has zero open PRs → print `No open PRs found for <author>.` and stop.
- **Scope = pwd**, zero git repos under cwd → print `No git repos found within 2 levels of $(pwd).` and stop. If repos resolved but zero matching PRs → print `No open PRs found for @me in <N> repos under $(pwd).` and stop.
- **Format = `links`, any zero-result case** → print nothing and stop. The "no PRs found" / "no git repos found" prose above is suppressed in `links` mode; a consumer reading the output line-by-line would treat that sentence as a link.
- **Scope = explicit refs**, a bare `#<n>` / digits token and cwd is not a git repo → error out, name the unresolvable token, ask the user to use a fully-qualified ref. Unparseable token (not a URL, shorthand, `#<n>`, or digits) → error out, name the bad token, do NOT silently skip.
- PWD keyword + explicit refs in the same call → error (no mixing).
- **Format = `pingpong`, zero PRs resolved** → still print the header block (counts of `0`, repo list intact) and skip the table. A pulse that prints nothing is indistinguishable from a dead agent, which defeats the purpose.
- If a single PR's status fetch fails, include it under NEEDS ATTENTION with the reason `status fetch failed` rather than dropping it silently.
- If `reviewDecision` is `null` (no reviews requested yet), treat as `NEED APPROVAL` (not READY).
- **Scope = explicit refs** is author-agnostic, so it's the scope most likely to come back mixed — always run the mixed-author check on it. PWD scope forces `--author=@me` and can never be mixed; `all` scope with an explicit author token is single-author but that author may not be you, in which case say whose PRs these are rather than repeating one handle on every row.
