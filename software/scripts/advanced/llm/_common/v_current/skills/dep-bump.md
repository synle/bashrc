[Sy] Upgrade dependencies safely with changelog review, exact production pins, and recorded deprecations. Use the shared fast-track path for eligible early PR publication; complete required verification afterward.

Argument: $ARGUMENTS (package names, `outdated`, `security`, or `patch` / `minor` / `major`). If empty, survey and propose.
An explicit `loop` token, optionally with `max=<n>`, selects the bounded task loop after the initial survey.

## Purpose

Read `<<LLM_ROOT_FOLDER>>/upstream/ADAPTERS.md` and `<<UPSTREAM_KHASKY>>/skills/awesome-dependency-upgrade/SKILL.md` completely.
Use its inventory, changelog-driven migration, lockfile review, verification, and rollback procedure with these Sy policy differences.

## Steps

- Resolve repository identity, discover the existing package manager, and survey resolved versions, advisory status, production/development class, target versions, and declarations.
- Report the inventory and proposed order before editing: advisories first, then isolated majors and production minors, then eligible patch/development batches.
- Use the upstream upgrade procedure. Do not adopt release-age cooldowns unless the repository or user requires them; preserve existing priority by advisory impact and migration readiness.
- Pin production dependencies exactly. A lockfile does not replace the declaration pin.
- Every major gets its own commit and PR when publication is authorized. Every production minor gets its own commit; batch only patch-level or development-only changes.
- Read and link every intervening major or production-minor changelog and migration guide. Patch/development changelogs may be skipped; lockfile-only refreshes skip bump-specific review, not repository checks.
- Find actual affected consumers for removals, renames, changed defaults, and behavioral changes. Apply migration steps with the bump, never as an unspecified follow-up.
- Record new deprecations and peer warnings verbatim, with applicable fixes or explicit deferred risk.

### Verification and publication differences

Use `<<LLM_ROOT_FOLDER>>/instructions/pr-workflow.md` for Execution routing, Fast-track PRs, and publication permissions.
Eligible early publication may precede optional setup and local verification, but never required repository gates or safety checks.

Verification covers a locked clean install in an isolated environment, build, type-check, full suite, and an application smoke path using the dependency.
Reuse caches; do not erase existing environments or global caches. Capture warnings and distinguish baseline failures from bump failures.

Local-only work never publishes. Authorized PRs include versions/class, reason, changelog links, applicable breakage and consumer evidence, migration, warnings, actual checks, and rollback limits.
Use `BREAKING:` only for changes observable by this repository's consumers.
Automerge is opt-in, offered once for dependency-only work, never for a major; upstream bot-PR defaults grant no permission.

### Loop mode

Read `<<LLM_ROOT_FOLDER>>/skills/sy-loop/SKILL.md` and hand it the proposed commit-sized units, with advisories first.
One unit is one major, one production minor, or one eligible batch. Excluded bumps stay out of scope.
Use the full suite and the in-scope outdated/advisory enumeration as proof. Changelog, pin, warnings, and verification requirements remain unchanged per unit.

## Safety

Never:

- Upgrade as a speculative bug fix, force peer resolution, hand-merge lockfiles, or silently change runtime/language versions.
- Execute lifecycle scripts, codemods, release/publish workflows, or irreversible data changes without the applicable source review and authority.
- Force-push, enable automerge, or publish because an upstream skill suggests it.

Stop for a runtime/language change or an undocumented migration requiring judgment.
Fix or safely reverse a failed unit; report a blocker instead of carrying an unexplained red upgrade forward.

## Verification

Report upgraded, pinned, deferred, and rejected candidates; applicable breaking changes; recorded deprecations; exact checks and results; smoke-path evidence; rollback limits; and remaining risks.
Honor execution limits and never present skipped verification as passed.
