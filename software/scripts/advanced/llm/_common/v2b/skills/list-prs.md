[Sy] List open pull requests across repos, grouped by readiness. Defaults to `short` format (just full links).

## Inputs

`$ARGUMENTS` is a free-form string that may carry three independent dimensions: a **format keyword**, a **scope**, and an **author**.

- **Format keyword** (one of, case-insensitive): `short`, `long`, `table`, `links`, `clusters`, `pingpong`. Defaults to `short` if absent. `links` (alias `link`) prints bare PR URLs with no headings at all. `clusters` (aliases `cluster`, `grouped`, `feature`) buckets the same URLs by **feature cluster**. Cross-repo features form one block. Every line gets a running `pr<N>` handle. `/sy-list-prs-pending` uses this render. `pingpong` (aliases `ping-pong`, `pulse`) renders agent-status heartbeats for `/sy-babysit-prs` and `/sy-review-prs`. Group by feature set / dispatch slot, keeping cross-repo features together.
- **Scope** — pick exactly one (first match wins):
  - **PWD** (default without scope tokens) — discover git repos at or below cwd, two levels deep. This depth covers common nested repo folders. List only `@me` open PRs in discovered repos. PWD scope forces author = `@me` (ignores any author token).
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
2. **Extract the first matching format keyword**, case-insensitively. Accept `short`, `long`, or `table` unchanged. Normalize `links` / `link` to `links`. Normalize `clusters` / `cluster` / `grouped` / `feature` to `clusters`. Normalize `pingpong` / `ping-pong` / `pulse` to `pingpong`. Remove it from the token list. If no match, format = `short`.
3. **Determine scope from remaining tokens** (first match wins):
   - **Explicit PR refs** — every remaining token is a PR ref (URL, `<owner>/<repo>#<n>`, `#<n>`, or pure digits) → scope = explicit. Normalize each to a full URL using `/sy-babysit-prs` rules. Bare `#<n>` / digits require cwd inside a git repo with GitHub `origin`. Resolve `<owner>/<repo>` through `git remote get-url origin`, never folder names. Error on bad tokens; do NOT silently skip them.
   - **PWD keyword** — first remaining token (case-insensitive) is one of the PWD keyword set → scope = pwd. Any extra tokens after the keyword are an error (PWD mode takes no author or refs).
   - **`all` / `every` / `global`** — scope = all.
   - **Otherwise** → scope = all (default for author tokens). The remaining tokens form the author:
     - Empty → current user (`--author=@me`).
     - Single token of `me`/`mine`/`self` (case-insensitive) → current user.
     - Single token (no spaces) → treat as a GitHub handle (`--author=<token>`).
     - Multiple tokens → treat as a full name. Resolve via `gh api "search/users?q=<name>" --jq '.items[0].login'` and confirm the match with the user before proceeding.
4. **No mixing.** PWD keyword + explicit refs in the same call is an error; pick one.

## Fetch PR data

**Fast path — one call instead of one-per-PR.** The standalone Node CLI `list_prs` at `~/.local/bin/list_prs` already implements this entire section. It handles discovery, open-PR searches, CI rollup, review decisions, threads, and mergeability. Its four wrappers are `pr_list_my_open` / `pr_list_my_need_attention` / `pr_list_other_open` / `pr_list_other_need_attention`. `pr_list` aliases the first. Enrich up to three PRs concurrently. Keep successful rows in search order before display sorting. Normalize leading WIP / DO NOT MERGE / DNM markers to one `WIP: ` prefix. Place WIP rows after non-WIP rows. Check for it first:

```bash
type pr_list_my_open
```

When it exists, one call returns the whole set as JSON and every field below is already in it — no `gh search prs`, no per-PR `gh pr view`, no per-PR GraphQL:

```bash
pr_list_my_open --json                                  # scope = all  (every repo you have a PR in)
pr_list_my_open --json --cwd                            # scope = pwd  (git repos discovered at/below cwd)
pr_list_my_open --json --activity                       # opt-in scheduler data; default output stays unchanged
pr_list_my_open --json <owner>/<repo> <owner>/<repo>    # explicit repo list
pr_list_my_open --json --author=<handle>                # same scopes, one named author
pr_list_other_open --json --cwd                         # everyone else's PRs in the repos below cwd
```

`pr_list_my_open` is `list_prs --all --me=1` — every open PR, ready-to-merge ones included. Use it here: the sibling `pr_list_my_need_attention` (`list_prs --me=1`) applies a pending filter that drops the fully-green PRs `short` / `long` / `table` / `links` / `clusters` still have to render. `/sy-list-prs-pending` is the one caller that wants the filter, so it may call `pr_list_my_need_attention` instead and skip its own Step 2. Repo scope uses a flag, not a positional. Without repo arguments or `--cwd`, mine-only searches are **global** across repos containing your open PRs. Add `--cwd` to discover repos at or below the current folder. Audience is `--me=1` for yours, `--me=0` for everyone else, or omitted for everyone. Wider-than-self audiences imply `--cwd`; otherwise the search covers all GitHub. `--json` always emits plain output without ANSI. Default text uses two lines per PR: colored title, then URL. `--verbose` adds metadata as a third line. `--links` prints only URLs. Emit color only in interactive terminals.

Each JSON row normally carries `url repo number title author createdAt updatedAt ageDays headRefName baseRefName isDraft isWip group signal color reasonIcon reasonTag autoMerge autoMergeMethod ci review failedCheck runningChecks approvalGates mergeable mergeStateStatus openThreads openHumanThreads openBotThreads resolvedThreads status`. With opt-in `--activity`, it additionally carries `activityAt` (the newest observed PR, commit, issue-comment, review, review-thread-comment, or CI timestamp). The default row shape, GraphQL query, and wrapper behavior stay unchanged. `headRefName` / `baseRefName` (which `gh search prs` cannot return) and the unresolved / bot-vs-human thread split (which `gh pr view --json` cannot return) are already present on the normal fast path. `group` matches this file's Classification. `signal` (alias `color`) uses the same emoji roll-up rules. `approvalGates` counts pending human gates already excluded from CI status.

**`reasonIcon` names the cause; `signal` only names the severity.** Three different problems all roll up to 🔴, so a red row still needs a click to find out which — the reason icon answers that in one glyph. First match wins in Work-owed ranking order: blocked humans, then broken machinery, then stale branches. A conflicting PR with changes requested shows 🗣️. Its `status` still lists every component:

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

**Two encoding rules pick the glyphs, and a replacement has to satisfy both.** Prefer glyphs without `U+FE0F` variation selectors. VS16 pairs render narrowly in some terminals, misaligning scanned columns. Prefer the oldest emoji version preserving meaning; newer codepoints can appear as missing-glyph tofu. That is why build-in-progress is 🔨 `U+1F528` ("hammer", E0.6, no VS16) and not 🏗️ `U+1F3D7 U+FE0F` ("building construction", E0.7, VS16). Unicode has no traffic-cone emoji to prefer over either.

**A glyph also has to survive being read out of context**, which is what retired the two cutest ones. 👀 suggested "look at this" for awaiting-review, although that row waits on the _reviewer_, not you. ⏳ conveys "waiting on a person". It also matches the pending-approval-gate icon already in status lines. 🐌 for behind-base editorialized ("slow", "neglected") about a branch that is merely out of date; 🔄 names the actual remedy, which is a sync. **Keep icons on every state**, including untagged states. Readers scan an icon column. Omitting one shifts its title earlier than the other eight, recreating ragged alignment.

**A running build also gets a trailing `…`, in magenta.** Only builds resolve while users read; every other state waits on a person. Familiar "still moving, come back" punctuation communicates that difference. Use magenta: red / yellow / green encode roll-up severity, and blue identifies URLs. Reusing those colors would falsely imply severity. The suffix is render-only: `title` in JSON stays clean and `runningChecks` already carries the same fact, so nothing matching a PR by name ever sees it.

**`autoMerge` says whether GitHub will merge it without you.** True when `autoMergeRequest.enabledAt` is set; `autoMergeMethod` carries `SQUASH` / `MERGE` / `REBASE`. It changes what a human should do with a row — an armed 🟡 needs no babysitting, the same row unarmed is waiting on someone to come back and click. Render a **dim `[auto-merge]` tag after the reason tag, never an icon**. Automatic landing describes the row, not a tenth blocking reason. Never compete with the reason column for attention. `status` carries an `AUTO-MERGE (<method>)` token either way.

**Every text marker survives losing color; only the tone is conditional.** Human-readable piped, redirected, and `NO_COLOR` output keeps tags and `…` without styling. URL-only `--links` output remains undecorated, as the next rule requires.

**Icons go on the title line only — never on a URL line.** The two-line human render is `<reasonIcon> [<reasonTag>] [auto-merge] <headRefName> : <title>[…]` then the bare URL, and `--links` is unchanged. Same rule as `short` below: consumers read URL lines, so decorating them breaks every caller.

**The head branch prefixes the title, in cyan, separated by `:`.** Local commands (`worktree_create`, `git checkout`, `git log`) consume the branch handle. Only that field identifies _where_ work lives; URLs alone require clicks. Use cyan because red / yellow / green encode severity, blue identifies URLs, and magenta marks running builds. Branches are addresses users retype, not footnotes. Dimming would hide this copyable field. Place it **after** tags and **before** titles to preserve the flush reason column. This is render-only: JSON retains separate `headRefName` and clean `title` fields. Name-matching consumers never see the prefix. Omitted when `headRefName` is empty (the explicit-refs fallback path), never replaced by a placeholder.

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
   - **`gh search prs` silently returns only 30 results by default.** No warning, no truncation notice — the tail simply is not there, and a fan-out then reports full coverage of a set it never saw. Always pass `--limit` explicitly. **`--limit` accepts 1–1000** (`--limit 1001` is rejected with `` `--limit` must be between 1 and 1000 ``), and 1000 is also where GitHub's search API itself stops, so it is both the flag ceiling and the real one. If result count equals the limit, announce **possible truncation**, never completeness. Exhaust scope through per-repo searches or `created:<range>` partitions. Union results by PR URL. A scope that cannot be exhausted is reported as partial; it is never silently trimmed.
   - **Branch names are fetched only when something needs them.** Stack detection and worktree paths need `headRefName` / `baseRefName`, so a caller that does stack detection (`/sy-babysit-prs`, `/sy-review-prs`) follows the search with one `gh pr view <url> --json headRefName,baseRefName` per PR. Plain `short` / `links` renders skip that call entirely.

2. **For each PR, fetch detailed status:**
   - CI/build status: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup` → `CI PASSED` / `CI FAILED` (name the first failing check) / `BUILD IN PROGRESS` (count the still-running checks). **Count only self-resolving checks as "running"** — classify pending entries exactly as `/sy-babysit-pr` Step 3 does; that is the single definition, do not restate or re-derive it here. App-reported human approval gates remain `IN_PROGRESS` until someone clicks. Classify them as `AWAITING REVIEW`, never running builds. Exclude them from `(<n> running)`. If only human gates remain pending, do not classify the PR as `BUILD IN PROGRESS`.
   - Reviews: `gh pr view <number> --repo <owner/repo> --json reviews,reviewDecision` → `APPROVED` (with approval count) / `CHANGES REQUESTED` / `AWAITING REVIEW`
   - Review threads: **`reviewThreads` is not a `gh pr view --json` field**. `gh` 2.88 rejects it; only GraphQL's `PullRequest` type exposes it. Fetch through GraphQL once and reuse the result for all thread-derived counts:

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
     - **Human vs bot** — a thread is a bot thread when its first comment's `author.__typename == "Bot"`. Use typename, never `[bot]` suffix matching. GitHub review bots can use plain-looking logins. Suffix checks miss them and misclassify bot nits as human blockers. This split is what separates P1 from P4 in the Work-owed ranking.

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

Parenthesized colors match `long`, `table`, and `pingpong` roll-ups. Groups and colors must agree: groups 4/5 are exactly 🟢, group 2 exactly 🔴, and group 3 🟡. Group 1 takes whichever color its own signals earn — a draft with failing CI is still 🔴.

Group 3 deliberately catches remaining cases. Green requires CI passed **and** approval **and** no conflict. Anything clearing group 2 without all three belongs here. Previously, approved PRs with running builds could match no group. Now they are 🟡 `NEED APPROVAL`, waiting on builds rather than humans. Rendered `BUILD IN PROGRESS` status identifies that dependency.

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

**Activity breaks ties before age does.** Scheduler callers opt in with `pr_list ... --json --activity`; ordinary `pr_list` callers do not pay the extra GraphQL fields and do not receive a new JSON key. Within equal attention keys and equal work-owed tier, compute `activityAt` as the newest observed PR update, commit, issue comment, review, review-thread comment, or CI timestamp. A PR is **active** when `activityAt` is less than `14` days old and **stale** when it is `14` days or older. Active PRs run first, newest `activityAt` first. Stale PRs run last, oldest `activityAt` first. This makes a recently changed PR beat an abandoned peer without letting a low-urgency fresh PR jump ahead of urgent work. If `activityAt` is unavailable, fall back to `updatedAt` and mark the activity signal as incomplete in the ledger; never pretend the evidence is complete.

**Queue aging prevents starvation.** A stale PR that waits through `3` queue selections, or `1` full run without a pass, receives an aging promotion within its current activity band and tier. Aging never crosses P0/P1/P2 urgency, reviewer `R0`/`R1` attention, or P6's dead-last rule. Report the promotion and the wait count. Final tie-break remains oldest `updatedAt`, then stable URL order.

**A completed failure needs no blocking/non-blocking classification, and a running check is not a failure.** `/sy-babysit-pr` Step 3's classification answers "will this pending check ever resolve on its own?", which is only a question about checks still running. Two consequences, and the second is the one that gets mis-scored:

- **Completed** failing checks have resolved unsuccessfully. They are ours and P2, regardless of their pending-state classification. Count both check systems. Modern `CheckRun` uses `conclusion`: `FAILURE` / `TIMED_OUT` / `STARTUP_FAILURE`. Legacy `StatusContext` uses `state`: `FAILURE` / `ERROR`, without `conclusion`. Reading only one field silently misses commit-status CI failures.
- **A check that has not finished is never P2**, whether Step 3 calls it blocking or not. "Blocking" means _merge waits_, not _broken_. A two-minute-old build is behaving normally. Nothing about that state needs our fix. **Stalled** pending checks are not P2 either. Step 3 classifies them non-blocking and steps over them. Calling them "broken and ours to fix" would contradict that rule. Every unfinished check — running, queued, stalled, or held by a human gate — is P5, waiting on something other than us. Scoring healthy in-flight builds as P2 incorrectly promotes every fresh push. Those PRs just received work and do not yet need more attention.

### Two lenses over the same tiers

"Who is owed work" has two answers depending on which side of the PR you are standing, so the tiers above are read through one of two lenses. **The tier definitions never change** — a PR's `matches when` is objective — only the _order_ the tiers are serviced in. One table, two documented readings; never a second table.

- **Author lens (the default, used by `/sy-babysit-prs`)** — the order exactly as listed, P0 → P6. Rank the actions _I_ owe my own PR. "Awaiting first review" belongs at P5: I already shipped and cannot accelerate the reviewer.
- **Reviewer lens (used by `/sy-review-prs`)** — same tiers, but two _sub-buckets_ are lifted out and re-placed. Move only those sub-buckets, never whole tiers. P5 and P1 each contain several PR kinds. Leave all other kinds in their original positions.
  - **`awaiting first review` (a member of P5) is lifted out and placed above P1**, becoming the top tier for this lens. First reviews are the reviewer's most actionable work. Nobody has examined these PRs yet. Leaving them at P5 would service the review fan-out's core purpose last. The rest of P5 — green-and-approved awaiting merge, held by a human approval gate — does **not** move.
  - **`reviewDecision == "CHANGES_REQUESTED"` (a member of P1) is lifted out and placed just above P6.** Another reviewer already has an open block, so `/sy-review-pr` Step 3 skips it rather than piling on — servicing it early spends a round on a documented no-op. It stays _in_ the set, since a block can be dismissed between rounds and the later rounds exist to catch that. Keep the remaining P1 sub-bucket at P1: unresolved threads opened by humans. Those threads await replies that reviewers may owe.

  So the reviewer tier order is: awaiting-first-review → P0 → P1 (minus `CHANGES_REQUESTED`) → P2 → P3 → P4 → P5 (minus awaiting-first-review) → `CHANGES_REQUESTED` → P6. Everything else keeps its author-lens position. A dispatcher states which lens it used when it reports the slot map, so a surprising order is self-explaining rather than looking like a bug.

#### Reviewer-lens attention keys — evaluated before the tiers

The tier order answers _"how much work is owed?"_. On a reviewer's board two things outrank that, because both mean **a human is currently waiting on my eyes specifically**. Score each key, then sort: `R0` first, then `R1`, then the tier order above, then the tiebreakers. Re-score keys **at the start of every round**. Mid-run arrivals or mentions gain priority next round, not at run end. Both keys are re-ordering only — neither adds, removes, or skips a PR (see "Ranking never drops a PR").

- **`R0` — new since the last round, newest first.** The dispatcher has **not yet run a pass on this PR during this run**. It was also absent from the previous ranked set: it entered scope after fan-out began. Sort by `createdAt` **descending**, newest first, reversing normal oldest-first ties. The newest arrival's author is waiting for the first response. Determined from the agent ledger (`/sy-review-prs` Step 4b), not from GitHub: a PR is "seen" once it has a recorded completed pass. **Round 1 has no entries for this key**. Otherwise "newest unseen" includes the entire board and silently replaces tier ranking with date sorting. Round 1 is ranked by tiers alone.
- **`R1` — I am named on it.** Resolve my handle with `gh api user --jq .login`. Match `@`-mentions in PR bodies, issue comments, review bodies, review line comments, or replies within threads I commented in. Also match membership in `reviewRequests`. That is an explicit, addressed ask, so it outranks every tier including awaiting-first-review, where nobody asked for me by name. Detect per PR, in one call, and match `@<login>` case-insensitively on a word boundary so `@alice-bot` never matches `@alice`:

  ```bash
  gh pr view <url> --json body,comments,reviews,reviewRequests,latestReviews
  ```

  A mention of a **team** I belong to (`@<org>/<team>`) scores `R1` too. My own `@`-mention of myself does not. Ignore mentions inside fenced code blocks or quoted (`> `) lines — a quoted mention is history, not a new ask.

**Tiebreakers, applied in order once `R0` / `R1` / tier are equal:**

a. **Someone else's PR before my own.** A teammate is blocked on my review; on my own PR I am both parties and can act any time.
b. **Smaller diff first** (`additions + deletions` from `gh pr view --json additions,deletions`). Cheap reviews clear the board and unblock their authors soonest; a 4000-line PR behind three 20-line ones costs everyone less than the reverse.
c. **Activity recency** — active before stale, then newest `activityAt` first. This is the primary freshness tie-break for both dispatchers.
d. **Oldest `updatedAt`** — use when activity timestamps tie or `activityAt` is incomplete.
e. **Stable URL order** — final deterministic tie-break.

**P0 is checked locally and costs nothing.** `worktree_create --path-only <head-branch>` prints the canonical path without creating anything, so the dispatcher can probe a PR's branch worktree before dispatching, without an API call and without touching the user's checkout. A path that does not exist is simply not P0.

**Ranking never drops a PR.** It decides _order_, never _membership_ — a P6 draft is still dispatched, still gets its passes, and still appears in every render. Anything that uses this ranking to skip a PR is misusing it. **P6 remains last under both lenses; no attention key can lift it**. Draft / `WIP` / `DO NOT MERGE` / `DNM` PRs stay last despite newest arrival (`R0`) or direct mentions (`R1`). Explicit not-ready markers outrank both signals. Still dispatch these PRs. Each pass is a **documented skip posting nothing** (`/sy-review-pr` Step 3). This catches PRs marked ready between rounds on the next round.

## Feature clustering

Features commonly span API, client, and documentation PRs across repos. Those PRs form one work unit even when GitHub records no grouping. Clustering recovers that grouping so the set reads side by side instead of scattered across five repo-sorted rows. Compute clusters for **every** scope and format. Render them in `clusters`, which `/sy-list-prs-pending` delegates to, and `pingpong`. Group both pingpong pulse lines and tables by cluster. `short`, `long`, `table`, and `links` keep their existing repo-then-date sort untouched, because `/sy-babysit-prs` parses those line-by-line.

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

a. Use the cluster's **most urgent** member and the display group priority below. NEEDS ATTENTION outranks NEED APPROVAL even when those are each cluster's best-ranked members. One red PR blocks the whole feature, so the whole feature sorts red.
b. Cluster size descending — the widest fan-out first; that is the one where a missed repo costs the most.
c. Earliest member `createdAt` ascending.

Standalone PRs always come last, ordered by the normal group display order and within-group sort.

**Within clusters**, sort by dependency first, then group priority, repo name, and `createdAt`. Branch/body declarations that one sibling must land first put it above dependents, matching within-group rule b.

## Output format

Print groups in this fixed display order. Skip empty groups (don't print the heading if `N == 0`). Each group heading is `## <Group Name> (N)`.

### Mixed-author disclosure

Before rendering, resolve your own handle once (`gh api user --jq .login`) and compare it against every PR's `author.login`.

- **All PRs are yours** → omit the author entirely. It's noise.
- **Any PR has a different author** → the list is mixed. Surface authors in every format, and lead the output with one line: `Mixed authors: <handle> (N), <handle> (N), …`.

Where the author goes, per format:

| Format     | Placement                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `short`    | Group heading only — `## NEEDS ATTENTION (2 — @me 1, @alice 1)`. **URL lines stay bare.**                                 |
| `long`     | In the description line, right after the repo: `#123 [owner/repo] @alice — <title> — <status>`                            |
| `table`    | A dedicated `Author` column, inserted after `Repo`                                                                        |
| `links`    | Nowhere — `links` is pure machine input and carries no author, heading, or summary line                                   |
| `clusters` | Cluster heading only — `### oauth-migration (3 — @me 2, @alice 1) — acme/api, acme/web`. **PR lines stay bare.**          |
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

The short description line is: `#<number> [<owner/repo>] <title> — <color emoji> <status>`. On a mixed-author list, insert the author after the repo: `#<number> [<owner/repo>] @<author> — <title> — <color emoji> <status>`. Strip leading `[<repo>] ` from `<title>` only when it matches the repo already printed on that line. The repo field already supplies that information.

`<color emoji>` and `<status>` share pingpong Status vocabulary and roll-up rules. Use 🔴 for failed CI, requested changes, or merge conflicts. Use 🟡 for running builds or awaiting review. Use 🟢 only for CI passed **and** approval **and** no conflict. `<status>` is the component tokens that justify the color, `·`-separated on one line: `CI FAILED — <check>`, `CHANGES REQUESTED`, `MERGE CONFLICT`, `BUILD IN PROGRESS (<n> running)`, `AWAITING REVIEW`, `CI PASSED`, `APPROVED`. Print every token that applies, in that fixed order, so a red row says which of the three reds it is. For NOT READY / WIP / DRAFT, display the normalized `WIP: ` title and prepend `[draft]` when the PR is a draft.

### Format: `table`

Print one markdown table per group with these columns:

| PR | Repo | Title | Link | CI Status | Approvals | Comments | Ready to Merge? |

On a mixed-author list, insert an `Author` column immediately after `Repo`, filled in for **every** row (including your own) so the rows stay comparable.

- **PR**: PR number and branch name on separate lines (e.g. `#123` then `feature-branch` below it).
- **CI Status**: `CI PASSED` / `CI FAILED — <check>` / `BUILD IN PROGRESS (<n> running)` — same vocabulary as the `pingpong` Status cell, so one reader learns one set of words for the whole command.
- **Approvals**: `APPROVED (<n>)` / `CHANGES REQUESTED` / `AWAITING REVIEW`.
- **Comments**: count of unresolved review threads (`0` if none).
- **Ready to Merge?**: group 5 gets `🟢 yes`; group 4 gets `🟢 yes — <n> open comments`. Otherwise use `🔴 no — <blocker>` for CI failures, changes requested, or merge conflicts. Use `🟡 no — <what it waits on>` for running builds or awaiting review. Same three colors and the same roll-up rule as `pingpong`: green needs CI passed **and** approved **and** no conflict; red wins over yellow.
- In the NOT READY / WIP / DRAFT table, display the normalized `WIP: ` title and prepend `[draft]` when the PR is a draft.

### Format: `links`

A bare bullet list of PR URLs — one `- <url>` per line. **Nothing else** — no group headings, no counts, no blank lines between groups, no `Mixed authors:` line, no titles, no status. The whole output is a clean link list you can paste into Slack, a PR body, or notes, and that another command can read line-by-line after stripping the `- ` prefix.

```
- https://github.com/owner/repo-a/pull/123
- https://github.com/owner/repo-b/pull/456
- https://github.com/owner/repo-c/pull/789
```

- Every line is exactly `- ` followed by the URL. No numbering, no nesting, no indentation, no trailing punctuation.
- Classification still runs — it only drives the **order**. Use the same fixed display order: NEEDS ATTENTION → READY TO MERGE → READY TO MERGE (with comments) → NEED APPROVAL → NOT READY / WIP / DRAFT. Preserve within-group sorting. Flatten to one bullet per line.
- Print the full `https://github.com/<owner>/<repo>/pull/<number>` form here — `links` output is meant to be consumed by other commands, and the scheme keeps every consumer happy.
- Zero PRs → print nothing at all (empty output). No "no PRs found" line: an empty list is the correct machine answer, and a prose line would be parsed as a link by whatever is reading.
- `links` is the strictest machine-input format in this file. The `- ` prefix is the only decoration — never add a handle, title, status, annotation, or code fence.

### Format: `clusters`

The cross-repo view. Use the same URLs as `links`, bucketed by **feature cluster** (Feature clustering). Cross-repo features form one block, even across four repos. Give every line a running `pr<N>` handle for follow-up references: "babysit pr2 and pr3 first".

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
- **PR line**: `- <full URL> — pr<N> — <description> — <color emoji> <status>`. Keep the same four fields in the same order for clustered and standalone lines. Never create per-block variants. Pasted lines retain identical meaning everywhere. `<color emoji>` and `<status>` use the exact vocabulary and roll-up rule as `long` (`CI FAILED — <check>`, `CHANGES REQUESTED`, `MERGE CONFLICT`, `BUILD IN PROGRESS (<n> running)`, `AWAITING REVIEW`, `CI PASSED`, `APPROVED`, `·`-separated). Use the normalized `WIP: ` title and prepend `[draft]` when they apply.
- **The URL leads every PR line — always the first field after `- `.** Everything else is a trailing annotation, so a line stays clickable, greppable, and copy-pasteable no matter how many annotations get appended later. Never put the `pr<N>` handle, a status, or a description ahead of the URL.
- **Describe what each PR does**. Write `<description>` as ≤8 plain-English words from its title and body. Never paste titles verbatim, use branch names, or restate status. Without it a reader gets a bare number and a color and has to open every link to triage. Cannot tell from title and body what it does → say the narrowest true thing (`config change in the ingest job`), never invent a purpose.
- **Inside clusters, describe the PR's contribution, not the overall feature**. The `###` heading already names that feature. Repetition wastes the field that distinguishes member PRs. Write the differentiator: `issue refresh tokens on the token endpoint`, not `oauth migration`.
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

| PR | Description | Status | Agent |
| --- | --- | --- | --- |
| [github.com/acme/widget-store/pull/109](https://github.com/acme/widget-store/pull/109) | **@alice** · `alice/oauth-migration/token-retry` · **Retry token refresh on 401** · auto-merge off | Δ 🔴 CI FAILED — `unit-tests` · AWAITING REVIEW | 🔄 IN PROGRESS (pass 1 · 4:12 left) · slot 1 · started 17:12 · running 22m · 💬 3 open · ✔ 5 resolved · ⚠️ 0 need attention |
| [github.com/acme/web/pull/7](https://github.com/acme/web/pull/7) | `@me` · `syle/oauth-migration/split-auth-middleware` · **WIP: Split auth middleware** · auto-merge off | ▫️ 🔴 CI PASSED · CHANGES REQUESTED · MERGE CONFLICT | ⚠️ ESCALATED (pass 2 · 4:12 left) · slot 1 · stopped 17:01 · ran 19m — needs human · 💬 1 open · ✔ 3 resolved · ⚠️ 1 need attention |
| [github.com/acme/api/pull/51](https://github.com/acme/api/pull/51) | **@bob** · `bob/signup-flow` · **Add signup flow** · 🤖 auto-merge (squash) | 🆕 🟡 BUILD IN PROGRESS (3 running) · AWAITING REVIEW | ⚪ NOT STARTED · slot 2, position 2 of 2 · behind github.com/acme/web/pull/7 · 💬 0 open · ✔ 0 resolved · ⚠️ 0 need attention |

### 🌊 Standalone (2) — acme/widget-store, acme/api

| PR | Description | Status | Agent |
| --- | --- | --- | --- |
| [github.com/acme/widget-store/pull/113](https://github.com/acme/widget-store/pull/113) | `@me` · `syle/drop-dead-flag` · **Drop dead feature flag** · auto-merge off | ▫️ 🟡 CI PASSED · AWAITING REVIEW | ⏸️ WAITING (pass 2 · 4:12 left) · slot 1 · ended 16:58 · ran 26m · next check 17:02 · 💬 2 open · ✔ 0 resolved · ⚠️ 1 need attention |
| [github.com/acme/api/pull/42](https://github.com/acme/api/pull/42) | `@me` · `syle/bump-deps` · **Bump deps to latest** · 🤖 auto-merge (squash) | Δ 🟢 CI PASSED · APPROVED | ✅ COMPLETED (pass 3 · 4:12 left) · slot 1 · ended 17:05 · 48m total · 💬 0 open · ✔ 4 resolved · ⚠️ 0 need attention |
```

**Grouping — one feature set is one block, top to bottom.**

A fan-out is dispatched by feature, not by repo, so the pulse is read by feature too. Use the **same** groups in the **same** order for pulse sentences and tables. Keep each sentence near its corresponding row, never at opposite output ends. A four-repo feature reads as one block instead of four rows scattered by color.

**Group key — first signal that fires:**

1. **Feature cluster** (see Feature clustering) — the PR is in a cluster of two or more. Group = that cluster, label = the cluster label.
2. **Dispatch slot** — no cluster, but the ledger gives the PR a slot number. Group = `Slot <N>`, for PRs that share nothing but the job lane servicing them.
3. **`Standalone`** — neither. One trailing group, always last.

**Group ordering** follows Feature clustering unchanged: most urgent member first, then group size descending, then earliest member `createdAt`. Groups containing 🔴 outrank those whose worst state is 🟡. Append one pingpong-only tiebreaker: **lowest slot number first**, placing busier lanes above quieter ones. `Standalone` is always last regardless of what it holds.

**Group heading**: `### 🌊 <label> (<n>) — slot <N> · <repo>, <repo>, … — <≤10-word description of the feature set>`.

- Omit `slot <N>` when the ledger has no group slot. Use `slots <N>–<M>` for clusters spread across slots. Round-robin dealing commonly splits cross-repo features; per-row Agent slots identify each lane.
- The `<description>` is one plain-English clause for what the whole feature set does, written from the members' titles and bodies. Omit it on `Standalone` and on `Slot <N>` groups, which have no shared feature to describe.
- Repos are comma-separated in the order their PRs appear, same as the `clusters` heading.
- When the group came from clustering inference (Feature clustering signals 4–5), append ` — grouped by <signal>`. A guess says it's a guess.

**Pulse block grouping**: one bold group line — `**<label>** — slot <N> · <n> PRs · <repo>, <repo>, … — <description>` — then that group's sentences beneath it, then a blank line before the next group. Same fields, same order as the table heading, minus the `###` and the 🌊.

**One table per group**, under its heading and repeating the four-column header below. Keep groups intact and use the within-group sort.

**Sort within groups** by `🔴`, `🟡`, `🟢`, then `❓`. Within colors, sort `Δ` before `🆕` before `▫️`. Break remaining ties by repo name, then PR number. Red work leads because humans must act on it. Moved work precedes parked work because it changed since the last pulse. Sort **only within groups**. Never move red PRs outside their feature sets to lead the board. Group ordering already promotes the group containing the most urgent member.

**Header block:**

- Line 1: `🏓 Agent Status Ping-Pong — <current timestamp>` (local time, with zone).
- Line 2: `Next ping-pong: <timestamp> (in <N> min)`. On the final pulse of a run, write `Next ping-pong: — (final)` instead.
- `Repos Scanned (<count>): <owner/repo>, <owner/repo>, …` — the resolved scope, comma-separated.
- `PRs Scanned (<count>):` followed by one `- <owner>/<repo>: <n>` line per repo. Repos with zero matching PRs still get a line with `0` — a scanned-but-empty repo is a real answer.
- `Pulse (<n> moved, <n> steady, <n> new):` followed by **one sentence per PR**, bucketed under its feature-set group line (see Grouping) — the high-level read, before anyone looks at the tables. This is the part a human skims on a phone; the tables are where they go when a sentence makes them want detail.

  Each line is `- <change marker> <full PR path> — <one sentence>`. Use one high-level, plain-English sentence of ≤20 words. State what moved, or stayed unchanged, and the agent's response. Never include counters, `Δ` fragments, or status tokens. Tables own counts and status tokens. Duplicating them makes the pulse as dense as the tables, defeating its purpose.

  Group order and within-group order match the tables exactly, so the reader can drop from a sentence straight to its row. The `(<n> moved, <n> steady, <n> new)` tally is across the **whole** board, not per group — a one-glance answer to "did anything happen in the last 10 minutes?".

**Columns — exactly four, in this order: `PR`, `Description`, `Status`, `Agent`.**

**Every cell is ONE line. `<br>` is forbidden anywhere in this render.** Previously, PR cells packed four lines with `<br>`. These CLIs render Markdown tables as plain text. Literal `<br>` characters make such cells unreadable. A cell holding several fields joins them with `·` instead — a separator that is just text and renders identically everywhere. Cells wrap on width by themselves; that is the renderer's job, not this spec's.

**Fields inside a cell each get a different markdown span so the reader's theme colors them apart** — markdown link, inline code, bold, plain. Three distinct spans is the whole coloring mechanism: never emit ANSI, an HTML `<span>`, or a color name, all of which render as literal garbage in a table cell.

- **PR** — the link, and **nothing else**: `[<path>](<url>)`, where `<path>` is the full `github.com/<owner>/<repo>/pull/<number>`. One field per cell is what keeps the column narrow enough to scan, and a link is the one thing in the row a reader clicks rather than reads. **Never elide the owner to `…/<repo>/pull/<n>`** — a path with the org replaced by an ellipsis is not clickable, not greppable, and not pasteable.

- **Description** — everything that says _what this PR is_, one line, `·`-separated, in this fixed order: `<author> · `<head branch>` · **<title>** · <auto-merge>`.

  | Field       | Span                                   | Typical color | Notes                                                                                                                     |
  | ----------- | -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
  | Author      | `` `@me` `` mine / `**@alice**` theirs | code vs bold  | The one field with **two** spans on purpose — the color flip is what makes "mine vs theirs" scannable (see Author, below) |
  | Head branch | inline code, `` `<headRefName>` ``     | grey / dim    | `headRefName` verbatim, never the base branch, never a slug. The token you retype into `git checkout` / `worktree_create` |
  | Title       | bold, `**<title>**`                    | accent        | Normalized as every other render normalizes it (`WIP: ` form, `[draft]` prepended). Over ~60 chars → truncate with `…`    |
  | Auto-merge  | plain text                             | default       | `🤖 auto-merge (<method>)` when armed, `auto-merge off` when not — it decides whether a green row still needs a human     |

  Auto-merge belongs here, not `Status`: it describes configuration, not health. Armed 🟡 rows need nobody; identical unarmed rows await someone returning to click. Method comes from `autoMergeMethod` lowercased (`squash` / `merge` / `rebase`).

  Head branch comes from a per-PR `gh pr view <url> --json headRefName` — `gh search prs` cannot return it (see the field trap above). Unavailable → drop the field and its separator; never a placeholder. Where the title genuinely says nothing (`fix`, `update`, `wip`), append ` — <≤8-word TLDR>` written from the body.

  Remove the old per-row group / feature line from PR cells. Each table's `###` heading already identifies its feature set, repos, and slot range. Per-row repetition adds no information. The per-row slot survives in the `Agent` cell, which is the only part of it that varies row to row.

  **Author — the first field of the Description cell**, always shown, mixed-author list or not. It leads the cell because "is this mine to fix or someone else's to nudge?" is the first triage question on a mixed board.

  **Wrap handles differently for mine versus others**, using distinct Markdown spans and theme colors. Never use ANSI escapes: many clients render them as literal garbage inside table cells:

  | Author        | Render                 |
  | ------------- | ---------------------- |
  | Me (the user) | `` `@me` ``            |
  | Anyone else   | `**@alice**`           |
  | A bot         | `**@dependabot[bot]**` |

  Always the real handle after the `@`; `@me` is written literally only for the user's own PRs, matching the existing `@me` convention in every other render. Author unresolvable → `❓` in the cell, never a blank and never a guess.

- **Status** — the PR's own state, independent of any agent. **One line: the change marker, the color emoji, then the component fragments joined with `·`.** Never a comment dump, never a prose reason, never the word "GREEN" / "RED" / "YELLOW" spelled out — the emoji _is_ the roll-up and the fragments are the evidence. The per-thread counts live in the Agent cell, because acting on them is the agent's job.

  ```
  <change marker> <color emoji> <CI fragment>[ · <review fragment>][ · MERGE CONFLICT]
  ```

  **The change marker leads the cell; it does not get a column.** A separate trailing `Δ` column created a near-empty stripe. It repeated the status-leading marker, forcing two glances for one bit. What moved in detail belongs to the pulse sentence above the table, which has room for a clause; the cell carries the one-character verdict.

  | Marker | When                                                              |
  | ------ | ----------------------------------------------------------------- |
  | `Δ`    | Anything about this PR differs from its previous pulse — it moved |
  | `▫️`   | Identical to the previous pulse — nothing moved                   |
  | `🆕`   | First pulse for this PR — no prior snapshot to compare against    |

  A "change" includes any difference in color emoji, Status fragments, Description fields, **or Agent-cell counters**. Resolved threads, new approvals, and additional green checks all count. The marker sits in Status but diffs the whole row. Never render `▫️` on a PR you have no prior snapshot for; that is `🆕`.

  **The feature grouping is excluded from the diff.** Clustering is derived from titles, branches, and bodies, so it re-resolves on every pulse and a re-labelled group is bookkeeping, not PR movement — same reason the clock is excluded. One exception: a PR whose **slot position actually advanced** (its lane finished the PR ahead of it and started this one) is `Δ`, and the pulse sentence says so.

  Print all applicable fragments in fixed order. A conflicting PR with changes requested shows both. Color collapses them into one signal; fragments explain the components.

  **The color emoji** is the whole verdict, rolled up from the fragments below. Evaluate top-down, first match wins:

  | Emoji | When                                                                                         |
  | ----- | -------------------------------------------------------------------------------------------- |
  | `🔴`  | **Any** of: CI failed, reviewer requested changes, merge conflict                            |
  | `🟡`  | Nothing red, but not yet all-clear: build still running, or nobody has reviewed it yet       |
  | `🟢`  | CI passed **and** approved **and** no merge conflict — the only combination that earns green |
  | `❓`  | Status fetch failed — cannot roll up. The fragments say which call failed (see Edge cases)   |

  Red is checked before yellow so a failing check on a still-running build reads red, not yellow. Green is a conjunction of all three conditions — a PR that is CI-green and unreviewed is `🟡`, never `🟢`.

  **Fragment 1 — CI, always printed.** Exactly one of:

  | Fragment                          | When                                                                                                    |
  | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
  | `CI PASSED`                       | Every required check succeeded (neutral / skipped count as ok)                                          |
  | `CI FAILED — <check>`             | Any required check failed. Name the first failing check                                                 |
  | `BUILD IN PROGRESS (<n> running)` | Self-resolving checks still queued or running, none failed yet (human approval gates excluded — Step 2) |

  **Fragment 2 — review, printed whenever the review state is known.** Exactly one of:

  | Fragment            | When                                                                 |
  | ------------------- | -------------------------------------------------------------------- |
  | `APPROVED`          | `reviewDecision == "APPROVED"`                                       |
  | `CHANGES REQUESTED` | `reviewDecision == "CHANGES_REQUESTED"`                              |
  | `AWAITING REVIEW`   | `reviewDecision` is null or `REVIEW_REQUIRED` — nobody has ruled yet |

  Always print `AWAITING REVIEW` when applicable. Waiting on reviewers is one possible `🟡` meaning. A yellow row showing only `CI PASSED` hides that dependency. Omit this fragment entirely only when the review state could not be fetched.

  **Fragment 3 — `MERGE CONFLICT`, printed only when `mergeable == "CONFLICTING"`.** Absent means no conflict; there is no "no conflict" line, because a clean merge is the default and printing it on every row is noise.

  Nothing else goes in this cell. No open-thread counts (Agent cell), no timestamps (Agent cell), no free-form reason clause.

- **Agent** — what the dispatched job is doing. **One line: `<state token>[ (pass N · <HH:MM> left)] · [slot <N> · ]<clock> · <counters>`.** State, clock, and counters are one thought — "which state, since when, for how long, and how much is outstanding" — and they read worse split. The per-row `slot <N>` lives here because it is the only part of the old group line that varies row to row. No delta here; the marker leads the Status cell.

  **State token and clock.**

  | Token                   | When                                                             | Clock                                                           |
  | ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
  | `⚪ NOT STARTED`        | Enrolled, first pass not yet run                                 | `queued, position 2 of 5` (no clock; nothing started)           |
  | `🔄 IN PROGRESS`        | Job actively working this pass                                   | `started 17:12 · running 22m`                                   |
  | `⏸️ WAITING`            | Pass done, polling until something moves                         | `ended 16:58 · ran 19m · next check 17:02`                      |
  | `🔍 WATCHING`           | **Not terminal** — no worker held, dispatcher polling cheaply    | `blocked on Owner Approval · probe 4 · next check 17:02`        |
  | `✅ COMPLETED`          | Job finished all passes, or the PR merged                        | `ended 17:05 · 48m total`                                       |
  | `⏭️ SKIPPED`            | **Terminal** — skipped, and the run budget is spent              | `17:02 — draft, budget spent`                                   |
  | `⏸️ WAITING_AFTER_SKIP` | **Not terminal** — this pass skipped, run budget still open      | `17:02 — draft · next check 17:02`                              |
  | `🙋 NEEDS_USER`         | **Not terminal on GitHub** — this run paused it for the operator | `needs you — split request · asked 16:40 · revalidated current` |
  | `⚠️ ESCALATED`          | Job stopped and needs human judgment                             | `stopped 17:01 · ran 19m — needs human`                         |
  | `❌ FAILED`             | Job errored out                                                  | `failed 16:44 · ran 4m — worktree conflict`                     |

  **`SKIPPED` vs `WAITING_AFTER_SKIP` — the distinction the pulse depends on.** Every per-PR skip except `MERGED` / `CLOSED` is a snapshot judgment. Later passes can overturn it: drafts become ready, authors drop `WIP`, or reviewers dismiss blocking requests. So a skip while the run budget is still open is `⏸️ WAITING_AFTER_SKIP`, and the row keeps its next-check ETA. Only when the budget is spent does the row settle to `⏭️ SKIPPED`. Collapsing these states makes `⏭️ SKIPPED` both terminal and loopable. That stops pulses early and reports completion while the job still has scheduled work.

  **`🔍 WATCHING` means the PR is being served cheaply, not that it was dropped.** This PR is externally blocked, so the dispatcher released its worker slot and is polling the state fingerprint itself (`/sy-babysit-prs` Step 4b, `/sy-review-prs` Step 5b). The row is **not terminal** — it keeps its pass counter and its next-check ETA, the pulse keeps running, and a worker is dispatched the instant the fingerprint moves. Its clock reads `blocked on <what> · probe <N> · next check <HH:MM>`: what it is waiting on, how many probes it has spent there, and when the next one lands. Never render it as `⏸️ WAITING` (which claims a dispatched job is asleep) or as `⏭️ SKIPPED` (which claims nobody is coming back).

  **`🙋 NEEDS_USER` is a pause in this run, never a state on GitHub.** Pause only the blocked decision; retain probes and keepalive revalidation passes per the dispatcher's rules. Show the question, ask time, and latest verdict (`current` / `changed` / `conflicted` / `stale_unknown`); `cleared` returns to normal scheduling. Make no GitHub scheduler-state writes. Do not render this pause as `⚠️ ESCALATED` or terminal `⏭️ SKIPPED`.

  **A merged or closed PR is `✅ COMPLETED`, never `⏭️ SKIPPED`** — precedence, because both could otherwise claim it. Merged or closed PRs reached the run's destination. Reserve `⏭️ SKIPPED` for PRs still open with nothing to do on every pass.

  **Clock grammar.** Times are local `HH:MM`, 24-hour, no date (the header block already carries the date). Durations are `<N>m` under an hour, `<N>h <N>m` over it, always whole minutes — a pulse is a 10-minute heartbeat, so seconds are noise.

  - `running <N>m` on `🔄 IN PROGRESS` is **elapsed since the current loop started**, recomputed at render time (`now − loop start`), not the total across loops. That is the number a human actually wants: "has this pass been stuck for 45 minutes?"
  - `ran <N>m` on a finished-pass state is that pass's own wall time (`pass end − pass start`).
  - `<N>m total` on `✅ COMPLETED` is the whole job, first dispatch to final pass end, across every pass.
  - A clock field with no data prints nothing rather than `0m` or `--`; drop the field and its `·` separator. Never invent a start time to fill the slot.

  The pass counter is `(pass N · <HH:MM> left)` whenever the per-PR command loops — how many full passes that PR has had, and how much of the shared run budget remains. There is no pass quota, so never render a denominator. Drop the counter entirely only for a genuinely single-pass per-PR command (`🔄 IN PROGRESS — started 17:12 · running 6m`).

  **The clock is excluded from the change-marker diff.** Elapsed time moves on every pulse by definition, so counting it as a change would render `Δ` on every running row forever and destroy the marker's only job. Diff the state token, the pass number, the Status cell, and the counters line — never `running <N>m`, never a recomputed `next check <HH:MM>`, never the remaining-budget figure. A row whose only difference is the clock ticking is `▫️`.

  **Counters — the tail of the same line.** Always printed, always all three fields, always this order, appended after the clock with the same `·` separator:

  `💬 <n> open · ✔ <n> resolved · ⚠️ <n> need attention`

  | Field                   | Meaning                                                                                                                                                                         |
  | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `💬 <n> open`           | Unresolved review threads still on the PR — the agent's remaining queue                                                                                                         |
  | `✔ <n> resolved`        | Review threads resolved — what the agent (or the author) has already worked through                                                                                             |
  | `⚠️ <n> need attention` | Threads the agent read but **cannot** act on alone: no good option is obvious, the fix is a product/design call, the reviewer and the code disagree, or it needs human judgment |

  Zeros are printed, never omitted — a fixed three-field line is what makes two pulses diffable at a glance, and a missing field reads as "not measured" rather than "none". `⚠️ need attention` is a strict subset of `💬 open`: blocked threads remain open. Always require `need attention ≤ open`. Exceeding `open` is a bookkeeping bug, not a rendering choice. It counts **comment threads**, not CI failures or conflicts — those are already the Status color. A non-zero `⚠️` is the signal a human has to read this PR themselves; pair it with `⚠️ ESCALATED` as the state token when the job stopped over it.

  Counts come from the caller's ledger where the agent tracked them; standalone with no ledger, fill `💬` / `✔` from `reviewThreads` and print `⚠️ 0 need attention` (nothing has judged them). On a failed fetch, print `?` in the affected field rather than guessing `0`.

**Agent state comes from the caller.** `/sy-list-prs` owns the layout, not the job bookkeeping. The dispatcher passes scope and its per-PR agent ledger. Include ledger state, pass count, **active slot number or queued position**, and first dispatch time. Include last pass start/end and next-check ETA. Include **watch state, blocker, probe count, and next-check time when watching**. Include open, resolved, and need-attention thread counts. Every clock field on the Agent line is read from that ledger — `/sy-list-prs` computes only the elapsed subtraction (`now − loop start`), never the timestamps themselves. The slot number is read from the ledger too and never invented; with no slot for a PR, the Agent cell drops its `slot <N> · ` fragment rather than guessing one. Invoked standalone with no ledger, every Agent cell renders `⚪ NOT STARTED · no agent dispatched` plus counters derived straight from `reviewThreads` — the pulse still works as a read-only board, grouped by feature cluster alone.

**The previous snapshot comes from the caller too.** The change marker is a diff, so it needs the prior pulse to diff against: the ledger carries, per PR, the last rendered color emoji, Status fragments, and counters. After rendering, the dispatcher overwrites that snapshot with what was just printed, so the next pulse compares against the immediately preceding one — not against the run's opening state. With no prior snapshot (standalone invocation, first pulse of a run, or a PR that entered the set mid-run), the row's Status cell leads with `🆕`.

**Renderer contract — the board is emitted exactly as specified, or not at all.** Every pulse, from the first baseline to the closing one, is the **same** table: four columns in the fixed order `PR | Description | Status | Agent`, one line per cell, full `github.com/<owner>/<repo>/pull/<number>` paths. Context pressure invites "quick" boards with abbreviated paths, three columns, invented columns, or bespoke `Ping-pong 0 — baseline` headers. These variants prevent comparing pulses ten minutes apart without rereading. Before printing, verify four columns in order. PR cells contain only linked paths. Description cells contain author, branch, title, and auto-merge in their own spans. Forbid `<br>` anywhere and `…/` in PR paths. Require the header block and one table per feature set. A field you have no data for prints its documented empty form (`❓`, `?`, `⚪ NOT STARTED`) — never a dropped column and never a shortened row.

**Never** prefix or suffix PR paths, add or remove columns, or split boards by readiness. Use one table per **feature set**, ordered by Grouping above. Readiness lives in the Status column and in the group order; it never gets its own table.

## Edge cases

- **Scope = all**, author has zero open PRs → print `No open PRs found for <author>.` and stop.
- **Scope = pwd**, zero git repos under cwd → print `No git repos found within 2 levels of $(pwd).` and stop. If repos resolved but zero matching PRs → print `No open PRs found for @me in <N> repos under $(pwd).` and stop.
- **Format = `links` or `clusters`, any zero-result case** → print nothing and stop. The "no PRs found" / "no git repos found" prose above is suppressed in both, because a consumer reading the output line-by-line would treat that sentence as a link.
- **Format = `clusters`, nothing clusters** → every PR is standalone; print only the `### Standalone (<n>)` block, numbering unchanged. Never fabricate a cluster to avoid an all-standalone render, and never drop the heading.
- **Format = `clusters`, one PR matches two keys** → unite both clusters transitively. Label with the strongest signal (lowest signal number). Disclose inference in the heading when that strongest signal was inferred.
- **Scope = explicit refs**, bare `#<n>` / digits outside a git repo → error. Name the unresolvable token. Ask for a fully-qualified ref. Unparseable token (not a URL, shorthand, `#<n>`, or digits) → error out, name the bad token, do NOT silently skip.
- PWD keyword + explicit refs in the same call → error (no mixing).
- **Format = `pingpong`, zero PRs resolved** → still print the header block (counts of `0`, an empty `Pulse (0 moved, 0 steady, 0 new):` line, repo list intact) and skip the tables. A pulse that prints nothing is indistinguishable from a dead agent, which defeats the purpose.
- **Format = `pingpong`, nothing clusters and the ledger has no slots** → the whole board is one `### 🌊 Standalone (<n>)` group with one table. Never fabricate a feature set or revert to the old ungrouped board. The heading confirms grouping ran and found no shared feature.
- **Format = `pingpong`, a cluster spans two slots** → it stays **one** group (the feature is the unit of work, not the job lane). The heading reads `slots <N>–<M>` and each row's group line carries its own slot.
- **Format = `pingpong`, a PR changes clusters between pulses** → regroup without separate commentary. Examples include new sibling PRs or body edits revealing shared tickets. Mention regrouping once in that PR's pulse sentence. The row is not `Δ` for the regrouping alone — see the diff exclusion above.
- **Format = `pingpong`, no prior snapshot** (standalone call, or the run's opening pulse) → every row is `🆕`, never `▫️`. `▫️` is a positive claim that nothing moved; only render it when you actually have a previous pulse to compare against.
- **Format = `pingpong`, a PR exits scope**, including merged, closed, or no-longer-matching PRs → retain one final pulse **inside its feature-set group**. Render Status as `Δ 🟢 MERGED` / `Δ ⚫ CLOSED` and Agent as `✅ COMPLETED`. Then drop it. A row that silently vanishes reads as a lost job, and moving it to a "done" bucket breaks the one-feature-one-block rule.
- **Format = `pingpong`, status fetch fails** → render color emoji `❓`. Replace fragments with the failing call, such as `STATUS FETCH FAILED — statusCheckRollup`. Never guess a color from partial data, and never drop the row: a missing row reads as "merged", which is the opposite of "we don't know".
- **Format = `pingpong`, the ledger lacks a normally required state clock** → print the state token without a clock. This includes lost timestamps or jobs predating the ledger. Do not backfill `0m`, `--`, or the pulse's own timestamp; an absent clock is honest, an invented one sends someone chasing a job that never ran that long.
- If a single PR's status fetch fails, include it under NEEDS ATTENTION with the reason `status fetch failed` rather than dropping it silently.
- If `reviewDecision` is `null` (no reviews requested yet), treat as `NEED APPROVAL` (not READY).
- **Scope = explicit refs** is author-agnostic, so it's the scope most likely to come back mixed — always run the mixed-author check on it. PWD forces `--author=@me` and cannot be mixed-author. `all` with an explicit author token is single-author but may name someone else. Identify whose PRs these are rather than repeating that handle per row.
