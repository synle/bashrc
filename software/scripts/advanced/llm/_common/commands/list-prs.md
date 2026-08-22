[Sy] List open pull requests across repos, grouped by readiness. Defaults to `short` format (just full links).

## Inputs

`$ARGUMENTS` is a free-form string that may carry three independent dimensions: a **format keyword**, a **scope**, and an **author**.

- **Format keyword** (one of, case-insensitive): `short`, `long`, `table`, `links`, `clusters`, `pingpong`. Defaults to `short` if absent. `links` (alias `link`) prints bare PR URLs with no headings at all. `clusters` (aliases `cluster`, `grouped`, `feature`) prints the same URLs bucketed by **feature cluster** — one feature that spans several repos reads as one block — with a running `pr<N>` handle on every line; it is what `/sy-list-prs-pending` renders. `pingpong` (aliases `ping-pong`, `pulse`) is the agent-status heartbeat render used by `/sy-babysit-prs` and `/sy-review-prs`, grouped by feature set / dispatch slot so a cross-repo feature reads as one block.
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

**Fast path — one call instead of one-per-PR.** Everything in this section (repo discovery, the open-PR search, CI rollup, review decision, review threads, mergeability) is already implemented as a standalone command, `list_prs` — a Node CLI installed at `~/.local/bin/list_prs`, with four shell wrappers (`pr_list_my_open` / `pr_list_my_need_attention` / `pr_list_other_open` / `pr_list_other_need_attention`, plus `pr_list` as a bare alias for the first). It enriches up to three PRs concurrently, keeps successful rows in search order before display sorting, normalizes leading WIP / DO NOT MERGE / DNM markers to one `WIP: ` prefix, and places WIP rows after non-WIP rows. Check for it first:

```bash
type pr_list_my_open
```

When it exists, one call returns the whole set as JSON and every field below is already in it — no `gh search prs`, no per-PR `gh pr view`, no per-PR GraphQL:

```bash
pr_list_my_open --json                                  # scope = all  (every repo you have a PR in)
pr_list_my_open --json --cwd                            # scope = pwd  (git repos discovered at/below cwd)
pr_list_my_open --json <owner>/<repo> <owner>/<repo>    # explicit repo list
pr_list_my_open --json --author=<handle>                # same scopes, one named author
pr_list_other_open --json --cwd                         # everyone else's PRs in the repos below cwd
```

`pr_list_my_open` is `list_prs --all --me=1` — every open PR, ready-to-merge ones included. Use it here: the sibling `pr_list_my_need_attention` (`list_prs --me=1`) applies a pending filter that drops the fully-green PRs `short` / `long` / `table` / `links` / `clusters` still have to render. `/sy-list-prs-pending` is the one caller that wants the filter, so it may call `pr_list_my_need_attention` instead and skip its own Step 2. Repo scope is a flag, not a positional: with no repo argument and no `--cwd` a mine-only search is **global** (every repo you have an open PR in); pass `--cwd` to scope it to the git repos at or below the current folder. Audience is `--me=1` (yours) / `--me=0` (everyone but you) / omitted (everyone), and anything wider than yourself implies `--cwd`, since an unscoped search of everyone's PRs is all of GitHub. `--json` output is always plain (no ANSI); the default text render is two lines per PR (colored title, then URL), `--verbose` adds a third metadata line, `--links` prints only the URLs, and color is emitted only for an interactive terminal.

Each JSON row carries `url repo number title author createdAt updatedAt ageDays headRefName baseRefName isDraft isWip group signal color reasonIcon reasonTag autoMerge autoMergeMethod ci review failedCheck runningChecks approvalGates mergeable mergeStateStatus openThreads openHumanThreads openBotThreads resolvedThreads status` — including `headRefName` / `baseRefName` (which `gh search prs` cannot return) and the unresolved / bot-vs-human thread split (which `gh pr view --json` cannot return), so the two field traps below do not apply on this path. `group` is already this file's Classification; `signal` (aliased as `color`) is its roll-up emoji, computed with the same rules; `approvalGates` counts the pending human gates the CI status already excluded.

**`reasonIcon` names the cause; `signal` only names the severity.** Three different problems all roll up to 🔴, so a red row still needs a click to find out which — the reason icon answers that in one glyph. First match wins, in Work-owed ranking order (a blocked human outranks broken machinery outranks a stale branch), so a PR that is conflicting _and_ has changes requested reads 🗣️ while `status` still lists every component:

| Icon | Tag           | Means               | Fires when                                        |
| ---- | ------------- | ------------------- | ------------------------------------------------- |
| 🛑   | `[draft]`     | Draft / WIP         | `isDraft` or a WIP / DNM title — checked first    |
| 🗣️   | `[rejected]`  | Changes requested   | `reviewDecision == "CHANGES_REQUESTED"`           |
| ⚔️   | `[conflict]`  | Merge conflict      | `mergeable == "CONFLICTING"`                      |
| 💥   | `[ci-failed]` | CI failed           | A check finished with a failing conclusion        |
| 🔨   | —             | Build in progress   | Self-resolving checks still running               |
| ⏳   | —             | Awaiting review     | Not yet approved, nothing else pending            |
| 🔄   | `[behind]`    | Behind base         | `mergeStateStatus == "BEHIND"`, nothing else open |
| 💬   | —             | Ready, threads open | Green and approved, unresolved threads remain     |
| 🚀   | —             | Ready to merge      | Green, approved, no conflict, no open threads     |

**The icon and the tag come from one key, so they can never disagree.** `reasonKeyFor` picks a single state, and both `reasonIcon` and `reasonTag` are looked up from it — one precedence list, not two that happen to agree today. `reasonTag` is on every JSON row (`""` where the state carries no tag).

**Three tags mean BLOCKED, and only ever one of them shows.** `[rejected]` (a reviewer said no), `[conflict]` (the branches disagree), `[ci-failed]` (the build broke) — these are exactly the three states that roll up to 🔴. "Blocked" is a single answer, not a checklist: a PR that is conflicting _and_ rejected _and_ red prints `[rejected]` alone, while `status` still lists every component. They render **bold red**; a blocked PR's title is already red, so weight rather than hue is what keeps them readable. `[behind]` and `[draft]` are dim, because neither is a failure — a behind branch just needs a sync, and a draft is not finished being written.

**Four states carry no tag at all.** Awaiting review, building, ready, and ready-with-threads say everything in the icon; tagging all nine would put a bracket on every row and mean nothing.

**Two encoding rules pick the glyphs, and a replacement has to satisfy both.** Prefer no `U+FE0F` variation selector — a VS16 pair renders narrow in several terminals and knocks the scanned column out of alignment — and prefer the oldest emoji version that still says the right thing, since a recent codepoint is tofu on an older font. That is why build-in-progress is 🔨 `U+1F528` ("hammer", E0.6, no VS16) and not 🏗️ `U+1F3D7 U+FE0F` ("building construction", E0.7, VS16). Unicode has no traffic-cone emoji to prefer over either.

**A glyph also has to survive being read out of context**, which is what retired the two cutest ones. 👀 for awaiting-review read as "look at this" — an attention grab on the one row that wants nothing from you, since it is the _reviewer_ being waited on; ⏳ says "waiting on a person" and matches the ⏳ the status line already uses for a pending approval gate. 🐌 for behind-base editorialized ("slow", "neglected") about a branch that is merely out of date; 🔄 names the actual remedy, which is a sync. **Every state keeps an icon**, even the untagged ones — these are read as a column, so dropping one glyph starts that title a character earlier than the other eight and re-ragged the edge the column exists to remove.

**A running build also gets a trailing `…`, in magenta.** It is the one state on the list that resolves itself while you read the output — every other one waits on a person — so it earns a "still moving, come back" marker in punctuation every reader already knows. Magenta because red / yellow / green are all spoken for by the roll-up signal and blue is the URL line, so the marker would otherwise read as a severity it does not have. The suffix is render-only: `title` in JSON stays clean and `runningChecks` already carries the same fact, so nothing matching a PR by name ever sees it.

**`autoMerge` says whether GitHub will merge it without you.** True when `autoMergeRequest.enabledAt` is set; `autoMergeMethod` carries `SQUASH` / `MERGE` / `REBASE`. It changes what a human should do with a row — an armed 🟡 needs no babysitting, the same row unarmed is waiting on someone to come back and click. The CLI renders it as a **dim `[auto-merge]` tag after the reason tag, never an icon**: GitHub landing the PR itself is a property of the row, not a tenth reason it is stuck, so it must not compete with the reason column for the same glance. `status` carries an `AUTO-MERGE (<method>)` token either way.

**Every text marker survives losing color; only the tone is conditional.** `[rejected]`, `[behind]`, `[auto-merge]`, and the `…` all print under `--links`, a pipe, `NO_COLOR`, and a redirect. Those renders lose bold / dim / magenta but never a fact — which is the whole reason these are words and punctuation rather than styling.

**Icons go on the title line only — never on a URL line.** The two-line human render is `<reasonIcon> [<reasonTag>] [auto-merge] <headRefName> : <title>[…]` then the bare URL, and `--links` is unchanged. Same rule as `short` below: consumers read URL lines, so decorating them breaks every caller.

**The head branch prefixes the title, in cyan, separated by `:`.** It is the handle every local command takes (`worktree_create`, `git checkout`, `git log`), and the only field that says _where_ the work lives — a URL alone forces a click to find out. Cyan because every other slot is spoken for (red / yellow / green by the roll-up signal, blue by the URL line, magenta by the running marker) and because a branch is an address you retype, not a footnote — dim would hide the one field you copy out of the render. It goes **after** the tags and **before** the title so the reason column stays flush, and it is render-only: `headRefName` is already its own JSON field and `title` stays clean, so nothing matching a PR by name ever sees it. Omitted when `headRefName` is empty (the explicit-refs fallback path), never replaced by a placeholder.

**The fast path covers all three repo scopes, not explicit PR refs.** Plain `pr_list_my_open --json` serves **all** scope (global search), `--cwd` serves **pwd** scope, and positional slugs serve an **explicit repo list**; `--author` / `--me` change only whose PRs it looks for. Fall through to the manual `gh search prs` steps whenever the command is absent, exits non-zero, or scope is explicit PR refs (it takes repos, not PR numbers).

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
     `gh search prs --author=@me --state=open --limit 1000 --repo <o1>/<r1> --repo <o2>/<r2> ... --json number,title,repository,isDraft,url,createdAt,updatedAt,author`

   b. **Scope = all**:
   `gh search prs --author=<resolved> --state=open --limit 1000 --json number,title,repository,isDraft,url,createdAt,updatedAt,author`

   c. **Scope = explicit refs**:
   - For each normalized PR URL, fetch metadata:
     `gh pr view <url> --json number,title,headRefName,baseRefName,isDraft,url,createdAt,updatedAt,author`
   - De-duplicate by URL. Order preserves the user's input order; classification + sort still happen below.

   **Two `gh` field traps, both verified against `gh` 2.88 — get these wrong and discovery aborts before anything else runs:**
   - **`gh search prs` and `gh pr view` do not take the same `--json` fields.** `gh search prs` accepts only: `assignees author authorAssociation body closedAt commentsCount createdAt id isDraft isLocked isPullRequest labels number repository state title updatedAt url`. It has **no** `headRefName` / `baseRefName` — asking for either exits 1 with `Unknown JSON field`. `gh pr view` is the mirror image: it _has_ `headRefName` / `baseRefName` but has **no** `repository` (it offers `headRepository` / `headRepositoryOwner` instead). So branch names come from a per-PR `gh pr view`, never from the search; the owning repo comes from the search's `repository.nameWithOwner`, never from `gh pr view`.
   - **`gh search prs` silently returns only 30 results by default.** No warning, no truncation notice — the tail simply is not there, and a fan-out then reports full coverage of a set it never saw. Always pass `--limit` explicitly. **`--limit` accepts 1–1000** (`--limit 1001` is rejected with `` `--limit` must be between 1 and 1000 ``), and 1000 is also where GitHub's search API itself stops, so it is both the flag ceiling and the real one. If the result count comes back exactly at the limit, say so and treat the set as **possibly truncated** rather than complete — then exhaust the scope by partitioning it (one search per repo, or by `created:<range>` windows) and unioning the results on PR URL. A scope that cannot be exhausted is reported as partial; it is never silently trimmed.
   - **Branch names are fetched only when something needs them.** Stack detection and worktree paths need `headRefName` / `baseRefName`, so a caller that does stack detection (`/sy-babysit-prs`, `/sy-review-prs`) follows the search with one `gh pr view <url> --json headRefName,baseRefName` per PR. Plain `short` / `links` renders skip that call entirely.

2. **For each PR, fetch detailed status:**
   - CI/build status: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup` → `CI PASSED` / `CI FAILED` (name the first failing check) / `BUILD IN PROGRESS` (count the still-running checks). **Count only self-resolving checks as "running"** — classify pending entries exactly as `/sy-babysit-pr` Step 3 does; that is the single definition, do not restate or re-derive it here. A human approval gate that an app reports as a check sits `IN_PROGRESS` by design until a person clicks, so it reads `AWAITING REVIEW`, never a running build: keep it out of the `(<n> running)` count, and when it is the only pending entry the PR is not `BUILD IN PROGRESS` at all.
   - Reviews: `gh pr view <number> --repo <owner/repo> --json reviews,reviewDecision` → `APPROVED` (with approval count) / `CHANGES REQUESTED` / `AWAITING REVIEW`
   - Review threads: **`reviewThreads` is not a `gh pr view --json` field** (`gh` 2.88 rejects it — it exists on the GraphQL `PullRequest` type only), so fetch it over GraphQL and reuse the one result for every thread-derived number:

     ```bash
     gh api graphql -f owner=<owner> -f repo=<repo> -F number=<number> -f query='
     query($owner:String!,$repo:String!,$number:Int!){
       repository(owner:$owner,name:$repo){
         pullRequest(number:$number){
           reviewThreads(first:100){ nodes{ isResolved comments(first:1){ nodes{ author{ login __typename } } } } }
         }
       }
     }'
     ```

     - Unresolved count (`💬 open`): nodes with `isResolved == false`.
     - Resolved count (`pingpong` only, for the counters strip): nodes with `isResolved == true`.
     - **Human vs bot** — a thread is a bot thread when its first comment's `author.__typename == "Bot"`. Use the typename, not a `[bot]` login suffix: GitHub's own review bots post under plain-looking logins, so a suffix match misses them and reads a bot nit as a human blocker. This split is what separates P1 from P4 in the Work-owed ranking.

   - Mergeability / conflicts: `gh pr view <number> --repo <owner/repo> --json mergeable,mergeStateStatus`

## Classification — 5 groups

Classify each PR into exactly one group. Evaluate in this priority order (first match wins):

1. **NOT READY / WIP / DRAFT** — `isDraft` is true OR title contains `WIP`, `DO NOT MERGE`, or `DNM` (case-insensitive). Display titles normalize leading markers to one `WIP: ` prefix; tag drafts with `[draft]`.
2. **NEEDS ATTENTION** (🔴) — would otherwise be ready (not draft, no WIP / DO NOT MERGE / DNM marker in title) BUT one or more of:
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

For the standalone `list_prs` CLI, flattening preserves this oldest-first order for non-WIP rows, then places every WIP / DO NOT MERGE / DNM row last. WIP display titles use one `WIP: ` prefix; meaningful title text stays intact.

## Work-owed ranking

The five groups above answer _"what state is this PR in?"_. This ranking answers a different question — **"who is this PR waiting on, and how badly does it need me?"** — and it is what a fan-out dispatcher (`/sy-babysit-prs`, `/sy-review-prs`) uses to decide which PRs get serviced first when there are more PRs than concurrent job slots. Rendering never reorders on it; it is a scheduling order, not a display order.

Score each PR into exactly one tier, highest first (first match wins). The name of the tier is the answer to _who is owed work_:

| Tier   | Name                       | Matches when                                                                                                                                                                                                                | Why it ranks here                                                                                                                             |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | Unshipped work             | The PR's canonical worktree exists and holds work GitHub has never seen: unpushed commits (`git log @{upstream}..HEAD`), a dirty tree (`git status --porcelain`), or an interrupted merge (`MERGE_HEAD`)                    | Only tier whose failure mode is **data loss**. Also the cheapest to detect — a local `worktree_create --path-only <head-branch>` call, no API |
| **P1** | Someone waiting on a reply | `reviewDecision == "CHANGES_REQUESTED"`, or an unresolved review thread whose first comment's `author.__typename == "User"`                                                                                                 | A human is blocked on you. Latency here is measured in reviewer patience                                                                      |
| **P2** | Broken and ours to fix     | A check that has **finished failing** — a `CheckRun` with `conclusion` in `FAILURE` / `TIMED_OUT` / `STARTUP_FAILURE`, or a legacy `StatusContext` with `state` in `FAILURE` / `ERROR` — or `mergeable == "CONFLICTING"`    | Actionable right now, fully within our control, and it rots — a conflict widens with every push to the base                                   |
| **P3** | Stale against base         | `mergeStateStatus == "BEHIND"`, or (on a stack) behind any ancestor, with no other flag. `BEHIND` is only reported where the repo requires branches to be up to date — elsewhere compare the head against the base directly | A sync fixes it, and it turns into P2 if left                                                                                                 |
| **P4** | Bot nits only              | Unresolved threads, every one of them opened by a `Bot` (`author.__typename`), no human blocker                                                                                                                             | Real work, low stakes, no human waiting                                                                                                       |
| **P5** | Waiting on someone else    | Green and approved awaiting merge, awaiting first review, any check still unfinished (running, queued, or stalled), or held by a non-blocking human approval gate (`/sy-babysit-pr` Step 3)                                 | Nothing to do until another party moves; a pass here mostly re-reads                                                                          |
| **P6** | Nothing owed               | Draft, `WIP` / `DO NOT MERGE` / `DNM` title — every pass is a documented skip                                                                                                                                               | Cheapest possible pass; safe to service last                                                                                                  |

**Ties break on oldest `updatedAt`** — within a tier, the PR that has gone longest without anyone touching it goes first. That is the one most at risk of being forgotten, which is the failure this ranking exists to prevent.

**A completed failure needs no blocking/non-blocking classification, and a running check is not a failure.** `/sy-babysit-pr` Step 3's classification answers "will this pending check ever resolve on its own?", which is only a question about checks still running. Two consequences, and the second is the one that gets mis-scored:

- A check that already **completed** with a failing conclusion has resolved — it failed, it is ours, and it is P2 regardless of how the same check would have been classified while pending. Both check systems count: modern `CheckRun` entries carry `conclusion` (`FAILURE` / `TIMED_OUT` / `STARTUP_FAILURE`), while legacy `StatusContext` entries carry `state` (`FAILURE` / `ERROR`) and have no `conclusion` at all — reading only one field silently misses every PR whose CI posts commit statuses.
- **A check that has not finished is never P2**, whether Step 3 calls it blocking or not. "Blocking" there means _the merge waits on it_, not _it is broken_ — a build that started two minutes ago is doing exactly what it should, and nothing about it is ours to fix. A **stalled** pending check is not P2 either: Step 3 explicitly classifies stalled entries as non-blocking and steps over them, so scoring them as "broken and ours to fix" would contradict the very step this tier cites. Every unfinished check — running, queued, stalled, or held by a human gate — is P5, waiting on something other than us. Scoring healthy in-flight builds as P2 would put every freshly-pushed PR at the front of the queue, which is precisely backwards: it just pushed, so it is the one PR guaranteed not to need attention yet.

### Two lenses over the same tiers

"Who is owed work" has two answers depending on which side of the PR you are standing, so the tiers above are read through one of two lenses. **The tier definitions never change** — a PR's `matches when` is objective — only the _order_ the tiers are serviced in. One table, two documented readings; never a second table.

- **Author lens (the default, used by `/sy-babysit-prs`)** — the order exactly as listed, P0 → P6. It ranks by what _I_ must do to move my own PR forward, which is why "awaiting first review" sits at P5: I have shipped, and nothing I do speeds up a reviewer.
- **Reviewer lens (used by `/sy-review-prs`)** — same tiers, but two _sub-buckets_ are lifted out and re-placed. They are sub-buckets, not whole tiers: P5 and P1 each hold several kinds of PR, and only one kind from each moves, so the rest of both tiers stay exactly where they are.
  - **`awaiting first review` (a member of P5) is lifted out and placed above P1**, becoming the top tier for this lens. It is the most actionable work on a reviewer's board and the only case where _nobody_ has looked at the PR at all; leaving it at P5 makes the review fan-out service its whole reason for existing dead last. The rest of P5 — green-and-approved awaiting merge, held by a human approval gate — does **not** move.
  - **`reviewDecision == "CHANGES_REQUESTED"` (a member of P1) is lifted out and placed just above P6.** Another reviewer already has an open block, so `/sy-review-pr` Step 3 skips it rather than piling on — servicing it early spends a round on a documented no-op. It stays _in_ the set, since a block can be dismissed between rounds and the later rounds exist to catch that. The rest of P1 — an unresolved thread whose first comment is from a human — stays at P1, because those are threads waiting on a reply that a reviewer may well be the one to give.

  So the reviewer tier order is: awaiting-first-review → P0 → P1 (minus `CHANGES_REQUESTED`) → P2 → P3 → P4 → P5 (minus awaiting-first-review) → `CHANGES_REQUESTED` → P6. Everything else keeps its author-lens position. A dispatcher states which lens it used when it reports the slot map, so a surprising order is self-explaining rather than looking like a bug.

#### Reviewer-lens attention keys — evaluated before the tiers

The tier order answers _"how much work is owed?"_. On a reviewer's board two things outrank that, because both mean **a human is currently waiting on my eyes specifically**. Score each key, then sort: `R0` first, then `R1`, then the tier order above, then the tiebreakers. Keys are re-scored **at the top of every round**, so a PR opened or a mention posted mid-run jumps the queue on the next round rather than at the end of the run. Both keys are re-ordering only — neither adds, removes, or skips a PR (see "Ranking never drops a PR").

- **`R0` — new since the last round, newest first.** A PR the dispatcher has **not yet run a pass on in this run** and that was not in the previously ranked set: it entered scope while the fan-out was already in flight. Sort these by `createdAt` **descending** — newest first, the inverse of the usual oldest-first tiebreak, because the newest arrival is the one whose author is standing there watching for a first response. Determined from the agent ledger (`/sy-review-prs` Step 4b), not from GitHub: a PR is "seen" once it has a recorded completed pass. **On round 1 this key is empty by definition** — nothing has been seen yet, so "newest unseen" would mean the whole board and would silently replace the tier order with a date sort. Round 1 is ranked by tiers alone.
- **`R1` — I am named on it.** My handle (`gh api user --jq .login`) appears as an `@`-mention in the PR body, in any issue comment, in any review body or review line comment, or in any reply on a thread I commented in — or I am on `reviewRequests`. That is an explicit, addressed ask, so it outranks every tier including awaiting-first-review, where nobody asked for me by name. Detect per PR, in one call, and match `@<login>` case-insensitively on a word boundary so `@alice-bot` never matches `@alice`:

  ```bash
  gh pr view <url> --json body,comments,reviews,reviewRequests,latestReviews
  ```

  A mention of a **team** I belong to (`@<org>/<team>`) scores `R1` too. My own `@`-mention of myself does not. Ignore mentions inside fenced code blocks or quoted (`> `) lines — a quoted mention is history, not a new ask.

**Tiebreakers, applied in order once `R0` / `R1` / tier are equal:**

a. **Someone else's PR before my own.** A teammate is blocked on my review; on my own PR I am both parties and can act any time.
b. **Smaller diff first** (`additions + deletions` from `gh pr view --json additions,deletions`). Cheap reviews clear the board and unblock their authors soonest; a 4000-line PR behind three 20-line ones costs everyone less than the reverse.
c. **Oldest `updatedAt`** — the existing tiebreak, and still the last word. Within everything else equal, the PR nobody has touched longest is the one most at risk of being forgotten.

**P0 is checked locally and costs nothing.** `worktree_create --path-only <head-branch>` prints the canonical path without creating anything, so the dispatcher can probe a PR's branch worktree before dispatching, without an API call and without touching the user's checkout. A path that does not exist is simply not P0.

**Ranking never drops a PR.** It decides _order_, never _membership_ — a P6 draft is still dispatched, still gets its passes, and still appears in every render. Anything that uses this ranking to skip a PR is misusing it. **P6 is dead last under both lenses and no attention key can lift it**: a draft / `WIP` / `DO NOT MERGE` / `DNM` PR is ranked last even when it is the newest arrival (`R0`) or names me directly (`R1`) — an author who marks a PR not-ready has said so more loudly than a mention says otherwise. It is dispatched anyway, and every pass on it is a **documented skip that posts nothing** (`/sy-review-pr` Step 3), purely so a PR marked ready between rounds gets caught in the round after.

## Feature clustering

One feature routinely needs a PR in several repos — the API change, the client change, the docs change — and those PRs are one unit of work even though nothing in GitHub says so. Clustering recovers that grouping so the set reads side by side instead of scattered across five repo-sorted rows. It is computed for **every** scope and format, and _rendered_ by two: `clusters` (and by `/sy-list-prs-pending`, which delegates here) and `pingpong`, which groups both its pulse lines and its table by cluster. `short`, `long`, `table`, and `links` keep their existing repo-then-date sort untouched, because `/sy-babysit-prs` parses those line-by-line.

**Cluster key — take the first signal that fires, strongest first.** Signals 1–3 are declarations by the author and are trusted alone; 4–5 are inference and need the whole normalized phrase to match, not one shared word.

1. **Branch group slug** — branch is `<username>/<group-slug>/<feature-name>` (three segments, see Branch naming). The middle segment is the key. This is the author saying "these belong together", so it wins outright.
2. **Plan artifact** — the PR body references the same `<repo>-<feature>.md` / `<repo>-<feature>.diff` artifact (see Plans & Wrap-Ups). Key is `<feature>` (the snake_case tail after the repo), with any `_v<N>` revision suffix dropped so every revision of one plan clusters together.
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
| `pingpong` | A dedicated `Author` column, second, right after `PR` — always shown, mixed-author or not, and color-coded mine vs theirs |

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

`<color emoji>` and `<status>` use the same vocabulary and the same roll-up rule as the `pingpong` Status cell — 🔴 for CI failed / changes requested / merge conflict, 🟡 for build running or awaiting review, 🟢 only when CI passed **and** approved **and** no conflict. `<status>` is the component tokens that justify the color, `·`-separated on one line: `CI FAILED — <check>`, `CHANGES REQUESTED`, `MERGE CONFLICT`, `BUILD IN PROGRESS (<n> running)`, `AWAITING REVIEW`, `CI PASSED`, `APPROVED`. Print every token that applies, in that fixed order, so a red row says which of the three reds it is. For NOT READY / WIP / DRAFT, display the normalized `WIP: ` title and prepend `[draft]` when the PR is a draft.

### Format: `table`

Print one markdown table per group with these columns:

| PR | Repo | Title | Link | CI Status | Approvals | Comments | Ready to Merge? |

On a mixed-author list, insert an `Author` column immediately after `Repo`, filled in for **every** row (including your own) so the rows stay comparable.

- **PR**: PR number and branch name on separate lines (e.g. `#123` then `feature-branch` below it).
- **CI Status**: `CI PASSED` / `CI FAILED — <check>` / `BUILD IN PROGRESS (<n> running)` — same vocabulary as the `pingpong` Status cell, so one reader learns one set of words for the whole command.
- **Approvals**: `APPROVED (<n>)` / `CHANGES REQUESTED` / `AWAITING REVIEW`.
- **Comments**: count of unresolved review threads (`0` if none).
- **Ready to Merge?**: `🟢 yes` if group 5 (READY TO MERGE), `🟢 yes — <n> open comments` if group 4, otherwise `🔴 no — <blocker>` (CI failed / changes requested / merge conflict) or `🟡 no — <what it waits on>` (build running / awaiting review). Same three colors and the same roll-up rule as `pingpong`: green needs CI passed **and** approved **and** no conflict; red wins over yellow.
- In the NOT READY / WIP / DRAFT table, display the normalized `WIP: ` title and prepend `[draft]` when the PR is a draft.

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
- https://github.com/acme/api/pull/51 — pr1 — issue refresh tokens on the token endpoint — 🔴 CI FAILED — unit-tests
- https://github.com/acme/web/pull/7 — pr2 — swap the login form to the new flow — 🟡 AWAITING REVIEW
- https://github.com/acme/widget-store/pull/109 — pr3 — drop the old session cookie reader — 🟢 CI PASSED · APPROVED

### ABC-1234 (2) — acme/api, acme/web
- https://github.com/acme/api/pull/60 — pr4 — add the org-fields column to the sync payload — 🟡 BUILD IN PROGRESS (2 running)
- https://github.com/acme/web/pull/18 — pr5 — render org fields on the profile card — 🟡 AWAITING REVIEW

### Standalone (2)
- https://github.com/acme/widget-store/pull/113 — pr6 — retry token refresh on 401 — 🔴 MERGE CONFLICT
- https://github.com/acme/api/pull/42 — pr7 — drop the legacy /v1 search endpoint — 🟢 CI PASSED · APPROVED
```

- **Cluster heading**: `### <label> (<n>) — <repo>, <repo>, …`, repos comma-separated in the order their PRs appear. The repo list is the whole point of the heading: it answers "which repos does this feature still need" without reading a single URL. Single-repo clusters (two PRs in the same repo) still print the repo once.
- **Standalone block**: everything with no partner, under a literal `### Standalone (<n>)` heading, always last, no repo list. Print it even when it holds every PR — an all-standalone list is a real answer, not an error.
- **PR line**: `- <full URL> — pr<N> — <description> — <color emoji> <status>`. Same four fields in the same order on every line in the render, clustered and standalone alike — no per-block variant to remember, and a line means the same thing wherever it is pasted. `<color emoji>` and `<status>` use the exact vocabulary and roll-up rule as `long` (`CI FAILED — <check>`, `CHANGES REQUESTED`, `MERGE CONFLICT`, `BUILD IN PROGRESS (<n> running)`, `AWAITING REVIEW`, `CI PASSED`, `APPROVED`, `·`-separated). Use the normalized `WIP: ` title and prepend `[draft]` when they apply.
- **The URL leads every PR line — always the first field after `- `.** Everything else is a trailing annotation, so a line stays clickable, greppable, and copy-pasteable no matter how many annotations get appended later. Never put the `pr<N>` handle, a status, or a description ahead of the URL.
- **Every line says what its PR does** — `<description>` is ≤8 words of plain English written from that PR's title and body, never the title pasted verbatim, never the branch name, never a restatement of the status. Without it a reader gets a bare number and a color and has to open every link to triage. Cannot tell from title and body what it does → say the narrowest true thing (`config change in the ingest job`), never invent a purpose.
- **Inside a cluster, `<description>` is what that PR contributes, not what the feature is** — the `###` heading already said the feature, so repeating it on all three lines burns the one field that could tell them apart. Write the differentiator: `issue refresh tokens on the token endpoint`, not `oauth migration`.
- **Numbering is global, continuous, and display-ordered** — `pr1` through `pr<N>` across the whole render, never restarting per cluster. The handle is stable only within one render; it is a pointer for the next message, not an identifier to store.
- **Consumers read the `https://` token from each line.** That token is always the full `https://github.com/<owner>/<repo>/pull/<number>` form and always the second whitespace-separated field, immediately after the `- `. Heading lines carry no `https://` token, so a URL-extracting parser skips them for free — the same property that lets `/sy-babysit-prs` read `short` past its `##` headings.
- **Ordering is Feature clustering's, not this section's** — cluster rank by most-urgent member, then size, then age; within a cluster, dependency order first. Do not re-sort here.
- When a cluster came from inference (Feature clustering signals 4–5), append ` — grouped by <signal>` to its heading, e.g. `### retry-token-refresh (2) — acme/api, acme/web — grouped by matching branch name`. A guess says it's a guess.
- Zero PRs → print nothing at all, same as `links`.

### Format: `pingpong`

The heartbeat / pulse render. One board per **feature set** — no per-readiness-group tables — answering "what is going on right now, and what are the agents doing about it". `/sy-babysit-prs` and `/sy-review-prs` emit this on a fixed cadence so a long async fan-out is never a black box.

Structure: a header block (scope counts, then a pulse grouped by feature set), then one table per feature set. The pulse lines are the only prose in this render — keep every table cell terse, fragments not sentences. This is a status board.

```
🏓 Agent Status Ping-Pong — 2026-08-05 17:34 PDT
Next ping-pong: 2026-08-05 17:44 PDT (in 10 min)

Repos Scanned (3): acme/widget-store, acme/api, acme/web
PRs Scanned (5):
- acme/widget-store: 2
- acme/api: 2
- acme/web: 1

Pulse (2 moved, 2 steady, 1 new):

**oauth-migration** — slots 1–2 · 3 PRs · acme/widget-store, acme/web, acme/api — move token refresh onto the new OAuth flow
- Δ github.com/acme/widget-store/pull/109 — CI just went red on unit-tests; agent is mid loop 1.
- ▫️ github.com/acme/web/pull/7 — still conflicting with main; agent gave up and wants a human.
- 🆕 github.com/acme/api/pull/51 — new to the board, CI still running; second in slot 2, first pass not yet run.

**Standalone** — 2 PRs · acme/widget-store, acme/api
- ▫️ github.com/acme/widget-store/pull/113 — still 2 open threads and no review; agent sleeps until 17:28.
- Δ github.com/acme/api/pull/42 — cleared its last 4 threads and picked up an approval; ready to merge.

### 🌊 oauth-migration (3) — slots 1–2 · acme/widget-store, acme/web, acme/api — move token refresh onto the new OAuth flow

| PR | Author | Status | Agent |
| --- | --- | --- | --- |
| github.com/acme/widget-store/pull/109<br>**Retry token refresh on 401**<br>🌊 slot 1 · oauth-migration — new OAuth token refresh<br>Δ CI green→failing · +2 open threads | **@alice** | Δ 🔴<br>CI FAILED — `unit-tests`<br>AWAITING REVIEW | 🔄 IN PROGRESS (pass 1 · 4:12 left) — started 17:12 · running 22m<br>💬 3 open · ✔ 5 resolved · ⚠️ 0 need attention |
| github.com/acme/web/pull/7<br>**WIP: Split auth middleware**<br>🌊 slot 1 · oauth-migration — new OAuth token refresh<br>▫️ No change since last ping-pong | `@me` | ▫️ 🔴<br>CI PASSED<br>CHANGES REQUESTED<br>MERGE CONFLICT | ⚠️ ESCALATED (pass 2 · 4:12 left) — stopped 17:01 · ran 19m — needs human<br>💬 1 open · ✔ 3 resolved · ⚠️ 1 need attention |
| github.com/acme/api/pull/51<br>**Add signup flow**<br>🌊 slot 2 · oauth-migration — new OAuth token refresh<br>🆕 First ping-pong — no prior snapshot | **@bob** | 🆕 🟡<br>BUILD IN PROGRESS (3 running)<br>AWAITING REVIEW | ⚪ NOT STARTED — slot 2, position 2 of 2 — behind github.com/acme/web/pull/7<br>💬 0 open · ✔ 0 resolved · ⚠️ 0 need attention |

### 🌊 Standalone (2) — acme/widget-store, acme/api

| PR | Author | Status | Agent |
| --- | --- | --- | --- |
| github.com/acme/widget-store/pull/113<br>**Drop dead feature flag**<br>🌊 slot 1 · standalone<br>▫️ No change since last ping-pong | `@me` | ▫️ 🟡<br>CI PASSED<br>AWAITING REVIEW | ⏸️ WAITING (pass 2 · 4:12 left) — ended 16:58 · ran 26m · next check 17:02<br>💬 2 open · ✔ 0 resolved · ⚠️ 1 need attention |
| github.com/acme/api/pull/42<br>**Bump deps to latest**<br>🌊 slot 1 · standalone<br>Δ 4 threads resolved · +1 approval | `@me` | Δ 🟢<br>CI PASSED<br>APPROVED | ✅ COMPLETED (pass 3 · 4:12 left) — ended 17:05 · 48m total<br>💬 0 open · ✔ 4 resolved · ⚠️ 0 need attention |
```

**Grouping — one feature set is one block, top to bottom.**

A fan-out is dispatched by feature, not by repo, so the pulse is read by feature too. Both halves of the render — the pulse sentences _and_ the tables — use the **same** groups in the **same** order, so a sentence and its row are never on opposite ends of the output. A four-repo feature reads as one block instead of four rows scattered by color.

**Group key — first signal that fires:**

1. **Feature cluster** (see Feature clustering) — the PR is in a cluster of two or more. Group = that cluster, label = the cluster label.
2. **Dispatch slot** — no cluster, but the ledger gives the PR a slot number. Group = `Slot <N>`, for PRs that share nothing but the job lane servicing them.
3. **`Standalone`** — neither. One trailing group, always last.

**Group ordering** is Feature clustering's Cluster ordering unchanged — most urgent member first (a group holding a 🔴 outranks one whose worst is 🟡), then group size descending, then earliest member `createdAt` — with one pingpong-only tiebreaker appended: **lowest slot number first**, so the busiest lane reads above the quieter ones. `Standalone` is always last regardless of what it holds.

**Group heading**: `### 🌊 <label> (<n>) — slot <N> · <repo>, <repo>, … — <≤10-word description of the feature set>`.

- `slot <N>` is dropped when the ledger has no slot for the group, and becomes `slots <N>–<M>` when a cluster's members were dealt into different slots (round-robin dealing routinely splits a cross-repo feature across lanes — the per-row slot in the PR cell says which is which).
- The `<description>` is one plain-English clause for what the whole feature set does, written from the members' titles and bodies. Omit it on `Standalone` and on `Slot <N>` groups, which have no shared feature to describe.
- Repos are comma-separated in the order their PRs appear, same as the `clusters` heading.
- When the group came from clustering inference (Feature clustering signals 4–5), append ` — grouped by <signal>`. A guess says it's a guess.

**Pulse block grouping**: one bold group line — `**<label>** — slot <N> · <n> PRs · <repo>, <repo>, … — <description>` — then that group's sentences beneath it, then a blank line before the next group. Same fields, same order as the table heading, minus the `###` and the 🌊.

**One table per group**, in group order, each under its heading, each repeating the three-column header row. Never merge two groups into one table and never split a group across two. Within a group, rows keep the normal pingpong sort (below).

**Sort within a group:** `🔴` first, then `🟡`, then `🟢`, then `❓`; within one color, `Δ` rows come before `🆕` before `▫️`; ties broken by repo name then PR number. Red work reads first because that is the row a human has to act on, and moved work reads before parked work because that is the row that changed since they last looked. Sorting is **within** a group only — a red PR never jumps out of its feature set to the top of the board, because Group ordering already leads with the group holding the most urgent member.

**Header block:**

- Line 1: `🏓 Agent Status Ping-Pong — <current timestamp>` (local time, with zone).
- Line 2: `Next ping-pong: <timestamp> (in <N> min)`. On the final pulse of a run, write `Next ping-pong: — (final)` instead.
- `Repos Scanned (<count>): <owner/repo>, <owner/repo>, …` — the resolved scope, comma-separated.
- `PRs Scanned (<count>):` followed by one `- <owner>/<repo>: <n>` line per repo. Repos with zero matching PRs still get a line with `0` — a scanned-but-empty repo is a real answer.
- `Pulse (<n> moved, <n> steady, <n> new):` followed by **one sentence per PR**, bucketed under its feature-set group line (see Grouping) — the high-level read, before anyone looks at the tables. This is the part a human skims on a phone; the tables are where they go when a sentence makes them want detail.

  Each line is `- <change marker> <full PR path> — <one sentence>`. Stay high level and plain English: what moved (or that nothing did) and what the agent is doing about it, in one sentence, ≤20 words, no counters, no `Δ` fragments, no status tokens. The counts and the tokens are the tables' job; duplicating them here just makes the top of the pulse as dense as the bottom, which is the thing this block exists to avoid.

  Group order and within-group order match the tables exactly, so the reader can drop from a sentence straight to its row. The `(<n> moved, <n> steady, <n> new)` tally is across the **whole** board, not per group — a one-glance answer to "did anything happen in the last 10 minutes?".

**Columns — exactly four, in this order.** Cells are multi-line; use `<br>` for the line break so the markdown table survives rendering.

- **PR** — **four lines.** Line 1 is the full clickable path, `github.com/<owner>/<repo>/pull/<number>` (scheme optional, nothing else dropped — see Render every PR / issue reference as a full clickable path). **Never elide the owner to `…/<repo>/pull/<n>`** — a path with the org replaced by an ellipsis is not clickable, not greppable, and not pasteable, which is every reason the link is line 1.

  **Line 2 — the PR title, always present.** The real title, bolded — `**Retry token refresh on 401**` — normalized the same way every other render normalizes it (`WIP: ` prefix form, `[draft]` prepended when it applies), never the branch name and never a paraphrase. It sits directly under the link because a bare `…/pull/1785` identifies nothing on its own: the whole reason a reader crosses to another column today is to find out which PR the row even is. Title too long for a cell → truncate at ~60 chars with `…`, never rewrite it. The ≤10-word plain-English TLDR is **not** this line; where the title genuinely says nothing (`fix`, `update`, `wip`), append ` — <TLDR>` to it rather than adding a fifth line.

  **Line 3 — the group line, always present.** `🌊 slot <N> · <group label> — <≤8-word feature-set description>`. It repeats, per row, the heading the row already sits under, because a row copied into Slack or a ticket loses its heading and then nobody can tell which feature it belonged to. Same slot number the dispatcher assigned that PR — **per row, not per group**, so a cluster dealt across two lanes shows `slot 1` and `slot 2` on the rows that actually differ. Drop the `slot <N> · ` prefix when the ledger has no slot (standalone invocation, no dispatcher). On a `Standalone` row the label is the literal `standalone` and the description is omitted; on a `Slot <N>` group the label is the slot itself, so print `🌊 slot <N>` alone rather than repeating it twice.

  **Line 4 — the delta, always present.** It sits directly under the group line because "what does this PR do" and "what happened to it since you last looked" are the same question one beat apart; the reader gets both without crossing columns. One of three forms, matching the Status change marker:

  | Marker row | Line 4                                                |
  | ---------- | ----------------------------------------------------- |
  | `Δ`        | `Δ <fragment> · <fragment> · …` — what actually moved |
  | `▫️`       | `▫️ No change since last ping-pong`                   |
  | `🆕`       | `🆕 First ping-pong — no prior snapshot`              |

  Each changed signal is one `·`-separated fragment: old→new form where a value flipped, signed form where a counter moved — `Δ CI green→failing · +2 open threads`, `Δ 4 threads resolved · +1 approval · CI failing→green`. Cap at the three most significant fragments and append ` · +N more` rather than letting the cell sprawl. When the PR moved but no agent touched it (someone else pushed, a reviewer commented), prefix the fragments `Δ (external)`. Never leave line 4 blank — an unchanged row says so out loud, because a silent cell is indistinguishable from a pulse that failed to diff.

- **Author** — one line, the PR author's handle, and **nothing else**. It is its own column rather than a fragment inside the PR cell because "is this mine to fix or someone else's to nudge?" is the first triage question on a mixed board, and it is answered by scanning one narrow column instead of reading four-line cells.

  **The handle is wrapped so the renderer colors mine differently from everyone else's** — two different markdown spans, two different theme colors, no ANSI escapes (an escape sequence inside a table cell renders as literal garbage in half the clients that read this board):

  | Author           | Render        |
  | ---------------- | ------------- |
  | Me (the user)    | `` `@me` ``   |
  | Anyone else      | `**@alice**`  |
  | A bot            | `**@dependabot[bot]**` |

  Always the real handle after the `@`; `@me` is written literally only for the user's own PRs, matching the existing `@me` convention in every other render. Author unresolvable → `❓` in the cell, never a blank and never a guess.

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

  **The group line is excluded from the diff.** Clustering is derived from titles, branches, and bodies, so it re-resolves on every pulse and a re-labelled group is bookkeeping, not PR movement — same reason the clock is excluded. One exception: a PR whose **slot position actually advanced** (its lane finished the PR ahead of it and started this one) is `Δ`, and the fragment is `Δ slot 2 position 2→now running`.

  **The color emoji** is the whole verdict, rolled up from the component lines below. Evaluate top-down, first match wins:

  | Emoji | When                                                                                         |
  | ----- | -------------------------------------------------------------------------------------------- |
  | `🔴`  | **Any** of: CI failed, reviewer requested changes, merge conflict                            |
  | `🟡`  | Nothing red, but not yet all-clear: build still running, or nobody has reviewed it yet       |
  | `🟢`  | CI passed **and** approved **and** no merge conflict — the only combination that earns green |
  | `❓`  | Status fetch failed — cannot roll up. Component lines say which call failed (see Edge cases) |

  Red is checked before yellow so a failing check on a still-running build reads red, not yellow. Green is a conjunction of all three conditions — a PR that is CI-green and unreviewed is `🟡`, never `🟢`.

  **Line 2 — CI, always printed.** Exactly one of:

  | Line                              | When                                                                                                    |
  | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
  | `CI PASSED`                       | Every required check succeeded (neutral / skipped count as ok)                                          |
  | `CI FAILED — <check>`             | Any required check failed. Name the first failing check                                                 |
  | `BUILD IN PROGRESS (<n> running)` | Self-resolving checks still queued or running, none failed yet (human approval gates excluded — Step 2) |

  **Line 3 — review, printed whenever the review state is known.** Exactly one of:

  | Line                | When                                                                 |
  | ------------------- | -------------------------------------------------------------------- |
  | `APPROVED`          | `reviewDecision == "APPROVED"`                                       |
  | `CHANGES REQUESTED` | `reviewDecision == "CHANGES_REQUESTED"`                              |
  | `AWAITING REVIEW`   | `reviewDecision` is null or `REVIEW_REQUIRED` — nobody has ruled yet |

  `AWAITING REVIEW` is printed rather than omitted because "waiting on a reviewer" is one of the two things `🟡` can mean, and a yellow row showing only `CI PASSED` leaves the reader guessing which. Omit line 3 entirely only when the review state could not be fetched.

  **Line 4 — `MERGE CONFLICT`, printed only when `mergeable == "CONFLICTING"`.** Absent means no conflict; there is no "no conflict" line, because a clean merge is the default and printing it on every row is noise.

  Nothing else goes in this cell. No open-thread counts (Agent cell), no timestamps (Agent cell), no free-form reason clause.

- **Agent** — what the dispatched job is doing. **Two lines, not three:** line 1 is the state token plus its clock, line 2 is the counters line. The timing used to sit on its own line; it is folded into line 1 because "which state, since when, for how long" is one thought and reads worse split across two rows. No delta here — that lives on line 4 of the PR cell.

  **Line 1 — `<state token>[ (pass N · <HH:MM> left)] — <clock>`.**

  | Token                   | When                                                            | Clock                                                                 |
  | ----------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
  | `⚪ NOT STARTED`        | Enrolled, first pass not yet run                                | `queued, position 2 of 5` (no clock; nothing started)                 |
  | `🔄 IN PROGRESS`        | Job actively working this pass                                  | `started 17:12 · running 22m`                                         |
  | `⏸️ WAITING`            | Pass done, polling until something moves                        | `ended 16:58 · ran 19m · next check 17:02`                            |
  | `👁️ WATCHING`           | **Not terminal** — no worker held, dispatcher polling cheaply   | `blocked on Owner Approval · probe 4 · next check 17:02`              |
  | `✅ COMPLETED`          | Job finished all passes, or the PR merged                       | `ended 17:05 · 48m total`                                             |
  | `⏭️ SKIPPED`            | **Terminal** — skipped, and the run budget is spent             | `17:02 — draft, budget spent`                                         |
  | `⏸️ WAITING_AFTER_SKIP` | **Not terminal** — this pass skipped, run budget still open     | `17:02 — draft · next check 17:02`                                    |
  | `🙋 NEEDS_USER`         | **Not terminal on GitHub** — this run paused it for the operator | `needs you — split request · asked 16:40 · revalidated current`       |
  | `⚠️ ESCALATED`          | Job stopped and needs human judgment                            | `stopped 17:01 · ran 19m — needs human`                               |
  | `❌ FAILED`             | Job errored out                                                 | `failed 16:44 · ran 4m — worktree conflict`                           |

  **`SKIPPED` vs `WAITING_AFTER_SKIP` — the distinction the pulse depends on.** Every per-PR skip except `MERGED` / `CLOSED` is a snapshot judgement that a later pass can overturn: a draft gets marked ready, a `WIP` prefix is dropped, a blocking reviewer's request is dismissed. So a skip while the run budget is still open is `⏸️ WAITING_AFTER_SKIP`, and the row keeps its next-check ETA. Only when the budget is spent does the row settle to `⏭️ SKIPPED`. Collapsing the two makes `⏭️ SKIPPED` terminal _and_ loopable at once, which stops the pulse early and reports a PR as finished while its job is still scheduled to work on it.

  **`👁️ WATCHING` means the PR is being served cheaply, not that it was dropped.** This PR is externally blocked, so the dispatcher released its worker slot and is polling the state fingerprint itself (`/sy-babysit-prs` Step 4b, `/sy-review-prs` Step 5b). The row is **not terminal** — it keeps its pass counter and its next-check ETA, the pulse keeps running, and a worker is dispatched the instant the fingerprint moves. Its clock reads `blocked on <what> · probe <N> · next check <HH:MM>`: what it is waiting on, how many probes it has spent there, and when the next one lands. Never render it as `⏸️ WAITING` (which claims a dispatched job is asleep) or as `⏭️ SKIPPED` (which claims nobody is coming back).

  **`🙋 NEEDS_USER` is a pause in this run, never a state on GitHub.** A worker handed the PR back with a stop-and-ask, so the dispatcher stopped scheduling passes for it and is showing the question instead (`/sy-babysit-prs` Step 4d, `/sy-review-prs`). Nothing was labelled, blocked, or commented on the PR itself — it may still be green, approved, and mergeable to everyone else. The clock carries what is needed, when it was asked, and the verdict the last revalidation reached (`current` / `changed` / `conflicted` / `stale_unknown`); a `cleared` one is not rendered at all, because that PR went back into the rotation. Never render it as `⚠️ ESCALATED` (a job that stopped on its own error) or `⏭️ SKIPPED` (nobody is coming back).

  **A merged or closed PR is `✅ COMPLETED`, never `⏭️ SKIPPED`** — precedence, because both could otherwise claim it. The PR reached its actual destination, which is the outcome the whole run is for; `⏭️ SKIPPED` is reserved for a PR that is still open and simply had nothing to do on every pass.

  **Clock grammar.** Times are local `HH:MM`, 24-hour, no date (the header block already carries the date). Durations are `<N>m` under an hour, `<N>h <N>m` over it, always whole minutes — a pulse is a 10-minute heartbeat, so seconds are noise.

  - `running <N>m` on `🔄 IN PROGRESS` is **elapsed since the current loop started**, recomputed at render time (`now − loop start`), not the total across loops. That is the number a human actually wants: "has this pass been stuck for 45 minutes?"
  - `ran <N>m` on a finished-pass state is that pass's own wall time (`pass end − pass start`).
  - `<N>m total` on `✅ COMPLETED` is the whole job, first dispatch to final pass end, across every pass.
  - A clock field with no data prints nothing rather than `0m` or `--`; drop the field and its `·` separator. Never invent a start time to fill the slot.

  The pass counter is `(pass N · <HH:MM> left)` whenever the per-PR command loops — how many full passes that PR has had, and how much of the shared run budget remains. There is no pass quota, so never render a denominator. Drop the counter entirely only for a genuinely single-pass per-PR command (`🔄 IN PROGRESS — started 17:12 · running 6m`).

  **The clock is excluded from the change-marker diff.** Elapsed time moves on every pulse by definition, so counting it as a change would render `Δ` on every running row forever and destroy the marker's only job. Diff the state token, the pass number, the Status cell, and the counters line — never `running <N>m`, never a recomputed `next check <HH:MM>`, never the remaining-budget figure. A row whose only difference is the clock ticking is `▫️`.

  **Line 2 — counters line.** One line, always printed, always all three fields, always this order, `·`-separated:

  `💬 <n> open · ✔ <n> resolved · ⚠️ <n> need attention`

  | Field                   | Meaning                                                                                                                                                                         |
  | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `💬 <n> open`           | Unresolved review threads still on the PR — the agent's remaining queue                                                                                                         |
  | `✔ <n> resolved`        | Review threads resolved — what the agent (or the author) has already worked through                                                                                             |
  | `⚠️ <n> need attention` | Threads the agent read but **cannot** act on alone: no good option is obvious, the fix is a product/design call, the reviewer and the code disagree, or it needs human judgment |

  Zeros are printed, never omitted — a fixed three-field line is what makes two pulses diffable at a glance, and a missing field reads as "not measured" rather than "none". `⚠️ need attention` is a strict subset of `💬 open` (a thread the agent is stuck on is by definition still open), so `need attention ≤ open` always; a pulse where it exceeds `open` is a bookkeeping bug, not a render choice. It counts **comment threads**, not CI failures or conflicts — those are already the Status color. A non-zero `⚠️` is the signal a human has to read this PR themselves; pair it with `⚠️ ESCALATED` on line 1 when the job stopped over it.

  Counts come from the caller's ledger where the agent tracked them; standalone with no ledger, fill `💬` / `✔` from `reviewThreads` and print `⚠️ 0 need attention` (nothing has judged them). On a failed fetch, print `?` in the affected field rather than guessing `0`.

**Agent state comes from the caller.** `/sy-list-prs` owns the layout, not the job bookkeeping. The dispatcher passes its agent ledger (per PR: ledger state, pass count, **slot number when active and queue position when queued**, first dispatch time, last pass start / end, next check ETA, **watch state plus its blocker, probe count, and next-check time when watching**, and the open / resolved / need-attention thread counts) alongside the scope. Every clock field on the Agent line is read from that ledger — `/sy-list-prs` computes only the elapsed subtraction (`now − loop start`), never the timestamps themselves. The slot number is read from the ledger too and never invented; with no slot for a PR, the group line drops its `slot <N> · ` prefix rather than guessing one. Invoked standalone with no ledger, every Agent cell renders `⚪ NOT STARTED — no agent dispatched` plus a counters line derived straight from `reviewThreads` — the pulse still works as a read-only board, grouped by feature cluster alone.

**The previous snapshot comes from the caller too.** The change marker is a diff, so it needs the prior pulse to diff against: the ledger carries, per PR, the last rendered color emoji, component lines, and counters line. After rendering, the dispatcher overwrites that snapshot with what was just printed, so the next pulse compares against the immediately preceding one — not against the run's opening state. With no prior snapshot (standalone invocation, first pulse of a run, or a PR that entered the set mid-run), the row is `🆕` with `🆕 First ping-pong — no prior snapshot` on line 4 of the PR cell.

**Never** decorate the PR path line with extra prefixes or suffixes, and never split the board by readiness group — one table per **feature set**, ordered by Grouping above, is the format. Readiness lives in the Status column and in the group order; it never gets its own table.

## Edge cases

- **Scope = all**, author has zero open PRs → print `No open PRs found for <author>.` and stop.
- **Scope = pwd**, zero git repos under cwd → print `No git repos found within 2 levels of $(pwd).` and stop. If repos resolved but zero matching PRs → print `No open PRs found for @me in <N> repos under $(pwd).` and stop.
- **Format = `links` or `clusters`, any zero-result case** → print nothing and stop. The "no PRs found" / "no git repos found" prose above is suppressed in both, because a consumer reading the output line-by-line would treat that sentence as a link.
- **Format = `clusters`, nothing clusters** → every PR is standalone; print only the `### Standalone (<n>)` block, numbering unchanged. Never fabricate a cluster to avoid an all-standalone render, and never drop the heading.
- **Format = `clusters`, a PR matches two cluster keys** → clustering is transitive, so the two clusters are one; label it with the strongest signal that fired (lowest signal number) and say so in the heading when that signal was inference.
- **Scope = explicit refs**, a bare `#<n>` / digits token and cwd is not a git repo → error out, name the unresolvable token, ask the user to use a fully-qualified ref. Unparseable token (not a URL, shorthand, `#<n>`, or digits) → error out, name the bad token, do NOT silently skip.
- PWD keyword + explicit refs in the same call → error (no mixing).
- **Format = `pingpong`, zero PRs resolved** → still print the header block (counts of `0`, an empty `Pulse (0 moved, 0 steady, 0 new):` line, repo list intact) and skip the tables. A pulse that prints nothing is indistinguishable from a dead agent, which defeats the purpose.
- **Format = `pingpong`, nothing clusters and the ledger has no slots** → the whole board is one `### 🌊 Standalone (<n>)` group with one table. Never fabricate a feature set to avoid a single-group render, and never fall back to the old ungrouped board — the heading is what tells the reader the grouping ran and found nothing.
- **Format = `pingpong`, a cluster spans two slots** → it stays **one** group (the feature is the unit of work, not the job lane). The heading reads `slots <N>–<M>` and each row's group line carries its own slot.
- **Format = `pingpong`, a PR's cluster changed between pulses** (a sibling PR appeared, or a body edit revealed a shared ticket) → re-group silently and say so once in that PR's pulse sentence. The row is not `Δ` for the regrouping alone — see the diff exclusion above.
- **Format = `pingpong`, no prior snapshot** (standalone call, or the run's opening pulse) → every row is `🆕`, never `▫️`. `▫️` is a positive claim that nothing moved; only render it when you actually have a previous pulse to compare against.
- **Format = `pingpong`, a PR dropped out of the set** (merged, closed, or no longer matches the scope) → keep it for one final pulse **in its own feature-set group** with its last known Status, `✅ COMPLETED` in the Agent cell, and a `Δ merged` / `Δ closed` line, then drop it. A row that silently vanishes reads as a lost job, and moving it to a "done" bucket breaks the one-feature-one-block rule.
- **Format = `pingpong`, a status fetch failed** → the row renders `❓` as its color emoji and names the call that failed in place of the component lines (`STATUS FETCH FAILED — statusCheckRollup`). Never guess a color from partial data, and never drop the row: a missing row reads as "merged", which is the opposite of "we don't know".
- **Format = `pingpong`, the ledger has no clock for a state that normally carries one** (dispatcher lost the timestamp, or the job predates the ledger) → print the state token with no clock at all. Do not backfill `0m`, `--`, or the pulse's own timestamp; an absent clock is honest, an invented one sends someone chasing a job that never ran that long.
- If a single PR's status fetch fails, include it under NEEDS ATTENTION with the reason `status fetch failed` rather than dropping it silently.
- If `reviewDecision` is `null` (no reviews requested yet), treat as `NEED APPROVAL` (not READY).
- **Scope = explicit refs** is author-agnostic, so it's the scope most likely to come back mixed — always run the mixed-author check on it. PWD scope forces `--author=@me` and can never be mixed; `all` scope with an explicit author token is single-author but that author may not be you, in which case say whose PRs these are rather than repeating one handle on every row.
