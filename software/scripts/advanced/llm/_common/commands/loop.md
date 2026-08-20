[Sy] Work a goal to completion in a bounded, self-checking loop — one task per iteration, verified before the next, with all state in a durable file so the run survives context loss. A Ralph-style loop, repo- and language-agnostic.

Argument: $ARGUMENTS (the goal — "fix all failing tests", "migrate every call site off the old client", a plan file path, or a plain-English objective. May end with `max=<n>` to override the iteration cap. If the placeholder arrives unexpanded or empty, ask for the goal and the command that proves it done, then stop.)

## When to use

- A goal that is one sentence to state and many small edits to reach: fix every failing test, remove a deprecated API from every call site, add missing docstrings across a module, work a checklist someone already wrote.
- The finish line is **machine-checkable** — a command exists that goes from red to green, or a list exists that goes from N items to zero.
- The work is repetitive enough that deciding what to do next is cheaper than doing it.

Do **not** use this for: a single edit (just make it), design work with no verifiable stopping condition, a bug whose cause is unknown (that is a hunt — use the debugging workflow first), or anything where a wrong iteration is expensive to undo (schema migrations, deletions, releases).

## Hard rules

- **A loop without a machine-checkable exit is not a loop, it is an infinite one.** Before iteration 1, name the exact command or enumeration that decides "done" and run it once to capture the starting number. If no such check exists, building it is the first iteration — or the loop does not start.
- **The durable file is the state; the conversation is not.** Everything needed to resume — goal, done list, remaining list, the check command, the current iteration number — lives in a file on disk and is rewritten at the end of every iteration. Context gets compacted, sessions die, and a loop whose memory is the scrollback silently restarts or silently stops. Re-read that file at the top of each iteration rather than trusting recall.
- **One task per iteration, verified before the next begins.** Batching five tasks to "save time" converts one failing iteration into five suspects, exactly as in a bug hunt. An iteration that ends red is reverted or fixed inside that same iteration — never carried forward.
- **The remaining list only shrinks.** Work discovered mid-run is recorded as a follow-up, not adopted. A loop that grows its own scope has no exit condition, and it is the single most common way this pattern burns an afternoon.
- **Every iteration must move the number.** Two consecutive iterations with no measurable progress is a stall — stop and report, never a third attempt at the same wall.
- **Bounded by default.** The cap is 20 iterations unless `max=<n>` says otherwise. Hitting the cap is a normal, reportable outcome, not a failure to hide.
- **Never fake green.** Loosening an assertion, skipping a test, deleting a case, or widening a type to make the check pass ends the run immediately and is reported as a stop, not a completion. The check command is the referee; editing the referee is cheating.
- **Every claim carries its evidence.** Paste the check command's real output, never a summary of a run you did not perform.

## Phases

### Phase 0 — Frame the loop, once

Produce all five before touching code, and put them in the durable file:

1. **Goal** — one sentence, from `$ARGUMENTS`.
2. **Check command** — the exact copy-pasteable command that decides done (`npx vitest run`, `make validate`, `rg -c 'oldClient(' src | wc -l`, `cargo build 2>&1 | grep -c warning`).
3. **Starting number** — that command's output right now, quoted verbatim. This is the baseline every later iteration is measured against.
4. **Remaining list** — the enumerated work, one line per item, ordered cheapest-and-most-informative first. Derive it from the check output where possible rather than guessing.
5. **Out of scope** — what this loop will not touch, named explicitly. This is what the "only shrinks" rule is enforced against.

The durable file lives at `<LLM_ROOT_FOLDER>/plans/<repo>/loop-YYYY-MM-DD-<slug>.md`, where the date is today's (`date +%Y-%m-%d`, fixed at first write) and `<slug>` is the kebab-case goal. Create the folder if missing. When the goal already came from a plan or RFC file, append the loop state to that file instead of opening a second one — one artifact per piece of work.

### Phase 1 — Iterate

Each iteration is the same five steps, in order, and nothing else:

1. **Re-read the durable file.** Confirm the iteration number, the remaining list, and the check command from disk — not from memory.
2. **Take exactly one item** off the top of the remaining list. Say which, in one line, before editing.
3. **Do it,** touching only the files that item needs. Scope Discipline still applies inside a loop: no drive-by reformatting, no adjacent fixes, no refactor you noticed on the way past.
4. **Verify at the cheapest rung that can fail** — syntax check, then the one test covering the change, then the check command if it is fast. Escalate to the full check command at least every fifth iteration and always on the last one. If the iteration ends red, fix it or revert it now; never advance with a known failure.
5. **Rewrite the durable file** — move the item to the done list with its result, record the new number, increment the iteration counter, add any discovered work under follow-ups.

Stop the loop the moment any of these is true, and say which one:

- The remaining list is empty **and** the check command is green — the success exit.
- The iteration cap is reached.
- Two consecutive iterations produced no measurable change in the number — the stall exit.
- An iteration needs a decision that is not yours to make: a scope change, a destructive step, a public-contract break, a conflict, or a genuine ambiguity in the goal.
- The only remaining way forward is to weaken the check.

### Phase 2 — Prove and close

Run the **full** check command one final time and paste its output beside the Phase 0 baseline. A loop that never re-ran the original check has not finished; it has merely run out of ideas.

Then emit the completion sentinel on its own line, so an outer driver or a reader can grep for it:

```
<promise>DONE</promise>
```

Emit it **only** on the success exit — remaining list empty and the check green. Every other exit ends with the stop reason instead, and never with the sentinel. A sentinel printed on a partial run is a lie a script will act on.

## Report format

End every run with this, whatever the exit was:

- **Goal** — one line.
- **Exit** — done / cap reached / stalled / stopped for a decision / stopped rather than weaken the check.
- **Iterations** — used of allowed.
- **Number** — starting → final, with the check command's before and after output.
- **Done** — one line per completed item.
- **Remaining** — what is left, if anything, ready to feed the next run.
- **Follow-ups** — work discovered and deliberately not adopted.
- **Durable file** — the absolute path, so the run is resumable.

## Notes

- **Resuming is re-running.** Point a fresh run at the same durable file and it picks up at the next unfinished item; the file, not the session, is what makes that work. This is also why the file is rewritten every iteration rather than at the end.
- **A shorter cap is usually the right call.** `max=5` on an unfamiliar goal surfaces a bad framing after five cheap iterations instead of twenty expensive ones.
- **The loop follows the repo's own rules, not looser ones.** Validation cadence, commit and branch conventions, and test quality apply exactly as they would to a single hand-made change; iterating is not a reason to batch a gate away or skip a regression test.
