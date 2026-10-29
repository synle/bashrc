# TODO: shell-agnostic scripts and validation

> **Optional, non-gating checks:** `make validate` runs these checks by default after required validation. Set `VALIDATE_SHELL_AGNOSTIC=0` to skip them.
> Failures print diagnostics and do not stop the rest of `make validate`.
> The checks are not part of `precommit`, `test_all`, or CI, and they never execute selected scripts.

## First pass — collect files, validate, and fix

Run this from the repository root:

```bash
make validate_shell_prep
# Direct collector: node software/tools/collect-shell-agnostic-files.js
```

The collector saves a JSON filename array in `shell-agnostic-files.txt` under the system temporary folder and prints its full path.
For `/tmp`, run `TMPDIR=/tmp make validate_shell_prep` and use the same `TMPDIR` for validation.
The selection includes tracked `.sh`, `.bash`, and `.zsh` files, excluding `.build/`, `dist/`, `coverage/`, and `.ps1.bash` templates.
It excludes `assets/fonts/install.sh` because that display file mixes Bash and PowerShell.
It also excludes `software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash` because the generator substitutes its placeholders before execution.
Untracked files are not included.

- [x] **Printf vs echo — first priority:** run `make validate_shell_prep`, replace applicable `echo` usage with fixed-format `printf`, then run `make validate_shell_agnostic_printf`.

  Command: `make validate_shell_prep && make validate_shell_agnostic_printf`

  Result:

  ```json
  {
    "ok": true,
    "rule": "printf",
    "checkedFiles": 127,
    "findings": []
  }
  ```

- [ ] **Quoting:** run `make validate_shell_agnostic_quoting`, fix applicable findings, and rerun.
- [ ] **Shell options:** run `make validate_shell_agnostic_options`, review option mutations, fix applicable findings, and rerun.
- [ ] **POSIX syntax:** run `make validate_shell_agnostic_syntax`, fix shared-code violations, and rerun.

All four rule targets, `make validate_shell_agnostic`, and `make validate_shell_agnostic_best_effort` read the saved list when `files` is omitted or empty.
The best-effort target runs printf, quoting, options, and syntax checks in order; it prints each failure and continues.
No shell variable or shared shell session is required; prep and validation use the same temporary-folder configuration.
The best-effort wrapper runs printf, quoting, options, and syntax rules in order, and prints each failure without stopping later checks.
The saved paths are relative to the repository root; run validators there and recollect after changing checkouts or tracked files.
The most recent collection replaces the shared temporary list.
A missing list reports the collection command; malformed or empty lists fail validation.
Preserve documented interpreter-specific adapters rather than removing required Bash or native zsh behavior merely to obtain a clean POSIX result.

## TLDR

Track shared-shell portability one code section at a time, starting with the optional validation commands below. Static checks find mistakes; later Bash/zsh behavior tests must establish runtime compatibility.

## Impact

- **Benefit:** measurable portability work with a repeatable validation gate instead of relying on prose alone.
- **Scope:** shared scripts, sourced helpers, generated shell content, and documented native adapters.
- **Relationship:** [the zsh migration checklist](TODO_ZSH_MIRATION.md) owns interactive adoption and the component inventory.
- **Status:** optional static targets are implemented; required CI enforcement, code migration, and runtime parity remain pending.

## Priority 0 — validate, fix, and revalidate

Use the four first-pass items above before broader migration work.
The reference below explains each optional target and how to override the saved list with an explicit `files` scope.

| Make target                       | What it checks                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `validate_shell_agnostic_printf`  | SC2059, SC3037, and AST detection of all literal `echo` commands, including simple `command`/`builtin` wrappers.         |
| `validate_shell_agnostic_quoting` | ShellCheck SC2086, SC2068, and optional SC2248 for quoted expansions and argv.                                           |
| `validate_shell_agnostic_options` | AST detection of direct `set`, `shopt`, `setopt`, and `unsetopt` option mutations or dynamic arguments requiring review. |
| `validate_shell_agnostic_syntax`  | POSIX parsing through shfmt and ShellCheck's non-POSIX diagnostic family.                                                |
| `validate_shell_agnostic`         | All four checks together.                                                                                                |

An explicit `files=` overrides the saved list and does not require collection.
This existing export-only partial provides a small smoke-check example:

```bash
make validate_shell_agnostic_printf files=software/scripts/bash-env-telemetry.profile.bash
make validate_shell_agnostic_quoting files=software/scripts/bash-env-telemetry.profile.bash
make validate_shell_agnostic_options files=software/scripts/bash-env-telemetry.profile.bash
make validate_shell_agnostic_syntax files=software/scripts/bash-env-telemetry.profile.bash
make validate_shell_agnostic files=software/scripts/bash-env-telemetry.profile.bash
```

A single path is literal, including spaces; multiple paths use a JSON array, not a shell-expanded list:

```bash
make validate_shell_agnostic_quoting files='["software/scripts/bash-env-telemetry.profile.bash","software/scripts/bash-base85.profile.bash"]'
```

The validator prints JSON with the selected rule, checked-file count, and located findings.
Analyzer failures appear in an additional `errors` array with the filename, code, and original diagnostic message.
The batch retains earlier findings and continues checking later files after an analyzer failure.
`checkedFiles` counts distinct attempted files, including files whose analysis failed.
A parser may report only its first syntax error within a rejected file; that file's policy findings remain incomplete.
Invalid scope, sensitive paths, and filesystem failures still stop validation immediately.
Its exit statuses are 0 for clean, 1 for findings, and 2 for invalid scope or unavailable analysis; Make reports failures as nonzero.
Any analyzer failure selects exit status 2, even when other files have findings.
Missing tools and invalid source never count as a successful validation.
File-based ShellCheck configuration is ignored for these focused checks; inline suppressions still require review.

- [x] Provide the four optional rule targets and their aggregate without changing existing gate dependencies.
- [x] Pass source to existing ShellCheck/shfmt analyzers rather than executing selected scripts or adding a parsing dependency.
- [ ] Select one bounded shared-code section and record its current behavior and interpreter classification.
- [ ] Run the relevant `validate_shell_agnostic_xxx` target and fix each reported finding in that section.
- [ ] Re-run the same target, then run `validate_shell_agnostic` on the same explicit files.
- [ ] Run the section's Bash/zsh behavior fixtures before marking the code portable.
- [ ] Record quoted results and exceptions, update that section's checklist, and move to the next section.

**Limits:** the `printf` check intentionally flags even literal-only `echo`; the options check conservatively reports mutations rather than proving restoration.
Unknown aliases, dynamic command names, `eval`, inline suppressions, and native zsh runtime semantics are not fully established by static checks.
`"$*"` can pass lint while changing argv; behavior tests remain required.
No automatic fixer, automatic package installation, or runtime script execution is included.

## How to track progress

Work through one section and one item at a time.
Check an item only after implementation and its acceptance evidence exist.
For each completed item, record the affected paths, exact check command, quoted result, and any remaining exception.
A documentation change, successful parse, skipped check, or advisory lint run does not establish runtime compatibility.

## 1. Classify code before changing it

- [ ] Inventory shared scripts, sourced helpers, shell emitted from JavaScript, and generated artifacts using the [existing component inventory](TODO_ZSH_MIRATION.md#component-inventory-and-required-work).
- [ ] Classify each entry as portable shared code, Bash-only provisioning, native zsh integration, or a separately justified interpreter-specific adapter.
- [ ] Record the interpreter used for execution and for sourcing; a shebang does not select the interpreter when another shell sources the file.
- [ ] Define how the validation gate selects files and generated artifacts; keep one authoritative classification inventory.
- [ ] Record current behavior with isolated fixtures before modifying legacy code.
- [ ] List intentionally deferred components and affected commands; do not describe an unaudited component as portable.
- [ ] Preserve the Bash 3.2 bootstrap requirement and existing standalone interpreter contracts.
- [ ] Define the actual supported shell/version matrix; do not promise untested sh, dash, or ksh compatibility.

**Section complete when:** every entry in the first migration batch has a classification, an owner, and an observable behavior check.

## 2. Establish the ShellCheck gate

### Current setup and gap

The existing `ci_test_shellcheck` target in [Makefile](Makefile) forces Bash mode, excludes `SC2086`, and treats ShellCheck findings as advisory.
Its separate Bash 3.2 textual compatibility check is already gating.
Those existing checks do not enforce the proposed portable-shell checklist.

Earlier local probes used ShellCheck 0.11.0 and shfmt 3.14.1.
Recheck installed versions during implementation instead of treating those observations as permanent version pins.

### Tool and dialect setup

- [ ] Inspect existing provisioning and CI tool installation before adding another installer or dependency.
- [ ] Ensure supported development and required CI environments provide the selected ShellCheck and shfmt versions.
- [ ] Record reviewed version requirements and use existing repository installation conventions.
- [ ] Check portable shared code with ShellCheck's `sh` dialect; retain Bash mode for classified Bash-only adapters.
- [ ] Keep native zsh code outside ShellCheck's supported-language claims; ShellCheck has no native zsh dialect.
- [ ] Lint actual generated shell artifacts as well as source scripts; do not mistake a JavaScript template for executable shell output.
- [ ] Keep generation and validation isolated from personal startup files, credentials, history, and live services.
- [ ] Make required tools, parse failures, and scoped lint findings fail the new gate rather than reporting success.
- [ ] Report the checked file/artifact count and explicit exclusions; a missing or unexpectedly empty scope must not masquerade as coverage.

### Required diagnostic coverage

- [ ] Enable `SC2086` for unquoted variable expansions in the portable scope; do not inherit the existing blanket exclusion.
- [ ] Enable `quote-safe-variables` for stricter quoting, including otherwise-safe variables; local probes reported `SC2248` for this case.
- [ ] Keep `SC2068` active for unquoted argument-array expansion such as `$@`.
- [ ] Keep `SC2059` active for variables used as `printf` format strings.
- [ ] Keep `SC3037` active in POSIX mode for unsupported `echo` flags such as `echo -e`.
- [ ] Review inherited and inline suppressions so that intended checks cannot silently disappear from the scoped gate.
- [ ] Add failing and passing fixtures for every enforced diagnostic before treating the gate as reliable.
- [ ] Keep deliberately invalid fixtures separate from the production-code lint inventory while still executing their negative tests.

Example commands for a future classified file named `shared-helper.sh`:

```bash
# Portable shared code. This example file is not part of the current checkout.
shellcheck --shell=sh --enable=quote-safe-variables shared-helper.sh

# A separately classified Bash-only adapter.
shellcheck --shell=bash bash-adapter.sh
```

These lower-level examples show the analyzer dialects beneath the optional Make targets.
Required CI integration remains a separate unchecked rollout item.

**Section complete when:** a known violation fails CI, its corrected fixture passes, and the gate reports its actual scope without suppressing these diagnostics.

## 3. Cover policy gaps with targeted checks

ShellCheck does not enforce the project's intent for strict-mode ownership or require `printf` for every output operation.
Local probes also accepted `"$*"` and an `echo` value resembling an option; green lint alone is insufficient.

### Parse commands rather than searching text

- [x] Evaluate the installed `shfmt --to-json` interface as the existing parser boundary before adding another parsing dependency.
- [ ] Parse the declared dialect and inspect command nodes; avoid regex-only checks that flag comments, strings, or inert heredoc data.
- [ ] Reject malformed or unsupported input explicitly instead of silently skipping it.
- [ ] Identify actual output commands, including straightforward `command` or `builtin` wrappers, when applying the reviewed `echo` policy.
- [ ] Document limits around aliases, dynamic command names, `eval`, and generated commands; do not claim complete static detection of dynamic execution.
- [ ] Add fixtures proving that executable violations fail while matching text inside comments, quoted data, and inert heredocs remains allowed.
- [ ] Return actionable diagnostics with the path, source location, failed condition, and suggested correction.

### Strict-mode and caller-option ownership

- [ ] Detect unapproved strict-mode boilerplate, including `set -eu`, `set -ue`, separate `-e`/`-u` options, and equivalent long-option forms.
- [ ] Check sourced helpers for caller-option mutations, including disabling options and relevant `set`, `shopt`, or native `setopt` operations.
- [ ] Define narrow exceptions for intentional option ownership, with justification and restoration checks on success and failure paths.
- [ ] Preserve intentional strict-mode behavior in standalone scripts when the script contract and tests justify it; do not delete all `set -eu` usage mechanically.
- [ ] Keep explicit checks for expected command failures; do not treat strict mode as a substitute for error handling.
- [ ] Test that sourcing and invoking shared helpers preserves the caller's option state under both Bash and zsh.

### Predictable output

- [ ] Adopt fixed-format `printf` for shared output; pass data through conversion arguments rather than treating data as the format string.
- [ ] Replace `echo -e` and implementation-dependent `echo` behavior in each migrated section.
- [ ] Decide whether stable literal-only `echo` calls remain allowed; encode the accepted boundary in the policy check and its fixtures.
- [ ] Test empty strings, leading `-n`/`-e`, backslashes, percent signs, newlines, and missing final newlines where byte preservation matters.

**Section complete when:** the selected policies have tested static checks, explicit limits, and runtime checks for caller-state and output behavior.

## 4. Review shared syntax and arguments section by section

### Portable syntax and interpreter boundaries

- [ ] Use a POSIX-compatible subset for shared logic: `[ ]`, `case`, `$(...)`, and `name() { ...; }` function definitions.
- [ ] Replace shared-code `[[ ]]`, shell-specific arrays, `${var/foo/bar}`, and shell-specific builtins unless an explicit native adapter owns them.
- [ ] Audit zero-based indexing, implicit scalar splitting, regex captures, function export, and collisions with native special parameters.
- [ ] Use `#!/bin/sh` only for fully POSIX standalone scripts validated under `sh`; do not blanket-convert Bash provisioning shebangs.
- [ ] Keep native completion, editing widgets, activation, and parent-shell state changes in the responsible adapters.
- [ ] Avoid globally enabling compatibility modes or falsifying `SHELL` to conceal unported code.
- [ ] Avoid sourcing the complete Bash interactive profile from zsh or from every preview callback.

### Quoting and argument forwarding

- [ ] Double-quote expansions where splitting or globbing could alter data; use the optional quoting diagnostic to enforce the stricter shared-code style.
- [ ] Forward argument lists with `"$@"` when preserving argv; do not substitute `"$*"` or an unquoted scalar command string.
- [ ] Implement intentional splitting and globbing explicitly, with equivalent behavior in both shells.
- [ ] Verify zero arguments, empty arguments, spaces, quotes, wildcard characters, backslashes, newlines, and Unicode data.
- [ ] Assert exact argument counts and values at the command boundary, not just successful exit status.

### Generated content and helper dependencies

- [ ] Review shell emitted from JavaScript and generated caches, not only files ending in `.sh` or `.bash`.
- [ ] Trace sourced dependencies and child callbacks so that portable wrappers do not conceal Bash-only helpers.
- [ ] Validate actual generated artifacts with their intended interpreters and relevant lint dialects.
- [ ] Keep native serialization and caches separate where the formats differ.

**Section complete when:** every changed shared helper passes syntax, static-policy, and observable behavior checks without widening native exceptions silently.

## 5. Build the Bash/zsh behavior matrix

- [ ] Use isolated HOME, history, cache, working folders, and startup configuration; do not exercise live user state.
- [ ] Record unavoidable global startup effects; an isolated `ZDOTDIR` does not suppress all system startup files.
- [ ] Run `/bin/bash -n` and the selected zsh interpreter's syntax check on the appropriate artifacts.
- [ ] Execute representative shared-helper fixtures under both Bash and zsh; parse success alone does not count.
- [ ] Test under `sh` when claiming POSIX support; add dash/ksh runs only when those shells are part of the declared support matrix.
- [ ] Compare stdout bytes, stderr, status, argv, working-folder effects, environment changes, and caller options against the accepted contract.
- [ ] Test success, expected failures, cancellation, repeated sourcing, and helper invocation with caller options both enabled and disabled.
- [ ] Include callback subprocesses and generated wrappers; test the interpreter that actually runs each child.
- [ ] Use PTY fixtures only for genuinely interactive behavior; keep slower native-process fixtures in the documented integration suite.
- [ ] Keep test source ASCII-only; represent Unicode cases with escapes or constructed bytes.
- [ ] Prove fixtures reject the relevant broken behavior before accepting their green results.

**Section complete when:** each first-batch shared entry has passing behavior checks under every declared interpreter, with skips and unsupported paths reported separately.

## 6. Migrate one code group at a time

Use the [zsh component inventory](TODO_ZSH_MIRATION.md#component-inventory-and-required-work) rather than maintaining another file list here.
A Bash-only component can remain classified as a native adapter; this checklist does not require rewriting the entire repository to POSIX.

- [ ] Select the first bounded group and record its current commands, inputs, outputs, and consumers.
- [ ] Land its missing behavior fixtures and lint-policy fixtures before structural changes.
- [ ] Apply only that group's portability changes and preserve its public command and output contracts.
- [ ] Audit consumers before removing or renaming commands, aliases, fields, or configuration.
- [ ] Run the scoped lint, policy, and behavior checks; record exact output and unresolved gaps.
- [ ] Update the owning component's checklist entry and its evidence before starting the next group.
- [ ] Repeat for the next group without treating an earlier batch's success as proof for unexamined code.

## 7. Roll out enforcement without hiding the backlog

- [ ] Introduce the validated gate for explicitly classified shared/new code before expanding its scope.
- [ ] Integrate with the repository's existing Makefile and CI ownership; choose the appropriate local validation rung rather than adding duplicate orchestration.
- [ ] Keep the existing Bash 3.2 guard active and regression-test changes to its surrounding target.
- [ ] Retain the legacy advisory ShellCheck path until its findings are audited; do not promote the entire backlog to a failing gate blindly.
- [ ] Replace blanket suppressions in migrated scope with narrow, justified exceptions only where necessary.
- [ ] Verify a nonzero lint, parser, policy, or behavior result fails the required gate instead of being swallowed by `|| true` or an advisory message.
- [ ] Verify missing tools and unsupported dialects are reported as blocked or unsupported, never silently passed.
- [ ] Record checked-file counts, exclusions, failed findings, and skipped checks in CI output.
- [ ] Add editor integration only after the same configuration is authoritative in CI.

**Section complete when:** CI demonstrably blocks an introduced violation in scoped code and reports legacy exclusions without obscuring them.

## 8. Completion evidence

- [ ] Every migrated item has an owner, classification, source paths, and its behavior contract.
- [ ] ShellCheck and the targeted policy checker cover the agreed portable scope with no unexplained suppressions.
- [ ] Bash/zsh behavior fixtures pass; additional shell claims have corresponding executed checks.
- [ ] Required commands preserve argv, output bytes, status, parent-shell effects, and caller options.
- [ ] Generated artifacts and callback boundaries have been validated through their actual consumers.
- [ ] Remaining native adapters, deferred components, unsupported cases, and skipped checks are explicit.
- [ ] Changed-code line and branch coverage meets the applicable floor where measurable; unavailable shell metrics are disclosed rather than inferred from JavaScript coverage.
- [ ] Follow the repository's [validation cadence](./AGENTS.md) for implementation checks; use documentation-only checks for edits confined to these TODO files.
- [ ] Record rollback for each implemented batch, preserving unrelated work and persistent user data.
- [ ] Update the relevant checklist items only after reviewing the recorded results against their acceptance conditions.

## Evidence record for a completed item

Copy this record beside the completed item when implementation begins:

```text
Item:
Owner:
Classification and interpreter matrix:
Changed source and generated artifact paths:
Accepted behavior and deliberate exception:
Lint command and quoted result:
Policy-check command and quoted result:
Runtime command(s) and quoted result(s):
Failed, skipped, unsupported, or deferred checks:
Consumer audit and rollback:
```

## References and limits

- [Current shell-lint target and advisory behavior](Makefile)
- [Repository testing and development map](DEV.md)
- [SC2086: unquoted variable expansions](https://www.shellcheck.net/wiki/SC2086)
- [SC2068: unquoted argument-array expansions](https://www.shellcheck.net/wiki/SC2068)
- [SC2059: variable format strings](https://www.shellcheck.net/wiki/SC2059)
- [SC3037: non-POSIX echo flags](https://www.shellcheck.net/wiki/SC3037)

All unchecked entries describe future implementation or verification.
Optional static targets and their native-analyzer fixtures are implemented alongside this checklist.
Required CI enforcement, full policy coverage, the application runtime matrix, script conversion, and shell migration remain open work.
