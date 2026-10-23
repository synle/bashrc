# bashrc

Personal dotfiles and shell-environment bootstrapper. The setup engine is Node.js scripts piped into bash (`cat index.js | node | bash`) orchestrated by `run.sh` and a GNU `Makefile`, covering macOS, Ubuntu/Debian, Arch, RHEL/Fedora, Windows/WSL/MinGW, ChromeOS, SteamOS, and Android Termux. A Vite + React webapp under `webapp/` renders the demo page at https://synle.github.io/bashrc/; tests run on Vitest.

## Quick Start

```bash
npm ci || npm install --no-fund --prefer-offline   # deps
npm run dev                # webapp dev server
make setup_local_full      # full profile setup
npm test                   # unit tests
npm run build              # build webapp
make build_installer       # .build/install-bashrc.sh
```

The installer is a single bash script (~1 MB): `run.sh` + `software/` as a base64'd gzipped tarball after a sentinel marker. Extracts to a per-PID tmp dir (`BASHRC_INSTALLER_DIR` overrides, `BASHRC_INSTALLER_KEEP=1` preserves), forwards every `run.sh` flag. CI mirrors it to the `binary-cache` release as `bashrc-installer__install-bashrc.sh`:

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

## Running a Subset

`run.sh` accepts `--file` / `--files` and `--preset` / `--presets`, with either `=value` or a separate value.
Both selector types fuzzy-match case-insensitively: one hit auto-resolves; multiple hits print suggestions.
Trailing `*` selects every case-insensitive prefix match instead. Quote hash-prefixed selectors and wildcards so the shell passes them unchanged.
There are no short file/preset aliases; existing `-f` still means force refresh.

```bash
bash run.sh --files=git.js              # one script
bash run.sh --file git.js               # singular alias, separate value
bash run.sh 'vim*'                      # all scripts with this basename prefix
bash run.sh --files=vim                 # fuzzy match
bash run.sh --preset=lightweight        # named preset
bash run.sh --preset=terminal,prompt    # union
bash run.sh --presets terminal         # plural alias, separate value
bash run.sh '#llm*'                     # all presets with this prefix
bash run.sh @llm                        # strict preset lookup
bash run.sh editors                     # bare arg: script-first, preset fallback
bash run.sh --refresh="fzf.js,fonts.js" # force-refresh specific scripts
bash run.sh --dryrun --setup            # preview, no writes
bash run.sh --remove --files=fzf.js     # undoWork for one script
```

Presets live in `software/metadata/presets.jsonc` (JSONC). Each entry declares `files[]` and/or recursive `presets[]`; cycles rejected at parse time by `expandPresetFiles`, guarded by `software/tests/presets.spec.js`. Composites: `lightweight` / `heavyweight`. Building blocks: `editors`, `emulators`, `apps`, `browsers`, `terminal`, `prompt`, `llm`.

Resolution priority: file flags are script-only; preset flags are preset-only with substring fallback; bare `<x>` searches scripts first, then presets.
Bare `@<x>` and quoted `'#<x>'` search presets only. Collision → script wins (`bash run.sh llm` hits `llm-common.js`; use `'#llm'`).
Missing separate option values fail before selection. Existing empty `--files=` and `--preset=` values remain no-ops.

## Testing

Suites are split across dedicated Vitest configs so each can run independently:

```bash
make test_unit             # Vitest sandbox tests for software/index.js + build-include
make test_coverage         # Unit tests + istanbul coverage report
make test_profile          # bash -n syntax checks for assembled profile scripts
make test_smoke            # Puppeteer smokes against the live deploy
make test_smoke_local      # Puppeteer smokes against ./dist (local build)
make test_buildconfig      # Inline-snapshot shape checks for generated configs
make test_dryrun           # Dry-runs every JS script; asserts no writes / clean stdout
make test_all              # Unit + profile + smoke + buildconfig + dryrun (skips coverage)
make validate              # format + test_unit + test_buildconfig + build_webapp + test_smoke_local + test_dryrun
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
| `vitest.profile.config.js`     | `profileSyntax.spec.js`                                                               |
| `vitest.buildconfig.config.js` | `buildConfigShape.spec.js`                                                            |
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

Executable scripts may use `.personal.js` / `.personal.sh` or `.work.js` / `.work.sh`.
Discovery and explicit `--files` / preset runs enforce the active `is_work_profile`;
same-name variants run common → personal → work. These suffixes do not apply to profile
partials, PowerShell templates, `.common.*`, or other SOURCE files.

**VS Code debugging:** `.vscode/launch.json` has configs for the current script (via
`software/.debug-runner.js`) and for Vitest.

### Coverage

Istanbul provider via `@vitest/coverage-istanbul`. Thresholds, globs, and rationale live in `vitest.config.js` — the source of truth; don't duplicate numbers here.

## Make Targets

```bash
make init                  # npm ci + mkdir .build
make setup                 # = setup_local_full → bash run.sh --setup --force
make setup_local_profile   # profile refresh only, no dep install
make setup_prod            # bootstrap from GitHub
make format                # build_include → ci_binaries → script_indexes → jsdocs
                           #   → spec_cleanup → shell (shfmt) → oxfmt
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
make validate              # format + unit + buildconfig + webapp + smoke_local
                           #   + dryrun + shellcheck   ← run this before pushing
make new-script name= os= type=
make doctor                # environment diagnosis (shows last bench_profile result)
make bench_profile         # time `bash -i -c exit`; fails if median > budget
                           #   (default 400ms ceiling; baseline ~330ms, goal 150ms)
make clean / make nuke     # clean generated output / wipe ~/.bash_syle*, fnm, node_modules …
```

The formatter is **oxfmt** (`npm run format`), not prettier, despite the
`format_prettier` target name. Shell formatting is `shfmt -w -i 2 -bn -sr`.

## Native file listing

`ls` uses the native executable without an alias, wrapper, or injected arguments.
Reloading the profile removes the retired listing alias and function.
`ll` provides a colored native long listing with hidden files, readable sizes, and file-type indicators.

- `ls_newest` / `ls_newest_first`: newest entries last / first.
- `ls_biggest` / `ls_biggest_first`: largest entries last / first.

These shortcuts are explicit aliases, not generated command variants.
Native timestamps and permission columns replace the retired backend's custom formatting.
The retired package is no longer installed or registered for completion; existing machine installations are not automatically uninstalled.

## Shared theme sources

`theme/sy/_palette_{dark,light}.jsonc` owns foundation colors, aliases, and `{from, over, alpha}` recipes.
`software/tools/build-include.js` generates RGB, alpha, tint/shade variants and updates native-shaped `theme/sy/<app>_<mode>.jsonc` templates.

Use `// {{dark.key}}` or `// {{light.key}}` after color values. Multi-color strings retain a `// {{template: "...{{dark.key}}..."}}` recipe comment.
Run `make format_build_include` after source/marker changes; a second run must report no updates. Unknown, malformed, or unbound active markers fail before writes.

Baseline references and historical audit files under `theme/` are not regeneration targets. The formatter also preserves baseline bytes.
See `theme/README.md` for native shapes and capability limits.

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
