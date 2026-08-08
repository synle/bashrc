[Sy] **The one implementation of branch syncing.** Brings a branch up to date with everything it sits on — the default branch, plus every ancestor branch when the PR is stacked — merging, never rebasing. Runs standalone, and is also the sync step every other Sy command **delegates to** instead of hand-rolling its own `git merge origin/<base>`.

Argument: $ARGUMENTS — a target plus optional `key=value` options (see Invocation contract).

## When to use

- A PR is behind its base branch and CI requires "up to date with base" before merging.
- `gh pr merge` reports `MERGEABLE: BEHIND` and you don't want the full `/sy-babysit-pr` loop.
- A stacked PR needs its parent's (and grandparent's) latest commits, not just main's.
- **Any Sy command that needs a branch synced.** `/sy-babysit-pr` Step 5 calls this; `/sy-babysit-prs` gets it transitively. Do not re-implement the merge, the ancestor walk, or the conflict resolver anywhere else — call this and consume its result block.

For address-comments + drive-CI-green work, use `/sy-babysit-pr`. This command syncs and stops.

## Invocation contract

**Target** (first token, optional):

- A PR URL, PR number, or `<owner>/<repo>#<n>` → sync that PR's head branch.
- A bare branch name → sync that branch. Ancestors are still resolved (a branch can be based on an open PR's head even when it has no PR of its own); with no PR anywhere, the floor is the default branch.
- Empty → the current branch's PR, else the current branch.

**Options** (any order, `key=value`, all optional — defaults are what a human invoking this directly wants):

| Option                      | Default   | Meaning                                                                                                                                            |
| --------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace=<path>`          | _unset_   | Run in this already-resolved worktree. Skips workspace resolution **and cleanup** — the caller owns its lifecycle. Unset → resolve and own one here |
| `push=now\|defer`           | `now`     | `defer` leaves the merge commits local for the caller to push after its own work                                                                    |
| `server-side=auto\|never`   | `auto`    | `auto` may use `gh pr update-branch` on the fast path. Callers that need local commits pass `never`                                                 |
| `migrations=check\|skip`    | `check`   | Run the migration-head check after the chain merges                                                                                                |
| `on-conflict=resolve\|stop` | `resolve` | `stop` reports the conflicted files and exits without resolving                                                                                    |
| `report=prose\|structured`  | `prose`   | `structured` emits only the machine-readable result block (Step 8)                                                                                 |

**Delegated invocation** — how another command calls this, e.g. from `/sy-babysit-pr` Step 5:
`/sy-sync-pr-branch <PR-URL> workspace=$HOME/.worktrees/<owner>/<repo>/<repo>__pr-<number> server-side=never report=structured`

A delegated run never creates or removes a worktree, never touches the caller's cwd, and always ends by emitting the Step 8 result block.

## Steps

1. **Parse `$ARGUMENTS` into target + options.** Unknown `key=value` → error out naming the key; never silently ignore an option. Resolve `<owner>/<repo>` via `gh repo view --json nameWithOwner -q .nameWithOwner`, or `git remote get-url origin` — never from the folder name (see Repo Identification).

2. **Fetch state.** With a PR: `gh pr view <number> --repo <owner/repo> --json number,title,headRefName,baseRefName,isDraft,state,mergeable,mergeStateStatus,url`. Branch-only target: `git ls-remote --heads origin <branch>` must return a ref.
   - **Skip if `state == "MERGED"` or `state == "CLOSED"`** — nothing to sync. Emit the result block with `skipped: <state>`.
   - **Skip if `mergeStateStatus == "CLEAN"` or `HAS_HOOKS` AND the PR is not stacked** (Step 3 decides that) — already up to date.
   - **`isDraft == true`:** standalone → warn and proceed only on explicit yes. Delegated → proceed silently; the caller already decided.
   - `mergeable == "UNKNOWN"` → GitHub is still computing. Re-fetch every 5s, cap 6 retries, then treat as `CONFLICTING`. Never read `UNKNOWN` as `MERGEABLE`.

3. **Resolve the sync chain — floor + ancestors. This is the core of the command; every caller gets it for free.** Re-resolve on every invocation; bases move, parents push and merge, GitHub retargets children when a parent lands.
   - Resolve the default branch, never assume `main`:
     `DEF="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"`, falling back to `gh repo view --repo <owner/repo> --json defaultBranchRef -q .defaultBranchRef.name`.
   - Read the target's base fresh (`gh pr view ... --jq .baseRefName`; for a branch-only target, its upstream tracking branch, else `$DEF`). Never reuse a cached value from an earlier pass.
   - **Walk upward.** With `B` = that base: if `B == $DEF`, stop. Otherwise ask whether `B` is itself the head of an open PR — `gh pr list --repo <owner/repo> --head "$B" --state open --json number,url,title,headRefName,baseRefName`. A hit means **stacked**: record `B` as an ancestor, set `B` to that PR's `baseRefName`, keep walking. Stop on `B == $DEF`, a `B` with no open PR, a `B` already seen (cycle), or **10 hops** (hard cap). Report a cycle or a hop-cap hit; never loop forever.
   - Yields `ancestors[]` (immediate parent first, root-most last) and a **floor** — the branch the walk stopped on:
     - Stopped at `$DEF` → floor is `$DEF`. The normal case, stacked or not.
     - Stopped at a non-default branch with **no open PR** (a long-lived release / integration line, or a parent whose PR already merged) → **that branch is the floor and `$DEF` is NOT merged.** Merging main into a release-line PR imports commits that line never asked for.
     - The branch no longer exists on the remote (`git ls-remote --heads origin "$B"` prints nothing) → its PR landed and the branch was deleted; GitHub has retargeted the child. Re-read the base once and restart the walk. Flag `retargeted`.
   - **An ancestor whose PR was `CLOSED` without merging** → flag `orphaned-base`, report `"base <branch> belongs to PR <link>, closed without merging — retarget this PR"`, skip it as a merge source, continue with the rest of the chain. Never wedge on it.
   - **Merge order = floor first, then every ancestor from root-most down to the immediate parent.** The floor's commits arrive first, so each ancestor merge lands on a base that already has them — the conflict set stays small and is resolved once instead of once per level.

4. **Fast path — server-side update (skipped unless it applies).** Only when **all** hold: `server-side=auto`, the chain has no ancestors (floor is the only source), the floor is the PR's actual base, `push=now`, and `mergeable != "CONFLICTING"`. Then `gh pr update-branch <number> --repo <owner/repo>` (merge strategy; **never `--rebase`**) and jump to Step 8 with `method: server-side`.
   - **A stack always skips this.** `gh pr update-branch` merges only the immediate base, so on a stack it leaves the branch behind the default branch and behind every ancestor above the parent.
   - On failure or conflict, fall through to Step 5 — the local path resolves what the server refused.

5. **Workspace.** With `workspace=<path>`: `cd` there and use it as-is — do not create, reset, or clean it, and do not remove it on exit; the caller owns it (it has usually already run its own interrupted-run recovery).
   Without it, resolve the canonical worktree — **never the user's primary checkout** (see Never do PR-branch work in the primary checkout / One rigid worktree path):
   - `WT="$(git create-worktree <headRefName> <number>)"` — one command, no hand-rolled path and no hand-rolled `git worktree add`. It resolves `$HOME/.worktrees/<owner>/<repo>/<repo>__pr-<number>` (`<repo>__branch-<slug>` when there is no PR number to pass), prunes orphan records first so `already registered` cannot bite, reuses a linked worktree already on `<headRefName>`, and never returns the primary checkout.
   - Read the case it reports on stderr and pay what it owes: `keeping <n> unpushed local commit(s)` means it checked the branch out **as-is, no reset** (it uses `-B` only when `origin/<headRefName>..<headRefName>` is empty or the local branch is missing, since `-B` hard-resets and would destroy an interrupted run's work) — reconcile via `git merge origin/<headRefName> --no-edit`; `DETACHED` means the branch is checked out in the MAIN worktree, so push with `git push origin HEAD:<headRefName>` later. When cwd is not the target repo there is no `origin` to read, so spell the leaf out once — `gh repo clone <owner/repo> "$HOME/.worktrees/<owner>/<repo>/<repo>__pr-<number>"` and `gh pr checkout <number>` there.
   - **Resume, never discard, what a prior interrupted run left behind.** Finish an in-progress merge (`MERGE_HEAD` → resolve per Step 6, `git commit --no-edit`) before starting a new one; commit uncommitted work at the canonical path; carry unpushed local commits through the normal push. At a **non-canonical** path the dirt is the user's — stop and ask. Never `stash`, `reset`, or `checkout --` to force a clean tree.
   - The tree must be clean before the first merge. Clean up on exit **only what this run created** (`git worktree remove` / `rm -rf`); a reused or caller-supplied workspace stays.

6. **Merge the chain — one source at a time, in Step 3's order.** Regular merge commits: **never `--rebase`, never `--squash`, never an octopus `git merge A B C`** (a conflict there aborts everything and gives no per-source resolution point).
   - For each source: `git fetch origin "<source>"` then `git merge "origin/<source>" --no-edit`. Resolve conflicts **before** starting the next source.
   - `Already up to date` on the upper entries is normal — the immediate parent usually already carries its ancestors' commits. Log it and continue; never skip a source because you expect it to be empty.
   - **Merges flow downhill only.** Ancestor → this branch, never the reverse. Never merge this branch into its parent, never push an ancestor branch, never `gh pr merge` an ancestor to unblock this one, never edit an ancestor's migration — those branches belong to other PRs, often other running jobs.
   - **Conflict resolution** (skip and report when `on-conflict=stop`):
     - `git status` lists the conflicted files. For each, read both sides of the `<<<<<<<` / `=======` / `>>>>>>>` markers, understand what each side is doing, produce a correct merged result, remove every marker.
     - Lockfiles / generated files / snapshots (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `.build/` artifacts, `__snapshots__/`, approval-test output): accept the incoming version and **regenerate** (`npm install`, `cargo build`, `make build`, the runner's snapshot-update flag) rather than hand-editing. A hand-merged lockfile is valid to git and wrong to the tool.
     - Append-only files (barrels, registries, config lists, enum blocks) where both sides added a different entry at the same spot: **keep both**, in the order they appear, unless the file is explicitly sorted — then re-sort the merged result. This is the most common conflict class and it almost never needs judgment.
     - Test files where both sides added different tests: **keep both**. Two new `it` / `test` blocks are additive by nature; only a genuine redefinition of the same test name needs a decision.
     - Non-overlapping edits and obvious either/or choices: resolve directly.
     - Stop and ask **only** when the resolution needs judgment you don't have (conflicting semantics, diverging feature logic, unclear intent). Never force a resolution you aren't confident in; don't bail on conflicts you can reason through.
     - Then `git add <files>` and `git commit --no-edit`. `git status` must end with a clean tree and no unmerged paths.
   - After the last source the tree is clean and HEAD is a merge commit (or unchanged, when every source was already up to date).

7. **Migration head check** (`migrations=check`, and only if the repo uses a migration tool — skip silently otherwise). Run **once after the whole chain**, not per source. After syncing, the migration DAG must have exactly one head descending from the floor branch's head; never push a branch that would create a second head on the default branch.
   - Detect the tool (first match wins): Alembic (`alembic.ini`, `alembic/`, `migrations/versions/`), Django (`*/migrations/0*.py` + `manage.py`), Rails (`db/migrate/` + `db/schema.rb` / `structure.sql`), Knex (`migrations/[0-9]*_*.{js,ts}`), golang-migrate / sql-migrate (`migrations/[0-9]*_*.{up,down}.sql`), Prisma (`prisma/migrations/`), Flyway (`V*__*.sql`), Liquibase (a changelog), TypeORM (`*/migration/[0-9]*-*.{ts,js}`), generic SQL (timestamp/sequence-prefixed `.sql` under `migrations/` or `schema/`).
   - Check with the tool's native command: `alembic heads` prints exactly one; `python manage.py makemigrations --check --dry-run` is clean; Rails' `schema.rb` version is not lower or duplicated after the merge; for the rest, no two siblings share a sequence number / parent.
   - Diverged → **re-parent, don't merge-revision.** Re-stamp this branch's new revision(s) onto the floor's current head: Alembic → set `down_revision` to the floor's head, **not** `alembic merge` (that injects a merge revision and permanently forks the DAG; fall back to it only when re-parenting is genuinely unsafe, and flag it). Django → `makemigrations --merge` is idiomatic, or renumber onto the latest base migration, then re-run `--check`. Rails → bump the timestamp above base's latest and regenerate `schema.rb`. Knex / golang-migrate / sql-migrate / Prisma / Flyway / Liquibase / TypeORM / generic SQL → renumber strictly after base's highest version and regenerate any checksum/lock file.
   - **Never re-parent or edit a migration that belongs to an ancestor PR** (Step 6, downhill only). An ancestor and this branch adding sibling migrations is the cross-PR case `/sy-review-pr` flags — re-parent **this** branch's migration onto the ancestor's and say so in the report.
   - Re-verify (single head descending from the floor), commit the re-parented migration. Needs judgment you don't have → stop and ask, same escape hatch as the conflict resolver.

8. **Pre-push gate, push, and report.**
   - **Pre-push gate — blocking, no exceptions** (see the Pre-push gate rule): commit-author identity check on every pending commit (`git log @{u}..HEAD --format='%H %ae %an'` vs `git config --get user.email` / `user.name`; on mismatch ask, default "no" → `git commit --amend --reset-author --no-edit`, preserving `Co-Authored-By:` trailers) plus a secret scan of `git log @{u}..HEAD -p`.
   - `push=now` → `git push`, or `git push origin HEAD:<headRefName>` from a detached workspace. **Never force-push.** `push=defer` → stop here and report the unpushed SHAs; the caller pushes.
   - **Emit the result block** — always, in both report modes. `report=prose` adds a human summary around it (PR link, fresh `mergeStateStatus`, and the re-triggered CI run from `gh run list --branch <headRefName> --limit 1`); `report=structured` emits the block alone:

     ```
     sync-result:
       target:    <PR url | branch>
       method:    server-side | local-merge | skipped
       workspace: <path> (caller-provided | created | reused | none)
       stack:     not-stacked | <n> deep: <this> ← <parent link> ← <floor>
       floor:     <branch> (default-branch | release-line)
       sources:
         - <branch>: merged <n> commits | already up to date | conflicts resolved (<n> files) | skipped (<why>)
       migrations: single-head | re-parented <what> | none-detected | needs-human
       pushed:    <sha> | deferred (<n> local commits) | nothing-to-push
       flags:     retargeted | orphaned-base <link> | cycle | hop-cap | stopped-for-human <why>
     ```

   - A caller **must** read `flags` and `migrations`: `stopped-for-human` and `needs-human` mean the sync did not finish — do not continue as if the branch were synced.

## Rules

- **This is the only place branch syncing is implemented.** Any Sy command needing a branch up to date calls `/sy-sync-pr-branch` and consumes its result block — never its own `git merge origin/<base>`, ancestor walk, or conflict resolver. Two implementations of the same merge always diverge; that is exactly the drift that let stacked PRs sync against main only.
- **Merge, never rebase.** `git pull --rebase`, `git rebase`, `gh pr update-branch --rebase`, and interactive rebase on a PR branch are all forbidden — rebasing rewrites pushed history and forces `--force-with-lease` on the next push.
- **A stacked branch syncs from its whole ancestor chain, floor first, immediate parent last (Steps 3 / 6).** Merging only the default branch leaves a child missing everything its parent pushed; merging only the parent leaves the stack behind the default branch. Re-resolve the chain on every invocation. Depth cap 10 hops; a repeat is a cycle and stops the walk.
- **The floor is whatever the walk stops on — not always the default branch.** A long-lived non-default line (release / integration branch) with no open PR is itself the floor, and the default branch is **not** merged into it. A deleted base means the parent landed and GitHub retargeted; a parent PR closed without merging is an orphaned base — flag it, skip it as a source, keep going.
- **Merges flow downhill only.** Never push an ancestor branch, never merge a branch into its parent, never merge or retarget an ancestor's PR to unblock a child, never edit an ancestor's migration. Cross-stack ordering is the caller's ≥3-pass loop, not a wait — never block on, message, or poll a sibling job.
- **Never touch comment threads, CI, or the merge button.** This command syncs and exits, whatever CI says. Addressing comments and driving CI green is `/sy-babysit-pr`; landing the PR is the human's.
- **All work happens in a worktree at `$HOME/.worktrees/<owner>/<repo>/<repo>__pr-<number>`, created by `git create-worktree` — never the user's primary checkout** (see One rigid worktree path). A caller-supplied `workspace=` is used as-is and never cleaned up; only a workspace this run created is removed on exit.
- **Resume an interrupted run, never discard it (Step 5).** Finish a left-over merge, commit work found at the canonical path, carry unpushed commits through the gate. `git worktree add -B` onto a branch with unpushed commits and `stash` / `reset` / `checkout --` to force a clean tree are both banned — `git create-worktree` already makes the first one impossible.
- **Migration head stays single (Step 7)** — one head descending from the floor, re-parented rather than merge-revisioned, and never re-parenting an ancestor PR's migration.
- **One target per invocation.** For every open PR at once, use `/sy-babysit-prs`, which fans out one `/sy-babysit-pr` per PR and reaches this command through it.
- **Resolve `<owner>/<repo>` from the remote, never the folder name (see Repo Identification).**
