[Sy] List open pull requests across repos, grouped by readiness. Defaults to `short` format (just full links).

## Inputs

`$ARGUMENTS` is a free-form string that may carry three independent dimensions: a **format keyword**, a **scope**, and an **author**.

- **Format keyword** (one of, case-insensitive): `short`, `long`, `table`. Defaults to `short` if absent.
- **Scope** — pick exactly one (first match wins):
  - **PWD** (default, no scope token present) — scan the current working directory up to 2 child levels below cwd (find -maxdepth 3 on .git; depth chosen because PRs often live in nested repo folders) for git repos and list `@me` open PRs in those repos only. PWD scope forces author = `@me` (ignores any author token).
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

## Parsing $ARGUMENTS

1. Tokenize `$ARGUMENTS` on whitespace. (Quoted multi-word author names — e.g. `"Alice Doe"` — preserve as one token.)
2. **Extract the format keyword** — pick the first token (case-insensitive) that matches `short`, `long`, or `table`. Remove it from the token list. If no match, format = `short`.
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
   - Discover git repo roots under cwd up to 2 child levels below cwd (find -maxdepth 3 on .git):
     `find . -maxdepth 3 -type d -name .git -not -path '*/node_modules/*' -not -path '*/.build/*' -not -path '*/vendor/*'`
     Each match's parent dir is a repo root. Include cwd itself if `./.git` exists.
   - For each root, resolve `<owner>/<repo>` via `git -C <root> remote get-url origin` (never from the folder name — see Repo Identification). Skip roots with no `origin` or a non-GitHub remote.
   - De-duplicate `<owner>/<repo>` list. If empty, print `No git repos found within 2 levels of $(pwd).` and stop.
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

| Format  | Placement                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------- |
| `short` | Group heading only — `## NEEDS ATTENTION (2 — @me 1, @alice 1)`. **URL lines stay bare.**      |
| `long`  | In the description line, right after the repo: `#123 [owner/repo] @alice — <title> — <status>` |
| `table` | A dedicated `Author` column, inserted after `Repo`                                             |

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

## Edge cases

- **Scope = all**, author has zero open PRs → print `No open PRs found for <author>.` and stop.
- **Scope = pwd**, zero git repos under cwd → print `No git repos found within 2 levels of $(pwd).` and stop. If repos resolved but zero matching PRs → print `No open PRs found for @me in <N> repos under $(pwd).` and stop.
- **Scope = explicit refs**, a bare `#<n>` / digits token and cwd is not a git repo → error out, name the unresolvable token, ask the user to use a fully-qualified ref. Unparseable token (not a URL, shorthand, `#<n>`, or digits) → error out, name the bad token, do NOT silently skip.
- PWD keyword + explicit refs in the same call → error (no mixing).
- If a single PR's status fetch fails, include it under NEEDS ATTENTION with the reason `status fetch failed` rather than dropping it silently.
- If `reviewDecision` is `null` (no reviews requested yet), treat as `NEED APPROVAL` (not READY).
- **Scope = explicit refs** is author-agnostic, so it's the scope most likely to come back mixed — always run the mixed-author check on it. PWD scope forces `--author=@me` and can never be mixed; `all` scope with an explicit author token is single-author but that author may not be you, in which case say whose PRs these are rather than repeating one handle on every row.
