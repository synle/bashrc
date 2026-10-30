# bashrc

Personal dotfiles and shell-environment bootstrapper for the platforms listed in `ARCHITECTURE.md`.
`run.sh` feeds the shared Node engine into a logged bash pipeline; GNU Make provides development and CI targets.
The Vite + React webapp lives under `webapp/`; tests run on Vitest.

## Quick Start

```bash
npm ci --ignore-scripts     # locked deps; review lifecycle scripts before running separately
npm run dev                # webapp dev server
make setup_local_full      # full profile setup
npm test                   # unit tests
npm run build              # build webapp
make build_installer       # .build/install-bashrc.sh
```

The installer is a single bash script: `run` + `run.sh` + `software/` as a base64'd gzipped tarball after a sentinel marker. Extracts to a per-PID tmp dir (`BASHRC_INSTALLER_DIR` overrides, `BASHRC_INSTALLER_KEEP=1` preserves), forwards every `run.sh` flag. CI mirrors it to the `binary-cache` release as `bashrc-installer__install-bashrc.sh`:

```bash
curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh | bash -s -- --setup
```

See `software/tools/build-installer.js`.

## Manual release-cache cleanup

**Actions → Clean Binary Cache Release** provides three off-by-default checkboxes:
**Precompiled Bash profiles**, **Tool binaries and installer bundles**, and
**Decky plugin and theme bundles**. Only selected, allowlisted asset groups are deleted;
the release, tag, and unknown assets stay. This is separate from Actions artifact
cleanup. Read [scope, preconditions, and recovery](docs/release-cache-cleanup.md)
before running it; no live cleanup is needed to verify the workflow locally.

## Refreshing SteamOS Decky Plugins

`software/metadata/decky-packages.json` declares an exact `decky_loader_version` and `decky_packages`.
Compact entries require only `path`, `name`, and `version`; approved hand-picked ZIPs live under `assets/steamos/decky_loader_plugins/`.
The shared Node runtime derives hashes, native roots, package kinds, and theme IDs, while retaining rich HTTPS/hash entry support.
The self-extracting installer includes those ZIPs. Missing or stale cached packages recover from selected repository bytes or pinned upstream URLs.
Reruns overwrite selected archive members, restart `plugin_loader.service`, and verify it is active; unrelated plugins and settings remain.
SteamOS setup delegates to the same standard script. For a checked update of every package, ask:

```text
Refresh all pinned Decky plugins and CSS Loader themes to the latest verified installable releases.
```

The repo-local `refresh-steamos-decky-plugins` skill defaults to all entries; supply
package names only for a partial refresh. It discovers current stable releases,
verifies artifacts, updates pins, tests, builds, and reports updated/current/blocked
packages. Building alone does not discover updates.

Query upstream releases/store records, verify temporary candidate SHA-256, ZIP safety,
identity/version, compiled plugin payload, and theme IDs before changing inventory pins.
Keep newer verified releases; do not downgrade merely to match older store listings.
Use `<name>_v<version>.zip` filenames. Compact entries derive theme IDs and hashes from verified committed bytes; rich entries retain explicit pins.
Store metadata alone is not an archive. Preserve upstream attribution in `assets/steamos/README.md` and leave unverified candidates unchanged.

`make build_decky_bundle DECKY_BUNDLE_OUTPUT="$HOME/steamos-decky__bundle.zip"` builds
and validates deterministic output with Node.js and curl; failed builds preserve existing
output. CI builds without release credentials on PRs and publishes only on default-branch
pushes. See [`docs/steamos-decky-installation.md`](docs/steamos-decky-installation.md).

After a refresh, run:

```bash
/bin/bash -n software/scripts/steamos/setup.bash
npx vitest run --config vitest.config.js software/tests/steamosSetup.cache.spec.js software/tests/steamosSetup.decky.spec.js software/tests/deckyZip.spec.js software/tests/deckyInstaller.spec.js
git diff --check
```

## SteamOS manual setup

`software/scripts/steamos/setup.bash` is an interactive post-install entry point, not a discoverable `./run --files=` script.
Run it from the checkout root in Desktop Mode/Konsole as the normal desktop user, never root or `sudo`:

```bash
/bin/bash software/scripts/steamos/setup.bash
```

After validating the invoking account, setup checks existing `~/.bashrc` and `~/.bash_profile` files independently.
For each file without an active direct `alias update=` definition, it saves original/latest backups and appends:

```bash
alias update='curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/software/scripts/steamos/setup.bash | bash -'
```

Missing startup files are not created. Existing `update` aliases are preserved, even when their commands differ; commented-out aliases do not block installation.
Open a new Bash session to load the alias. It reruns the complete interactive setup, including its shortcut-clearing prompt; it is not package-update-only.
Later definitions from sourced profiles can override it, including the managed SteamOS profile's existing pacman `update` alias.

Close Steam before changing shortcuts. The script records a private `steamos-setup.*` log on the Desktop.
Before downloads, it asks whether to clear user-defined non-Steam shortcuts, install Decky, upgrade the system, and enable USB wake-up.
The final completion acknowledgment remains at the end.
Long pacman, Flatpak, and paru operations capture stdout/stderr in a private `sy-log-<UTC-start-time>-steamos-setup-output.<unique>.txt` file.
Its temporary root uses `BASHRC_TEMP_ROOT_DIR`, then `TMPDIR`, then `/tmp`; short progress, failure status, and log location remain visible.
The shortcut-clearing prompt defaults to Yes; declining preserves existing entries for title-based updates.
Clearing affects all user-defined non-Steam shortcuts in the selected account; review that prompt deliberately.

Brave Flatpak is a prerequisite for browser tiles. Fixed-site tiles use `--kiosk` with a direct HTTP or HTTPS URL.
Only Brave-backed tiles receive these browser flags; native application shortcuts and global Flatpak settings remain unchanged:

| Flag                         | Why it is included                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ozone-platform=x11`       | Request X11/XWayland instead of native Wayland as a compatibility workaround for reported SteamOS hangs. This is not a confirmed diagnosis or guaranteed fix. |
| `--disable-smooth-scrolling` | Disable animated scrolling as requested. This is a behavior preference, not a measured performance improvement.                                               |
| `--kiosk`                    | Keep fixed-site tiles fullscreen without browser chrome.                                                                                                      |

The [Chromium Ozone documentation](https://chromium.googlesource.com/chromium/src.git/+/HEAD/docs/ozone_overview.md) documents X11 platform selection.
The [Chromium switch definition](https://chromium.googlesource.com/chromium/src/+/HEAD/content/public/common/content_switches.cc) identifies `--disable-smooth-scrolling` as a testing switch.
GPU acceleration, hardware video decoding, and sandbox defaults remain intact. Do not add speculative rendering or performance switches without target-host measurements.
Exit Brave completely before testing new launch flags; also close Steam before updating its shortcuts.
Re-run setup with shortcut cleanup declined to refresh existing browser tiles by title without clearing unrelated entries.
Confirm X11 selection in `brave://gpu` and the applied command line in `brave://version`, then check scrolling, streaming playback, and stability on SteamOS.
These local fixture tests cannot prove that a reported browser hang is fixed.

The tile named Brave opens Fav in kiosk mode instead of launching a generic browser window.
Setup no longer registers a separate Fav tile. If shortcut cleanup is declined, previously saved Fav entries remain until manually removed.
Do not impose an HTTPS-only restriction on local HTTP services or replace kiosk launch options with `--app=` or URI forwarding.
The site registrations near the script's end are the authoritative title/URL inventory, including Plex, Apple TV+, and Crunchyroll.
URL helpers match exact titles, refresh existing entries, and refuse database changes while Steam runs.
The manual replacement helper also backs up the shortcut database and restores it if re-adding fails.

Validate changes without provisioning an unrelated host:

```bash
/bin/bash -n software/scripts/steamos/setup.bash
npx vitest run --config vitest.config.js software/tests/steamosSetup*.spec.js
```

The subprocess specs exercise isolated fixtures, not live Steam/Brave playback. Report a missing target-host run as a validation gap.

### USB wake-up

The USB wake-up prompt defaults to Yes. Choosing No skips installation and leaves existing wake settings unchanged.
Setup writes `/etc/systemd/system/usb-wake-all.service`, reloads systemd, and enables and starts the oneshot service.
An existing unit receives `.bak_original` and `.bak_latest` backups before replacement; the original backup is never overwritten.
The service enables wake-up only for USB devices exposing `power/wakeup`; hardware, firmware, and suspend mode still determine actual wake capability.
Enabling every supported USB device can cause accidental resumes. No actual wake behavior has been verified on the target host.
The boot-time service does not handle later hotplug automatically; restart it after connecting new devices:

```bash
sudo systemctl restart usb-wake-all.service
```

To stop future boot-time application without deleting the unit:

```bash
sudo systemctl disable --now usb-wake-all.service
```

Disabling the service does not undo wake settings already applied; reboot to let the kernel and other power-management configuration establish their defaults.
The unit uses `$$` so systemd passes shell variables through correctly.
It orders after USB device triggering, not after `multi-user.target`, avoiding an ordering cycle with its installation target.

## Running a Subset

`./run` invokes `run.sh` and accepts `--file` / `--files` and `--preset` / `--presets`, with either `=value` or a separate value.
Names match exactly and case-insensitively by default. File selectors accept exact paths, basenames, or basenames without extensions.
Use `name*` for prefix matches, `*name` for suffix matches, and `*name*` for contains matches. Internal stars are unsupported.
Quote wildcard arguments so the shell passes them unchanged. One match runs automatically; multiple matches require confirmation before any selected script executes.
The red warning names `files` or `presets` and lists all matches. Enter accepts; No, EOF, a 30-second timeout, or no terminal cancels.
Pass `--skip-prompt` to run every eligible match without selector confirmation, including without a terminal. This presence flag defaults to false.
Match warnings, missing-name errors, OS/work-profile guards, and unrelated prompts remain unchanged. The single-dash form `-skip-prompt` also works.
There are no short file/preset aliases; existing `-f` still means force refresh.

```bash
./run --files=git.js              # one script
./run --file git.js               # singular alias, separate value
./run 'vim*'                      # all scripts with this basename prefix
./run --skip-prompt 'vim*'        # all eligible matches without selector confirmation
./run --files='*config.js'        # explicit suffix match
./run --preset=lightweight        # named preset
./run --preset=terminal,prompt    # union
./run --presets terminal         # plural alias, separate value
./run '@llm*'                     # preset prefix expansion with confirmation
./run @llm                        # strict preset lookup
./run editors                     # bare arg: script-first, preset fallback
./run --refresh="fzf.js,fonts.js" # force-refresh specific scripts
./run --dryrun --setup            # preview, no writes
./run --remove --files=fzf.js     # undoWork for one script
```

Presets live in `software/metadata/presets.jsonc` (JSONC). Each entry declares `files[]` and/or recursive `presets[]`; cycles rejected at parse time by `expandPresetFiles`, guarded by `software/tests/presets.spec.js`. Composites: `lightweight` / `heavyweight`. Building blocks: `editors`, `emulators`, `apps`, `browsers`, `terminal`, `prompt`, `llm`.

Resolution priority: file flags are script-only; preset flags and bare `@<x>` are preset-only; other bare arguments search scripts first, then presets.
Exact file paths take priority over basename matches. Script matches take priority over bare-name preset fallback.
Explicit comma-separated lists do not require confirmation merely because they contain several keywords.
Missing separate option values fail before selection. Existing empty `--files=` and `--preset=` values remain no-ops.

### Selector migration

Hash-prefixed preset shorthand is no longer supported. Replace `'#name'` with `@name`, or use `--preset=name`.
Implicit fuzzy abbreviations are no longer supported. Replace `--preset=editor` with `--preset=editors` or quote `--preset='editor*'`.
For automation without a terminal, provide exact preset names or unambiguous file paths, or pass `--skip-prompt` to accept every eligible match.
Both SteamOS setup installer calls pass `--skip-prompt` so matching-name confirmation cannot interrupt those delegations.

## Chromium browser launchers

`software/scripts/advanced/browser-launch-options.common.js` owns shared Brave, Chrome, and Edge flags and their Bash/PowerShell rendering.
Keep feature toggles in one `--disable-features` argument; retain browser-specific options and Linux-only VA-API selection.
`--disable-web-security` remains commented out for local debugging, never enabled for normal browsing.

Consumers are `software/scripts/advanced/browser-launchers.js`, `software/scripts/mac/_only.js`, and the Windows shortcut template rendered by `windows/_init.js`.
macOS creates signed `Browser Brave.app`, `Browser Chrome.app`, and `Browser Edge.app` launchers without replacing the original browser apps.
Existing unmanaged launcher paths are skipped.
Legacy `* With Flags.app` removal requires a successfully signed replacement plus matching legacy bundle and launcher markers.
Windows updates existing Brave, Chrome, and Edge shortcuts; it does not create or pin shortcuts.

Focused fixture checks:

```bash
npx vitest run --config vitest.config.js software/tests/scripts/advanced/browser-launchers.spec.js software/tests/macBrowserLaunchers.spec.js software/tests/windowsBraveShortcuts.spec.js
```

Read Installer fixture isolation before changing these tests.
Fixtures verify generated output, not live Finder launching, signing, Windows COM behavior, or installed-browser feature support.
The separate SteamOS manual setup retains its own launch path; see SteamOS manual setup above.

## Purging local Git branches and tags

The shell helper `purge_branches_and_tags` operates only on the current repository:

```bash
purge_branches_and_tags --dry-run
purge_branches_and_tags
```

It keeps origin's detected default branch, falling back to local `main`, then `master` when origin cannot identify a default.
The retained branch must exist locally. The command switches to it without forcing checkout, deletes every other local branch, including unmerged branches, and deletes all local tags.
Remote branches and tags remain unchanged. The command never resets or cleans working files and never removes linked worktrees.
Checkout failures stop deletion; branches checked out in other worktrees cause a nonzero result and can leave an incomplete purge.
Unpushed branch tips and local-only tags lose their names; record any needed commit IDs before purging.
Remote-backed refs can be fetched again, but local-only refs have no guaranteed recovery.

## Local work files

Profile generation discovers regular files matching `~/.work*.bash` and writes sorted explicit `safe_source` lines inside `BEGIN Sy bash_syle entry point`.
Runtime discovery remains for files added later, including eligible symlinks, and avoids duplicate calls for known successful sources.
Requested and resolved `.secret.` paths are excluded before content is read.
Refresh the profile with `./run` after changing the startup generator; it does not rename existing home files.

`software/bootstrap/safe-source.bash` owns the shared implementation emitted into both startup files and included in `common-functions.bash`.
`safe_source` tracks successful canonical local paths and URL identities per Bash process.
Repeated calls return success, skip execution, and print a warning to stderr; failed loads remain retryable.
The recursion guard prevents a source cycle from repeatedly executing an active script.
Re-reading helper definitions retains the registry; a new Bash process starts with independent state.
Use `safe_source --reload <file>` for intentional repeat execution, such as virtual-environment activation.

This startup change does not cause a non-interactive LLM tool to read `.bashrc`; those tools still need their own startup integration.

Each LLM client setup discovers regular instruction documents matching `~/.work_*_instructions.md`.
For example, `~/.work_acme_instructions.md` becomes a `Custom Work Prompt | ~/.work_acme_instructions.md` HTML BEGIN/END block.
New documents append after the existing instructions; subsequent deployments refresh their blocks without duplicates.
Existing manually added path-keyed blocks also refresh in place.
Review-note files such as `~/.work_pr_reviews.md` remain on-demand references because their names do not match the instruction pattern.

Instruction imports reject credential-shaped and `.secret.` paths, including resolved symlink targets.
Sources must remain inside home and contain nonempty regular-file content.
Invalid markers retain existing content and emit diagnostics.
The shared instruction budget covers the common block; custom documents increase the final client file size.

## Reconciling local memory and guidance

Use this workflow when auditing repository instructions against prior local work:

1. Verify the remote, current HEAD, working tree, and index before interpreting historical records.
2. Read `AGENTS.md`, `ARCHITECTURE.md`, `DEV.md`, and applicable nested rules.
   Read the cleanup checklist at `software/scripts/advanced/llm/_common/v_current/skills/clean-instructions.md` before editing guidance.
3. Inspect relevant `~/_extra/ai_llm/plans/<repo>-<feature>.md` records and available project memory, including `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` when present.
   Follow only task-relevant linked records; apply secret-path and approval rules before reading sensitive material.
   Report missing memory without treating it as proof that no previous work exists.
4. Treat plans, wrap-ups, and memory as leads, not current execution evidence.
   Verify each proposed correction against current source, configuration, or command output.
   Historical failures and timeouts are not fresh baselines; historical passes do not prove current checks pass.
5. Give each fact one home.
   Keep repository rules in `AGENTS.md` and implementation maps in `ARCHITECTURE.md`.
   Keep development procedures here and LLM operational reference in `software/scripts/advanced/llm/llm.md`.
   Personal work overlays and generated user-level instructions remain separate from repository guidance.
6. Preserve compatibility links and edit canonical sources.
   Check source paths, section references, named rules, before/after sizes, and the complete diff.
   Use the Markdown-only validation path in `AGENTS.md` unless shared instruction sources or executable behavior also change.

The on-demand memory bridge snapshots multiple projects into user-level context; it is not required for a repository documentation audit.
Read `software/scripts/advanced/llm/llm.md` → Memory promotion bridge before considering that separate deployment.

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

Refresh existing inline snapshots with Vitest's one-shot update mode:

```bash
npm run test:update -- software/tests/piSettingsDeployment.spec.js # one spec (preferred)
npm run test:update                                             # all default-suite snapshots
npm run test:buildconfig:update                                 # generated-config snapshots, separate suite
```

These commands rewrite expectations in test source; they do not delete tests or reset fixtures.
Inspect every snapshot diff against the intended behavior, then rerun without update mode before committing.
Never accept updated snapshots merely to silence a regression.

Browser integration specs live in `software/tests/integration/webapp/` without a filename prefix.
`app.spec.js` snapshots all trimmed command labels with an explicit Mac browser model; `navigation.linux.spec.js` separately checks Ubuntu-first Linux ordering.
Each `commands.<name>.spec.js` clicks its command and checks the exact main-body child count.
Content entries snapshot the banner title and MD5 of rendered `innerText.trim()`; link groups retain nested labels and literal `href` values without URL hashing.
Hidden form-data children remain counted and fingerprinted by their IDs. Browser platform and viewport are fixed for reproducible OS warnings and layout.
Snapshots describe the current collapsed UI, not complete downloaded source files. Published profile headers and fetched content changes require intentional review.
The Windows command currently records a missing published Windows Terminal artifact as an explicit error-state snapshot, not successful source loading.
Local integration serves actual published profiles when the webapp-only build omits them; no synthetic profile content is substituted.

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
                           #   → spec_cleanup → shell (shfmt) → oxfmt → autocomplete specs
make format_build_include  # process BEGIN/END markers
make format_ci_binaries    # regenerate the ci-binary-checks block
make build_all             # configs, hosts, webapp, postbuild
make build_installer       # .build/install-bashrc.sh self-extracting installer
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
See [the prioritized shell-validation checklist](TODO_AGNOSITC_SHELL.md) for all rule targets, examples, limits, and the fix/recheck workflow.

The formatter is **oxfmt** (`npm run format`), not prettier, despite the
`format_prettier` target name. Shell formatting is `shfmt -w -i 2 -bn -sr`.
For Markdown-only changes, scope the configured formatter instead of regenerating unrelated outputs:

```bash
npx oxfmt --write AGENTS.md DEV.md ARCHITECTURE.md
```

For a changed Markdown include directive, `node software/tools/build-include.js <target.md>` regenerates only that target.
Edit the directive or included source, never the generated body; verify a second run makes no changes.

## Native navigation

`cd` tries native Bash navigation first, preserving exact paths, options, `CDPATH`, symlinks, previous-folder behavior, HOME, and failure status.
Missing paths use fuzzy matching from their longest existing folder prefix, including parent-relative paths and absolute paths expanded from `~/`.
Without an existing prefix, relative queries search from the current folder.
Files, exact paths, bare `..`, and option forms retain native behavior; unresolved `.` or `..` components never enter fuzzy matching.
An asynchronous breadth-first search considers at most 3 levels below the anchor, 20,000 entries, and 2 seconds.
The first matching depth wins. Within that depth, exact components rank above prefixes, prefixes above substrings, then shorter suffixes and lexical paths.
Search reuses `_IGNORED_FOLDERS_JSON`; excluded cache folders stay hidden unless every matching excluded component appears exactly in the segmented query.
One match prints `print_action_summary` and changes directory. Multiple matches show at most five paths; choose 1–5 or type a displayed path.
Anchored matches display absolute paths; unanchored matches retain relative paths.
Selection requires terminal stdin and an accessible `/dev/tty`; piped stdin remains untouched even when a controlling terminal exists.
Searches with no safe match preserve Bash's native failure status.
The `..`, `...`, and `....` aliases use `cd`; folder completion keeps the shared registry. Profile refresh does not remove navigation history.

Refresh the complete profile with `./run`, then open a fresh shell.
Refresh completion alone with `./run --files=advanced/bash-autocomplete-complete-spec.js` or the broader `./run --preset=terminal`.
Regression coverage lives in `software/tests/nativeCd.spec.js` and `software/tests/integration/fuzzyCd.spec.js`.

## Native file listing

`ls` uses the native executable without an alias, wrapper, or injected arguments.
`ll` provides a colored native long listing with hidden files, readable sizes, and file-type indicators.

- `ls_newest` / `ls_newest_first`: newest entries last / first.
- `ls_biggest` / `ls_biggest_first`: largest entries last / first.

These shortcuts are explicit aliases, not generated command variants.
Long listings use native timestamps and permission columns.

## Worktree listing

`worktree_list` lists primary and linked worktrees without changing Git state or querying remote services.
It scans the current folder and nested repositories through depth three, excluding hidden/cache folders and symbolic-link recursion.
Discovered repositories include all registered worktrees, even when linked paths lie outside the scan folder.

```bash
worktree_list           # pretty output (default)
worktree_list --pretty  # explicit pretty output
worktree_list --raw     # JSON array
```

Pretty output groups worktrees under `📦 <org>/<repo>  <root_path>` headers.
Each worktree row uses `🌳 [<size>]  <branch_name>  <worktree_path>`.
Interactive `worktree_clean --mode interactive` prints the same row before each pending all/y/N confirmation.
Cleanup statuses use one line: `<icon> <action> [<size>]  <branch_name>  <worktree_path>  <reason>`.
Sizes are measured before deletion so removed rows retain their storage information.
Cleanup repository headers compact the repository, root path, and default ref onto one line.
Both commands use the shared `git.worktree_info.cjs` formatter deployed beside them by the installer.
Size is allocated disk usage from `du -skP`, including ignored and untracked content without following symlinks.
Decimal labels use 1 MB = 1,000,000 bytes; shared Git objects outside linked worktrees are not counted.
Missing, unreadable, unsupported, or timed-out measurements show `[unknown]`; each probe has a two-second deadline.
Raw JSON does not probe sizes or add size fields.
Raw records contain `branch_name`, `repo`, `org`, `worktree_path`, and `root_path`.
`root_path` identifies the primary checkout; detached/bare branches and unknown organizations use JSON `null`.
Repositories without a network origin use the primary folder name.
Malformed network origin URLs fail with a diagnostic instead of producing an inventory.
Pretty output labels detached/bare branches and escapes terminal control bytes; raw JSON preserves exact path values.
An empty scope produces `[]` in raw mode.

Install through `./run --files=git-functions.js` or the broader `./run --preset=terminal`.

## Terminal links

Terminal link helpers render labels in blue without explanatory hints. Open links with your terminal's link gesture; modifier keys vary by terminal.
Agent replies use Markdown links where supported, otherwise complete plain URLs. Raw OSC 8 bytes belong only in terminal programs.

- Shell: call `format_hyperlink "$url"` directly between `printf` calls, never through command substitution.
- Installer diagnostics: `log()` linkifies HTTP(S) and file URLs on stderr without changing generated stdout.
- Git helpers: PR and worktree links emit OSC 8 only on their human output TTY.
- Delta: hyperlink behavior follows the active Git configuration. File targets may require an installed editor URI handler.
- Pager: `PAGER="less -R"` preserves OSC 8 on supported less versions. Do not use unsafe `less -r` as a workaround.
- Listing: native `ls` remains unchanged. `ll` requests automatic hyperlinks only when GNU ls advertises support; BSD ls keeps its existing flags.
- Search: `rg_link` and `fd_link` add native hyperlink flags only on a non-dumb terminal when the binary advertises support.
- tmux: the configured append-only `hyperlinks` feature enables forwarding on supported versions.
- Ghostty inside tmux: Shift bypasses mouse capture; the existing macOS gesture is Shift+Cmd+click.
- Pipes, redirected output, JSON, clipboard contents, and machine-only link lists receive no added OSC 8 or color escapes.

Refresh the profile with `./run`; refresh Git tooling with `./run --files=git-functions.js` or the broader `./run --preset=terminal`.
Unsupported applications keep their native output. Byte-level PTY tests do not prove physical clicking in every emulator.

### File search colors and Git diffs

The profile defaults `LS_COLORS` to terminal ANSI colors, avoiding fd's bright fixed 256-color fallback.
Regular file names use the terminal foreground; folders, links, and executables retain native palette distinctions.
Custom values, including an explicitly empty `LS_COLORS`, remain unchanged.

Git's `d`, `dh`, `ds`, and their one-/two-column variants send unified patches to the configured pager.
Delta performs word highlighting itself; Git's `--word-diff` markup prevents normal Delta line rendering even when the pager runs.
Log shortcuts keep their graph for ordinary history and disable it for explicit patch flags so Delta can recognize patch headers.
Explicit `--no-pager`, `GIT_PAGER`, and command-specific pager settings still follow Git's native precedence.

Test terminal support directly:

```bash
printf '\033]8;;https://example.com\033\\\033[34mExample\033[0m\033]8;;\033\\\n'
```

The [Delta hyperlink manual](https://dandavison.github.io/delta/hyperlinks.html) describes file and commit targets.

## Smart file diff

`diff file1 file2` compares arbitrary files in Delta's one-column layout; `file1` stays left, `file2` stays right. `diff -delta2 file1 file2` selects two columns.

Both layouts use Git's no-index comparison, including inside repositories. For Delta styling, configure Delta as Git's pager; Git controls terminal rendering.

Add leading `-r` or `--reverse` to swap left and right before comparison.
The reverse flag and renderer selector may appear in either order before the operands:

```bash
diff -r file1 file2
diff --reverse target_file sha1
diff -delta2 -r target_file sha1 sha2
diff --reverse -code target_file sha1 sha2
```

Repeated reverse flags still reverse only once. Use `--` before filenames that resemble wrapper flags.
Working-tree Git comparisons also reverse through Git's `-R` option.
With native flags, such as `diff --reverse -u file1 file2`, the final two operands must be existing files.
For native recursive folder comparison, bypass the wrapper with `command diff -r folder1 folder2`.

Tracked-file history supports two additional forms:

```bash
diff target_file sha1       # file at sha1 on the left, committed HEAD on the right
diff target_file sha1 sha2  # file at sha1 on the left, file at sha2 on the right
```

With two operands, an existing second path always takes precedence, even if its name resembles a commit.
Only a nonexistent second path triggers file/revision fallback; directories and broken symlinks receive file errors instead.
Three positional operands always select tracked-file revision mode.
Both historical forms require a Git-tracked file in the current repository, with file contents present at both commits.
Commit revisions such as abbreviated hashes, `HEAD`, and `HEAD~1` are accepted; blobs, trees, and invalid revisions are rejected.
Errors identify each invalid revision as `sha1=<value>` or `sha2=<value>` and return nonzero without launching a comparison.
The implicit second revision is committed `HEAD`, never staged or unstaged file content.
Historical comparisons do not change the index or working tree.

All renderer selectors below also accept these historical forms, such as `diff -delta2 target_file sha1 sha2` and `diff -code target_file sha1`.
Historical bytes are written without newline trimming into private snapshots under `${TMPDIR:-/tmp}/diff-revisions.*`.
Terminal comparisons and failed launches remove their snapshots.
Successful GUI launches retain snapshots for asynchronous readers and print their folder to stderr; remove that folder after use.

Use `diff -code file1 file2` for VS Code. Use `diff -zed` or `diff -z` for Zed, and `diff -winmerge` for WinMerge. Use `diff -smerge` or `diff -sublime_merge` for Sublime Merge.

Sublime Merge uses `smerge` first, then falls back to `smerge.exe`. Other editor modes require their named command or launcher. Missing commands produce an error instead of silently changing tools.

Shortcuts: `diff_delta1`, `diff_delta2`, `diff_code`, `diff_zed`, `diff_z`, `diff_winmerge`, `diff_smerge`, and `diff_sublime_merge`. Each alias accepts its matching mode's arguments.

`pdiff [diff options] file` compares the clipboard on the left with the supplied file on the right, reusing `paste` and `diff`.
The final argument is the file; preceding options pass unchanged to `diff`. Examples: `pdiff file`, `pdiff -delta2 file`, `pdiff -code file`, and `pdiff -u file`.
Use `pdiff -- -filename` for a leading-dash filename.
Matching shortcuts are `pdiff_delta1`, `pdiff_delta2`, `pdiff_code`, `pdiff_zed`, `pdiff_z`, `pdiff_winmerge`, `pdiff_smerge`, and `pdiff_sublime_merge`.

Clipboard bytes go directly into a private `mktemp` file under `${TMPDIR:-/tmp}` without stripping trailing newlines.
Successful captures remain as `pdiff.*` snapshots because GUI launchers may return before reading them; remove these clipboard-bearing files when done.
Missing files and help requests do not read the clipboard. Failed captures remove partial snapshots and return the capture failure without launching a comparison.

With no selector, two file paths compare by default. Two commit hashes compare Git revisions; an available GitHub remote preserves the existing compare-page opening.

Inside a repository, no arguments show tracked working changes. One path shows tracked changes or compares an untracked file against empty content. Outside a repository, one path is compared against standard input by native `diff`.

Prefix a leading-dash filename with `--`. Unselected leading flags such as `-u` pass directly to native `diff`. Explicit `-delta1` and `-delta2` modes accept Git diff flags.

## Shared theme sources

`theme/sy/_palette_{dark,light}.jsonc` owns foundation colors, aliases, and `{from, over, alpha}` recipes.
`software/tools/build-include.js` generates RGB, alpha, tint/shade variants and updates native-shaped `theme/sy/<app>_<mode>.jsonc` templates.

Use `// {{dark.key}}` or `// {{light.key}}` after color values. Multi-color strings retain a `// {{template: "...{{dark.key}}..."}}` recipe comment.
Run `make format_build_include` after source/marker changes; a second run must report no updates. Unknown, malformed, or unbound active markers fail before writes.

Baseline references and historical audit files under `theme/` are not regeneration targets. The formatter also preserves baseline bytes.
The authoritative new-feature workflow is `theme/README.md` → Required workflow for new feature colors.
Add or reuse a semantic role in both foundations, bind both native app templates with marker comments, generate, then load through `readSyTheme(app, mode)`.
Setup scripts render/deploy native output; they must not define another Sy palette. Keep opt-out and both appearances covered, preserve tab/title-bar identity, and update current audit status without treating historical measurements as current failures.

## Helper API Reference

Every function below is a **global** inside `software/scripts/*.js` — no `require`, no
import. Reuse these instead of hand-rolling file IO, path lookup, download, or install
logic (see AGENTS.md §2, Golden rules).

- **Templates:** `text`, `code` (dedented), `list`, `set`, `json`, `readText` (async; URL
  / absolute / repo-relative + SOURCE expansion), `readJson`, `readList`, `readSet`,
  `requireUrl`. **Placeholders:** `resolvePlaceholders(content, tokenMap)` — the one
  `<<TOKEN>>` substituter (doubled brackets so a token can never collide with prose,
  shell redirection, or a tag); names are SCREAMING_SNAKE_CASE, `COMMON_PLACEHOLDERS`
  supplies `<<SY_ROOT_FOLDER>>` / `<<HOME>>` for free.
- **Write:** `writeText`, `writeJson`, `writeJsonWithMerge`, `writeConfigToFile`,
  `writeBuildArtifact` (→ `.build/`), `safeWriteText` (shrink-ratio guard),
  `writeTextIfSignificantChange`, `appendText`, `replaceTextLineByLine`, `touchFile`,
  `copyFile`, `safeSymlink`, `mkdir`, `deleteFile`, `deleteFolder` (guarded), `unzip`,
  `md5Hash*`. **Backup:** `backupConfigFile`, `backupText`, `backupProfileSnapshot`.
- **Find:** `findPath`, `findPathList`, `findPathFromList`, `pathExists`, `findDirList`,
  `findFileRecursive` — all take `{ type: file|folder|exec|any }`. **Platform paths:**
  `getWindowUserBaseDir`, `getWindowAppDataRoaming/LocalUserPath`, `toWindowsPath`,
  `getDesktopPath`, `getEtcHostsPath`, `getCustomTweaksPath`,
  `getOsxApplicationSupportCodeUserPath`, `resolveOsKey`. **Visibility:**
  `hidePaths(items, hidden = true, shouldHandleRecursion = false)` uses Windows Hidden
  attributes on WSL and `chflags` on macOS; Linux is a no-op.
- **Install/download:** `downloadAsset(s)`, `downloadAssetWithFallback` (GitHub release →
  `binary-cache`), `downloadAndInstallBinary`, `installMacDmg`, `clearMacQuarantine`,
  `installWindowsSetupExe`, `getWindowsInstalledAppVersion`, `installLinuxUniversalAppImage`, `installBrowserExtension`,
  `gitClone`, `fetchGitHubReleaseVersion`, `getGitHubRawUrl`.
- **CPU arch:** `getNativeArch()` (memoized; JS mirror of bash `get_native_arch` — never
  `os.arch()`/`process.arch`, which report `x64` under Rosetta 2 and pick the Intel
  asset on Apple Silicon; on a Mac with unreadable probes it answers `arm64`),
  `resolveNativeArch(probe)` (the pure decision table behind it),
  `isMachOArchMismatch(fileOutput, arch)` and `isMacInstalledAppArchMismatched(label)`
  (mirror of `binary_arch_mismatch` — why a same-version wrong-arch app still
  reinstalls), `getMacInstalledAppVersion`.
- **Install version stamps:** `getInstalledVersionStampPath` (sibling
  `<folder>.installed.json`, never inside the folder — Chrome rejects an unpacked
  extension containing a dot-entry), `readInstalledVersionStamp`,
  `writeInstalledVersionStamp` — a re-run then skips delete + re-download when the
  recorded version matches upstream; `--refresh` forces.
- **Blocks/profile:** `replaceBlock(s)`, `removeBlock`, `appendTextBlock`,
  `prependTextBlock`, `moveTextBlockToEnd/Start`, `registerProfileBlock`,
  `registerWithBashSyleProfile`, `registerWithPowershellProfile`,
  `registerWithBashSyleAutocompleteWithRawContent`, `registerPlatformTweaks`,
  `removeFromBashSyleProfile`, `flushProfileBlocks`.
- **Guards:** `ScriptSkipError`, `exitIfNotTargetOs`, `exitIfUnsupportedOs`,
  `exitIfLimitedSupportOs`, `exitIfPathFound/NotFound`, `exitIfNotSudo`,
  `exitIfNoChromiumBrowser`, `exitIfNoGui("any"|"x11"|"wayland")`. **GUI flags:**
  `is_gui`, `is_gui_x11`, `is_gui_wayland` (§7.5). **Staleness:** `isPathStale`,
  `isForceRefreshStale`, `isBashSyleStale`.
- **Exec/output:** `execBash` (async, 30s default, `timeout` option up to a 5m ceiling,
  never rejects — an installer must verify its own result), `execBashSync`,
  `hasBinary`, `emitBash`, `log`, `echo`, `color*`, `printSectionBlock`,
  `printRunInfo`. **Options:** `getRuntimeOption("KEY")` reads `--KEY=value` or the
  env var; `parseString` / `parseInteger` (clamping) / `parseBoolean`.

Bash equivalents in `software/bootstrap/common-functions.bash`: `is_help_arg`,
`safe_source`, `curl_bash_install`, `npm_install_global`, `has_persistent_binary`,
`find_path`, `prompt_yes_no`, `ensure_binary_alias`, `exit_if_not_sudo`,
`safe_touch`/`safe_mkdir`/`safe_chown`/`safe_chmod`, `get_native_arch` / `run_native`,
plus a logging `sudo` wrapper. `tsc --declaration --allowJs` emits the full typed API
into `software/types/` (`make format_jsdocs`) — read that when unsure of a signature.

## Where to Go Next

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Execution pipeline, directory map, CI phases, key files.
- **[AGENTS.md](AGENTS.md)** — Repo rules and conventions (shell, JS, profile-assembly, protected paths).
- **[README.md](README.md)** — User-facing install instructions and feature highlights.
- **[docs/editor-keybindings.md](docs/editor-keybindings.md)** — Canonical keybinding reference across editors / terminals / AI CLIs.
