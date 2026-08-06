[Sy] Systematic bug hunt: reproduce, shrink, bisect, then test one hypothesis at a time and prove the fix is load-bearing. Repo-, language-, and framework-agnostic.

Argument: $ARGUMENTS (optional — the bug: a failing test name, an error string, a stack trace, a PR/issue link, or a plain-English symptom. If empty, ask for the symptom and the command that triggers it.)

## When to use

- A test, build, or CI job is red and the cause is not obvious on the first read.
- A symptom is reported but the failing code path is unknown.
- A previous "fix" landed and the bug came back — or the fix worked and nobody can say why.
- A failure reproduces on one machine / OS / CI runner but not another.

Do **not** use this for: a compile error with an obvious one-line cause (just fix it), a feature request wearing a bug costume, or a known-flaky test (fix the flake's root cause, which is its own bug hunt).

## Hard rules

- **No fix without a reproduction.** A change made against a symptom you cannot trigger on demand is a guess, and a guess that turns the symptom green is worse than no fix — it hides the real defect behind a coincidence. If it cannot be reproduced, the deliverable of this command is a reproduction, not a patch.
- **One hypothesis, one change, one observation.** Changing five things and seeing green teaches nothing: you now have five suspects, four pieces of dead code, and no idea which mattered. Revert every change that did not prove out.
- **Read the FIRST failure, not the last.** Test runners, compilers, and CI logs cascade — failures 2..N are usually consequences of failure 1. Scroll up. The last line of output is the least informative line in it.
- **Instrument, don't stare.** When two hypotheses are equally plausible, the next action is a log line, a breakpoint, or a `git bisect` — not more reading.
- **Never report a fix without re-running the original repro command and showing its output.** "Should work now" is not a result.
- **Every claim carries its evidence.** Cite `file:line` or paste the command output. A command you did not run produced no output — never narrate a result you did not observe.

## Phases

### Phase 0 — Capture the symptom verbatim

Record, before touching anything:

- The exact command that fails, copy-pasteable.
- The exact error text / stack trace, unedited and untruncated.
- Expected vs actual behavior, one line each.
- Environment: OS, runtime version, branch, dirty-or-clean working tree (`git status --short`).
- When it last worked, if known (a commit, a date, a release).

Paraphrasing the error here is the single most common way a bug hunt goes wrong — an error message is a search key, and a reworded one matches nothing.

### Phase 1 — Reproduce

Get to a command that fails **on demand, every time**. Report the reproduction rate — "3/3 runs" or "2/10 runs" — because an intermittent bug needs a different strategy (Phase 3's bisect is unreliable below ~90% reproduction; stabilize first by pinning seeds, clocks, ports, network, and concurrency).

If it will not reproduce locally, work down this list before giving up:

1. Match the failing environment — same runtime version, same OS, same env vars, clean checkout.
2. Reproduce in the failing environment itself (CI re-run with debug logging, a container matching the image).
3. Reproduce from a clean state — fresh clone, fresh dependency install, cleared caches.

Stop and report if none of these produce a repro. A hunt without a repro is over; say so instead of patching blind.

### Phase 2 — Shrink

Cut the reproduction down to the smallest thing that still fails: one test instead of a suite, one input instead of a fixture file, one function call instead of a request. Each removal that keeps the failure alive removes a suspect.

Shrinking is finished when removing any remaining piece makes the failure disappear. Note the total time the minimal repro takes — every later phase runs it repeatedly, so seconds here are worth minutes later.

### Phase 3 — Locate

Binary-search the failure. Pick whichever axis is cheapest:

- **History** — `git bisect start <bad> <good>` with the minimal repro as the test. Script it (`git bisect run <cmd>`) whenever the repro is non-interactive. This is the highest-value move whenever a "last known good" commit exists.
- **Code path** — log or breakpoint at the midpoint of the suspected path, confirm which half holds the bad state, repeat. Log the _value_, not just "got here".
- **Input** — halve the input until the failing element is isolated.
- **Config / dependencies** — toggle one flag, env var, or version at a time from a known-good baseline.

Do not skip this phase because the cause "seems obvious". A hypothesis formed before locating the failure is a bias, and confirming it costs the same as testing it honestly.

### Phase 4 — Hypothesize, one at a time

Keep a running table and show it in the final report:

| #   | Hypothesis | How tested | Result                |
| --- | ---------- | ---------- | --------------------- |
| 1   | ...        | ...        | ruled out / confirmed |

Rules for the loop: state the hypothesis **and what would disprove it** before making a change; change exactly one thing; observe; revert if it did not prove out. A hypothesis that cannot be disproved is not a hypothesis — reformulate it.

**After three consecutive ruled-out hypotheses, question the premise instead of forming a fourth.** Candidates for the wrong premise: the failing code is not the code being read (stale build, wrong file, shadowed module, cached artifact, wrong branch checked out), the test asserts something different than assumed, the "good" baseline was never actually good, or the environment differs from the assumption. Verify one of those before continuing.

### Phase 5 — Fix the cause

Fix the defect, not the observation. Ask explicitly: **why did this reach production / main?** — an unhandled case, a missing invariant, a wrong default, a race. Fix at that level.

Symptom-fix smells, all of which mean the cause is still there: a `try/except` added around the failing call, a null check bolted on at the crash site, a retry wrapped around a nondeterministic operation, a sleep added to a race, a test assertion loosened to match the buggy output.

If the same defect pattern appears in sibling call sites, fix them in the same change — one root cause, one patch. (See the Code Hygiene rule "Fix root causes, not symptoms".)

### Phase 6 — Prove it

Three checks, all required:

1. **Re-run the original Phase 0 command** — not the minimal repro, the real one — and show the output.
2. **Prove the fix is load-bearing:** revert just the fix, confirm the failure returns, re-apply. A fix whose removal changes nothing was not the fix, and the real bug is still live.
3. **Run the targeted suite around the touched code** to catch collateral damage, then the repo's full gate once (see the Validation Cadence rules — do not re-run the gate per edit).

### Phase 7 — Lock it in

- **Write a regression test that fails without the fix and passes with it.** Verify both directions — a test that passes before the fix is not a regression test, it is decoration.
- Name the test after the defect's cause, not the ticket number.
- If the bug survived an existing test, say why that test missed it; that gap is usually the more valuable finding.
- Follow the repo's own conventions for commit message, branch, and PR (see the Source Control & PRs rules).

## Report format

End with this, whether the hunt succeeded or not:

- **Symptom** — one line, the original error.
- **Root cause** — one to three sentences, with `file:line`.
- **Why it reached main** — the missing invariant / test / guard.
- **Fix** — files touched, one line each.
- **Evidence** — the repro command and its before/after output, plus the load-bearing revert check.
- **Hypothesis table** — from Phase 4, including everything ruled out (this is what saves the next person the same dead ends).
- **Still unknown** — anything unexplained. Never round an unexplained remainder up to "fixed"; a bug that stopped reproducing without an understood cause is reported as exactly that.
