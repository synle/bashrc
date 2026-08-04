[Sy] Stress-test a plan, design, or decision. Calibrated grilling — one question at a time, with recommended answers. Not hostile debate; calibrated pressure until plan is clear and defensible.

Argument: $ARGUMENTS (optional — topic to grill. If empty, asks what to grill.)

## Rules

- Ask one question at a time.
- Give a recommended answer for every question.
- If answer lives in files/code/docs/logs, read first instead of asking.
- Track unresolved decisions, assumptions, risks, dependencies.
- Let user change intensity anytime: "softer", "harder", "teach more", "skip basics".
- Stop when: user says stop, plan is clear enough, or missing info needs external research.

## Phases

### Phase 1 — Frame the Target

If topic not clear from $ARGUMENTS or context:

> What plan, design, or decision should I grill?
> Recommended answer: concrete goal, current approach, constraints, decision needed.

If context already contains the plan, summarize in 3-6 bullets and ask for correction.

### Phase 2 — Calibration

Ask once (skip if level obvious from context):

> Before I grill: what's your comfort with this topic, and how hard should pressure be?
> Recommended answer: "I know basics of [topic], standard pressure. Explain missing concepts briefly, keep pushing."

**Knowledge dial:** New (needs vocab/model) | Working (understands tradeoffs) | Expert (wants sharper critique)

**Pressure dial:** Light (clarify goals/constraints) | Standard (challenge assumptions/tradeoffs) | Hard (probe failure modes, edge cases, reversibility, second-order effects)

Default: Knowledge=Working, Pressure=Standard.

### Phase 3 — Build Decision Map

Track privately: Goal, User/Customer, Constraints, Options, Dependencies, Risks, Validation, Rollback. Use to choose next question. Don't dump unless asked.

### Phase 4 — Question Ladder

Move through these tiers. Stop early when plan firms up.

1. **Goal Fit** — What outcome matters most? What makes this not worth doing? What problem, for whom?
2. **Constraint Reality** — What hard constraint can't move? What resource bottleneck decides the plan? What assumption kills the plan if false?
3. **Option Pressure** — Top two alternatives? Why not the boring approach? Optimizing for speed/quality/cost/learning/control?
4. **Execution Path** — Smallest useful version? What first? What can defer?
5. **Failure Modes** — How does this fail in production? What edge case embarrasses the plan? Hardest part to observe when broken?
6. **Validation** — What test/metric/demo/user behavior proves it works? What does "done" mean in observable terms?
7. **Reversibility** — Hardest decision to undo? Rollback plan? What warrants an ADR?

### Pressure Adaptation

**New knowledge:** define missing concept in 2-4 sentences before asking. Avoid jargon. Focus goals/constraints/first-principles.

**Working knowledge:** normal tradeoff questions. Push for validation + smallest useful version. Challenge vague words ("simple", "scalable", "good", "clean", "fast").

**Expert knowledge:** skip basics. Sharper counterfactuals. Hidden costs, migration paths, long-term maintenance. What evidence changes their mind.

**Light pressure:** clarifying only. Stop after top ambiguities resolved.

**Standard pressure:** challenge assumptions and tradeoffs. Keep moving until implementation path concrete.

**Hard pressure:** direct. Name weak reasoning. Unpleasant edge cases. Demand observable validation.

## Recommended Answer Format

```
Question: ...
Recommended answer: ...
Why it matters: <one sentence>
```

## Output

End with: decision or best plan, remaining open questions, next concrete action, risks to watch.
