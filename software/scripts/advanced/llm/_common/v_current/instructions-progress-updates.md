# Agent Progress Updates

## Status sentence

At task start and every meaningful phase boundary, the main agent and each subagent send one status sentence as the first line of the update. Keep that sentence within `<<SY_PROSE_SENTENCE_MAX_WORDS>>` words.

Start the sentence with exactly one status:

- `IN PROGRESS` — work continues.
- `BLOCKED` — this agent cannot safely continue its assigned work without outside input or an external change.
- `DONE` — this agent completed its assigned work and required checks.

Include the current phase, completed work, remaining steps, and next action or blocker. Use this form:

```text
IN PROGRESS — <phase>; completed <summary>; <N> of <M> steps left — <next step>.
```

Examples:

```text
IN PROGRESS — implementation; fallback added; 2 of 4 steps left — run tests and inspect diff.
BLOCKED — validation; tests require unavailable Docker; 1 of 3 steps remains — install or start Docker.
DONE — validation; implementation and focused checks passed; 0 of 4 steps left.
```

Use `DONE` only after assigned work and required checks pass. State the result and checks. Do not use `DONE` for a partial handoff.

Use `BLOCKED` only when this agent cannot proceed on its assignment. Name the cause and required action. A blocked subagent does not block unrelated work owned by the main agent.

## Parent and subagent updates

Subagents send the same status sentence to their parent at task start, each phase boundary, and before returning. The parent reports each meaningful status change to the user, keeps accepted work moving when another assignment is blocked, and does not claim overall completion until required subagent results arrive.

Do not send routine command-by-command updates. Send a new update when status, phase, completed work, next action, or remaining-step count changes.
