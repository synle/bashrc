# Engineering Principles

Stack-agnostic rules. Apply across every language, framework, and codebase.

## Source Control & PRs

1. Branch from a fresh default. Pull right before branching. Task-scoped name. Never branch off a feature branch.
2. Squash on merge — one PR, one commit.
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
