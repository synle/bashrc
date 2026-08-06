# bashrc

Personal dotfiles and shell-environment bootstrapper. The setup engine is Node.js scripts piped into bash (`cat index.js | node | bash`) orchestrated by `run.sh` and a GNU `Makefile`, covering macOS, Ubuntu/Debian, Arch, RHEL/Fedora, Windows/WSL/MinGW, ChromeOS, SteamOS, and Android Termux. A Vite + React webapp under `webapp/` renders the demo page at https://synle.github.io/bashrc/; tests run on Vitest.

## Quick Start

Install dependencies:

```bash
npm ci || npm install --no-fund --prefer-offline
```

Run the webapp dev server:

```bash
npm run dev
```

Run the bootstrapper locally (full profile setup):

```bash
make setup_local_full
```

Run unit tests:

```bash
npm test
```

Build the webapp:

```bash
npm run build
```

Build the self-extracting single-file installer:

```bash
make build_installer   # -> .build/install-bashrc.sh
```

Output is a single bash script (~1 MB) containing `run.sh` + `software/{index.js,common.js,bootstrap,scripts,metadata}` as a base64'd gzipped tarball after a sentinel marker. At runtime it extracts to a per-PID tmp dir (override with `BASHRC_INSTALLER_DIR`; preserve with `BASHRC_INSTALLER_KEEP=1`) and `exec`s `bash run.sh "$@"` — every `run.sh` flag (`--setup`, `--files=`, `--preset=`, `--dryrun`, ...) is forwarded. CI mirrors it to the `binary-cache` rolling release on `synle/bashrc` as `bashrc-installer__install-bashrc.sh`, so end-users can install with one HTTP request:

```bash
curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh | bash -s -- --setup
```

See `software/tools/build-installer.js`.

## Running a Subset

`run.sh` accepts narrow targets (`--files=`) and broad preset bundles (`--preset=`). Both support case-insensitive substring matching — one match auto-resolves, multiple matches print copy-paste suggestions.

```bash
bash run.sh --files=git.js                         # one script (exact)
bash run.sh --files=vim                            # fuzzy match (auto-resolves if unambiguous)
bash run.sh --preset=lightweight                   # named preset from software/metadata/presets.jsonc
bash run.sh --preset=terminal,prompt               # union of multiple presets
bash run.sh @llm                                   # bare @-marker → strict preset lookup
bash run.sh editors                                # bare arg → script-first, falls back to preset on miss
bash run.sh --refresh="fzf.js,fonts.js"            # force-refresh specific scripts
bash run.sh --dryrun --setup                       # preview a full setup, no writes
bash run.sh --remove --files=fzf.js                # undoWork for one script
```

End-user composites: `lightweight` and `heavyweight` (kitchen-sink — symmetric counterpart to `lightweight`). Building blocks: `editors`, `emulators`, `apps`, `browsers`, `terminal`, `prompt`, `llm`. See `software/metadata/presets.jsonc` for the authoritative list and per-preset descriptions; the file is JSONC, so `//`, `/* */`, and trailing commas are allowed (stripped by `stripJsoncComments` in `software/index.js` before `JSON.parse`). Each entry declares a `files[]` list and/or a `presets[]` list pointing at other presets (composed recursively); `heavyweight` is the canonical example, defined as `{ "presets": ["editors", "emulators", "apps", "browsers", "terminal", "prompt", "llm"] }`. Cycles (a preset referencing itself, directly or transitively) are rejected at parse time by `expandPresetFiles` in `software/index.js` and guarded by `software/tests/presets.spec.js`.

CLI resolution priority: `--files=<x>` is strict (script only); `--preset=<x>` (and `--preset=@<x>`, which strips the `@`) is strict preset with case-insensitive substring fuzzy fallback; bare `<x>` tries scripts first and falls back to a preset lookup (`_resolveBareArgPresetFallback` in `software/index.js`); bare `@<x>` skips the script search and goes straight to preset resolution. On script-vs-preset name collision the script wins (e.g. `bash run.sh llm` partial-matches `llm-common.js`; use `@llm` to force the `llm` preset).

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
The convention-linter specs (one rule each) are listed in AGENTS.md §11.

**VS Code debugging:** `.vscode/launch.json` has configs for the current script (via
`software/.debug-runner.js`) and for Vitest.

### Coverage

The unit suite uses the istanbul provider via `@vitest/coverage-istanbul`. **Thresholds, included / excluded globs, and the rationale for the current floor all live in `vitest.config.js` — that file is the source of truth.** Don't duplicate the numbers in other docs; if a threshold changes, edit `vitest.config.js` and let downstream readers chase the link. There is no Rust / `cargo-llvm-cov` in this repo; if a future Rust sibling project lands, document its coverage config path next to the vitest entry instead of hardcoding a percentage.

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
make test_coverage         # + istanbul; thresholds live in vitest.config.js
make test_profile          # bash -n / profile invariants
make test_buildconfig      # inline-snapshot shape (…_update to refresh)
make test_smoke[_local]    # puppeteer webapp (live / local dist)
make test_dryrun           # run.sh --dryrun --setup; fails past DRYRUN_MAX_ERRORS (3)
make test_all              # unit, profile, smoke, buildconfig, dryrun, shellcheck
make validate              # format + unit + buildconfig + webapp + smoke_local
                           #   + dryrun + shellcheck   ← run this before pushing
make new-script name= os= type=
make doctor                # environment diagnosis
make clean / make nuke     # clean generated output / wipe ~/.bash_syle*, fnm, node_modules …
```

The formatter is **oxfmt** (`npm run format`), not prettier, despite the
`format_prettier` target name. Shell formatting is `shfmt -w -i 2 -bn -sr`.

## Helper API Reference

Every function below is a **global** inside `software/scripts/*.js` — no `require`, no
import. Reuse these instead of hand-rolling file IO, path lookup, download, or install
logic (see AGENTS.md §2, Golden rules).

- **Templates:** `text`, `code` (dedented), `list`, `set`, `json`, `readText` (async; URL
  / absolute / repo-relative + SOURCE expansion), `readJson`, `readList`, `readSet`,
  `requireUrl`.
- **Write:** `writeText`, `writeJson`, `writeJsonWithMerge`, `writeConfigToFile`,
  `writeBuildArtifact` (→ `.build/`), `safeWriteText` (shrink-ratio guard),
  `writeTextIfSignificantChange`, `appendText`, `replaceTextLineByLine`, `touchFile`,
  `copyFile`, `safeSymlink`, `mkdir`, `deleteFile`, `deleteFolder` (guarded), `unzip`,
  `md5Hash*`. **Backup:** `backupConfigFile`, `backupText`, `backupProfileSnapshot`.
- **Find:** `findPath`, `findPathList`, `findPathFromList`, `pathExists`, `findDirList`,
  `findFileRecursive` — all take `{ type: file|folder|exec|any }`. **Platform paths:**
  `getWindowUserBaseDir`, `getWindowAppDataRoaming/LocalUserPath`, `toWindowsPath`,
  `getDesktopPath`, `getEtcHostsPath`, `getCustomTweaksPath`,
  `getOsxApplicationSupportCodeUserPath`, `resolveOsKey`.
- **Install/download:** `downloadAsset(s)`, `downloadAssetWithFallback` (GitHub release →
  `binary-cache`), `downloadAndInstallBinary`, `installMacDmg`, `clearMacQuarantine`,
  `installWindowsSetupExe`, `installLinuxUniversalAppImage`, `installBrowserExtension`,
  `gitClone`, `fetchGitHubReleaseVersion`, `getGitHubRawUrl`.
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
- **Exec/output:** `execBash` (async, 30s cap), `execBashSync`, `hasBinary`, `emitBash`,
  `log`, `echo`, `color*`, `printSectionBlock`, `printRunInfo`. **Options:**
  `getRuntimeOption("KEY")` reads `--KEY=value` or the env var; `parseString` /
  `parseInteger` (clamping) / `parseBoolean`.

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
