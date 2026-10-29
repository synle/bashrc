[Sy] Generate the rules + map docs (AGENTS.md, ARCHITECTURE.md, DEV.md) for a repo that lacks them, by reading the actual codebase. Never invents conventions — every claim traces to a file.

Argument: $ARGUMENTS (repository and/or `rules`, `architecture`, `dev`, or `all`). Default to the current repository and all missing documents.

## Purpose

Read `<<LLM_ROOT_FOLDER>>/upstream/ADAPTERS.md` and `<<UPSTREAM_KHASKY>>/skills/awesome-agents-md-generator/SKILL.md` completely.
Use upstream mapping, command discovery, pattern mining, and verification for AGENTS.md; add the Sy architecture/developer-map outputs below.

## Steps

### Survey and rules

Resolve repository identity and scope, then apply upstream evidence gathering and its required pattern/format references.
Inspect real manifests, lockfiles, runtime pins, CI, formatters, test configuration, entry points, representative source, and history.
Report languages, frameworks, entry points, runner, package manager, CI, size, and monorepo scope before generation.

Generate only requested missing documents. Existing documents remain authoritative; propose additive changes instead of rewriting or selecting Refresh mode automatically.
Describe observed conventions, not aspirational ones. Report dominant forms with counts where appropriate.
Label uncertain inferences, especially observations from only two examples, and collect them under `## Confirm these`.

Verify commands against actual configuration. Run only safe bounded evidence checks; do not install dependencies, provision services, run migrations, or launch long-running processes.
Distinguish copied commands from commands actually executed. Unknown or expensive checks remain explicitly unverified.

### Architecture and developer-map extension

Upstream writes AGENTS.md only; this adapter separately produces the requested missing maps from the same verified survey.

- AGENTS.md owns operational rules, protected/generated content, conventions, validation, and compatibility constraints; link the maps instead of duplicating them.
- ARCHITECTURE.md explains the main flow, entry points, module boundaries, data/state ownership, integrations, extension recipes, and documented constraints.
- Trace architectural claims through source and cite `file:line`; use a diagram only when accurate.
- DEV.md records actual prerequisites, setup, run/build/check commands, one-test commands, debugging/log entry points, extension tasks, and known troubleshooting.
- Every developer command must exist in a manifest, task runner, CI definition, or existing documentation.
- Existing valid context bridges and distinct scoped guidance remain intact; do not create or replace compatibility files without the applicable authority.

## Safety

Never:

- Overwrite an existing document, invent a convention or command, flatten scoped rules, or use inference as evidence.
- Run destructive/slow commands merely to discover their behavior or execute upstream bootstrap/installation suggestions.
- Treat documentation generation as authority to commit, push, publish, or change trust settings.

Stop when repository scope changes the output materially, ownership conflicts, required evidence is unavailable, or a proposed convention needs an owner's decision.

## Verification

Check every referenced path and cross-link, every command's source, and the rules/maps for contradictions.
Report created files and line counts, convention evidence, unresolved inferences, missing information, and commands not run with reasons.
Do not claim generated documentation was runtime-validated when it was checked only by source reading.
