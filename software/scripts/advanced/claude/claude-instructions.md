# Engineering Principles

Stack-agnostic rules. Apply across every language, framework, and codebase.

## Source Control & PRs

1. Branch from a fresh default. Pull right before branching. Task-scoped name. Never branch off a feature branch.
2. Squash on merge — one PR, one commit. **Applies to manual merges AND automerge.** Always `gh pr merge --squash` (or `gh pr merge --squash --auto` to enable automerge). Never merge commits, never rebase merges. If a repo's default automerge mode is anything other than squash, switch the call to explicit `--squash` or fix the repo setting.
3. Sync with `git merge origin/<default>`. Never rebase or force-push shared branches.
4. Each PR is a standalone, mergeable unit. Bundle tightly-coupled changes (API + schema + models). Never stack PRs.

## Code Hygiene

5. Fix root causes, not symptoms. Three identical defensive blocks → extract or fix the invariant.
6. Keep comments, titles, and docstrings in sync with the code in the same edit.
7. Delete leftovers in the refactor PR — unused imports, mocks, props, dead helpers. Audit the matching test file.
8. Skip no-op wrappers; factor near-duplicates. Passthroughs are noise; N literals differing in a few fields aren't.
9. Imports and declarations at the top. Lazy only for circular deps or cold-start, with a comment.

## Logging & Errors

10. Parameterized logging only — pass values as arguments, not formatted strings.
11. Catch the narrowest expected exception. Catch-all swallows real bugs.
12. Catch by type or status code, never by error-message string.
13. Silent catch-and-pass in diagnostic, rollback, or alert paths is a bug. Log at warning level with the original exception attached.
14. Preserve the original stack trace when re-raising. Don't reconstruct an exception from its message.
15. Don't leak raw exceptions to clients. Generic message externally; raw details server-side only. Identifiers in URLs, paths, or workflow keys are PII — log non-identifying discriminators.

## Security

16. Parameterize all queries and commands — even "internal" inputs. Never interpolate user data into a query, shell command, or RPC string.
17. URL-encode interpolated path and query params. Signatures accept arbitrary strings.
18. Sanitize at trust boundaries. HTML via a sanitizer; validate `href` protocols; reject empty / absolute / `..` / leading-dot filenames.

## Defensiveness

19. Fail-closed on missing permissions or feature flags.
20. Allowlist inputs; reject unknowns. Default-branch fallthrough is a leak hazard.
21. Check input shape before reading fields. Non-object payloads must be rejected before field access, not coerced into an empty default.
22. Treat empty values (`0`, empty string, empty collection, `false`) as valid, not absent. Test for absence explicitly; never use truthy gates to mean "is set".
23. Bound numerics on both sides — clamp to `[MIN, MAX]`. One-sided clamps let negatives or overflows through.

## Concurrency & Resources

24. One try/catch per batch iteration — outer-only discards earlier successes.
25. Chunk unbounded list params. Query and packet-size limits will bite.
26. Emit heartbeats from long-running jobs or the scheduler will kill and retry them.
27. Register teardown for async resources — timers, intervals, abort controllers, handles, sessions, pools.
28. No long synchronous retry chains in request handlers. One attempt; queue the rest.
29. Hoist loop-invariant work — permission lookups, regex compiles, deadline math.

## Tests

30. Tests must fail for the right reason — pick assertions only the correct path can satisfy.
31. For ordering contracts, assert call order, not just that both calls happened.
32. Test the symmetric path when changing one of a pair — create↔update, attach↔detach, lock↔unlock, success↔failure.

## Change Execution Workflow

How any "work on a change" request should be executed. Follow exactly unless overridden in the same message.

TL;DR: worktree-isolated, master-fresh, fan-out in parallel, in the background, tests-first PRs, babysit every PR to green — pull master before every babysit fix.

33. Always use a git worktree. Each unit of work runs in its own isolated worktree (e.g. spawn sub-agents with `isolation: "worktree"`). Never modify the main checkout during parallel work — sub-agents must not trample each other or the working tree.
34. Always start from latest master. Inside the worktree (or before spawning), run `git checkout master && git pull` first, then cut the branch. Stale base causes merge pain, alembic drift, and redundant re-implementation.
35. Always parallelize within a single session. When several independent changes come in one request, fan them all out simultaneously — one message, multiple sub-agent tool calls. Do not serialize independent work.
36. Always run them in the background. Sub-agents should run with `run_in_background: true` so the main thread isn't blocked.
37. For phased work, parallelize within a phase; serialize between phases. If Phase 2 genuinely depends on Phase 1, fan out all Phase 1 work in parallel/background, wait for that phase to complete, then fan out all Phase 2 work in parallel/background. Never serialize within a phase.
38. PR order is fixed: tests first, then coverage gate, then push. Every PR starts by adding tests. Confirm the changed-code coverage gate passes — **≥ 80% line coverage; branch threshold 75% for BE/agent repos, 90% for FE repos** — before pushing. No PR without tests.
39. Babysit every PR all the way through to green CI. Use the `/babysit-pr` / `/babysit-prs` skills. "PR opened" is not "done." Every babysit cycle (rebuild, code edit, test fix, responding to a comment) begins with `git fetch origin && git merge origin/master` on the PR branch. Poll CI every 60 seconds, not 90.

### New project setup

When bootstrapping a new project (or adding tests to a project that has none):

- Aim for ≥ 80% line coverage on the changed code — same threshold as established projects.
- Set up the test pipeline early — wire CI to run tests + the coverage gate on every PR before any feature work lands. A repo without a coverage gate silently drifts below threshold.
- Pick the branch threshold based on repo type: 75% for backend/agent, 90% for frontend. If the repo type is ambiguous, ask.

### Per-request overrides

Drop the matching rule for the current request only when the user says any of:

- "do this one foreground" → skip background.
- "wait before starting the next" → serialize instead of parallelize.
- "skip babysit" → open the PR and stop.
- "WIP only" / "don't push" → no push, no PR.
- "single-shot" / "no worktree" → work in the main checkout.

## Secrets & Sensitive Data

Never leak secrets, credentials, or environment config to any tracked file or external surface. These rules apply to every output channel — logs, CI job summaries, PR comments, workflow artifacts, coverage reports, error messages, debug dumps, generated docs, anywhere.

40. **No secret values, ever, anywhere.** No raw env vars, API tokens, passwords, OAuth keys, signing keys, private hostnames, internal URLs, customer IDs, or PII in any output the user, the public, or other repo collaborators can read. Specifically: never `echo`/`printenv`/`env`/`set | grep` into `$GITHUB_STEP_SUMMARY`, never reference `${{ secrets.* }}` in summary/comment templates, never `console.log(process.env)`, never `JSON.stringify(req)` for objects that include auth headers.
41. **Coverage and artifact scope is source + metrics only.** Coverage `include:` should list source globs explicitly — never `**/*` or `.`. `exclude:` must cover `.env*`, `**/secret*`, `**/credential*`, `**/*.pem`, `**/*.key`, `**/*.p12`, `assets/binaries/**`, `secrets/**`, and any fixture path containing literal-looking tokens. Artifact uploads (`actions/upload-artifact`) must specify an explicit `path:` (e.g. `coverage/`) — never `.` or the whole workspace.
42. **CI summaries and PR comments carry metrics + filenames only.** Numbers, percentages, paths, status labels — yes. File contents, env dumps, build-time-generated config, response bodies from authenticated calls — no. Before adding any new step that writes to `$GITHUB_STEP_SUMMARY`, posts a `gh pr comment`, or uploads an artifact, audit exactly what it can read: if a prior step generated config files containing credentials, scope the new step to exclude those paths.
43. **No catch-all artifact uploads.** When a CI step generates output you want to publish, scope the upload to the exact subdirectory you need. Never upload the whole workspace "just in case" — that's how `.env`, `~/.aws/credentials`, and node_modules with embedded keys leak into public artifacts.

## Release Commands

44. **One unified `/release` skill — official by default, beta only on explicit signal.** Every release-related slash command (`/release`, `/release-stable`, `/release-official`, `/release-main`, `/release-master`, `/release-beta`) routes to the same skill body. The skill picks OFFICIAL vs BETA based on: (a) invocation name — `/release-beta` forces beta; (b) the literal keyword `beta` in `$ARGUMENTS`; (c) a SHA token that **validates** via `git cat-file -e <sha>^{commit}` against the actual repo; (d) a non-default branch name that resolves via `git rev-parse refs/heads/<name>`, `git rev-parse refs/remotes/origin/<name>`, or `git ls-remote --exit-code origin <name>`. Anything else — including unknown tokens that look like a SHA but don't resolve, or branch-shaped strings that don't exist — must **ABORT**, never silently degrade to official. Free-form phrases like "release", "release from main", "ship a release", "cut a release", "release prod", "release stable" are all OFFICIAL. `main` and `master` as args stay OFFICIAL (they're the default branch, no SHA pinning). Always confirm with the user before `gh workflow run`. Never auto-pin beta to `HEAD`.
45. **Release workflows must never derive a tag from a branch ref.** Dispatching a `workflow_dispatch` with `--ref main` sets `github.ref_name = "main"`. Any workflow expression of the form `${{ inputs.tag || github.ref_name }}` will produce a `vmain` release that overwrites real versions (incident: 2026-05-10, `synle/display-dj` clobbered three v7.0.x releases). Before any official `gh workflow run --ref <branch>`: (a) fetch the workflow file and grep for `github.ref_name` near `version:` / `tag:` / `release:` / `name:`; (b) if a `tag` `workflow_dispatch` input exists, always pass `--field tag=v<version>` derived from `tauri.conf.json` / `package.json` / `Cargo.toml` / `pyproject.toml`; (c) if neither is possible, ABORT and tell the user to push a `v*` tag or fix the workflow. After dispatch, poll the run and confirm the resolved tag matches strict semver `^v\d+\.\d+\.\d+(-[\w.]+)?$` — if not, immediately advise `gh release delete` + `gh run cancel`.

## Repo Identification

46. **The local folder name is not the repo — always resolve the remote.** Sy sometimes works on repos under a folder name that doesn't match the GitHub `owner/repo` (example: `~/git/file-explorer` is actually `synle/skiff-files`; a previous incident, 2026-05-10, sent fix/babysit agents to the wrong remote because they assumed folder = repo). Before any `gh` call, sub-agent spawn, PR action, or remote-aware reasoning: run `git remote get-url origin` (or `gh repo view --json nameWithOwner`) and use that as the authoritative `owner/repo`. Never derive the repo from `basename "$(pwd)"`, `$PWD`, or the directory name. When delegating to sub-agents, pass the resolved `owner/repo` explicitly so they don't re-infer from the folder.
