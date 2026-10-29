[Sy] Systematic bug hunt: reproduce, shrink, bisect, then test one hypothesis at a time and prove the fix is load-bearing. Repo-, language-, and framework-agnostic.

Argument: $ARGUMENTS (optional bug, failing command, error, stack, or issue). If empty, ask for the symptom and triggering command.

## Purpose

Use the installed Superpowers systematic-debugging procedure rather than maintaining another debugging algorithm.
Read `<<LLM_ROOT_FOLDER>>/upstream/ADAPTERS.md` and `<<UPSTREAM_SUPERPOWERS>>/skills/systematic-debugging/SKILL.md` completely before acting.
Apply required references and sibling testing/verification skills through local file reads.

## Steps

Apply upstream investigation, pattern analysis, hypothesis testing, and root-cause implementation with these Sy additions:

- Capture the original command, exact first error and stack, expected versus actual behavior, environment, branch, dirty state, and last-known-good evidence.
- Redact secrets and personal identifiers before displaying evidence. Preserve diagnostic structure; never print a credential to keep an error “verbatim.”
- Record reproduction rate. Below roughly 90% reliability, stabilize nondeterminism before using history bisect.
- Shrink to one minimal failing input or command and record its runtime. Then binary-search history, code path, input, or configuration.
- When history has a known-good point, prefer scripted bisect; do not skip localization because a cause seems obvious.
- State each hypothesis and its disproof before changing one variable. Revert disproved changes.
- After three consecutive rejected hypotheses, verify the premise: running build, module, branch, baseline, test meaning, or environment.
- Fix the shared cause and affected siblings; explain why the defect reached main.

An obvious one-line compile error may use its failing command directly as the reproduction. Feature work is not a bug hunt; flakes still require investigation.

## Safety

Never:

- Patch without a reproduction, accumulate speculative changes, or hide an unexplained remainder.
- Add a retry, sleep, swallowed error, or weaker assertion in place of finding the cause.
- Destroy existing state to obtain a clean environment or run unreviewed upstream scripts.

Stop and report reproduction gaps when matching environments, failing-host probes, and safe clean-state reproduction cannot reproduce the failure.
Ask when isolation requires destructive work, secret access, unavailable input, or a decision outside authorized scope.

## Verification

Rerun the original command, not only the reduced reproduction. Show its actual output.
Remove only the fix, confirm the failure returns, restore it, and verify a regression test fails without the fix and passes with it.
Run surrounding checks and the repository gate under shared Validation Cadence; honor explicit execution limits and report incomplete proof.

Report: symptom, root cause with `file:line`, why it reached main, changed files, original before/after evidence, load-bearing proof, hypothesis table, and remaining unknowns.
