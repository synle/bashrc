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

3. **Skip if CI is currently running.** Before any other check, fetch state:
   `gh pr view <number> --repo <owner/repo> --json statusCheckRollup`
   - If **any check is in progress / pending / queued** (statuses like `IN_PROGRESS`, `PENDING`, `QUEUED`, `WAITING`, or `statusCheckRollup` entries with `status` !== `COMPLETED`): report "PR build is currently running — skipping" and **stop**. Do not run any other checks, do not merge, do not address comments, do not push. Take no action.
   - Only proceed past this step when CI is idle (every check has `status: COMPLETED` or there are no checks).

4. **Early-exit check.** Fetch state:
   `gh pr view <number> --repo <owner/repo> --json statusCheckRollup,reviews,reviewDecision,mergeable,state,autoMergeRequest,baseRefName,headRefName`
   - If `state == "MERGED"`: PR already landed — report the merge SHA and stop. **Release dispatch is manual** — the user invokes `/sy-release <owner/repo>` themselves if desired. Babysit no longer auto-triggers the release skill.
   - **Merge-conflict override — check `mergeable` BEFORE either early-exit branch below.** A PR with conflicts against its base branch is NEVER "done", even when CI is green and reviewers have approved. Automerge will not land a conflicting PR either — it will sit forever.
     - If `mergeable == "CONFLICTING"` (or any non-`MERGEABLE`, non-`UNKNOWN` value indicating a base-branch conflict): **do NOT early-exit, do NOT just wait for automerge.** Report `"PR is green + approved BUT conflicts with <baseRefName> — falling through to Step 5 to resolve"` and continue to **Step 5**. Step 5 will perform the actual merge + conflict resolution; the rest of the loop (tests, local checks, CI monitor) handles the rebuild.
     - If `mergeable == "UNKNOWN"`: GitHub is still computing mergeability. Wait 5s and re-fetch — **cap at 6 retries (~30s total)**. If still `UNKNOWN` after the cap, treat as `CONFLICTING` and fall through to **Step 5** (the merge attempt will surface the real state). Never treat `UNKNOWN` as `MERGEABLE`.
   - If **all CI checks are passing** AND `reviewDecision` is `APPROVED` AND `mergeable == "MERGEABLE"` AND `autoMergeRequest` is `null` (no automerge enabled): report "PR is already green + approved — nothing to do" and **stop**. Skip all remaining steps.
   - If **all CI checks are passing** AND `reviewDecision` is `APPROVED` AND `mergeable == "MERGEABLE"` AND `autoMergeRequest` is NOT `null` (automerge enabled): keep polling `gh pr view --json state,mergeable` every 30s until `state == "MERGED"`, then report the merge SHA and stop. **Release dispatch is manual** — the user invokes `/sy-release <owner/repo>` themselves if desired. If `mergeable` flips to `CONFLICTING` mid-wait (the base branch advanced under us), break out of the poll loop and fall through to **Step 5** to resolve the new conflict.

5. **Merge base into the PR branch AND RESOLVE CONFLICTS** (NEVER rebase, must not rewrite history). **All git work for THIS PR happens inside an isolated worktree / clone** so the user's primary checkout is never disturbed (global rule 35).
   a. **Set up an isolated workspace for this PR:**
   - **If cwd is already the target repo** (`git remote get-url origin` resolves to `<owner/repo>`): create a sibling worktree — `ROOT="$(git rev-parse --show-toplevel)"; WT="${ROOT}-pr<number>-babysit"; git worktree add "$WT" --detach`.
   - **If cwd is NOT the target repo** (typical when babysit was invoked with an explicit PR URL from elsewhere): clone into a scoped temp dir — `WT="$(mktemp -d)/<repo>-pr<number>-babysit"; gh repo clone <owner/repo> "$WT"`.
   - If `$WT` already exists from a previous babysit run, reuse it (`cd "$WT"; git fetch origin`).
   - `cd "$WT"` and run **every subsequent git / `gh pr checkout` command from there**. The user's primary checkout (if any) stays untouched.
   - On final exit (success or any early stop after the workspace was created), clean up: - Worktree: `git worktree remove "$WT"`. Only pass `--force` after confirming no uncommitted work to preserve. - Clone: `rm -rf "$WT"` after the same confirmation.
     b. Check out the PR branch inside the workspace: `gh pr checkout <number> --repo <owner/repo>`.
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
     f. **Run the Pre-push gate** (commit-author check + secret scan; see Rules section). Block on failure.
     g. Push the updated branch: `git push`.
     h. Note: this creates a regular merge commit on the PR branch. The eventual PR-level merge into main must still be a **squash merge** per repo policy.

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
    Polls used: <N>/10
    Per-check fix attempts:
      - <check-name-1>: <attempts> (status: FAILING | UNFIXABLE_AFTER_2_ATTEMPTS | PENDING)
      - <check-name-2>: ...

    Last failing logs:
      - <check-name>: <gh run view URL>

    Commits pushed this session: <comma-separated short SHAs>
    Human comments addressed: <N> threads resolved
    Bot comments addressed: <N> trivial fixes applied
    Outstanding human comments: <N> (require judgment)

    To resume: re-invoke `/sy-babysit-pr <PR-URL>`. Counters reset on re-invocation; the prior state above shows what was already tried.
    ```

    Include enough state that a re-invocation OR a human picking up the PR can see exactly what was tried and where the loop gave up.

12. **Final report:** Summarize what happened — workspace setup (worktree / clone path + cleanup status), sync result, comments addressed (human + trivial bot), tests added / updated, coverage tooling detected (or `"no coverage tooling detected"`), pre-emptive CI fixes, local checks run, CI fixes applied, per-check fix-attempt counts, and merge outcome. **If the PR was merged, remind the user that release dispatch is manual** — they can invoke `/sy-release <owner/repo>` themselves if the repo has a release workflow.

## Rules

- **Step 3 (skip if CI is running) is the very first check — before everything.** If CI is in progress / pending / queued, stop immediately and take no action. Never merge, comment, or push while a build is still running.
- The loop is: Step 3 skip-if-running → Step 4 early-exit (or wait-for-automerge-merge) → Step 5 isolated-workspace setup + merge base → Step 6 human comments → Step 7 trivial bot comments → Step 8 add/update tests + best-effort coverage check → Step 9 pre-emptive CI fix → Step 10 local checks → Step 11 CI monitor → (on failure) back to Step 3. On `state == "MERGED"`: report the merge SHA and stop — release dispatch is manual.
- **All git work happens in an isolated worktree (cwd is the repo) or a scoped clone (cwd is not the repo) — global rule 35.** Never touch the user's primary checkout. The workspace lives at `<repo-root>-pr<number>-babysit` (worktree) or `$(mktemp -d)/<repo>-pr<number>-babysit` (clone). Clean up on exit (worktree → `git worktree remove`; clone → `rm -rf`).
- **Pre-push gate runs before every `git push` in this command** (Steps 5g, 6, 7, 8, 9, 10, 11e). Two checks, both blocking:
  1. **Commit-author identity check (global rule 2).** Compare each pending commit's `author.email` and `author.name` to local config: `git log @{u}..HEAD --format='%H %ae %an'` vs `git config --get user.email` / `user.name`. On mismatch, flag the SHA(s) + identities side-by-side and ask the user whether to proceed with the existing author. **Default = "no"** → run `git commit --amend --reset-author --no-edit` (single commit) or `git rebase <base> --exec 'git commit --amend --reset-author --no-edit'` (multiple). **Preserve `Co-Authored-By:` trailers** — `--reset-author` only touches the author field; trailers in the message body survive. Only push without `--reset-author` on explicit user "yes".
  2. **Secret scan (global rule 46).** Scan all unpushed changes — `git log @{u}..HEAD -p` plus `git diff --cached` (if anything staged). Apply rule-46 patterns:
     - **Filename allowlist** — flag staged paths matching: `.env*` (except `.example` / `.sample` / `.template`), `**/credential*`, `**/secret*`, `**/*.pem`, `**/*.key` (except `.pub.key`), `**/*.p12` / `.pfx` / `.keystore`, ssh keys (`id_rsa*` / `id_ed25519*` / `id_ecdsa*` / `id_dsa*`), `*.kdbx`, `service-account*.json`, `gha-creds-*.json`, `.npmrc` / `.pypirc` / `.netrc` with auth lines, `.aws/credentials`, `.kube/config`, `.docker/config.json`, `terraform.tfstate*`.
     - **Content patterns** — AWS (`AKIA|ASIA[0-9A-Z]{16}`, `aws_secret_access_key\s*=`), GitHub (`gh[pous]_[A-Za-z0-9]{36,}`, `github_pat_`), Anthropic/OpenAI (`sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}`), Slack (`xox[abprs]-`), Google (`AIza[0-9A-Za-z_-]{35}`), private keys (`-----BEGIN .* PRIVATE KEY-----`), JWTs (`eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`), assignments `(password|api[_-]?key|token|secret)\s*=\s*["'][^"']{6,}` — skip placeholders (`<...>` / `xxx` / `***` / `example`).
     - On hit: redact the value (e.g. `AKIA****REDACTED****`), show path + line + matched pattern, ask the user. **Default = "no"** → STOP, do not push, tell the user to remove the commit (`git reset HEAD~N` or rebase) and re-stage clean. Proceed only on explicit "yes" + user confirms false positive.
- Never rebase to sync — always use `git merge` so history is not rewritten. Never use `--squash` when merging main into the branch.
- Never skip local checks before pushing — it wastes CI cycles.
- **Bot comments: only trivial / minor fixes** (typos, single-line lint nits, doc wording). Never let a bot drive a refactor or redesign — skip anything non-trivial.
- **Every behavior-changing fix from Step 6 or 7 needs test coverage in Step 8.** Doc/typo/format-only changes are exempt. Coverage verification at the end of Step 8 is best-effort and language-agnostic — skip silently if no entrypoint is detected; do NOT block.
- Fix CI failures of every kind (tests, lint, type-check, build, config) regardless of language — do not assume JS/Node.
- **Broken-main detection runs before every fix attempt.** If the same check is failing on `origin/<default>`'s latest commit, the PR can't go green until default is fixed — stop, post the escalation comment, flag the user.
- Poll CI every 15 minutes; do not spam `gh` calls. Each wake runs the full loop (comments + CI) in one pass. Hard cap at 10 polls (~2.5 hours) — escalate via the resumable escalation comment after that.
- **Per-check fix-attempt cap = 2.** A single CI check failing twice with no result usually means the fix path needs human judgment. Don't churn CI with a third attempt — mark it `UNFIXABLE_AFTER_2_ATTEMPTS` and surface in the escalation comment.
- **After every applied fix: reply `Fixed — <one-liner> (<short-sha>)` and resolve the thread** (mechanics in Step 6). Reply-without-fix → post reply, leave thread open, no SHA.
- **Release dispatch is manual.** The merge → release handoff is the user's call; babysit reports the merge SHA and stops. (This was previously automatic per global rule 47; the babysit command no longer triggers `/sy-release`.)
