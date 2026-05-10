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
