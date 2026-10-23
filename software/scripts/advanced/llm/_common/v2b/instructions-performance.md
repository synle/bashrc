# Measure Before Optimizing

Companion to the always-loaded engineering principles. Governs every
performance-motivated change — read before caching, batching, indexing,
rewriting a loop, swapping a data structure, or adding a worker.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## Prove the win

- No optimization without a number before and after. "Faster" is not a result; `1.8s → 240ms on the same input, 5 runs, median` is. Applies to every performance-motivated change — caching, batching, an index, a rewritten loop, a swapped data structure, an added worker.
- A measured win must exceed run-to-run variance under the same harness. Revert neutral or slower changes; sunk effort is not evidence.
- Profile; don't guess. Locate the bottleneck with a profiler, flame graph, timed query logs, `EXPLAIN`, browser traces, or timers around suspected spans.
- State the budget before optimizing and stop when you hit it — p99 under 200ms at 10× load, a build under two minutes. Without a target, optimization has no completion condition. If the current number already meets the budget, leave the code alone and say so.
- Measure the thing the user waits on. A step running at startup, in parallel, or on a background thread gives a real benchmark win and zero perceived win. Measure end-to-end at the boundary a human or caller experiences, at realistic input size — a 10-row fixture hides every scaling problem.
- Re-measure after landing, on real traffic or data. Benchmarks lie by omission: warm caches, absent contention, single-tenant machines, unrealistic distributions. Say plainly when the win didn't survive production.

## Spend complexity carefully

- Fix the complexity class before micro-optimizing inside it. A faster inner comparison does not rescue an O(n²) loop. Address the nested scan, query inside the loop, linear lookup that should be a hash, or repeated full sort. Those changes survive growth.
- Never trade readability, correctness, or safety for an unmeasured gain. Caching adds key, staleness, invalidation, and stampede contracts; batching adds partial-failure semantics; concurrency adds races. When a fast version must stay, document the measurement and date beside it.
