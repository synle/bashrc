# Risky Changes

Companion to the always-loaded engineering principles. Governs a change whose
blast radius reaches past the diff — a removal, a rename, a schema or data
migration, a dependency upgrade, a breaking contract change, a rollback. Read
before making one, then follow as written.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## Removals & deprecations

- **Removing anything is a downstream audit first, never a diff-local decision.** Before deleting or renaming an API, endpoint, route, response field, event, prop, config key, feature flag, env var, exported symbol, or column, enumerate every consumer across the whole stack — other services, the frontend, background jobs, scripts, other agents, infrastructure, dashboards, alerts, docs — and say where you looked and what you found. Applies fully when the removal is a side effect: an optimization dropping a "redundant" field, a refactor deleting an "unused" branch, a payload slimmed to cut bytes. The change that intends to remove nothing is the one that removes something nobody audited.
- **A green test suite is not that audit, and a passing build is not consumer coverage.** Tests only exercise the callers someone already wrote a test for, inside the repos they run in — a cross-service, cross-repo, or runtime-shaped consumer is invisible to all of them. Never argue from a green run to "nothing downstream broke"; that inference is a fabrication under Epistemic Honesty. Name the consumers you verified and how, or state the search was inconclusive.
- **Search the consumer, not the definition.** Grep every repo that could call it for the field name, the route path, the string literal, the config key — including dynamic access (`obj["field"]`, a serializer allowlist, a GraphQL query, a schema/type file, a fixture, an OpenAPI or proto spec, a saved query, a template). A symbol with zero hits in a language-server "find references" run is not proven unused; a cross-service consumer never appears in it at all.
- **Degradation is the failure mode to hunt for, not a crash.** A missing field routinely produces no error anywhere: a UI silently falls back to read-only, a control disables itself, a panel renders blank, a permission check reads `undefined` and denies, a default substitutes for a real value, a job skips a batch. Nothing throws, nothing turns a check red, and the regression is found by a user. Ask per consumer: what does this code do when the field is absent?
- **Uncertain means deprecate, never delete.** If a consumer cannot be reached, the search is inconclusive, or the field's users cannot be enumerated, keep serving the old shape: mark it deprecated, add the new shape alongside, log or measure remaining use, remove in a later PR once the old path is provably dead. Expand → migrate → contract applies to an API contract as to a schema.
- **Ship the audit with the change.** The PR body lists each consumer, its verdict (`updated in <link>` / `unaffected because <reason>` / `unreachable — deprecated instead`), and how the absent-field behavior was verified. A reviewer cannot re-derive that from the diff, which shows only what was deleted.

## Migrations & schema

- Every schema / data migration ships with its reversal — up migration → matching down/rollback migration in the same PR. Irreversible operations (`DROP COLUMN`, `DROP TABLE`, destructive backfills, type narrowing) require a `## Recovery` section in the PR body (backup restore, event replay, manual SQL). Review blocks on a missing down migration or undocumented destruction.
- Migration head stays single — after syncing, the PR's migration DAG has exactly one head descending from default. Re-parent (don't add a merge revision); never create a second head on main/master. `/sy-review-pr` warns about cross-PR migration conflicts; `/sy-babysit-pr` fixes them.

## Contracts & dependencies

- Breaking changes need a title flag and a migration note. Title prefix `BREAKING:` (or `feat!:` / `fix!:` under Conventional Commits). Body has a `## Migration` section with the minimum diff a downstream consumer must apply. Applies to removed / renamed exports, removed CLI flags, changed default behavior, schema deletions, env-var and config-key renames. Internal-only refactors aren't breaking.
- Production dependency upgrades require local-first verification. For any `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `Gemfile` / `requirements.txt` change crossing a major or minor version on a runtime dep: (1) read the changelog and link it in the PR body; (2) run the full local test suite before pushing; (3) pin the exact version on prod deps (no `^` / `~` / `>=`); (4) note deprecation warnings in the PR body. Patch bumps and dev-only deps may skip steps 1-2; lockfile-only refreshes skip entirely.
- Rollback PRs are emergency fast-track — skip babysit, ship immediately. Title: `Revert "<original PR title>"` (`gh pr revert` or `git revert <sha>`). Body links the original PR and the failure that triggered it. CI must pass green but the address-comments loop is skipped. Merge with `gh pr merge --squash` once green (low-risk, so ASK before `--auto`). Do **not** auto-trigger a release — releases stay a manual `/sy-release`. Rollback-of-rollback is allowed if the original revert proves wrong.
