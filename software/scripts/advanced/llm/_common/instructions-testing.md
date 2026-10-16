# Test Quality

Read before writing, reviewing, or trusting tests. This governs test quality;
Validation Cadence governs when and at what scope to run them.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## What a test asserts

- Test behavior, not implementation. Assert what a caller observes — return values, emitted events, persisted rows, HTTP status and body, files on disk — never private methods, internal call ordering, or invocation counts. A test that must reach into internals is the finding.
- Pick the smallest stable seam a real caller uses, not necessarily the smallest function. If behavior needs six layers of setup or a private export, report the design pressure; don't mock through the stack or widen visibility to manufacture a unit seam.
- A test that passes before the fix is not a regression test. Verify both directions: fail against unfixed code, pass against the fix. Same for a bug you cannot yet reproduce — write the failing test first.
- A red test must fail for the intended behavior, not an import error, typo, or uncollected file. Read the failure before writing production code; a green test that the runner never collected proves nothing.
- Assert values, not the absence of an explosion. `expect(parse(x)).toEqual({...})` earns its keep; `expect(() => parse(x)).not.toThrow()` passes on `undefined` or the wrong answer. Same for over-loose matchers — `toBeTruthy()` where `3` is correct, `any(String)` on one correct value, a status check with no body assertion. Loosen only nondeterministic fields.
- A green suite is not consumer coverage. Apply the downstream audit in Risky Changes before removing or renaming anything a caller reads; local tests cannot prove cross-service or runtime consumers survive, especially silent degradation.
- Don't mock what you don't own. Mocking a third-party client freezes your _belief_ about its contract, so tests stay green through the upgrade that breaks production. Wrap it in a thin adapter you own, mock the adapter, cover the real thing in one integration test. Same for fixtures of someone else's API response — record from the real API, re-record on upgrade.
- A mocked boundary asserts what was sent into it — payload, idempotency key — not only the effect of its canned response.
- Rejection tests assert the full absence of effects. Check unchanged state, no persisted write, and no emitted event or external action wherever the rejected operation could produce them; an error response alone does not prove rejection was atomic.

## How a test is shaped

- One reason to fail per test — six unrelated assertions report one failure and hide five. Name tests after behavior and condition (`returns 400 when the payload is missing a body`), never after the function or ticket.
- No logic in tests. No loops building expectations, no branches, no computing the expected value with the implementation's own formula. Write expected values literally; table-driven tests hold literal inputs and outputs and the loop body stays assertion-only.
- Cover the boundaries: empty, zero, one, many, maximum, negative, absent vs present-but-falsy, duplicate, out-of-order, unicode, plus the error path for every failure the code explicitly handles. Code parsing untrusted bytes also gets property or fuzz tests; commit each failing input as a regression seed.
- Paired transformations get round-trip properties. For encode/decode or serialize/parse, verify recovery of generated valid inputs, including empty, maximal, and non-ASCII values. Also assert independent known input/output vectors: two inverse functions can share a bug and still round-trip.
- Each test owns its data — a factory with overrides, never shared mutable seed rows or another test's leftovers. Prove independence by running the suite shuffled under two seeds, and confirm the shuffle took effect (run order differs) before trusting green.
- Deterministic or deleted. Pin the clock, seed, ports, temp paths, iteration order; never sleep for something you can await or poll. Flakes train everyone to re-run CI until green, which is how a real failure gets clicked past. Quarantine only with a linked issue and a date; hunt the flake as a bug.
- Baseline before the first edit. Run the targeted tests at the base commit; failures already there are recorded as pre-existing, never blamed on or silently fixed by the change.
- Untested legacy code gets characterization tests before structural edits. Pin current observable behavior, including known oddities; separate the later intentional behavior change so review can distinguish it from refactoring damage.
- **Coverage floor for code changes:** In every code repository, require at least **80% changed-code line coverage and 80% changed-code branch coverage** wherever each metric is available. Honor any stricter repository or CI threshold. Measure the changed code, not only the overall project; overall coverage is not proof that the diff meets the floor. If the repository cannot report a metric, use the closest meaningful changed-code measurement and state the gap explicitly; never claim an unmeasured threshold passed. Add meaningful tests for uncovered behavior, not assertions written only to inflate a percentage.
- Coverage percentage is a smoke detector, not a goal. Never write a test to move the number, never delete a meaningful assertion to hit a threshold.
