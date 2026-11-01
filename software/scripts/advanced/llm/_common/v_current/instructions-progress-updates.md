# Agent Progress Updates

## Status sentence

At task start and every meaningful phase boundary, the main agent and each subagent send one status sentence as the first line of the update. Keep that sentence within `<<SY_PROSE_SENTENCE_MAX_WORDS>>` words.

Use this field order, separated by middle dots (`·`):

```text
[<repo>] #<PR> · <emoji> <STATUS> · step <N>/<M> - <current step> · <details>
```

Use the verified repository name; include its owner when needed to distinguish repositories.
Omit `#<PR>` and its preceding space when no verified PR applies.
For tasks outside a Git repository, omit the repository/PR prefix and its following separator; start with the status emoji.
Never invent a repository or PR.

Keep the entire step field within `10` words, including `step N/M -`.
Describe the current action in that field.
`N` is the current step; `M` is the total planned steps for this assignment, not individual commands.
`step N/M` conveys progress; do not repeat a separate remaining-step count in details.
If the total is unknown, use `step N/?` rather than inventing a total.
Explain changes to the total when scope changes.

Use exactly one status with its required leading emoji:

- `🟡 IN PROGRESS` — work continues.
- `🔴 BLOCKED` — this agent cannot safely continue its assigned work without outside input or an external change.
- `🔴 ERROR` — an attempted action or required check failed; name the failure and next recovery action.
- `🟢 DONE` — this agent completed its assigned work and required checks.

Include the current phase, completed work, step progress, and next action or blocker across the step field and details.
Put supporting explanation below the first line when needed to preserve its word limit.

Examples:

```text
[widget-store] #42 · 🟡 IN PROGRESS · step 2/4 - adding snapshot comments · sources reviewed; next document rerun commands.
[widget-store] #42 · 🔴 BLOCKED · step 3/4 - running validation · Docker unavailable; start Docker to continue.
[widget-store] #42 · 🔴 ERROR · step 3/4 - running validation · snapshot assertion failed; inspect source and actual output.
[widget-store] · 🟢 DONE · step 4/4 - validation complete · comments added; focused checks passed.
🟡 IN PROGRESS · step 2/3 - reviewing local notes · notes read; next revise guidance.
```

Use `DONE` only after assigned work and required checks pass. State the result and checks. Do not use `DONE` for a partial handoff.

Use `BLOCKED` only when this agent cannot proceed on its assignment. Name the cause and required action. A blocked subagent does not block unrelated work owned by the main agent.

## Worktree context

When the assignment uses a Git worktree, append this block below every milestone update and its supporting explanation.
Include primary checkouts and linked worktrees.
Outside Git, omit the entire footer, including separators and the `Branch:`, `PR:`, and `Worktree:` rows.

```text
---
Branch: <branch name>
PR: <verified PR URL>
Worktree: <absolute worktree root>
---
```

Use the verified current branch and absolute root of the worktree executing this assignment, not another checkout.
For detached HEAD, label `Branch:` as `detached HEAD` instead of inventing a branch.
Include the `PR:` row only when a verified PR URL applies to that worktree and assignment.
Keep the footer separate from the status sentence and its word limit.
Render the separators and metadata in muted grey when the output surface supports color; never use red or green for this block.
Otherwise, use plain text; never add raw ANSI or OSC escapes to agent replies.

Example without a PR:

```text
[widget-store] · 🟡 IN PROGRESS · step 2/3 - running regression tests · Node 24 baseline passes; next review changes.
20 tests pass. One local commit; no push.

---
Branch: feature/snapshot-comments
Worktree: /workspace/widget-store-snapshot-comments
---
```

## Parent and subagent updates

Subagents send the same status sentence to their parent at task start, each phase boundary, and before returning. The parent reports each meaningful status change to the user, keeps accepted work moving when another assignment is blocked, and does not claim overall completion until required subagent results arrive.

Do not send routine command-by-command updates. Send a new update when status, phase, completed work, next action, or step counter changes.
