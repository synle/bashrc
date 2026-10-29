[Sy] Stress-test a plan, design, or decision with calibrated pressure, one question at a time and a recommended answer, until the plan is clear and defensible.

Argument: $ARGUMENTS (topic to examine). If absent and context has no target, ask what plan, design, or decision to examine.

## Purpose

Read `<<LLM_ROOT_FOLDER>>/upstream/ADAPTERS.md` and `<<UPSTREAM_ADDY>>/skills/interview-me/SKILL.md` completely.
Reuse upstream hypothesis-led, one-question interviewing while retaining Sy calibration and critique of an existing plan.

## Steps

- If context already contains the plan, summarize it in 3–6 bullets and invite correction; do not restart discovery unnecessarily.
- Read answers available in code, files, documentation, or logs before asking the user.
- Ask one question at a time and provide a recommended answer with its reason.
- Keep an explicit hypothesis, unresolved assumptions, risks, dependencies, and decisions. Use them to choose the next question.
- Calibrate knowledge as New, Working, or Expert, and pressure as Light, Standard, or Hard. Ask once unless context establishes the level.
- Default to Working knowledge and Standard pressure. Honor “softer,” “harder,” “teach more,” and “skip basics” immediately.

### Existing-plan critique extension

Move through goal fit, real constraints, credible alternatives, smallest execution path, failure modes, observable validation, and reversibility/rollback.
Stop early when the decision becomes defensible; do not manufacture another interview after the user clearly confirms it.

For New knowledge, explain the missing concept in 2–4 sentences before the next question.
For Working knowledge, challenge vague terms and test tradeoffs and the smallest useful version.
For Expert knowledge, probe counterfactuals, hidden costs, migration, maintenance, and evidence that would change the decision.

Light pressure clarifies only. Standard pressure challenges assumptions and tradeoffs. Hard pressure probes weak reasoning, failure modes, and reversibility directly.

Use this response shape:

```text
Question: ...
Recommended answer: ...
Why it matters: ...
```

## Safety

Never:

- Batch questions, invent answers that require source reading, or treat uncertainty as permission to implement.
- Force repeated exact-word “yes” prompts after an unambiguous user decision or override the user's stop.
- Run an interactive interview in a non-interactive context; report missing decisions instead.

Stop when the user stops, the plan is clear enough, or missing information requires external research.

## Verification

End with the decision or best plan, unresolved questions, next concrete action, and risks to watch.
For intent discovery, preserve the upstream outcome/user/success/constraints/non-goals restatement.
For an existing plan, report the tested decision and remaining weaknesses rather than substituting a new requirements document.
