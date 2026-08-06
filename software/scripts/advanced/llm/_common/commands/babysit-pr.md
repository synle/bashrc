[Sy] Sync a pull request branch with its base (main/master), address review comments, run local checks, fix failing builds, and wait until CI passes. All git work runs in a **dedicated worktree** (never your primary checkout), and the full loop runs **at least 3 passes, 30 minutes apart**. A prose-only PR (docs / comments / whitespace) gets automerge enabled on the first pass; anything with an executable line does not.

Argument: $ARGUMENTS (optional — a PR URL or PR number. If empty, use the current branch's PR.)

## Steps

1. **Determine which PR to babysit:**
   - If `$ARGUMENTS` is provided (a PR URL like `https://github.com/org/repo/pull/123` or a PR number), use that.
   - If `$ARGUMENTS` is empty, detect from the current working directory:
     - `git remote get-url origin` to determine the repo.
     - `git branch --show-current` to get the current branch.
     - `gh pr view --json number,title,url,headRefName,baseRefName` to find the PR for the current branch.
     - If no PR exists for the current branch, tell the user and stop.

2. **Announce:** Tell the user which repo and PR you are babysitting (repo name, PR number, title, URL).

2a. **Prose-only automerge gate — first pass only, before the CI check.** A docs / comment PR should not wait on a human to click merge, so babysit flips `--auto` on itself the moment it picks one up. It runs here, ahead of Step 3, because enabling automerge is safe while CI is still running — `--auto` is a queued instruction, not a merge.

    Fetch: `gh pr view <number> --repo <owner/repo> --json state,isDraft,title,author,autoMergeRequest`.

    - **Skip the gate entirely** (report why once, never re-check) when any of: `state != "OPEN"`; `isDraft` is true; the title contains `WIP` or `DO NOT MERGE` (case-insensitive); `author.login` is not you (`gh api user --jq .login`); or `autoMergeRequest != null` (already enabled — someone else's call, leave it alone).
    - **Classify the diff** — `gh pr diff <number> --repo <owner/repo>`, and read every changed line, not just the file list. **Prose-only** means every `+`/`-` line is a line in a docs file (`*.md`, `*.mdx`, `*.rst`, `*.txt`, `docs/**`, `README*`, `CHANGELOG*`, `LICENSE*`), a comment line in a source file, a docstring / JSDoc block, or pure whitespace (see the Automerge is opt-in rule). A single executable line — code, config, schema, lockfile, CI workflow, test — disqualifies the whole PR, however small. A file-name check alone is not enough in either direction: a `.md` file can hold an executed snippet the repo tests, and a `.py` file can hold a comment-only fix.
    - **Prose-only → enable it:** `gh pr merge <number> --squash --auto`, then report `"Prose-only diff (<n> files, docs/comments only) — automerge enabled; CI and any required approval still gate the merge."` Then continue the normal loop at Step 3 — babysit still syncs, still fixes CI, still handles comments; automerge only removes the final click.
    - **Not prose-only → leave it off,** report `"Diff touches <what> — automerge stays off until you say otherwise."`, and do not reconsider on later passes. Automerge is opt-in everywhere except prose-only.
    - **If `gh` rejects `--auto`** (repo has auto-merge disabled, squash not an allowed method, branch protection missing a required check), report the exact error once and carry on with the loop. Never fall back to a bare `gh pr merge` without `--auto` — that would merge on the spot — and never retry on later passes.
    - **Revoke it if the PR stops being prose-only.** Babysit pushes its own commits (Steps 5–10), and a CI fix or a new test turns a docs PR into a code PR. On every later pass, if automerge is on **because this gate enabled it** and the diff now contains an executable line, run `gh pr merge <number> --disable-auto`, report `"PR is no longer prose-only (<what changed>) — automerge disabled; merge is yours again."`, and treat it as opt-in from then on. Never revoke automerge the user or `/sy-create-pr` enabled — only what this gate turned on.

3. **Skip if CI is currently running.** Before any other check, fetch state:
`gh pr view <number> --repo <owner/repo> --json statusCheckRollup`

- If **any check is in progress / pending / queued** (statuses like `IN_PROGRESS`, `PENDING`, `QUEUED`, `WAITING`, or `statusCheckRollup` entries with `status` !== `COMPLETED`): report "PR build is currently running — skipping this pass" and **end the pass**. Do not run any other checks, do not merge, do not address comments, do not push. Take no action, then fall through to the **Step 12 loop gate** (sleep 30 min, re-enter at Step 3) instead of exiting babysit.
- Only proceed past this step when CI is idle (every check has `status: COMPLETED` or there are no checks).

4. **Early-exit check.** Fetch state:
   `gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable,state,autoMergeRequest,baseRefName,headRefName`
   - If `state == "MERGED"`: PR already landed — report the merge SHA, then **invoke `/sy-release <owner/repo>` (auto-release after PR merge; skill no-ops on repos without a release workflow)**. Stop babysit entirely — merged is the one terminal state that skips the remaining Step 12 passes.
   - **Merge-conflict override — check `mergeable` BEFORE either early-exit branch below.** A PR with conflicts against its base branch is NEVER "done", even when CI is green and reviewers have approved.
     - If `mergeable == "CONFLICTING"` (or any non-`MERGEABLE`, non-`UNKNOWN` value indicating a base-branch conflict): report `"PR is green + approved BUT conflicts with <baseRefName> — falling through to Step 5 to resolve"` and continue to **Step 5**. Step 5 will perform the actual merge + conflict resolution; the rest of the loop (tests, local checks, CI monitor) handles the rebuild.
     - If `mergeable == "UNKNOWN"`: GitHub is still computing mergeability. Wait 5s and re-fetch — **cap at 6 retries (~30s total)**. If still `UNKNOWN` after the cap, treat as `CONFLICTING` and fall through to **Step 5** (the merge attempt will surface the real state). Never treat `UNKNOWN` as `MERGEABLE`.
   - If **all CI checks are passing** AND `reviewDecision` is `APPROVED` AND `mergeable == "MERGEABLE"`:
     - **Do NOT enable automerge here.** The one place babysit may flip `--auto` is the Step 2a prose-only gate; by this point that decision is already made, and a green non-prose PR is the user's merge to click.
     - If `autoMergeRequest` is `null`: report `"PR is green + approved — ready for you to merge with 'gh pr merge <number> --squash' (or enable automerge if appropriate)"` and **end the pass** (skip Steps 5–11). Fall through to the **Step 12 loop gate** — a later pass catches review comments or CI reruns that land after this moment.
     - If `autoMergeRequest` is NOT `null` (Step 2a's prose-only gate, or the user earlier via UI or `/sy-create-pr` Step 10): the merge will land on its own. Poll `gh pr view --json state,mergeable` every 30s until `state == "MERGED"`, then invoke `/sy-release` (auto-release after PR merge) and stop. If `mergeable` flips to `CONFLICTING` mid-wait (base advanced), break out and fall through to **Step 5**.

5. **Merge base into the PR branch, resolve conflicts, and push** (NEVER rebase, must not rewrite history). **All git work for THIS PR happens inside a dedicated worktree (or a scoped clone)** so the user's primary checkout and current branch are never disturbed.
   **⚠️ MERGE ONLY — NEVER REBASE.** This step uses `git merge`, not `git pull --rebase`, `git rebase`, or `--squash`. Rebasing rewrites pushed history and forces `--force-with-lease` on next push. Always merge.
   a. **Resolve an isolated worktree for this PR — ALWAYS a worktree, NEVER the user's primary checkout** (see Never do PR-branch work in the primary checkout). Resolve the PR head branch first: `BR="$(gh pr view <number> --repo <owner/repo> --json headRefName --jq .headRefName)"`.
   - **Canonical worktree path — one rigid location, no variants** (see One rigid worktree path):
     `WT="$HOME/.worktrees/<owner>/<repo>/pr-<number>"; mkdir -p "$(dirname "$WT")"`
     Same path for every command that touches this PR, so `/sy-review-pr` and `/sy-sync-pr-branch` reuse this worktree instead of forking their own. Never a sibling of the repo, never `mktemp -d`.
   - **Clear stale bookkeeping first: `git worktree prune`.** A run killed after its folder was deleted (or a cleanup `rm -rf`) leaves an orphan admin record, and every later `git worktree add` then fails with `"<path>" is already registered`. Prune only drops records whose folder is gone — it never touches a live worktree.
   - **If cwd is the target repo** (`git remote get-url origin` resolves to `<owner/repo>` — see Repo Identification), pick the first case that applies:
     1. **Reuse a matching linked worktree.** `git worktree list --porcelain` — if a _linked_ worktree (any entry after the first; the first entry is the main checkout) already has `branch refs/heads/$BR`, that's the workspace: `WT=<that path>; cd "$WT"; git fetch origin`. This is normally `$HOME/.worktrees/<owner>/<repo>/pr-<number>` from an earlier run — but honor whatever path it reports. If that path is NOT the canonical one, it's the user's own worktree: **never remove it on exit**.
     2. **The branch is checked out in the MAIN worktree.** Do NOT work there — that is exactly the interference this rule exists to prevent, and git refuses a second checkout of the same branch anyway. Create a detached worktree at the canonical path: `git fetch origin "$BR"; git worktree add --detach "$WT" "origin/$BR"`. Work detached and push with `git push origin HEAD:"$BR"` (Step 5i) — never `git push` bare from a detached HEAD.
     3. **No worktree on the branch.** `git fetch origin "$BR"`, then create one at the canonical path — but **never `-B` onto a local branch that has unpushed commits.** `-B` hard-resets the branch to the start point, so it silently destroys work a previous interrupted run already committed but never pushed. Check first — `git rev-list --count "origin/$BR..$BR" 2>/dev/null` (a missing local branch errors, treat as `0`):
        - Count is `0` or the local branch does not exist → `git worktree add "$WT" -B "$BR" "origin/$BR"`. Nothing local-only to lose.
        - Count is non-zero → `git worktree add "$WT" "$BR"` — check the branch out **as-is, no reset** — then reconcile forward with `git merge "origin/$BR" --no-edit`. Those commits are recovered work; Step 5i pushes them.
   - **If cwd is NOT the target repo** (typical when babysit was invoked with an explicit PR URL from elsewhere): clone into the **same canonical path** — `gh repo clone <owner/repo> "$WT"; cd "$WT"; gh pr checkout <number> --repo <owner/repo>`. Do not invent a temp dir.
   - If `$WT` already exists from a previous run, reuse it (`cd "$WT"; git fetch origin`).
   - **⚠️ Recover interrupted work BEFORE the clean guard — assume a previous pass was killed mid-flight.** This command sleeps 30 minutes between passes and polls CI for 15, so being terminated mid-run (Ctrl-C, session timeout, reboot, OOM, a fan-out job cancelled) is normal, not exceptional. A reused worktree is _expected_ to hold unfinished work of ours, and a deleted worktree is expected to have left commits on the local branch. In `$WT`, check all four in order and resolve each **before** merging:
     1. **In-progress git operation.** Read `git status`, or look in `$(git rev-parse --git-dir)` for `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `rebase-merge/`, `rebase-apply/`. A left-over `MERGE_HEAD` means the last run died mid-conflict-resolution: finish the resolution per Step 5e and `git commit --no-edit`. Do not `git merge --abort` a resolution that is already complete, and do not start a new merge on top (git refuses anyway). A left-over `rebase-*` is not ours — this command never rebases — so `git rebase --abort` and say so in the report.
     2. **Uncommitted / staged changes** (`git status --porcelain`). At the **canonical** path these are ours from an interrupted pass: read the diff, then either commit it (message describes the actual hunks — see the commit-message rule) if it is complete, or finish the half-edit and commit. At a **non-canonical** path — case 1, the user's own worktree — they are the user's: **STOP and ask.** Never stash, `reset`, `checkout --`, or merge on top of either.
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
       c. Fetch the latest base: `git fetch origin <baseRefName>`.
       d. Merge (regular merge commit — do NOT use `--rebase` and do NOT use `--squash`):
       `git merge origin/<baseRefName> --no-edit`
       e. **If merge conflicts occur, resolve them — this is the primary goal of this step:**
   - Run `git status` to list conflicted files.
   - For each conflicted file: read both sides of the conflict markers (`<<<<<<<` / `=======` / `>>>>>>>`), understand what each side is doing, and produce a correct merged result. Remove all conflict markers.
   - Lockfiles / generated files (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `.build/` artifacts, etc.): regenerate them after accepting the base version (e.g. re-run `npm install`, `cargo build`, `make build`) rather than hand-editing.
   - Non-overlapping edits, obvious either/or choices: resolve directly.
   - Only stop and ask the user if the resolution requires judgment you don't have (conflicting semantics, diverging feature logic, unclear intent). Never force a resolution you are not confident in, but don't bail out on conflicts you CAN reason through.
   - After resolving every file: `git add <files>` and `git commit --no-edit`.
   - Verify the merge is complete: `git status` should show a clean working tree with no "unmerged paths".
     f. **Check migration head divergence** (if the project uses a migration tool). After syncing with base, the PR's migration DAG must have exactly one head that descends from the base branch's current head. Never push a branch that would create a second migration head on main/master. Detect a migration tool (first match wins; skip the whole sub-step if none found):
     - Alembic: `alembic.ini` or an `alembic/` / `migrations/versions/` dir.
     - Django: any `*/migrations/0*.py` and a `manage.py`.
     - Rails: `db/migrate/` + `db/schema.rb` (or `structure.sql`).
     - Knex: `migrations/` with `[0-9]*_*.{js,ts}` files or `knex/migrations/`.
     - golang-migrate / sql-migrate: `migrations/` with `[0-9]*_*.{up,down}.sql`.
     - Prisma: `prisma/migrations/`.
     - Flyway: `V*__*.sql` files or `*/flyway/`.
     - Liquibase: a changelog (`xml`/`yaml`/`json`/`sql`).
     - TypeORM: `*/migration/[0-9]*-*.{ts,js}`.
     - Generic SQL: any `migrations/` or `schema/` folder containing `.sql` files with timestamp/sequence-prefixed names.

     Check for head divergence using the tool's native command:
     - Alembic: `alembic heads` — must print exactly one head; `alembic history` stays linear.
     - Django: `python manage.py makemigrations --check --dry-run` — non-zero / "conflicting migrations" means diverged leaf nodes.
     - Rails: compare the PR's `db/schema.rb` version against base's — a lower or duplicate version after merge signals divergence.
     - Knex / golang-migrate / sql-migrate / Prisma / Flyway / Liquibase / TypeORM: two siblings sharing the same sequence number / parent under the migrations dir.
     - Generic SQL: two files with the same timestamp prefix or sequence number.

     If a single head / no divergence → done (log "single migration head, ok"). If diverged → **re-parent, don't merge-revision.** Prefer re-stamping the PR's new revision(s) onto the base branch's current head so history stays linear:
     - Alembic: set the PR revision's `down_revision` to base's current head (`alembic heads` on base), **not** `alembic merge` (which injects a merge revision and permanently forks/rejoins the DAG). Only fall back to `alembic merge` if re-parenting is genuinely unsafe (two independent schema changes that must both apply) — and flag it for the user.
     - Django: `makemigrations --merge` is acceptable (Django's merge migrations are the idiomatic fix), OR renumber the PR migration onto the latest base migration. Re-run `makemigrations --check` to confirm zero conflicts.
     - Rails: bump the PR migration's timestamp above base's latest and regenerate `schema.rb` (`rails db:migrate` against a fresh base-synced DB).
     - Knex / golang-migrate / sql-migrate / Prisma / Flyway / Liquibase / TypeORM: renumber the PR migration to sit strictly after base's highest version; regenerate any checksum/lock file.
     - Generic SQL: rename the PR migration file to sit after base's latest timestamp/sequence.

     Verify: re-run the head/divergence check — must now report a single head descending from base. Commit the re-parented migration. If re-parenting needs judgment you don't have (conflicting schema semantics, destructive ordering, ambiguous intent): stop and ask the user — same escape hatch as the text-conflict resolver in Step 5e. Never guess a migration re-order.

     **Cross-PR angle (waves):** When wave sync (Step 5h) merges a parent PR that also carries a migration, run the same head check after that merge too — the parent's migration must be an ancestor of the child's, single-head. If both the parent PR and this PR add sibling migrations, that's the review-time coordination case `/sy-review-pr` already warns about; surface it in the final report rather than silently re-parenting across PR boundaries.

     g. **Wave sync (if this PR is part of a stacked wave).** If `baseRefName` is a branch that has an open PR (check: `gh pr list --repo <owner/repo> --head <baseRefName> --state open --json number,headRefName,url`), sync from both the default branch AND the parent PR:
     - `git merge origin/<default> --no-edit` (merge main/master first).
     - Fetch the parent PR's branch and merge it: `git fetch origin <baseRefName>` then `git merge origin/<baseRefName> --no-edit`.
     - If conflicts occur during wave sync: resolve them the same way as Step 5e — read both sides, produce correct merged result, `git add`, `git commit --no-edit`.
     - Skip only if the branch is already up to date (`git merge` reports "Already up to date").
       h. **Run the Pre-push gate** (commit-author check + secret scan; see Rules section). Block on failure.
       i. Push the updated branch from the worktree: `git push` when the workspace is on the branch, or `git push origin HEAD:"$BR"` when it is detached (Step 5a case 2). Never force-push. If the push changed what the PR does, re-check the PR body against the new diff and update it — see the _PR body tracks the branch_ rule.
       j. Note: this creates a regular merge commit on the PR branch. The eventual PR-level merge into main must still be a **squash merge** per repo policy.

6. **Address reviewer comments from human (NON-BOT) users:**
   - Fetch review comments: `gh api repos/<owner>/<repo>/pulls/<number>/comments` and issue comments: `gh api repos/<owner>/<repo>/issues/<number>/comments`.
   - **Filter to humans first.** For each comment, check `user.type` (skip when `Bot`) and `user.login` — separate out anything matching known bot patterns (`*[bot]`, `coderabbitai*`, `copilot*`, `dependabot*`, `sonarcloud*`, `github-actions*`, `renovate*`, etc.) for Step 7. This step is humans only.
   - For every remaining (human) unresolved, substantive comment: read the referenced code, apply the fix (or reply explaining why not), and commit. **Capture the fix commit SHA immediately after the commit lands:** `SHA=$(git rev-parse --short HEAD)`.
   - Skip comments already marked resolved / outdated / on stale SHAs.
   - **After every applied fix: reply + resolve the thread.**
     - Reply with `Fixed — <one-line summary> (<sha>)` — include the short commit hash so the reviewer can trace the fix:
       - Review (line) comments: `gh api repos/<owner>/<repo>/pulls/<number>/comments/<comment-id>/replies -f body='Fixed — <summary> (<sha>)'`.
       - Issue (top-level) comments: `gh pr comment <number> --repo <owner/repo> --body 'Fixed — <summary> (<sha>)'`.
     - Resolve the review thread (GraphQL — review comments only; issue comments have no thread to resolve):
       `gh api graphql -F threadId='<thread-id>' -f query='mutation($threadId:ID!){ resolveReviewThread(input:{threadId:$threadId}){ thread{ id isResolved } } }'`. Get `<thread-id>` from `gh api graphql -F owner=<owner> -F repo=<repo> -F number=<number> -f query='query($owner:String!,$repo:String!,$number:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$number){ reviewThreads(first:100){ nodes{ id isResolved comments(first:1){ nodes{ databaseId } } } } } } }'` — match by `comments.nodes[0].databaseId == <comment-id>`.
     - If you're replying "explaining why not" instead of fixing: post the reply but DO NOT resolve the thread — leave it open so the reviewer can respond. **No SHA in the reply** since there is no fix commit.
   - **Run the Pre-push gate before any push at the end of this step** (Rules section).

7. **Address ONLY trivial / minor bot comments:**
   - From the bot-authored comments separated out in Step 6, address **only the small, low-risk ones**: typo fixes, obvious lint one-liners, missing semicolons / trailing commas, simple rename suggestions, doc/comment wording tweaks, dead-import removal, and similar one-line nits.
   - **Do NOT redesign or refactor based on bot suggestions.** Skip anything that asks for: architectural changes, API redesigns, new abstractions, broad renames, restructured control flow, added error handling beyond a one-liner, new tests, performance rewrites, or anything requiring judgment about intent.
   - When in doubt, skip. Bots over-suggest — their job is to flag, yours is to triage. Err on the side of leaving the bot comment unaddressed.
   - Commit any trivial fixes you apply.
   - **Same reply + resolve pattern as Step 6** for every trivial bot fix applied: `Fixed — <one-liner> (<sha>)` reply (include the short commit hash), then resolve the thread. Skipped bot comments — leave unaddressed (no reply, no resolve).
   - **Run the Pre-push gate before any push at the end of this step** (Rules section).

8. **Add / update tests to cover the changes from Steps 6 and 7:**
   - For every code change introduced while addressing human comments (Step 6) and trivial bot fixes (Step 7), check whether existing tests cover the new behavior. If not, **add a new test or extend an existing one**. This is language-agnostic — unit tests, integration tests, snapshot tests, table-driven tests, doctests, whatever the repo uses.
   - Look for gaps: new branches / conditions, new error paths, renamed / relocated APIs, edge cases the comment specifically called out, regression coverage for the bug a reviewer flagged.
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
   - If a coverage entrypoint is found, run it once. Most repos with a configured threshold (`vitest.config`, `.coveragerc`, `pyproject.toml`, `codecov.yml`, CI config) will fail the entrypoint on regression — surface the failure in the final report and fix before pushing.
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
  1.  **Repo-defined entrypoints first** — `make validate` / `make test` / `make lint` / `make check` (Makefile), `just test`, `pre-commit run --all-files`, scripts in `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`, or whatever `README` / `CLAUDE.md` / `CONTRIBUTING.md` says to run.
  2.  **Otherwise fall back to language-native tooling**, e.g.:
      - Node/TS: `npm test` (or `yarn`/`pnpm`), `npx tsc --noEmit`, `npx prettier --check .`, `npx eslint .`
      - Python: `pytest`, `ruff check .`, `ruff format --check .`, `mypy .`
      - Rust: `cargo test`, `cargo fmt --check`, `cargo clippy`
      - Go: `go test ./...`, `gofmt -l .`, `go vet ./...`
      - Shell: `shellcheck`, `shfmt -d`, `bash -n`
      - Config: `tsc --noEmit` for `tsconfig.json`, `yamllint`, `jsonlint`, `cargo check`, etc.
- If any fail, **fix them before pushing** — including lint/format violations, syntax errors, type errors, broken config (`tsconfig.json`, `pyproject.toml`, `Cargo.toml`, etc.), and unit/integration test failures. Re-run until green locally.
- **Run the Pre-push gate** (commit-author check + secret scan).
- Commit and push the fixes.

11. **Monitor CI and fix any failure (language-agnostic)** — poll every **15 minutes**, max **10 polls (~2.5 hours)**: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable`.
    - **Track two counters across the loop:**
      - **Global poll counter**, hard-capped at 10.
      - **Per-check fix-attempt counter** — `attempts[<check-name>]`, hard-capped at **2 fix attempts per individual check name**. Same check failing → same fix tried twice with no result usually means more pushes just churn CI. Stop trying that one.
    - On poll 11: STOP and post the **resumable escalation comment** (template below). Exit.
    - If all checks pass: go back to **Step 4 (early-exit)** to confirm green + approved.
    - If checks are still pending: keep polling (counts toward the 10-poll cap).
    - If any check is failing:
      a. Get failing run IDs from `statusCheckRollup`.
      b. Examine logs: `gh run view <run-id> --repo <owner/repo> --log-failed`.
      c. **Broken-main check (do this BEFORE diagnosing as a PR-side bug).** Check whether the same check is also failing on `origin/<default>`'s latest commit: `gh run list --repo <owner/repo> --branch <default> --limit 1 --json conclusion,name,headSha`. If the same check name has `conclusion == "failure"` on the latest default-branch commit, this is broken main — **STOP babysit**. Post the escalation comment (template below) with `Stop reason: broken-main`, tell the user, and exit. Do not retry-fix-retry against an unfixable base.
      d. **Per-check attempt cap.** If `attempts[<check-name>] >= 2`, do NOT try to fix this check again. Mark it `UNFIXABLE_AFTER_2_ATTEMPTS` in state and continue polling other checks. **If ALL currently failing checks are at the cap, STOP** and post the escalation comment with `Stop reason: all-checks-at-attempt-cap`.
      e. Otherwise diagnose the failure regardless of category — could be a test failure, a lint/format violation, a syntax error, a type error, a misconfigured `tsconfig.json` / `pyproject.toml` / `Cargo.toml` / similar, a missing dependency, or a build error in any language. Read the relevant code/config, fix it, and re-run the matching local check from Step 10 to confirm. **Run the Pre-push gate** (Rules section). Commit and push. Increment `attempts[<check-name>]`.
      f. **Go back to Step 3** — re-run the full loop: skip-if-running → early-exit → merge → human comments → bot trivia → tests → pre-emptive CI fix → local checks → CI monitor.

    **Escalation comment template (resumable state).** Post via `gh pr comment <number> --repo <owner/repo> --body '<rendered template>'`. Used on: poll-11 cap, all-failing-checks-at-attempt-cap, or broken-main detection.

    ```
    Babysit handing off — PR needs hands-on attention.

    Stop reason: <poll-cap | all-checks-at-attempt-cap | broken-main>
    Passes used: <N>/3 (30 min apart)
    Polls used: <N>/10
    Per-check fix attempts:
      - <check-name-1>: <attempts> (status: FAILING | UNFIXABLE_AFTER_2_ATTEMPTS | PENDING)
      - <check-name-2>: ...

    Last failing logs:
      - <check-name>: <gh run view URL>

    Commits pushed this session: <comma-separated short SHAs>
    Worktree: <path> (<reused | created-this-run>)
    Recovered from interrupted run: <none | what was recovered>
    Human comments addressed: <N> threads resolved
    Bot comments addressed: <N> trivial fixes applied
    Outstanding human comments: <N> (require judgment)

    To resume: re-invoke `/sy-babysit-pr <PR-URL>`. Counters reset on re-invocation; the prior state above shows what was already tried.
    ```

    Include enough state that a re-invocation OR a human picking up the PR can see exactly what was tried and where the loop gave up.

12. **Loop gate — run the FULL loop at least 3 times, 30 minutes apart.** One pass only ever sees the PR as it was at that instant; reviewers, bots, and CI post asynchronously. Three spaced passes let feedback land in batches instead of you churning on every incremental delta.
    - Track `loop_count` (starts at 1 on the first pass). When a pass finishes for ANY reason — green + approved, CI still running (Step 3 skip), nothing left to fix, comments all addressed — that ends the **pass**, not the babysit.
    - If `loop_count < 3`: report `"pass <N>/3 done — sleeping 30 minutes before pass <N+1>"`, **sleep 30 minutes**, then go back to **Step 3** and run the whole loop again (skip-if-running → early-exit → worktree + merge → comments → tests → CI). Reuse the same worktree from Step 5a — do not tear it down between passes.
    - After pass 3, if the PR is still not merged and nothing is actionable, stop and report. More passes are fine if the user asked for them; 3 is the floor, not the cap.
    - **Terminate early (skip the remaining passes) ONLY on:** `state == "MERGED"` (release already dispatched in Step 4), broken-main escalation, all-checks-at-attempt-cap escalation, poll-cap escalation, or a stop-and-ask where a conflict / migration / review comment needs human judgment. Everything else loops.
    - The 30-minute sleep is between passes and is independent of Step 11's 15-minute in-pass CI polling — they nest, they don't replace each other.

13. **Final report:** Summarize what happened — workspace setup (worktree path, whether it was reused or created, anything recovered from an interrupted prior run, cleanup status), the Step 2a automerge decision (`enabled — prose-only` / `left off — <what the diff touches>` / `skipped — <draft | WIP | not yours | already enabled>` / `revoked — no longer prose-only`), passes run (`<N>/3`), sync result, comments addressed (human + trivial bot), tests added / updated, coverage tooling detected (or `"no coverage tooling detected"`), pre-emptive CI fixes, local checks run, CI fixes applied, per-check fix-attempt counts, and merge outcome. **If the PR was merged, `/sy-release` was already invoked in Step 4** (auto-release after merge) — note the release run URL (or `"no release workflow — skipped"`).

## Rules

- **Step 3 (skip if CI is running) is the first check that may touch the PR's content — nothing before it pushes, comments, or merges.** The only thing ahead of it is the Step 2a automerge gate, which queues an instruction rather than acting (`--auto` waits for the same CI). Once past Step 3, if CI is in progress / pending / queued, take no action this pass: never merge, comment, or push while a build is still running. That ends the **pass**, not the babysit — fall through to the Step 12 loop gate, sleep 30 minutes, and re-enter at Step 3.
- The loop is: Step 2a prose-only automerge gate (first pass) → Step 3 skip-if-running → Step 4 early-exit (or, when automerge is already on, wait-for-merge) → Step 5 worktree setup + merge base + migration-head check + push → wave sync (if stacked) → Step 6 human comments → Step 7 trivial bot comments → Step 8 add/update tests + best-effort coverage check → Step 9 pre-emptive CI fix → Step 10 local checks → Step 11 CI monitor → (on failure) back to Step 3 → Step 12 loop gate (≥3 passes, 30 min apart). On `state == "MERGED"`: report the merge SHA, invoke `/sy-release` (auto-release after merge), and stop.
- **Minimum 3 full passes, 30 minutes apart (Step 12).** A single pass is never "done" unless the PR merged or babysit escalated. Sleep 30 minutes between passes so review comments, bot runs, and CI settle into batches instead of triggering a push per incremental change. In-pass CI polling (15 min, Step 11) nests inside a pass — it does not count as a pass.
- **ALWAYS work in a git worktree — never the user's primary checkout** (see Never do PR-branch work in the primary checkout). One rigid path, no variants: **`$HOME/.worktrees/<owner>/<repo>/pr-<number>`** (see One rigid worktree path). Step 5a resolution order: `git worktree prune` → reuse a linked worktree already on the PR branch → else create the canonical path on the branch → else (branch checked out in the main worktree) create it `--detach` at `origin/<branch>` and push with `git push origin HEAD:<branch>`. When cwd is not the target repo, `gh repo clone` into that same canonical path — never `mktemp -d`, never a sibling of the repo. Never `git checkout` / `git switch` / `gh pr checkout` in the user's main checkout. Clean up only what this run created (worktree → `git worktree remove`; clone → `rm -rf`); a reused worktree at a non-canonical path is the user's — leave it. The worktree persists across all 3+ passes.
- **Always assume the last run was interrupted; resume its work, never discard it (Step 5a).** Termination mid-run is the normal case here — the loop sleeps 30 minutes between passes and polls CI for 15. Before merging anything, recover from the reused worktree, in order: an in-progress merge (`MERGE_HEAD` → finish the resolution and `git commit --no-edit`), uncommitted / staged edits at the canonical path (finish + commit; at a **non-canonical** path they are the user's — stop and ask), untracked files, and unpushed local commits (`origin/<branch>..HEAD` → push through the Step 5i pre-push gate). Two things make discarded work possible and both are banned: `git worktree add -B` onto a local branch holding unpushed commits (it hard-resets), and `stash` / `reset` / `checkout --` to "clean up" a dirty worktree. `git worktree prune` before creating is required — a deleted folder leaves an orphan record that makes every later `git worktree add` fail.
- **⚠️ NEVER REBASE.** Always use `git merge` to sync branches. Never use `git pull --rebase`, `git rebase`, `gh pr update-branch --rebase`, or interactive rebase on a PR branch. Rebasing rewrites pushed history and forces `--force-with-lease` on next push. Always merge.
- **Pre-push gate runs before every `git push` in this command — no exceptions.** Two checks, both blocking:
  1. **Commit-author identity check.** Compare each pending commit's `author.email` and `author.name` to local config (`.gitconfig`): `git log @{u}..HEAD --format='%H %ae %an'` vs `git config --get user.email` / `user.name`. On mismatch, flag the SHA(s) + identities side-by-side and ask the user whether to proceed with the existing author. **Default = "no"** → run `git commit --amend --reset-author --no-edit` (single commit) or `git rebase <base> --exec 'git commit --amend --reset-author --no-edit'` (multiple). **Preserve `Co-Authored-By:` trailers** — `--reset-author` only touches the author field; trailers in the message body survive. Only push without `--reset-author` on explicit user "yes".
  2. **Secret scan.** Scan all unpushed changes — `git log @{u}..HEAD -p` plus `git diff --cached` (if anything staged). Check for:
     - **Filename allowlist** — flag staged paths matching: `.env*` (except `.example` / `.sample` / `.template`), `**/credential*`, `**/secret*`, `**/*.pem`, `**/*.key` (except `.pub.key`), `**/*.p12` / `.pfx` / `.keystore`, ssh keys (`id_rsa*` / `id_ed25519*` / `id_ecdsa*` / `id_dsa*`), `*.kdbx`, `service-account*.json`, `gha-creds-*.json`, `.npmrc` / `.pypirc` / `.netrc` with auth lines, `.aws/credentials`, `.kube/config`, `.docker/config.json`, `terraform.tfstate*`.
     - **Content patterns** — AWS (`AKIA|ASIA[0-9A-Z]{16}`, `aws_secret_access_key\s*=`), GitHub (`gh[pous]_[A-Za-z0-9]{36,}`, `github_pat_`), Anthropic/OpenAI (`sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}`), Slack (`xox[abprs]-`), Google (`AIza[0-9A-Za-z_-]{35}`), private keys (`-----BEGIN .* PRIVATE KEY-----`), JWTs (`eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`), assignments `(password|api[_-]?key|token|secret)\s*=\s*["'][^"']{6,}` — skip placeholders (`<...>` / `xxx` / `***` / `example`).
     - On hit: redact the value (e.g. `AKIA****REDACTED****`), show path + line + matched pattern, ask the user. **Default = "no"** → STOP, do not push, tell the user to remove the commit (`git reset HEAD~N` or rebase) and re-stage clean. Proceed only on explicit "yes" + user confirms false positive.
- Never skip local checks before pushing — it wastes CI cycles.
- **Bot comments: only trivial / minor fixes** (typos, single-line lint nits, doc wording). Never let a bot drive a refactor or redesign — skip anything non-trivial.
- **Every behavior-changing fix from Step 6 or 7 needs test coverage in Step 8.** Doc/typo/format-only changes are exempt. Coverage verification at the end of Step 8 is best-effort and language-agnostic — skip silently if no entrypoint is detected; do NOT block.
- Fix CI failures of every kind (tests, lint, type-check, build, config) regardless of language — do not assume JS/Node.
- **Broken-main detection runs before every fix attempt.** If the same check is failing on `origin/<default>`'s latest commit, the PR can't go green until default is fixed — stop, post the escalation comment, flag the user.
- Poll CI every 15 minutes; do not spam `gh` calls. Each wake runs the full loop (comments + CI) in one pass. Hard cap at 10 polls (~2.5 hours) — escalate via the resumable escalation comment after that.
- **Per-check fix-attempt cap = 2.** A single CI check failing twice with no result usually means the fix path needs human judgment. Don't churn CI with a third attempt — mark it `UNFIXABLE_AFTER_2_ATTEMPTS` and surface in the escalation comment.
- **After every applied fix: reply `Fixed — <one-liner> (<short-sha>)` and resolve the thread** (mechanics in Step 6). Reply-without-fix → post reply, leave thread open, no SHA.
- **Release dispatch is automatic.** When babysit observes `state == "MERGED"` (Step 4 early-exit or wait-for-merge), invoke `/sy-release <owner/repo>` once before reporting done. `/sy-release` no-ops cleanly on repos without a release workflow.
- **Never enable automerge on babysit's own behalf — with one carve-out: a prose-only diff (Step 2a).** Docs files, comments, docstrings, whitespace and nothing else → babysit runs `gh pr merge <n> --squash --auto` on the first pass, before the CI check, and says so; CI and any required approval still gate the merge. Any executable line in the diff and automerge stays off until the user says otherwise. If babysit's own later commits make the PR non-prose-only, it runs `--disable-auto` and hands the merge back. Automerge the user or `/sy-create-pr` enabled is never touched — babysit observes it and waits (Step 4).
- **Migration head stays single — after syncing with default, the PR's migration DAG must have exactly one head that descends from default.** Re-parent (don't add a merge revision) to keep it linear; never create a second head on main/master. `/sy-review-pr` warns about cross-PR migration conflicts; `/sy-babysit-pr` fixes them (Step 5f).
