[Sy] Combine all unpushed commits on the current branch into a single commit with a fresh one-line-plus-description message. Local history only — never rewrites, force-pushes, or touches anything already on the remote.

## Scope

Squashes the run of commits that exist locally but are **not yet on the remote** into one clean commit, so a messy work-in-progress history (`wip`, `fix`, `typo`, `address review`) collapses into a single reviewable change before it is pushed. It rewrites **only unpushed history**, so there is nothing for anyone else to reconcile. It does NOT push, does NOT open a PR, and does NOT rebase onto or sync with the base branch — pushing and PR work stay explicit (`/sy-create-pr`, `git push`). For combining commits that are already pushed, this is the wrong tool: that is a shared-history rewrite and needs a human decision.

## Inputs

`$ARGUMENTS` is optional and free-form:

- **A quoted subject line** — used verbatim as the new commit's one-line subject; the body is still generated from the squashed commits and the diff.
- **`yes` / `-y` / `auto`** — skip the confirmation prompt in Step 5 (the user pre-approved). Anything else is treated as a subject.
- **Empty** — derive the whole message from the squashed commits + diff, and confirm before rewriting.

Single-repo, foreground, one shot — no background agent, no multi-pass loop.

## Steps

1. **Resolve the repo and branch.**
   - `git rev-parse --show-toplevel` → confirm we are in a git repo (stop with a clear message if not).
   - `git branch --show-current` → the branch. **If HEAD is detached** (empty output), stop and tell the user — there is no branch to rewrite safely.
   - Resolve `<owner>/<repo>` via `git remote get-url origin` for the report (never from the folder name — see Repo Identification).

2. **Determine the unpushed range `<base>..HEAD`.**
   - **Upstream set** — `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` succeeds → `BASE=@{upstream}`. This is the exact set of commits not yet pushed to the tracked remote branch, which is precisely what may be rewritten.
   - **No upstream** (branch never pushed) — resolve the default branch and use the divergence point:
     ```bash
     DEF=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
     DEF=${DEF:-$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)}
     BASE=$(git merge-base "origin/${DEF}" HEAD)
     ```
     Every commit in `${BASE}..HEAD` is branch-local work that has never been pushed.
   - Record the pre-squash tip for recovery: `PRE=$(git rev-parse HEAD)`.
   - List what will be combined: `git log --oneline "${BASE}..HEAD"`.

3. **Guard — stop and ask (or stop and report) rather than rewrite blindly.** Every one of these is a hard stop; do not proceed past a failing guard without the user's explicit go-ahead.
   - **Zero commits in range** → nothing to combine. Report `"No unpushed commits on <branch> — nothing to squash."` and stop.
   - **Exactly one commit in range** → already a single commit. Report it and stop (this command combines, it does not reword — use `git commit --amend` for that).
   - **Dirty working tree** (`git status --porcelain` non-empty) → there are uncommitted changes. **Stop and ask** whether to (a) commit them first, (b) stash them out of the way, or (c) abort. Never silently fold uncommitted work into the squash.
   - **Merge commit in range** (`git log --merges "${BASE}..HEAD"` non-empty) → the range contains a merge (e.g. a `git merge origin/<default>` sync). A soft-reset squash flattens that merge into one ordinary commit, losing the merge structure. **Stop and ask** — most of the time the right move is to leave it alone.
   - **Any range commit already on a remote** — belt-and-suspenders even with an upstream base: for the boundary commits run `git branch -r --contains <sha>`; if any remote branch contains a commit in the range, that commit is pushed. **Stop** — this command never rewrites pushed history.

4. **Compose the new commit message** (see the commit-message rule — read the diff, describe what actually changed).
   - Collect the squashed subjects/bodies: `git log --format='%s%n%b' "${BASE}..HEAD"`.
   - Read the net change: `git diff "${BASE}..HEAD"` (and `--stat` for the file overview).
   - Build the message in the standard shape: **one imperative one-line subject** (from `$ARGUMENTS` if the user supplied one, otherwise summarizing the net behavior change — never a bare file list or a reused branch name), a blank line, then a **description body** covering what changed and why. Bullet the notable pieces when several distinct things landed.
   - **Preserve `Co-Authored-By:` trailers** — gather them from every squashed commit, de-duplicate, and place them at the end of the body. Keep intentional LLM co-author trailers.
   - Write the finished message to a unique temporary file with the file-editing tool (never inline it on the command line — backticks/quotes/`$` must stay out of the shell).

5. **Confirm before rewriting** (skip only when `$ARGUMENTS` carried `yes`/`-y`/`auto`).
   - Show the user: the branch, the resolved `<base>`, the list of commits being combined (`git log --oneline "${BASE}..HEAD"`), and the proposed message.
   - Ask: **proceed / edit the message / cancel.** On "edit", take the corrections, rewrite the temp file, and ask again. On "cancel", change nothing and say so.

6. **Squash.**
   - `git reset --soft "${BASE}"` — moves HEAD to the base and leaves the entire net change **staged**; no file contents change, nothing is lost.
   - **Run the Commit-author identity check** (see Source Control & PRs) before committing — compare the pending author to local `.gitconfig`; the reset+commit uses the current identity, so this is where a wrong harness identity would sneak in.
   - `git commit -F <tmp-message-file>` — one commit carrying the whole range.
   - Delete the temporary message file whether the commit succeeded or failed.

7. **Verify and report.**
   - `git log --oneline "${BASE}..HEAD"` must now show **exactly one** commit; `git status` must be clean (same tree as before — a squash never changes file contents).
   - Report: the new commit SHA and subject, how many commits were combined, the base it was reset to, and the recovery hint — `"If this isn't what you wanted, restore the old history with: git reset --hard ${PRE}"`.
   - **Do not push.** State that the squash is local and the branch is ready to push when the user chooses to.

## Rules

- **Unpushed history only — never rewrite what is on the remote.** The base is `@{upstream}` when the branch tracks a remote, otherwise the merge-base with the default branch. If any commit in the range is already on a remote branch, stop. No force-push, no `--force-with-lease`, no interactive rebase — a soft reset plus one commit is the whole mechanism.
- **A soft reset never loses file content.** `git reset --soft <base>` keeps every change staged; the tree is byte-identical before and after. The only thing that changes is how many commits carry it. Always print the `git reset --hard <PRE>` recovery line so the pre-squash history is one command away.
- **Stop and ask, don't guess**, on: a dirty working tree, a merge commit in the range, a detached HEAD, fewer than two unpushed commits, or any range commit found on a remote. None of these are safe to power through.
- **Message shape matches every other commit here** — one-line imperative subject, blank line, description body explaining what and why (read the diff first, per the commit-message rule). Preserve and de-duplicate `Co-Authored-By:` trailers from the squashed commits. Write the message to a temp file and commit with `-F`; never pass it inline.
- **Confirm before rewriting** unless the user pre-approved with `yes` / `-y` / `auto`. Show the commits and the proposed message first.
- **Squash only — never push, never PR, never sync the branch.** Pushing, opening a PR, and merging the base branch in are separate, explicit actions (`git push`, `/sy-create-pr`, `/sy-sync-pr-branch`).
- **Always resolve `<owner>/<repo>` via `git remote get-url origin`, never from the folder name** (see Repo Identification).
