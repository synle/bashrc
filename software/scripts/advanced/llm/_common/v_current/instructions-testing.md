# Test Quality

Read before writing, reviewing, or trusting tests. This governs test quality;
Validation Cadence governs when and at what scope to run them.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## What a test asserts

- Test behavior, not implementation. Assert what a caller observes — return values, emitted events, persisted rows, HTTP status and body, files on disk — never private methods, internal call ordering, or invocation counts. A test that must reach into internals is the finding.
- Pick the smallest stable seam a real caller uses, not necessarily the smallest function. If behavior needs six layers of setup or a private export, report the design pressure; don't mock through the stack or widen visibility to manufacture a unit seam.
- A test that passes before the fix is not a regression test. For code that changes observable behavior, write the smallest caller-facing test first when practical. Run it to confirm it is collected and fails for the intended reason; implement the minimum change, rerun it, and refactor only while green. If test-first is infeasible, state why and use the closest meaningful observable proof.
- For bugs, verify the test fails against unfixed code and passes with the fix. For a bug you cannot yet reproduce, write the failing test first.
- Assert values, not the absence of an explosion. `expect(parse(x)).toEqual({...})` earns its keep; `expect(() => parse(x)).not.toThrow()` passes on `undefined` or the wrong answer. Same for over-loose matchers — `toBeTruthy()` where `3` is correct, `any(String)` on one correct value, a status check with no body assertion. Loosen only nondeterministic fields.
- A green suite is not consumer coverage. Before removing or renaming anything a caller reads, apply Risky Changes' downstream audit, including silent cross-service and runtime degradation.
- Don't mock what you don't own. Wrap third-party clients in a thin owned adapter; mock the adapter and cover the real client in one integration test. Record external API fixtures from the real API and re-record on upgrade.
- A mocked boundary asserts what was sent into it — payload, idempotency key — not only the effect of its canned response.
- Rejection tests assert the full absence of effects. Check unchanged state, no persisted write, and no emitted event or external action wherever the rejected operation could produce them; an error response alone does not prove rejection was atomic.
- Tests for generated scripts, wrappers, installers, and configuration output execute or parse the generated artifact through its real consumer where practical. String-content checks alone do not prove that the artifact works.
- Tests around wrappers, generated commands, or harnesses check both the process exit status and the expected result output. Do not trust exit code alone when a wrapper can print a failure while returning `0`.

## How a test is shaped

- One reason to fail per test — six unrelated assertions report one failure and hide five. Name tests after behavior and condition (`returns 400 when the payload is missing a body`), never after the function or ticket.
- Keep ordinary unit tests under 100 ms each where practical. Keep each unit spec file under 10 seconds locally. Mark slower integration, subprocess, browser, network, and build tests clearly by suite, file, or test name. Investigate tests that exceed their budget; do not hide slow tests with retries or larger global timeouts.
- No logic in tests. No loops building expectations, no branches, no computing the expected value with the implementation's own formula. Except for characterization tests below, derive literal expected values from the contract or an independent calculation, never by copying current output. Table-driven tests hold literal inputs and outputs; the loop body stays assertion-only.
- Cover the boundaries: empty, zero, one, many, maximum, negative, absent vs present-but-falsy, duplicate, out-of-order, unicode, plus the error path for every failure the code explicitly handles. Input-handling seams also get realistic hostile values such as spaces, quotes, backslashes, newlines, emoji, right-to-left text, very long values, path traversal attempts, and absolute paths. Code parsing untrusted bytes gets property or fuzz tests; commit each failing input as a regression seed.
- Paired transformations get round-trip properties. For encode/decode or serialize/parse, verify recovery of generated valid inputs, including empty, maximal, and non-ASCII values. Also assert independent known input/output vectors: two inverse functions can share a bug and still round-trip.
- Each test owns its data — a factory with overrides, never shared mutable seed rows or another test's leftovers. Factories generate unique IDs, names, paths, ports, and temporary folders by default; fixed values require a behavior-based reason. Prove independence by running the suite shuffled under two seeds, and confirm the shuffle took effect (run order differs) before trusting green.
- Deterministic or deleted. Pin clock, seed, ports, temp paths, and iteration order; never sleep for something you can await or poll. Quarantine only with a linked issue and date; investigate flakes as bugs.
- Baseline before the first edit. Run the targeted tests at the base commit; failures already there are recorded as pre-existing, never blamed on or silently fixed by the change.
- Untested legacy code gets characterization tests before structural edits. Pin current observable behavior, including known oddities; separate the later intentional behavior change so review can distinguish it from refactoring damage.
- **Coverage floor for code changes:** In every code repository, require at least **80% changed-code line coverage and 80% changed-code branch coverage** wherever each metric is available. Honor any stricter repository or CI threshold. Measure the changed code, not only the overall project; overall coverage is not proof that the diff meets the floor. If the repository cannot report a metric, use the closest meaningful changed-code measurement and state the gap explicitly; never claim an unmeasured threshold passed. Add meaningful tests for uncovered behavior, not assertions written only to inflate a percentage.
- Skill evaluations separate trigger accuracy from task success. Compare a revised skill with its previous version on the same realistic prompts. Include should-trigger cases and adjacent near-misses that should not trigger; reserve held-out prompts to detect overfitting. Inspect resulting artifacts and execution traces, not only activation or aggregate scores.
- Coverage percentage is a smoke detector, not a goal. Never write a test to move the number, never delete a meaningful assertion to hit a threshold.
- Report passed, failed, errored, and skipped tests separately. A skipped test is not a pass: report its reason, especially when a dependency, browser, network, credential, OS, or external service is unavailable. A required test that cannot run is a failure, not a skip.
