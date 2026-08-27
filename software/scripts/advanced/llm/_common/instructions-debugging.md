# Debugging Discipline

Companion to the always-loaded engineering principles. Governs reproducing,
isolating, and fixing a defect — read before the first fix attempt on anything
broken, then follow as written.

Picks up where the Validation Cadence feedback ladder drops you. `/sy-debug` runs
this as a phased loop.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## Reproduce before you theorize

- No fix without a reproduction. A guess that greens the symptom is _worse_ than no fix — hides the defect, burns the evidence. Can't reproduce? The deliverable is a reproduction, not a patch: match the failing environment, run from a clean checkout, reproduce in CI. If none works, say so and stop rather than patch blind. Report the rate (`3/3`, `2/10`); stabilize intermittents (seeds, clocks, ports) before bisecting.
- Shrink the repro before forming a hypothesis. One test, not a suite; one input, not a fixture; one call, not a request. Done when removing anything else makes the failure vanish.
- Read the **first** failure, not the last. Runners, compilers, and CI logs cascade. Read whole stack traces before theorizing, quote errors verbatim — an error message is a search key.

## Isolate one variable at a time

- One hypothesis, one change, one observation. State the hypothesis **and what would disprove it** first, change one thing, observe, revert if it did not prove out. Changing five things and seeing green teaches nothing.
- List a few ranked candidates before testing any — single-hypothesis generation anchors on the first plausible idea. Each must name its disproof ("if X is the cause, changing Y kills the bug"); a candidate with no prediction is a vibe, so sharpen or drop it. Then test one at a time.
- Bisect; don't stare. Binary-search the cheapest axis — history (`git bisect run <cmd>` with the minimal repro), code path (log the _value_ at the midpoint, not "got here"), input, or one config/dependency toggle from a known-good baseline.
- Instrument narrowly, clean up after. Prefer one debugger breakpoint or REPL inspection over ten logs; never log-everything-and-grep. Tag every temporary debug log with a unique prefix (`[DEBUG-a4f2]`) so removal is one `grep` — and remove them all before declaring done.
- Perf regression: logs mislead. Establish a baseline measurement first (timing harness, profiler, query plan), then bisect. Measure first, fix second.
- After three consecutive ruled-out hypotheses, attack the premise instead of forming a fourth. Usual culprits: the code read is not the code run (stale build, cached artifact, shadowed module, wrong branch), the test asserts something other than assumed, the "known good" baseline was never good, or the environment differs.

## Fix the cause, then prove it

- Fix the cause. Symptom-fix smells: a `try/except` around the failing call, a null check bolted onto the crash site, a retry around a nondeterministic operation, a `sleep` in a race, a loosened assertion — each turns a loud bug silent. Ask "why did this reach main?" and fix at _that_ level, plus sibling call sites with the same defect.
- Prove the fix is load-bearing, three checks all required: re-run the **original** failing command (not the shrunk repro) and show output; revert only the fix, confirm the failure returns, re-apply; run the targeted suite for collateral damage.
- Ship a regression test, per Test Quality's both-directions check. Name it after the defect's cause, not the ticket. If an existing test should have caught this and didn't, say why.
- Never round an unexplained remainder up to "fixed". A bug that stopped reproducing without an understood cause is reported as that.
