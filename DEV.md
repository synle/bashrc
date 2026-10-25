# bashrc

Personal dotfiles and shell-environment bootstrapper for the platforms listed in `ARCHITECTURE.md`.
`run.sh` feeds the shared Node engine into a logged bash pipeline; GNU Make provides development and CI targets.
The Vite + React webapp lives under `webapp/`; tests run on Vitest.

## Quick Start

```bash
npm ci || npm install --no-fund --prefer-offline   # deps
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

Decky plugins and CSS Loader themes are pinned in `software/metadata/decky-packages.json`.
The opt-in `decky-and-css-loader.standalone.js` stages the generated binary-cache bundle,
recovers missing packages upstream in batches of three, and installs through the shared
protected Node runtime. SteamOS setup delegates to the same standard script. No Decky
ZIPs are tracked under `assets/steamos/`. For a checked update of every package, ask:

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
Use `<name>_v<version>.zip` filenames; preserve theme IDs and hashes in metadata. Store
metadata alone is not an archive. Leave unverified candidates unchanged.

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

Close Steam before changing shortcuts. The script records a private `steamos-setup.*` log on the Desktop.
It asks whether to clear user-defined non-Steam shortcuts, install Decky, upgrade the system, and enable USB wake-up.
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

## Testing

Suites are split across dedicated Vitest configs so each can run independently:

```bash
make test_unit             # software/tests unit, convention, and subprocess integration specs
make test_coverage         # Unit tests + istanbul coverage report
make test_profile          # bash -n syntax checks for assembled profile scripts
make test_smoke            # Puppeteer smokes against the live deploy
make test_smoke_local      # Puppeteer smokes against ./dist (local build)
make test_buildconfig      # Inline-snapshot shape checks for generated configs
make test_dryrun           # Dry-runs every JS script; asserts no writes / clean stdout
make test_all              # unit + profile + live smoke + buildconfig + dryrun + shellcheck; no coverage
make validate              # full local gate; exact targets and final profile gate are in Makefile
```

Run a single spec or filter by test name:

```bash
npx vitest run --config vitest.config.js software/tests/parseRawArgs.spec.js
npx vitest run --config vitest.config.js -t "parses --files flag"
```

### Vitest configs

One config per suite:

| Config                         | Suite                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `vitest.config.js`             | unit (everything except the four below); setup `software/tests/setup.js`; 30s timeout |
| `vitest.profile.config.js`     | `profileSyntax*.spec.js`                                                              |
| `vitest.buildconfig.config.js` | `buildConfigShape*.spec.js`                                                           |
| `vitest.smoke.config.js`       | webapp + raw-URL smokes against the live site                                         |
| `vitest.smoke.local.config.js` | webapp smoke against local dist (puppeteer)                                           |

`software/tests/setup.js` loads `index.js` in a VM sandbox — reach in with
`getIndexFunction(name)` / `getIndexConstant(name)`; `fileSystem` and `fetchResponses`
give in-memory mocks, auto-reset in `beforeEach`.

When you add a `.sh` file, register it in `profileSyntax.spec.js`. When you touch
`software/index.js` or `software/tools/build-include.js`, add or update unit tests.
Keep every test spec at **300 lines or fewer**. If a spec grows beyond 300 lines,
split it by behavior into independently named `*.spec.js` files; never use numeric
`partN` names. The convention-linter specs (one rule each) are listed in AGENTS.md §11.

The unit runner uses bounded Vitest fork workers and file parallelism. Keep tests independent:
own fixtures and temp folders, no shared mutable state, no order assumptions. Use
`describe.concurrent` only when a suite has no shared process or filesystem state.

If a native subprocess times out only during the parallel suite, reproduce its spec alone before changing code or timeouts.
A diagnostic complete-suite run can use fewer workers:

```bash
npm test -- --maxWorkers=4
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
make lint                  # oxlint correctness pass (.oxlintrc.json)
make test_coverage         # + istanbul; thresholds live in vitest.config.js
make test_profile          # bash -n / profile invariants
make test_buildconfig      # inline-snapshot shape (…_update to refresh)
make test_smoke[_local]    # puppeteer webapp (live / local dist)
make test_dryrun           # run.sh --dryrun --setup; fails on non-zero exit or any script status "error" in run_timing.json
make test_all              # unit, profile, smoke, buildconfig, dryrun, shellcheck
make validate              # format + lint + unit + buildconfig + webapp + smoke_local
                           #   + dryrun + shellcheck, then gating profile tests
make new-script name= os= type=
make doctor                # environment diagnosis (shows last bench_profile result)
make bench_profile         # time `bash -i -c exit`; fails if median > budget
                           #   budget and defaults: software/tools/bench-profile.js; override with BENCH_ARGS
make clean / make nuke     # clean generated output / wipe ~/.bash_syle*, fnm, node_modules …
```

The formatter is **oxfmt** (`npm run format`), not prettier, despite the
`format_prettier` target name. Shell formatting is `shfmt -w -i 2 -bn -sr`.
For Markdown-only changes, scope the configured formatter instead of regenerating unrelated outputs:

```bash
npx oxfmt --write AGENTS.md DEV.md ARCHITECTURE.md
```

For a changed Markdown include directive, `node software/tools/build-include.js <target.md>` regenerates only that target.
Edit the directive or included source, never the generated body; verify a second run makes no changes.

## Native file listing

`ls` uses the native executable without an alias, wrapper, or injected arguments.
`ll` provides a colored native long listing with hidden files, readable sizes, and file-type indicators.

- `ls_newest` / `ls_newest_first`: newest entries last / first.
- `ls_biggest` / `ls_biggest_first`: largest entries last / first.

These shortcuts are explicit aliases, not generated command variants.
Long listings use native timestamps and permission columns.

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
