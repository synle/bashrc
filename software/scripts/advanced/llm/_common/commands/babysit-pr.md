[Sy] Sync a pull request branch with its base (main/master), address review comments, run local checks, fix failing builds, and wait until CI passes.

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

3. **Step 0 — Skip if CI is currently running.** Before any other check, fetch state:
   `gh pr view <number> --repo <owner/repo> --json statusCheckRollup`
   - If **any check is in progress / pending / queued** (statuses like `IN_PROGRESS`, `PENDING`, `QUEUED`, `WAITING`, or `statusCheckRollup` entries with `status` !== `COMPLETED`): report "PR build is currently running — skipping" and **stop**. Do not run any other checks, do not merge, do not address comments, do not push. Take no action.
   - Only proceed past this step when CI is idle (every check has `status: COMPLETED` or there are no checks).

4. **Step 1 — Early-exit check.** Fetch state:
   `gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable,state,autoMergeRequest,baseRefName,headRefName`
   - If `state == "MERGED"`: skip ahead to **Step 9 — Post-merge release trigger**. Nothing else to babysit.
   - **Merge-conflict override — check `mergeable` BEFORE either early-exit branch below.** A PR with conflicts against its base branch is NEVER "done", even when CI is green and reviewers have approved. Automerge will not land a conflicting PR either — it will sit forever.
     - If `mergeable == "CONFLICTING"` (or any non-`MERGEABLE`, non-`UNKNOWN` value indicating a base-branch conflict): **do NOT early-exit, do NOT just wait for automerge.** Report `"PR is green + approved BUT conflicts with <baseRefName> — falling through to Step 2 to resolve"` and continue to **Step 2**. Step 2 will perform the actual merge + conflict resolution; the rest of the loop (tests, local checks, CI monitor) handles the rebuild.
     - If `mergeable == "UNKNOWN"`: GitHub is still computing mergeability. Wait 5s and re-fetch. Only proceed past this check after it resolves to `MERGEABLE` or `CONFLICTING`. Never treat `UNKNOWN` as `MERGEABLE`.
   - If **all CI checks are passing** AND `reviewDecision` is `APPROVED` AND `mergeable == "MERGEABLE"` AND `autoMergeRequest` is `null` (no automerge enabled): report "PR is already green + approved — nothing to do" and **stop**. Skip all remaining steps.
   - If **all CI checks are passing** AND `reviewDecision` is `APPROVED` AND `mergeable == "MERGEABLE"` AND `autoMergeRequest` is NOT `null` (automerge enabled): keep polling `gh pr view --json state,mergeable` every 30s until `state == "MERGED"`, then jump to **Step 9 — Post-merge release trigger**. Do not stop at green+approved — automerge will land within seconds and the release trigger must fire. If `mergeable` flips to `CONFLICTING` mid-wait (the base branch advanced under us), break out of the poll loop and fall through to **Step 2** to resolve the new conflict.

5. **Step 2 — Merge base into the PR branch AND RESOLVE CONFLICTS** (NEVER rebase, must not rewrite history).
   **The whole point of this step is to surface and fix merge conflicts before CI does.** If `git merge` reports conflicts, you MUST resolve them — do not skip, do not abort, do not leave the branch in a conflicted state.
   a. Check out the PR branch: `gh pr checkout <number> --repo <owner/repo>`.
   b. Fetch and pull the latest base: `git fetch origin <baseRefName>`.
   c. Merge (regular merge commit — do NOT use `--rebase` and do NOT use `--squash`):
   `git merge origin/<baseRefName> --no-edit`
   d. **If merge conflicts occur, resolve them — this is the primary goal of step 1:**
   - Run `git status` to list conflicted files.
   - For each conflicted file: read both sides of the conflict markers (`<<<<<<<` / `=======` / `>>>>>>>`), understand what each side is doing, and produce a correct merged result. Remove all conflict markers.
   - Lockfiles / generated files (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `.build/` artifacts, etc.): regenerate them after accepting the base version (e.g. re-run `npm install`, `cargo build`, `make build`) rather than hand-editing.
   - Non-overlapping edits, obvious either/or choices: resolve directly.
   - Only stop and ask the user if the resolution requires judgment you don't have (conflicting semantics, diverging feature logic, unclear intent). Never force a resolution you are not confident in, but don't bail out on conflicts you CAN reason through.
   - After resolving every file: `git add <files>` and `git commit --no-edit`.
   - Verify the merge is complete: `git status` should show a clean working tree with no "unmerged paths".
     e. Push the updated branch: `git push`.
     f. Note: this creates a regular merge commit on the PR branch. The eventual PR-level merge into main must still be a **squash merge** per repo policy.

6. **Step 3 — Address reviewer comments from human (NON-BOT) users:**
   - Fetch review comments: `gh api repos/<owner>/<repo>/pulls/<number>/comments` and issue comments: `gh api repos/<owner>/<repo>/issues/<number>/comments`.
   - **Filter to humans first.** For each comment, check `user.type` (skip when `Bot`) and `user.login` — separate out anything matching known bot patterns (`*[bot]`, `coderabbitai*`, `copilot*`, `dependabot*`, `sonarcloud*`, `github-actions*`, `renovate*`, etc.) for step 4. This step is humans only.
   - For every remaining (human) unresolved, substantive comment: read the referenced code, apply the fix (or reply explaining why not), and commit.
   - Skip comments already marked resolved / outdated / on stale SHAs.
   - **After every applied fix: reply + resolve the thread.**
     - Reply with a short `Fixed — <one-line summary>` describing the fix:
       - Review (line) comments: `gh api repos/<owner>/<repo>/pulls/<number>/comments/<comment-id>/replies -f body='Fixed — <summary>'`.
       - Issue (top-level) comments: `gh pr comment <number> --repo <owner/repo> --body 'Fixed — <summary>'`.
     - Resolve the review thread (GraphQL — review comments only; issue comments have no thread to resolve):
       `gh api graphql -F threadId='<thread-id>' -f query='mutation($threadId:ID!){ resolveReviewThread(input:{threadId:$threadId}){ thread{ id isResolved } } }'`. Get `<thread-id>` from `gh api graphql -F owner=<owner> -F repo=<repo> -F number=<number> -f query='query($owner:String!,$repo:String!,$number:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$number){ reviewThreads(first:100){ nodes{ id isResolved comments(first:1){ nodes{ databaseId } } } } } } }'` — match by `comments.nodes[0].databaseId == <comment-id>`.
     - If you're replying "explaining why not" instead of fixing: post the reply but DO NOT resolve the thread — leave it open so the reviewer can respond.

7. **Step 4 — Address ONLY trivial / minor bot comments:**
   - From the bot-authored comments separated out in step 3, address **only the small, low-risk ones**: typo fixes, obvious lint one-liners, missing semicolons / trailing commas, simple rename suggestions, doc/comment wording tweaks, dead-import removal, and similar one-line nits.
   - **Do NOT redesign or refactor based on bot suggestions.** Skip anything that asks for: architectural changes, API redesigns, new abstractions, broad renames, restructured control flow, added error handling beyond a one-liner, new tests, performance rewrites, or anything requiring judgment about intent.
   - When in doubt, skip. Bots over-suggest — their job is to flag, yours is to triage. Err on the side of leaving the bot comment unaddressed.
   - Commit any trivial fixes you apply.
   - **Same reply + resolve pattern as step 3** for every trivial bot fix applied: `Fixed — <one-liner>` reply, then resolve the thread. Skipped bot comments — leave unaddressed (no reply, no resolve).

8. **Step 5 — Add / update tests to cover the changes from steps 3 and 4:**
   - For every code change introduced while addressing human comments (step 3) and trivial bot fixes (step 4), check whether existing tests cover the new behavior. If not, **add a new test or extend an existing one**. This is language-agnostic — unit tests, integration tests, snapshot tests, table-driven tests, doctests, whatever the repo uses.
   - Look for gaps: new branches / conditions, new error paths, renamed / relocated APIs, edge cases the comment specifically called out, regression coverage for the bug a reviewer flagged.
   - Place tests in the repo's existing test folder / file convention (e.g. `software/tests/`, `__tests__/`, `tests/`, `*_test.go`, `spec/`, etc.). Don't invent a new test framework — reuse what's already there.
   - If a comment was a pure doc / typo fix with no behavior change, skip — no test needed.
   - Skip if the change is genuinely untestable (e.g. CI YAML, formatting-only). Note it in the final report.
   - Commit the new/updated tests.

9. **Step 6 — Pull current CI state and pre-emptively fix any visible failures (language-agnostic):**
   - Before running local checks, fetch the latest CI status: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup`.
   - For any check already failing (lint, test, type-check, build, config validation, security scan, custom step — any language), pull the logs: `gh run view <run-id> --repo <owner/repo> --log-failed`.
   - Fix what you can locally: lint / format violations, syntax errors, type errors, broken config (`tsconfig.json`, `pyproject.toml`, `Cargo.toml`, `.golangci.yml`, etc.), simple test failures. Same generic posture as step 8 — diagnose by category, not by language.
   - If a failure is clearly infra / flaky / approval-gated (network timeout, missing secret, queued runner), note it for the final report and move on.
   - Commit any fixes here so they get re-validated by the local checks in the next step.

10. **Step 7 — Run local checks before pushing any new commit (language-agnostic):**

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
- Commit and push the fixes.

11. **Step 8 — Monitor CI and fix any failure (language-agnostic)** — poll every **15 minutes**, max **10 polls (~2.5 hours)**: `gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable`.
    - Track a poll counter. On poll 11: STOP. Post a summary comment on the PR (`gh pr comment`) listing what was tried (commits pushed, comments addressed, CI failures seen), tell the user the PR needs hands-on attention, and exit.
    - If all checks pass: go back to **step 1 (early-exit)** to confirm green + approved.
    - If checks are still pending: keep polling (counts toward the 10-poll cap).
    - If any check is failing (test job, lint job, type-check job, build job, security scan, custom CI step — anything):
      a. Get failing run IDs from `statusCheckRollup`.
      b. Examine logs: `gh run view <run-id> --repo <owner/repo> --log-failed`.
      c. **Broken-main check (do this BEFORE diagnosing as a PR-side bug).** Check whether the same check is also failing on `origin/<default>`'s latest commit: `gh run list --repo <owner/repo> --branch <default> --limit 1 --json conclusion,name,headSha`. If the same check name has `conclusion == "failure"` on the latest default-branch commit, this is broken main — **STOP babysit**. Post a comment on the PR (`gh pr comment`) saying `"Broken-main detected — <check-name> is failing on <default>@<sha>. PR can't go green until <default> is fixed."`, tell the user, and exit. Do not retry-fix-retry against an unfixable base.
      d. Diagnose the failure regardless of category — could be a test failure, a lint/format violation, a syntax error, a type error, a misconfigured `tsconfig.json` / `pyproject.toml` / `Cargo.toml` / similar, a missing dependency, or a build error in any language. Read the relevant code/config, fix it, and re-run the matching local check from step 7 to confirm.
      e. Commit and push.
      f. **Go back to step 0** — re-run the full loop: skip-if-running → early-exit → merge → human comments → bot trivia → tests → pre-emptive CI fix → local checks → CI monitor.

12. **Step 9 — Post-merge release trigger** (per global rule 47):

- Reached when `state == "MERGED"` (manual squash, automerge landing, or admin-merge).
- Invoke `/sy-release` against `<owner/repo>`. The release skill handles repo-shape detection on its own:
  - If the repo has a release workflow: it prompts the user to confirm, then dispatches OFFICIAL (default-branch, tag-safety-checked per global rule 45).
  - If the repo has no release workflow (dotfiles, infra-only repos): it aborts cleanly with `"no official release workflow found — aborting"`. No harm, no action — log it and move on.
- Do NOT pre-decide whether the repo has a release workflow yourself; let `/sy-release` make that call. The point of rule 47 is uniform application: every merge flows through the release skill.
- Pass the resolved `<owner/repo>` explicitly when delegating (global rule 46) so the release skill doesn't re-infer from the folder name.

13. **Final report:** Summarize what happened — sync result, comments addressed (human + trivial bot), tests added / updated, pre-emptive CI fixes, local checks run, CI fixes applied, merge outcome, AND the release skill outcome (dispatched / no-op / aborted with reason).

## Rules

- **Step 0 (skip if CI is running) is the very first check — before everything.** If CI is in progress / pending / queued, stop immediately and take no action. Never merge, comment, or push while a build is still running.
- The loop is: step 0 skip-if-running → step 1 early-exit (or wait-for-automerge-merge) → step 2 merge base → step 3 human comments → step 4 trivial bot comments → step 5 add/update tests → step 6 pre-emptive CI fix → step 7 local checks → step 8 CI monitor → (on failure) back to step 0. On `state == "MERGED"`: jump directly to step 9 post-merge release.
- **Automerge PRs never exit at green + approved.** Always poll until `state == "MERGED"` and then trigger `/sy-release` (global rule 47). The agent owns the merge→release handoff; do not punt to the user.
- Never rebase to sync — always use `git merge` so history is not rewritten. Never use `--squash` when merging main into the branch.
- Never skip local checks before pushing — it wastes CI cycles.
- **Bot comments: only trivial / minor fixes** (typos, single-line lint nits, doc wording). Never let a bot drive a refactor or redesign — skip anything non-trivial.
- **Every behavior-changing fix from step 3 or 4 needs test coverage in step 5.** Doc/typo/format-only changes are exempt.
- Fix CI failures of every kind (tests, lint, type-check, build, config) regardless of language — do not assume JS/Node.
- **Broken-main detection runs before every fix attempt.** If the same check is failing on `origin/<default>`'s latest commit, the PR can't go green until default is fixed — stop and flag the user.
- Poll CI every 15 minutes; do not spam `gh` calls. Each wake runs the full loop (comments + CI) in one pass. Hard cap at 10 polls (~2.5 hours) — escalate to user after that.
- **After every applied fix: reply `Fixed — <one-liner>` and resolve the thread** (mechanics in step 3). Reply-without-fix → post reply, leave thread open.
