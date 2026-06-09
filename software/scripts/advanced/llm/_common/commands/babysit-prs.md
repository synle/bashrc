[Sy] Run `/sy-babysit-pr` on EVERY open PR in scope. This command is a fan-out wrapper — it resolves a list of target PRs (from `$ARGUMENTS`) and delegates the full per-PR loop (sync, comments, local checks, CI monitor) to `/sy-babysit-pr` for each one.

**Recommended order.** Run `/sy-review-prs` first (verdict pass), then `/sy-babysit-prs` (this command). Reversing wastes babysit cycles on PRs that would be requested-changes anyway.

Argument: `$ARGUMENTS` (optional — selects scope; the first token decides the mode, no mixing).

- **Empty** — babysit every open PR authored by `@me` across all repos. (Default behavior.)
- **PWD keyword** — first token (case-insensitive, trimmed) is one of: `pwd`, `.`, `./`, `here`, `cwd`, `this folder`, `this-folder`. Scan the current working directory up to 2 child levels deep for git repos and babysit `@me` open PRs in those repos only.
- **Explicit PR refs** — one or more whitespace-separated PR refs. Each ref is one of:
  - full URL: `https://github.com/<owner>/<repo>/pull/<n>`
  - shorthand: `<owner>/<repo>#<n>`
  - bare `#<n>` or bare digits `<n>` — only valid when the current working directory is a git repo with a GitHub `origin`; resolve `<owner>/<repo>` from `git remote get-url origin` (per global rule 51, NEVER from the folder name).

## Steps

1. **Resolve target PR list from `$ARGUMENTS`.** Pick exactly one branch:

   a. **Empty `$ARGUMENTS`** — run `gh search prs --author=@me --state=open --json number,title,repository,isDraft,url,headRefName,baseRefName` and use the full result.

   b. **PWD keyword** (first token matches `pwd` / `.` / `./` / `here` / `cwd` / `this folder` / `this-folder`, case-insensitive):
   - Discover git repo roots under the current working directory, up to 2 child levels deep:
     `find . -maxdepth 3 -type d -name .git -not -path '*/node_modules/*' -not -path '*/.build/*' -not -path '*/vendor/*'`
     Each match's parent dir is a repo root. Include the cwd itself if `./.git` exists.
   - For each repo root, resolve `<owner>/<repo>` from the GitHub remote — NEVER the folder name (global rule 51):
     `git -C <root> remote get-url origin`, parse `owner/repo` out of the URL (handle both `git@github.com:owner/repo.git` and `https://github.com/owner/repo(.git)?` forms).
     Skip roots with no `origin` or a non-GitHub remote — log them as skipped.
   - De-duplicate the `<owner>/<repo>` list.
   - Query open `@me` PRs scoped to those repos in a single call:
     `gh search prs --author=@me --state=open --repo <owner1>/<repo1> --repo <owner2>/<repo2> ... --json number,title,repository,isDraft,url,headRefName,baseRefName`
   - If zero repos resolved, report `"No git repos found within 2 levels of $(pwd)"` and stop. If repos resolved but zero matching PRs, report it and stop.

   c. **Explicit PR refs** (any other `$ARGUMENTS` — treat as whitespace-separated tokens):
   - For each token, normalize to a full PR URL:
     - Full URL → use as-is.
     - `<owner>/<repo>#<n>` → expand to `https://github.com/<owner>/<repo>/pull/<n>`.
     - `#<n>` or bare digits → require cwd to be a git repo; resolve `<owner>/<repo>` from `git remote get-url origin` (global rule 51), then expand. If cwd is not a git repo, error out naming the unresolvable token and ask the user to use a fully-qualified ref.
     - Anything else (not a URL, shorthand, `#<n>`, or digits) → error out, name the bad token, do NOT silently skip.
   - For each resolved URL, fetch metadata to match the search-result shape used downstream:
     `gh pr view <url> --json number,title,headRefName,baseRefName,isDraft,url,repository`.
   - De-duplicate by URL.

2. **Announce:** Tell the user which scope mode was resolved (`all @me PRs`, `pwd scan of <N> repos`, or `explicit list of <N> PRs`), how many PRs were resolved, and list them (repo, PR number, title).

3. **For each PR, delegate to `/sy-babysit-pr <PR-URL>`.** That command owns the full per-PR behavior:
   - step 0: early-exit if already green + approved (skipped PRs cost nothing),
   - step 1: merge base + resolve conflicts (always sync first),
   - step 2: address comments from human (non-bot) users,
   - step 3: address ONLY trivial / minor bot comments (typos, one-line nits — never redesign),
   - step 4: add / update tests to cover gaps from steps 2 and 3,
   - step 5: pull current CI state and pre-emptively fix any visible failures (lint, type, test, etc.),
   - step 6: run local tests / format / type checks / build (language-agnostic), fix before pushing,
   - step 7: monitor CI every 60s, fix any failing check (any language), loop back to step 0 on failure.
     Do NOT duplicate any of that logic here — if the per-PR flow needs to change, edit `/sy-babysit-pr`.

4. **Periodic status snapshot:** At the end of every 60-second polling cycle (across all PRs), run `/sy-list-prs` to render the current readiness table. This is the single source of truth for status output — do not hand-roll a separate table. Between snapshots, keep log lines terse (one line per action).

5. Repeat — delegate, wait 60s, render `/sy-list-prs` — until all PRs are green + approved or the remaining issues require human intervention (flaky infra, missing secrets, approval-gated checks). Report those clearly.

6. **Final report:** one last `/sy-list-prs` render plus a short summary of which PRs were skipped (already green), which were processed, and which need human attention.

## Rules

- This command is a dispatcher. The per-PR loop lives in `/sy-babysit-pr` — do not re-implement it here.
- Poll `/sy-list-prs` every 60s; do not spam `gh` calls.
- **First token of `$ARGUMENTS` decides the mode — no mixing.** PWD-keyword + explicit refs in the same call is an error; pick one. PWD mode always re-filters to `@me` authored PRs (consistent with the empty-args default); explicit-list mode does not filter by author (you asked for those specific PRs).
- **Always resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name** (global rule 51). Applies to PWD scan and to bare-`#<n>` ref expansion.
