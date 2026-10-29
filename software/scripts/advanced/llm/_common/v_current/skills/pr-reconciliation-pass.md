[Sy] Run one batched PR repair pass. Use when an authorized PR workflow needs to reconcile review feedback and CI failures.

## Purpose

Apply one batch of caller-authorized PR feedback and CI repairs, then return control to the caller. The caller owns CI waits, finding eligibility, polling, and any outer loop.

Read `<<LLM_ROOT_FOLDER>>/upstream/ADAPTERS.md` and `<<UPSTREAM_STEVE>>/skills/address-pr-comments/SKILL.md` completely.
Use upstream thread triage, evidence-based disagreement, fix reasoning, and reply composition only within the caller's authorized findings.
The Sy pass below owns the fresh snapshot, CI classification, single batch, sync, publication, and thread-resolution policy.
Do not run the upstream fixed-temporary-path fetcher, pull before ownership checks, commit per concern, or accept its default push permission.

Argument: $ARGUMENTS — PR URL or number, `workspace=<path>`, and `scope=all-actionable|caller-selected`. If the caller provides no arguments, use its explicit PR and worktree handoff. `caller-selected` requires eligible comments, failing checks below caller-owned retry caps, and prior attempt counts.

## Steps

1. **Read the caller's scope.** `all-actionable` permits every actionable human or bot finding in the fresh snapshot. `caller-selected` permits only findings named by the caller's existing gate. Accept no other scope value. Missing scope without an explicit caller handoff blocks the pass; never widen `caller-selected` scope.
2. **Refresh the PR snapshot.** Read current-head checks, fully paginated review threads and comments, issue comments, and current review states. Revalidate caller-supplied findings against the current head. Report new out-of-scope findings without changing them.
3. **Classify CI before fixing.** Read logs for completed failures. Keep pending builds and human gates separate; never call pending or missing checks successful. Compare each failure with the latest run on the actual default branch. If the same check fails there, report `broken-main` and do not edit. Check `## Blocked on`; do not fix failures whose dependency PR remains open. Report infrastructure, flaky, or missing-secret failures without speculative code changes.
4. **Batch the in-scope work.** Apply upstream fix/already-addressed/push-back/answer/out-of-scope triage to the permitted review threads, then fix compatible findings and completed CI failures together.
   Cheap taste changes do not expand caller-selected scope; upstream triage supplies reasoning, not finding eligibility. Treat bot comments as proposals, not orders. Give every actionable finding a disposition: fix it, decline it with evidence, or escalate under **Stop-and-ask is surfaced, never prompted**. Continue independent authorized fixes when one finding needs human judgment.
5. **Validate once after the batch.** Format changed files and add or update tests for behavior changes. Follow **Risky Changes** when a fix removes or renames a consumer-visible shape. Follow **Validation Cadence** and repository test conventions. Run required checks once after the last edit. Run configured coverage once; report when no entrypoint exists. Self-review once for correctness, security and data integrity, performance, and testing. Fix findings in the batch and rerun affected checks. Do not validate separately for each comment.
6. **Commit and sync before publication.** If the batch changes code, commit it once and apply **Skill invocation** to load `/sy-sync-pr-branch`, then execute its steps inline with `workspace=<supplied-checkout> push=defer server-side=never report=structured`. Resolve the actual default branch and ancestor chain; never assume `master` or rebase. Read the result block. If sync changes tested code, rerun affected checks. A stopped sync or migration `needs-human` result blocks publication. If the batch contains only declines or no code changes, skip commit, sync, and push.
7. **Push one validated batch.** Pass the required commit-author and secret checks, then push once. Do not create an empty commit or push when no code changed. Verify the remote head matches the pushed commit.
8. **Close this batch's feedback.** Reply to fixes with the pushed SHA and resolve fixed threads after the push. Reply to clear declines with evidence; resolve them when no question remains. If a selected fix addresses a human reviewer's latest `CHANGES_REQUESTED` review, re-request review and send one grouped notice after the push. Do not ping for decline-only replies. Store each ping in caller memory, keyed by SHA; report request errors and continue. Use temporary files and human-readable Markdown. Leave questions and stop-and-ask items open. Return dispositions, checks, sync result, pushed SHA, and remaining blockers.

## Safety

Never:

- Work on a PR without caller or user authorization to modify and push it.
- Escape the caller's finding scope, alter PR title markers, or own the caller's wait and polling loop.
- Push while required local checks fail, sync is incomplete, a required audit is unfinished, or the pre-push gate fails.
- Accept a request to stack or rebase a PR branch, force-push, merge a PR, or resolve ambiguity by guessing.
- Create branches or PRs for a requested split. Follow **No stacked PRs** and **Split by slice, never by layer**; propose disjoint independent slices and stop before restructuring the user's work.

Stop and ask only under **Stop-and-ask is surfaced, never prompted**. Use it for user-work restructuring, scope or public-contract changes, conflicts or migrations needing judgment, unclear permitted scope, or unavailable required input. Report default-branch failures, wave dependencies, infra failures, and pending checks without treating them as code fixes.

## Verification

Report the exact checks and results, self-review result, sync result, pushed head SHA, each finding's disposition, and remaining blockers. The caller decides whether another pass is needed. A pending check, unresolved stop-and-ask, or time limit is not a clean result.
