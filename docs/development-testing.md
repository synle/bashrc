# Development testing and Make targets

[Developer guide](../DEV.md). Run repository commands from the checkout root.

## Testing

Suites are split across dedicated Vitest configs so each can run independently:

```bash
make test_unit             # fast unit/convention and short isolated subprocess specs
make precommit             # lint + complete default unit suite, quiet output
make test_coverage         # Unit tests + istanbul coverage report
make test_profile          # bash -n syntax checks for assembled profile scripts
make test_integration      # native-process checks + browsers and URL checks against the live deploy
make test_integration_local # native-process checks + browsers against ./dist
make test_buildconfig      # Inline-snapshot shape checks for generated configs
make test_dryrun           # Dry-runs every JS script; asserts no writes / clean stdout
make test_all              # unit + profile + live integration + buildconfig + dryrun + shellcheck; no coverage
make validate              # full local gate; routine agent work leaves heavier suites to CI
```

`make precommit` uses dot reporting and shows console logs only for failing tests; direct subprocess or stderr output can still appear.
Only precommit filters raw `>>> Decky ` progress lines from stderr; other diagnostics and the test exit status remain intact.
`npm test` and `make test_unit` retain verbose unit output. `make validate` additionally runs local integration; `make precommit` never runs integration.
Format changed files separately before committing.

Audited tmux, autocomplete VCS, Git/Delta, Vim, and fuzzy-navigation specs live under `software/tests/integration/`.
Both integration configurations load the shared VM setup and cap workers at two. Only the live configuration includes `rawUrls.spec.js`.
Moving these tests separates the gates; it does not repair their resource isolation or subprocess deadlines.

Run a single spec or filter by test name:

```bash
npx vitest run --config vitest.config.js software/tests/parseRawArgs.spec.js
npx vitest run --config vitest.config.js -t "parses --files flag"
```

### Inline snapshots

Prefer `toMatchInlineSnapshot` for stable structured output instead of `toMatchObject`, external `toMatchSnapshot`, or bulky literal-object assertions.
Snapshot only relevant fields and normalize nondeterministic values such as temporary folder names.
Keep explicit assertions for scalar values, predicates, absence, and round-trip behavior when they communicate intent better.
Use distinct snapshot locations when parameterized cases produce different output.

Use inline snapshots for stable arrays and ordered field projections, including short title or command lists.
Replace incidental collection counts with snapshots of the relevant collection, not snapshots of `.length`.
When a complete collection snapshot already exists, remove its redundant count assertion.
Preserve explicit limits, byte/width contracts, rejection/no-effect checks, and equality to original inputs or previous outputs.
Sort inventory or set-like arrays before snapshotting; sort projected records by their stable identity key without mutating the source collection.
Preserve meaningful order for source lines, navigation, command arguments, ranking, and execution sequences.

For example, snapshot `blocks.slice(-4).map((block) => block.title)` instead of comparing it with a handwritten title array.
An existing `expect(blocks).toMatchInlineSnapshot(...)` already checks the block count, contents, and order.

Refresh existing inline snapshots with Vitest's one-shot update mode:

```bash
npm run test:update -- software/tests/piSettingsDeployment.spec.js # one spec (preferred)
npm run test:update                                             # all default-suite snapshots
npm run test:buildconfig:update                                 # generated-config snapshots, separate suite
npm run resetTestSnapshots                                      # unit + profile + buildconfig + live integration
make resetTestSnapshots                                         # proxy for the all-suite npm command
npm run resetTestSnapshots:unit                                 # default unit suite
npm run resetTestSnapshots:profile                              # assembled profile suite
npm run resetTestSnapshots:buildconfig                          # generated-config suite
npm run resetTestSnapshots:integration                          # native + live browser/URL integration
npm run resetTestSnapshots:integration:local                    # native + local browser integration
```

The all-suite reset runs sequentially and stops on the first failed suite.
Live integration covers all integration specs; the local variant excludes live URL reachability and requires an existing webapp build in `dist/`.
Profile and build-config suites require their existing generated artifacts.
Pass a spec filter to a type-specific command with `-- <spec>`.

**Actions → Reset Inline Snapshots → Run workflow** provides the manual default-branch repair path.
Select the repository default branch (`main` or `master`); dispatches on other branches skip the refresh job.
The action installs locked dependencies and Chrome, restores published Ubuntu/macOS profiles, and calls `npm run resetTestSnapshots`.
It then reruns all four suites without update mode; a failed suite or missing required release asset prevents publication.
Generated configuration inputs come from the checked-out default branch, while profile inputs come from the current `binary-cache` release.
Only changed tracked `software/tests/**/*.spec.js` files enter the repair commit; generated artifacts remain outside the pull request.
Each changed run opens a regular pull request from `automation/reset-inline-snapshots-<run-id>-<attempt>` against the detected default branch.
An unchanged run creates no remote branch or pull request.

Repository Actions settings must allow GitHub Actions to create pull requests.
The action uses `GITHUB_TOKEN`; GitHub may require **Approve workflows to run** on the generated PR before its CI starts.
Review every changed expectation against intended behavior before merging; this action does not diagnose regressions or merge its PR.
If PR creation fails after the push, the run log retains the branch name for manual recovery.

When adding a test suite type, follow `AGENTS.md` → Snapshot command parity in the same change:

- Add `resetTestSnapshots:<type>` to `package.json`, invoking that suite with snapshot update mode.
- Include its snapshot coverage in `resetTestSnapshots`; an existing equivalent suite may cover an alternate execution mode without duplicate execution.
- Keep `make resetTestSnapshots` delegating to `npm run resetTestSnapshots`.
- Document the command, required artifacts or services, and any alternate mode covered by an equivalent suite here.

These commands rewrite expectations in test source; they do not delete tests or reset fixtures.
Inspect every snapshot diff against the intended behavior, then rerun without update mode before committing.
Never accept updated snapshots merely to silence a regression.

Browser integration specs live in `software/tests/integration/webapp/` without a filename prefix.
`app.spec.js` snapshots all trimmed command labels with an explicit Mac browser model; `navigation.linux.spec.js` separately checks Ubuntu-first Linux ordering.
Each `commands.<name>.spec.js` clicks its command and snapshots every direct main-body child, including their exact count and order.
Content entries snapshot the banner title and MD5 of rendered `innerText.trim()`; link groups retain nested labels and literal `href` values without URL hashing.
Hidden form-data children remain counted and fingerprinted by their IDs. Browser platform and viewport are fixed for reproducible OS warnings and layout.
Snapshots describe the current collapsed UI, not complete downloaded source files. Published profile headers and fetched content changes require intentional review.
The SteamOS command spec serves its setup script from the real checkout while retaining other downloads, so unpublished edits cannot fingerprint an older remote script.
It explicitly normalizes the formatter-sensitive hidden-line count, then expands the block and verifies the complete source exactly.
Other ordinary source titles retain literal line counts unless their caller explicitly opts in; generated-header date normalization remains limited to generated artifacts.
The Windows command currently records a missing published Windows Terminal artifact as an explicit error-state snapshot, not successful source loading.
Local integration serves actual published profiles when the webapp-only build omits them.
If Pages returns HTTP 404, it loads the corresponding canonical `binary-cache` release asset under the same request deadline and content checks.
Other HTTP failures remain errors; no synthetic profile content is substituted.

```bash
npm run test:integration:local -- --update=all software/tests/integration/webapp/commands.wsl.spec.js
npm run test:integration:local -- software/tests/integration/webapp/commands.wsl.spec.js
```

Review every refreshed title, MD5, URL, count, and error state; rerun without update mode before accepting the change.

### Vitest configs

One config per suite:

| Config                               | Suite                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `vitest.config.js`                   | Fast unit suite; excludes integration, profile, and buildconfig specs; shared VM setup; 30s timeout |
| `vitest.profile.config.js`           | `profileSyntax*.spec.js`                                                                            |
| `vitest.buildconfig.config.js`       | `buildConfigShape*.spec.js`                                                                         |
| `vitest.integration.config.js`       | `integration/**/*.spec.js`: native subprocesses, live browsers, and URL reachability                |
| `vitest.integration.local.config.js` | Native subprocesses and local browsers; excludes live URL reachability                              |

`software/tests/setup.js` loads `index.js` in a VM sandbox — reach in with
`getIndexFunction(name)` / `getIndexConstant(name)`; `fileSystem` and `fetchResponses`
give in-memory mocks, auto-reset in `beforeEach`.

### Installer fixture isolation

The VM setup is not a complete filesystem sandbox.
`software/tests/setup.js` starts `mockFs` from the real `fs` module, then overrides selected operations.
Its `copyFileSync` override keeps `/Applications/` fixture copies in `fileSystem`; other paths fall through to real filesystem copying.
Keep mocked source bytes and existence records inside the fixture; a missing mocked application source must fail rather than read installed host resources.
Audit every filesystem and process seam used by a new installer fixture instead of assuming all operations are intercepted.

Use isolated temporary roots for real native-process fixtures.
Do not write into host installation or user-configuration folders to make a unit test pass.
`software/tests/macBrowserLaunchers.spec.js` demonstrates in-memory browser bundles, icons, and ownership checks.

### Test organization and execution

When you add a `.sh` file, register it in `profileSyntax.spec.js`. When you touch
`software/index.js` or `software/tools/build-include.js`, add or update unit tests.
Keep every test spec at **300 lines or fewer**. If a spec grows beyond 300 lines,
split it by behavior into independently named `*.spec.js` files; never use numeric
`partN` names. Place the audited native-process suites under `software/tests/integration/`; the default unit configuration excludes that tree.
Integration covers native Git/Delta, Vim, tmux, fuzzy-navigation, autocomplete VCS, browser behavior, and live URL reachability.
Keep short configuration checks together, and split expensive behavior into independently scheduled files.
The Git-default specs copy a private prepared repository per case; copies do not share mutable Git state.
Before changing convention-specific behavior, read Enforced conventions below for the invariant and owning spec.

The unit runner caps file-level Vitest fork workers at two so native fixtures retain their existing deadlines under load.
Keep tests independent:
own fixtures and temp folders, no shared mutable state, no order assumptions. Use
`describe.concurrent` only when a suite has no shared process or filesystem state.

If a native subprocess times out only during the parallel suite, reproduce its spec alone before changing code or timeouts.
A diagnostic complete-suite run can use fewer workers:

```bash
npm test -- --maxWorkers=1
```

Keep the original failure evidence. A passing isolated spec does not prove the full suite passed.
Native Vim plugin integration is opt-in through `BASHRC_VIM_PLUGIN_ROOT`; an unset variable skips those cases, not the ordinary Vim probes.

Ordinary map/documentation edits need scoped formatting, link/source verification, and diff review rather than runtime provisioning.
Shared instruction/skill changes also need registry/budget checks and deployment verification from `AGENTS.md` §13.3.

Executable scripts may use `.personal.js` / `.personal.sh` or `.work.js` / `.work.sh`.
Discovery and explicit `--files` / preset runs enforce the active `is_work_profile`;
same-name variants run common → personal → work. These suffixes do not apply to profile
partials, PowerShell templates, `.common.*`, or other SOURCE files.

**VS Code debugging:** `.vscode/launch.json` has configs for the current script (via
`software/.debug-runner.js`) and for Vitest.

### Enforced conventions

These convention-specific requirements supplement `AGENTS.md`; read the relevant entry before editing its source or test.
Spec stems and families are relative to `software/tests/`, with `integration/` shown where applicable.

- **`sectionMarkerStyle`** — No line that is solely 3+ `/` in js/ts/jsonc; no `# ---- Title ----` in sh/bash. Use `// --- Title ---` / `# --- Title ---`.
- **`pathArrayValidation`** — `_X_PATHS` constants in `advanced/*.common.js` must be nonempty string arrays.
  Each entry starts with `/`, `~`, or a drive letter.
  Reject extglob prefixes, NUL, CR, LF, and TAB; rendered arrays must pass `bash -n`.
- **`mirroredFunctionParity`** — `is_help_arg`, `get_native_arch`, `is_arch_translated`, `run_native`, `prompt_yes_no` must be **byte-identical** between `profile-*.sh` and `common-functions.bash`. Change one → change both.
- **`guiDetection`** — `_detect_gui_flags` replayed against fake env: flags always `0`/`1`, ssh forces `is_gui=0`, mac/windows always GUI, no other flag leaks. Add a case whenever you touch display detection.
- **`requiredBinariesNotInBackground`** — No `required` binary may use `install*PackageInBackground`; see `AGENTS.md` §8.
- **`fzfTerminalSafety`** — `_fuzzy_list_all`'s node call needs `< /dev/null` and `2> /dev/null`; `_fzf_info_line` must be `export -f`'d; every `--prompt=` has a matching case arm.
- **`curlWrapperFormat`** — `profile-advanced.sh` `curl()` wrapper: formatter dispatch + per-day HAR capture into `$BASHRC_CURL_HAR_FOLDER/mm-dd-yyyy.har`.
- **`editorKeybindings`** — No duplicate keybinding within a context across VS Code / Sublime / Zed sources.
- **`editorThemes`** — Bind color markers to `COLOR_MAP`; resolve every `var()`; preserve contrast floors, monotonic ANSI ramps, and structurally identical dark/light shapes.
  Re-measure the installed VS Code base theme because `tokenColorCustomizations` merges rather than replaces base tokens.
  No unclaimed scope may fall below 7:1.
- **`terminalThemes`** — Bind terminal palettes to `COLOR_MAP`, never app-local literals.
  Ghostty (`theme/sy/ghostty_{dark,light}.jsonc`) and Termux (`theme/sy/termux_{dark,light}.jsonc`) markers must stay bound.
  Include all 16 ANSI slots with legible, monotonic ramps; `termux-config.sh` must not resume writing `colors.properties`.
- **`autocompleteSpecValidation`** — Every `specFile` exists, every spec file is referenced, commands sorted alphabetically, dynamic tokens from `DYNAMIC_TOKENS`.
- **`generateCiBinaryList`** — `ci-binaries.json` invariants + the `action.yml` block is regenerated (`make format_ci_binaries`).
- **`gitWorktreePath`** — Exercise `worktree-path` and `create-worktree` against a temporary repository, fake origin, and fake `$HOME`.
  Layout is `$HOME/.worktrees/<owner>/<repo>/<sanitized-branch>`; derive owner/repo from the remote, never the folder name.
  The branch slug replaces everything outside `[A-Za-z0-9._-]`.
  Stdout contains only the path; never return the primary checkout or `-B`-reset a branch with unpushed commits.
- **`gitAliasResolution`** — Every `git.gitconfig` alias (incl. generated numbered ones) resolves to a real alias or git command; no unquoted `$(...)` argument, `awk`-split worktree path, or unquoted `%(...)` placeholder.
- **`presets`** — `presets.jsonc` parses, `lightweight` exists, every preset has non-empty `files[]` or `presets[]`, no self/transitive cycles.
- **`profileSyntax`** — Generated profiles must pass `bash -n` under PATH Bash and the oldest local Bash (`/bin/bash`, 3.2 on macOS).
  Preserve size floors, unique BEGIN/END keys, standalone block parsing, clean sourcing including `CLAUDECODE=1`, and deduplicated PATH with `/usr/bin` and `/bin` intact.
  Lint all shell files for nested command-substitution heredocs and `&>>`; see `AGENTS.md` §8.
- **`profileShellSyntax`** — Recursively check `*.profile.bash` and `*.bash` under `software/scripts/` and `software/bootstrap/`, excluding `.ps1.bash`.
  Files must pass `bash -n` under PATH Bash and the oldest local Bash.
  Keep these checks in the fast default suite without requiring `.build/`.
  Catch partial-edit failures such as deleting `function foo() {` while leaving its body and orphaned `}`.
- **`filterFilesByOsGuard`** — Explicit `--files=` entries in an inactive OS folder are dropped, not run.
- **`osDetection`** — Replays `_detect_os` against fake `/etc/os-release` + `/proc/version`; asserts no other distro flag leaks. Add a case whenever you touch OS flags.
- **`integration/rawUrls`** — Every `getGitHubRawUrl` / `get_github_raw_url` URL resolves; webapp uses the CORS-safe raw form.

### Coverage

Istanbul provider via `@vitest/coverage-istanbul`. Thresholds, globs, and rationale live in `vitest.config.js`; do not duplicate numbers here.
Its explicit JavaScript allowlist does not measure bash helpers or every installer script.
Subprocess tests can verify shell behavior without providing shell line/branch percentages; report that measurement gap instead of claiming the coverage floor passed.

## Make Targets

```bash
make init                  # npm ci + mkdir .build
make setup                 # = setup_local_full → ./run --setup --force
make setup_local_profile   # profile refresh only, no dep install
make setup_prod            # bootstrap from GitHub
make format                # build_include → ci_binaries → script_indexes → jsdocs
                           #   → spec_cleanup → shell (shfmt) → oxfmt → autocomplete specs → build_android
make format_build_include  # process BEGIN/END markers
make format_ci_binaries    # regenerate the ci-binary-checks block
make build_all             # configs, hosts, webapp, postbuild
make build_installer       # .build/install-bashrc.sh self-extracting installer
make build_android         # docs/android/build/{android,firetv}_{debloat,restore}.sh standalone host scripts
make test_unit             # vitest, vitest.config.js
make precommit             # lint + complete default unit suite, dot reporter and failing-test console logs
make lint                  # oxlint correctness pass (.oxlintrc.json)
make validate_shell_prep # save tracked shell sources to a temporary JSON list
make validate_shell_agnostic_printf # fixed-format printf / echo rule
make validate_shell_agnostic_quoting # quoting rule
make validate_shell_agnostic_options # option mutation rule
make validate_shell_agnostic_syntax # POSIX syntax rule
make validate_shell_agnostic # aggregate all four rules; files=<file> overrides
make validate_shell_agnostic_best_effort # all four rules; non-gating
make test_coverage         # + istanbul; thresholds live in vitest.config.js
make test_profile          # bash -n / profile invariants
make test_buildconfig      # inline-snapshot shape (…_update to refresh)
make test_integration[_local] # native-process checks + browsers (live / local dist)
make test_dryrun           # run.sh --dryrun --setup; fails on non-zero exit or any script status "error" in run_timing.json
make test_all              # unit, profile, integration, buildconfig, dryrun, shellcheck
make validate              # format + lint + verbose test_unit + buildconfig + webapp + integration_local + dryrun
                           #   + shellcheck, then gating profile tests; normally CI-owned
make new-script name= os= type=
make doctor                # environment diagnosis (shows last bench_profile result)
make bench_profile         # time `bash -i -c exit`; fails if median > budget
                           #   budget and defaults: software/tools/bench-profile.js; override with BENCH_ARGS
make clean / make nuke     # clean generated output / wipe ~/.bash_syle*, fnm, node_modules …
```

Run `make collect_shell_agnostic_files` from the repository root to save tracked shell sources and print the saved-list path.
Its direct equivalent is `node software/tools/collect-shell-agnostic-files.js`.
The collector writes a JSON filename array to `shell-agnostic-files.txt` under the system temporary folder (`/tmp` when `TMPDIR=/tmp`).
It excludes `assets/fonts/install.sh` because that webapp display file mixes Bash and PowerShell.
It also excludes `software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash` because the generator substitutes its placeholders before execution.
The optional shell-agnostic targets use that list when `files` is omitted or empty.
An explicit `files` accepts one literal filename or a JSON array and overrides the saved list.
Run validation from the same repository root with the same temporary-folder configuration; recollect after changing checkouts or tracked files.
The most recent collection replaces the shared list; missing, malformed, or empty lists fail validation.
The validators require ShellCheck and/or shfmt and never execute selected scripts.
The individual rule targets fail on findings or unavailable analyzers. The best-effort target prints every diagnostic and continues after each failure.
`make validate` runs that target by default; `VALIDATE_SHELL_AGNOSTIC=0` skips it.
`precommit`, `test_all`, and CI do not run the optional shell checks.
See [the prioritized shell-validation checklist](../TODO_AGNOSITC_SHELL.md) for all rule targets, examples, limits, and the fix/recheck workflow.

The formatter is **oxfmt** (`npm run format`), not prettier, despite the
`format_prettier` target name. Shell formatting is `shfmt -w -i 2 -bn -sr`.
For Markdown-only changes, scope the configured formatter instead of regenerating unrelated outputs:

```bash
npx oxfmt --write AGENTS.md DEV.md ARCHITECTURE.md
```

For a changed Markdown include directive, `node software/tools/build-include.js <target.md>` regenerates only that target.
Edit the directive or included source, never the generated body; verify a second run makes no changes.

`make format_shell` applies these shfmt settings to tracked `.sh` and `.bash` sources, including tools, documentation scripts, and hidden folders.
It excludes generated/protected artifacts, frozen guidance snapshots, PowerShell templates, and the unrendered autocomplete skeleton.
Filenames containing spaces remain single arguments.
Shell formatting is best-effort: missing shfmt skips the step; individual failures print the filename and analyzer diagnostic, then continue without failing CI.
