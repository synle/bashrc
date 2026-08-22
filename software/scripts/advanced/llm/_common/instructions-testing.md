# Test Quality

Companion to the always-loaded engineering principles. Everything here governs
whether a test is worth the green checkmark it prints — read it before writing,
reviewing, or trusting a test suite, then follow it as written.

Validation Cadence governs _when_ tests run; this governs whether they are worth
running at all. A green suite of bad tests converts "untested" into "believed
tested", which is strictly worse than knowing nothing.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## What a test asserts

- Test behavior, not implementation. Assert what a caller observes — return values, emitted events, persisted rows, HTTP status and body, files on disk — never private methods, internal call ordering, or invocation counts. If a test must reach into internals, that is the finding.
- A test that passes before the fix is not a regression test. Verify both directions: fail against unfixed code, pass against the fix. Same for a bug you cannot yet reproduce — write the failing test first.
- Assert values, not the absence of an explosion. `expect(parse(x)).toEqual({...})` earns its keep; `expect(() => parse(x)).not.toThrow()` passes on `undefined` or the wrong answer. Same for over-loose matchers — `toBeTruthy()` where `3` is correct, `any(String)` on one correct value, a status check with no body assertion. Loosen only genuinely nondeterministic fields.
- A green suite is not consumer coverage. It proves the callers someone already wrote a test for still pass, in the repos it runs in — never that a UI, another service, a job, or a script reading the same field survived. Removing or renaming anything a caller reads is audited against those consumers directly (see the removal rules in `risky-changes.md`), and a consumer that degrades silently rather than failing — read-only fallback, disabled control, blank panel, `undefined` permission check — is invisible to every assertion in this repo.
- Don't mock what you don't own. Mocking a third-party client freezes your _belief_ about its contract, so tests stay green through the upgrade that breaks production. Wrap it in a thin adapter you own, mock the adapter, cover the real thing in one integration test. Same for fixtures of someone else's API response — record from the real API, re-record on upgrade.

## How a test is shaped

- One reason to fail per test — six unrelated assertions report one failure and hide five. Name tests after behavior and condition (`returns 400 when the payload is missing a body`), never after the function or ticket.
- No logic in tests. No loops building expectations, no branches, no computing the expected value with the implementation's own formula. Write expected values literally; table-driven tests hold literal inputs and outputs and the loop body stays assertion-only.
- Cover the boundaries: empty, zero, one, many, maximum, negative, absent vs present-but-falsy, duplicate, out-of-order, unicode, plus the error path for every failure the code explicitly handles.
- Deterministic or deleted. Pin the clock, seed, ports, temp paths, iteration order; never sleep for something you can await or poll. Flakes train everyone to re-run CI until green, which is how a real failure gets clicked past. Quarantine only with a linked issue and a date; hunt the flake as a bug.
- Coverage percentage is a smoke detector, not a goal. Never write a test to move the number, never delete a meaningful assertion to hit a threshold.
