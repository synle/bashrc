[Sy] Find code that changed without test coverage, ranked by risk, and write the missing tests. Not a coverage-percentage chase — targets the specific untested paths that matter.

Argument: $ARGUMENTS (optional — a PR number/URL, a commit range like `main..HEAD`, a path, or `staged` / `unstaged`. If empty, use the current branch versus its base.)

## When to use

- Before opening a PR, to find what you forgot to test.
- Reviewing a PR whose diff looks under-tested.
- After a bug escaped to production, to find its untested siblings.
- Auditing a module nobody trusts.

## Hard rules

- **Coverage percentage is a smoke detector, not a goal** (see the Test Quality rules). This command finds _untested behavior_, not uncovered lines. A file at 95% with its only error path uncovered is a worse risk than a file at 60% whose happy and error paths are both solid.
- **Never write a test purely to move the number.** A test asserting that a getter returns what was set is coverage theater — it costs maintenance forever and defends nothing.
- **Every test written here must be able to fail.** Verify it: break the code it covers, watch the test go red, restore. A test never seen red proves nothing (see the Test Quality rules).
- **Report gaps you chose not to fill.** A silent skip reads as "covered".

## Steps

### 1. Establish the change set

Resolve `owner/repo` first (see the Repo Identification rules).

```bash
git --no-pager diff --stat <base>...HEAD
git --no-pager diff --name-only <base>...HEAD
gh pr diff <n> --repo <owner/repo> --name-only     # when targeting a PR
```

Split the file list into **source** and **test** using the repo's own layout, not a guess (check the test config: `vitest.config`, `jest.config`, `pytest.ini`, `go` `_test.go` convention, `Cargo.toml`).

The first cheap signal: source files changed with **no** corresponding test file touched. Report that list immediately — it is usually most of the answer.

### 2. Find what actually runs the changed code

Coverage tools answer this precisely when the repo has one configured. Use the repo's existing command — never add a coverage tool that is not already there.

```bash
npx vitest run --coverage
npx jest --coverage --changedSince=<base>
pytest --cov=<pkg> --cov-report=term-missing
go test ./... -coverprofile=cover.out && go tool cover -func=cover.out
cargo llvm-cov
```

Then intersect: for each changed source file, which of its changed lines are uncovered. Changed-and-uncovered is the target set; unchanged-and-uncovered is pre-existing debt and belongs in a separate report, not this PR.

**No coverage tool configured?** Do not install one. Fall back to a call-graph read: for each changed function, grep for its name in the test tree. Absent means untested; present means _possibly_ tested — open the test and confirm it exercises the changed branch, not just the function's happy path.

### 3. Rank by risk, not by line count

Not all uncovered code deserves a test. Rank the gaps:

| Priority     | What                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Critical** | Trust-boundary validation, auth / permission checks, anything handling money, data-deletion or destructive paths, migrations    |
| **High**     | Error and failure paths, retry / fallback logic, concurrency and ordering, state transitions, the branches of a new conditional |
| **Medium**   | Business logic with real branching, parsing / serialization, boundary values (empty, zero, one, max, negative)                  |
| **Low**      | Straight-line orchestration already covered indirectly by an integration test                                                   |
| **Skip**     | Generated code, trivial getters/setters/re-exports, pure config, logging-only lines, framework glue with no logic               |

Error paths are the systematic blind spot: happy paths get written first and tested by hand, while the `catch` block that only fires in production is the code nobody ever ran. Weight them accordingly.

### 4. Report the gap analysis before writing anything

For each gap: file, function, what specifically is untested (branch / error path / boundary), the priority, and one line on the failure it would allow. Then state which you will cover and which you are deliberately skipping, with reasons.

This ordering matters — the analysis is useful on its own, and it lets the reader redirect before any test is written.

### 5. Write the tests

Follow the repo's existing test conventions exactly: file location, naming, fixture and factory helpers, assertion style, setup and teardown. A test that is technically correct but structurally foreign is a maintenance burden.

Apply the Test Quality rules to everything written here — behavior not implementation, literal expected values, one reason to fail per test, no logic in tests, don't mock what you don't own, deterministic.

For each test: name it after the behavior and the condition, cover the specific gap identified in Step 3 (not a broad re-test of what already works), and **verify it can fail** by breaking the code under test and watching it go red.

### 6. Validate

Run the new tests, then the surrounding suite for collateral damage, then the repo's gate once at the end — not after each file (see the Validation Cadence rules).

Re-run the coverage command and report the delta for the changed files only. Report it as evidence, not as the goal.

### 7. Report

- **Gap table** — every gap found, its priority, and its status: covered now / deliberately skipped / needs a human decision.
- **Tests added** — file, name, and the specific gap each closes.
- **Failure verification** — confirmation that each new test was seen red against broken code.
- **Coverage delta** on changed files, as supporting evidence.
- **Deliberately skipped**, with reasons — generated, trivial, or genuinely covered elsewhere.
- **Pre-existing debt** noticed but out of scope for this change, listed separately so it does not read as new.
- **Untestable as written** — any gap that could not be tested without a refactor. That finding is usually more valuable than the tests: code that cannot be tested is code with a design problem, and naming it is the first step to fixing it.
