# Agent Progress Updates

## Status sentence

At task start and every meaningful phase boundary, the main agent and each subagent send one status sentence as the first line of the update. Keep that sentence within `<<SY_PROSE_SENTENCE_MAX_WORDS>>` words.

Use this field order, separated by middle dots (`·`):

```text
[<repo>] #<PR> · <STATUS> · step <N>/<M> - <current step> · <details>
```

Use the verified repository name; include its owner when needed to distinguish repositories.
Omit `#<PR>` and its preceding space when no verified PR applies.
For tasks outside a repository, use `[no repo]`; never invent a repository or PR.

Keep the entire step field within `10` words, including `step N/M -`.
Describe the current action in that field.
`N` is the current step; `M` is the total planned steps for this assignment, not individual commands.
`step N/M` conveys progress; do not repeat a separate remaining-step count in details.
If the total is unknown, use `step N/?` rather than inventing a total.
Explain changes to the total when scope changes.

Use exactly one status:

- `IN PROGRESS` — work continues.
- `BLOCKED` — this agent cannot safely continue its assigned work without outside input or an external change.
- `DONE` — this agent completed its assigned work and required checks.

Include the current phase, completed work, step progress, and next action or blocker across the step field and details.
Put supporting explanation below the first line when needed to preserve its word limit.

Examples:

```text
[widget-store] #42 · IN PROGRESS · step 2/4 - adding snapshot comments · sources reviewed; next document rerun commands.
[widget-store] #42 · BLOCKED · step 3/4 - running validation · Docker unavailable; start Docker to continue.
[widget-store] · DONE · step 4/4 - validation complete · comments added; focused checks passed.
```

Use `DONE` only after assigned work and required checks pass. State the result and checks. Do not use `DONE` for a partial handoff.

Use `BLOCKED` only when this agent cannot proceed on its assignment. Name the cause and required action. A blocked subagent does not block unrelated work owned by the main agent.

## Parent and subagent updates

Subagents send the same status sentence to their parent at task start, each phase boundary, and before returning. The parent reports each meaningful status change to the user, keeps accepted work moving when another assignment is blocked, and does not claim overall completion until required subagent results arrive.

Do not send routine command-by-command updates. Send a new update when status, phase, completed work, next action, or step counter changes.
