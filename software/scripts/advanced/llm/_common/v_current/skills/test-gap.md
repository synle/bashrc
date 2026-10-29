[Sy] Find code that changed without test coverage, ranked by risk, and write the missing tests. Not a coverage-percentage chase — targets the specific untested paths that matter.

Argument: $ARGUMENTS (PR, commit range, path, `staged`, or `unstaged`). Default to the current branch versus its base.
An explicit `loop` token, optionally with `max=<n>`, selects the bounded task loop after discovery.

## Purpose

Read `<<LLM_ROOT_FOLDER>>/upstream/ADAPTERS.md`, `<<UPSTREAM_KHASKY>>/skills/awesome-test-gap-audit/SKILL.md`, and `<<UPSTREAM_KHASKY>>/skills/awesome-test-writing/SKILL.md` completely.
Compose two distinct phases: read-only discovery first, then writing tests for the authorized worklist. The audit alone never writes tests.

## Steps

### Discovery

Apply the upstream audit to the selected change set, not its default whole-repository scope.
Resolve repository identity and the actual test runner, source/test layout, collection globs, fixtures, and CI coverage.
Report changed source files without an apparent test change as leads, not proof of absent coverage.
Confirm coverage through imports, public entry points, assertions, and the changed branches rather than filename similarity.

Use an existing configured coverage command when authorized; never install a coverage tool.
Intersect coverage with changed lines and branches. Separate unchanged uncovered code as pre-existing debt.
Without configured coverage, read the tests reaching each changed behavior; a function-name hit proves only possible coverage.

Retain the Sy risk labels:

| Priority | Behavior at risk                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------- |
| Critical | Trust boundaries, authorization, money, deletion, or migrations.                                          |
| High     | Failure paths, retry/fallback, concurrency, ordering, state transitions, or new conditional branches.     |
| Medium   | Branching business rules, parsing, serialization, or boundary values.                                     |
| Low      | Straight-line orchestration already covered indirectly.                                                   |
| Skip     | Generated code, trivial getters/re-exports, pure configuration, logging-only code, or glue without logic. |

Before writing, report each gap's file, function, precise branch/condition, risk, possible failure, planned test, and deliberate skips.
The user's explicit target and approved worklist establish the test seams; ask only when the seam choice materially changes scope or a public contract.

### Writing

Apply upstream test-writing through the repository's existing public seams, runner, fixture isolation, and assertion conventions.
For every test, break the covered behavior or remove the fix, observe red, restore, and observe green.
Temporary mutations must be restored; report gaps requiring production refactoring rather than making unrequested production changes.

### Loop mode

Read `<<LLM_ROOT_FOLDER>>/skills/sy-loop/SKILL.md`. Pass the ranked gap list, Critical first, excluding Low unless requested.
One item is one gap with red/green proof. Use focused tests and remaining-gap enumeration as the check.
Keep pre-existing debt and new production refactors out of scope. Loop state replaces the one-sweep ledger, not the final skipped-gap report.

## Safety

Never:

- Write tests merely to move a percentage, treat execution alone as behavioral proof, or report a suspected gap as confirmed.
- Install a new runner, weaken assertions, change generated output, or silently expand the change set.
- Count a skipped, errored, or never-red test as new protection.

Stop for a scope/public-contract decision, unavailable required seam, destructive isolation, or an untestable design needing an unapproved refactor.

## Verification

Run the new tests, surrounding suite, and repository gate under shared Validation Cadence.
Rerun configured coverage when authorized and report changed-code line/branch evidence, not only project totals.

Report every gap and status, tests added, observed red/green proof, coverage delta or measurement gap, deliberate skips, pre-existing debt, and untestable behavior.
