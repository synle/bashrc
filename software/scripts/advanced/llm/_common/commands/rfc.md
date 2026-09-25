[Sy] Draft a concise, evidence-based RFC for a nontrivial feature or implementation before code changes begin. Use when a decision carries meaningful complexity, risk, cost, or cross-team coordination.

Argument: $ARGUMENTS (topic, request, issue, or existing notes. If empty or unexpanded, use current conversation; if that still lacks a concrete decision, ask for the problem and stop.)

## Purpose

Create one decision document that helps reviewers align on a hard-to-reverse change, expose technical and operational risk, and understand implementation direction. An RFC captures why and what at design level; it does not replace product requirements, code review, API schemas, or an implementation plan.

Use an RFC when at least one condition holds:

- Technical complexity spans components or requires non-obvious tradeoffs.
- Failure, migration, security, privacy, operational, or cost risk is meaningful.
- A decision will be expensive to reverse.
- Several stakeholders need alignment before implementation.

Skip an RFC for straightforward, low-risk work with an obvious approach and few collaborators. Say why a shorter issue or implementation plan is enough instead of manufacturing complexity.

## Steps

### 1. Frame one decision

- State one engineering problem, affected users or operators, constraints, and decision needed.
- Separate verified facts from assumptions. Read repo rules, architecture docs, prior decisions, relevant code, and current behavior before making repo-specific claims.
- Keep product requirements and UI specifications linked or summarized only as constraints. Do not turn them into the engineering problem.
- Name goals, non-goals, success signals, and unresolved questions. Do not anchor the problem statement to a preferred solution.
- If the request combines independent decisions, propose separate RFCs and draft only the highest-priority one.

### 2. Compare viable approaches

- Identify the smallest credible approach, the preferred approach, and any materially different alternative.
- Compare only decision-driving tradeoffs: correctness, complexity, reversibility, compatibility, security, privacy, operability, observability, performance, cost, and delivery risk.
- Pick one approach and state why evidence favors it. Move detailed comparison and abandoned ideas to the appendix.
- Mark unknowns honestly. Never fabricate measurements, links, consumers, constraints, owners, or consensus.

### 3. Explain the proposal top-down

- Start with a small Mermaid or ASCII diagram when multiple components interact. Introduce every component name before using it as a subsection.
- Describe boundaries, data flow, state ownership, failure behavior, compatibility, migration, rollout, rollback, observability, and validation at the level needed to judge the design.
- Name implementation surface areas, not line-by-line details. Omit full code, schemas, resource manifests, and exhaustive API definitions; those belong in implementation and code review.
- Add user experience only when callers, operators, API clients, configuration users, CLI users, or UI users observe a change.
- Use prose to introduce every list, table, and figure. Keep terminology and subsection names consistent.

### 4. Write the artifact

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

Keep main body under roughly three rendered pages before appendix. Cut repetition first; move useful depth to appendix. Prefer one diagram over several paragraphs, but never add a decorative diagram.

### 5. Self-review and hand off

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
