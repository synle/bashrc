# Review & Runtime Guardrails

Companion to the always-loaded engineering principles. Read before writing or
reviewing code that touches multiple execution paths, retries, collection selectors,
runtime control planes, pseudonymization or redaction, operational runbooks,
persistent integration tests, streaming limits, async request/RPC handlers, or
long-running batch loops that mix database sessions with slow external I/O.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## Review-Derived Guardrails

- **Concrete failure or question.** A finding names the input or state, traces the reachable bad behavior, checks surrounding guards, and gives one correction. If that path cannot be constructed, ask a question instead of asserting a defect.
- **Review expected absences.** Before reading hunks, list artifacts the intent should require — migration, test, logging, rollback, docs, config — then investigate missing ones. A file absent from the diff can carry the highest-risk regression.
- **Removed guards have history.** Before approving a deleted or weakened guard, `git log -L` its lines; an introducing commit citing a bug, CVE, or incident makes the removal a regression until the author shows the cause is gone.
- **Hunt deletable complexity.** Beyond defects, flag reinvented stdlib, single-implementation abstractions, and unused flexibility — one line each: location, cut, replacement.
- **One behavior, every path.** Route sync/async, streaming/batch, manual/scheduled,
  list/detail, runtime/standalone, and fallback paths through one implementation seam.
  When duplication is unavoidable, run identical contract fixtures through every path
  and compare observable results.
- **Retry taxonomy is public behavior.** Map one exception or result type to one retry
- **Idempotency keys come from intent, not attempt.** Claim the key atomically (never SELECT-then-INSERT); same key with a different payload is rejected; a timeout is `unknown`, not failure.
- **Authorize the resource, not just the caller.** Every request checks the caller may touch that specific object (IDOR); server-side fetches of user-supplied URLs go through an allowlist (SSRF).
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
- **Isolate every iteration of a long-running loop.** Materialize each iteration's
  inputs into plain values before slow I/O; never carry ORM/session-bound objects
  across a commit or rollback (both can expire them, turning later iterations into
  lazy reloads on a stale connection). Release transactions, locks, and connections
  before waiting on an external call; do follow-up writes in a fresh, bounded scope.
  Test that one failed iteration — including a failure inside its own error
  bookkeeping — cannot poison the next.
- **Defaults exist only where they are applied.** Column/model defaults often apply at
  flush or insert, not construction; a failure path reading a new, unsaved object sees
  `None`. Set required initial values explicitly at construction, and make counters
  tolerate absent (`(n or 0) + 1`).
- **Systemic upstream failure trips a breaker.** When a batch exhausts its retry budget
  on a server-side error (5xx, timeout), stop submitting remaining batches and leave
  them pending for a later run. Continuing multiplies calls, commits, and rollbacks
  against a dependency already known to be down.
- **Keep the failure evidence.** On an upstream error, log a bounded, redacted excerpt
  of the response body plus status and fault code — never only its size. A discarded
  body turns root cause into guesswork.
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
