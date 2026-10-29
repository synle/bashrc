[Sy] Draft a concise, evidence-based RFC for a nontrivial feature or implementation before code changes begin. Use when a decision carries meaningful complexity, risk, cost, or cross-team coordination.

Argument: $ARGUMENTS (topic, issue, request, or notes). Use current context when absent; ask for the engineering decision if none exists.

## Purpose

Read `<<LLM_ROOT_FOLDER>>/upstream/ADAPTERS.md` and `<<UPSTREAM_KHASKY>>/skills/awesome-design-doc/SKILL.md` completely.
Use upstream requirements, alternatives, recommendation, risk inversion, and rollout reasoning; preserve the Sy RFC output contract below.

## Steps

Use an RFC for meaningful complexity, operational/security/privacy/cost risk, an expensive-to-reverse decision, or multi-stakeholder alignment.
Skip straightforward low-risk work with an obvious approach and explain why an issue or short plan is enough.

Frame one solution-neutral engineering problem, affected users/operators, goals, non-goals, constraints, success signals, and open questions.
For independent decisions, propose separate RFCs and draft the highest-priority one.
Read actual code, repository rules, prior decisions, and current behavior before repository-specific claims.
Compare the smallest credible approach, the preferred approach, and materially different alternatives; do not invent straw men.

Apply upstream design reasoning only where relevant. Do not invent load, cost, numeric rollback thresholds, owners, or agreement to satisfy a template.
Preserve explicit unknowns, including TBD metadata, as unknowns rather than failing the artifact merely for not fabricating an answer.
Keep implementation detail in linked plans, schemas, and code reviews; explain boundaries, ownership, failure behavior, compatibility, rollout, rollback, observability, and validation at decision level.

### Local RFC artifact

Resolve the authoritative repository name from its remote. Write the RFC flat under `<<LLM_ROOT_FOLDER>>/plans/` as `<repo>-<feature>.rfc.md`, where `<feature>` is concise snake_case. If a matching plan already exists, reuse its stem. Never put the RFC in the repo unless repo rules or the user explicitly require that location.

Use this structure, deleting optional sections that add no decision value:

```markdown
# [RFC] <Outcome-oriented title>

Summary: <one sentence>
Created: <YYYY-MM-DD>
Status: Work in Progress
Owner: <name or TBD>
Contributors: <names or None>
Stakeholders: <roles or groups, not a distribution list>
Approvers: <names, roles, or TBD>
Target decision date: <YYYY-MM-DD or TBD>

## Overview

<One or two paragraphs stating intent without deep background or design detail.>

## Background

<Enough verified context for a newcomer; link rather than repeat prior material.>

## Problem

<Solution-neutral engineering problem and why it matters.>

## Goals

<Outcomes this RFC commits to.>

## Non-Goals

<Adjacent work explicitly excluded.>

## Proposal

<Top-down design, beginning with a diagram when useful.>

## User Experience

<Externally observable behavior and compatibility; omit when none.>

## Risks And Mitigations

<Technical, operational, security, privacy, cost, and delivery risks that apply.>

## Rollout And Rollback

<Phases, compatibility window, stop signals, and recovery path.>

## Validation

<Observable evidence that proves the proposal works.>

## Open Questions

<Only decisions still blocking approval or implementation.>

## Appendix

### Alternatives Considered

### Abandoned Ideas

### Decision And Review Log
```

Keep the main body under roughly three rendered pages. Cut repetition; move useful depth to the appendix. Add diagrams only when they clarify the decision.

### Self-review and handoff

- Check that newcomer can explain problem, chosen approach, major tradeoffs, failure modes, rollout, rollback, and proof of success after one read.
- Check each section earns its space and each linked claim resolves.
- Surface assumptions, open questions, requested reviewers, and target decision date in final response.
- During review, fold answers back into RFC so decision stays understandable without comment history. Record substantive decisions and rejected alternatives in appendix; do not preserve every conversational turn.
- Recommend synchronous discussion only when asynchronous review stalls, reviewers conflict, or one hard topic benefits from a short focused session. Capture attendees, decisions, and action items afterward.

## Safety

Never:

- Include secrets, private personal data, internal-only URLs, or confidential source text in a broadly shared RFC.
- Preserve company-specific names from reference material when producing a reusable template or example; use `Acme`, `Widget`, and generic roles.
- Claim approval, reviewer agreement, measurements, dependencies, or existing behavior without evidence.
- Hide breaking changes, destructive migration steps, irreversible decisions, or unresolved security and privacy risk in an appendix.
- Begin implementation, create branches, commit, publish, or send the RFC unless the user separately requests it.
- Expand one RFC into unrelated problems or implementation-level documentation.

Stop and ask when the proposal changes a public contract, requires a destructive or irreversible migration without an agreed recovery path, or depends on a product, policy, security, privacy, or cost decision the available evidence cannot resolve.

## Verification

Before reporting completion, quote:

- Absolute RFC path and line count.
- Repo files and sources read to support factual claims.
- Main-body length before `## Appendix` and whether it stays within the concise target.
- Searches for obvious confidential residue from supplied source material, including named organizations and internal-link patterns.
- Remaining assumptions, open questions, and unverified claims.
