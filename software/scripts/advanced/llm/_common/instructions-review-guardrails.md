# Review & Runtime Guardrails

Companion to the always-loaded engineering principles. Read before writing or
reviewing code that touches multiple execution paths, retries, collection selectors,
runtime control planes, pseudonymization or redaction, operational runbooks,
persistent integration tests, streaming limits, or async request/RPC handlers.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## Review-Derived Guardrails

- **Concrete failure or question.** A finding names the input or state, traces the reachable bad behavior, checks surrounding guards, and gives one correction. If that path cannot be constructed, ask a question instead of asserting a defect.
- **Review expected absences.** Before reading hunks, list artifacts the intent should require — migration, test, logging, rollback, docs, config — then investigate missing ones. A file absent from the diff can carry the highest-risk regression.
- **One behavior, every path.** Route sync/async, streaming/batch, manual/scheduled,
  list/detail, runtime/standalone, and fallback paths through one implementation seam.
  When duplication is unavoidable, run identical contract fixtures through every path
  and compare observable results.
- **Retry taxonomy is public behavior.** Map one exception or result type to one retry
  policy. Keep transient transport failures, deterministic input or contract failures,
  authorization failures, and capacity limits distinct; tests assert both the public
  error and whether the caller retries. Unknown failures never become empty data or
  success.
- **Selectors prove uniqueness.** Select from a repeated collection with the complete
  structural key. A reduced key needs a documented uniqueness scope enforced by
  producer validation and consumer tests.
- **Control planes preserve identity.** Validate and normalize runtime settings on
  write, reject unknowns, bound numerics, enforce one persisted value per scope+key,
  and use symmetric read/write resolution. Safety controls fail closed outside
  explicit development mode.
- **Cryptographic pseudonyms fail closed.** Missing key material is an error, never an
  empty-key fallback. Redactors normalize key style before matching and test nested
  snake_case, camelCase, and mixed payloads.
- **Operational docs are executable interfaces.** Verify commands in the correct
  non-production environment. Recovery steps name scope, preconditions, idempotency,
  cancellation completion, rollback, and proof of success. Absolute security or
  privacy claims enumerate and verify every mode.
- **Persistent tests clean what they create.** Use a run-unique marker, capture the
  created resource identifier from the mutation response, and register cleanup
  immediately with language-native teardown (`finally`, `defer`, or equivalent);
  failed readback must not prevent cleanup.

## Concurrency & Resources

- One try/catch per batch iteration; outer-only discards earlier successes.
- Chunk unbounded list params — query and packet-size limits bite.
- Enforce byte, item, page, token, and time limits while consuming, not after
  buffering. Close nested streams on timeout, cancellation, or limit breach.
- Async request/RPC paths never call blocking filesystem, subprocess, synchronous SDK,
  registry, or network APIs directly. Use an async client or offload the call, apply a
  deadline, and test that unrelated work progresses while the slow operation runs.
- Emit heartbeats from long-running jobs or the scheduler kills and retries.
- Register teardown for async resources — timers, intervals, abort controllers,
  handles, sessions, pools.
- No long synchronous retry chains in request handlers — one attempt, queue the rest.
- Hoist loop-invariant work — permission lookups, regex compiles, deadline math.
