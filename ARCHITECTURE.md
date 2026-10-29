# bashrc — Architecture

## High-Level Overview

This repository bootstraps dotfiles and machine configuration across macOS, Ubuntu/Debian/Mint, Arch/SteamOS, RHEL/Fedora, Windows (PowerShell, MinGW, WSL), ChromeOS, and Android Termux.
`run.sh` feeds the Node engine through a logged bash pipeline.
The engine selects scripts and emits bash; bash installs tools, writes configuration, and assembles `~/.bash_syle` from managed blocks.

The Vite + React webapp lives in `webapp/` and `src/`; its published entry point is documented in `README.md`.
The configured test suites use `software/tests/`; `tests/` also contains webapp utility tests outside that default unit glob.
CI regenerates build artifacts under `.build/`.

## Key Directories

| Path                                            | Purpose                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `software/scripts/`                             | Per-tool installers + OS subdirs (`mac/`, `ubuntu/`, `redhat/`, `arch_linux/`, `windows/`, `wsl/`, `mingw64/`, `chromeos/`, `steamos/`, `android_termux/`) and `advanced/` subtrees. `filterRepoScripts()` owns prefix ordering and explicit first/last pins. |
| `software/bootstrap/`                           | Bash entry points sourced by `run.sh`: `common-env.sh` (OS detection, env vars), `common-functions.bash`, `profile-core.sh`, `profile-advanced.sh`, `setup.sh`.                                                                                               |
| `software/metadata/`                            | Build-time config: autocomplete specs, host blocklists, `presets.jsonc`, `ci-binaries.json`, file associations, hostname/IP groups, canonical script list.                                                                                                    |
| `software/metadata/autocomplete-complete-spec/` | Tab-completion specs shared by bash + PowerShell; the folder and autocomplete registry define the current inventory.                                                                                                                                          |
| `software/tools/`                               | Dev tooling: `build-include.js` (marker-inline builder), `build-installer.js`, `doctor.sh`, `new-script.sh`, formatters.                                                                                                                                      |
| `software/tests/`                               | Vitest unit + integration specs for the engine.                                                                                                                                                                                                               |
| `webapp/`, `src/`                               | Vite + React demo site published to GitHub Pages.                                                                                                                                                                                                             |
| `tests/`                                        | Webapp utility tests outside the `software/tests/**/*.spec.js` default unit glob; do not count them as covered by `npm test`.                                                                                                                                 |
| `.build/`                                       | Generated artifacts committed back by CI (editor configs, host files). Per-OS `profile_bashrc_<os>.sh` not tracked in git — mirrored to the `binary-cache` release, copied into `dist/` by publish for same-origin Pages fetch.                               |
| `docs/`                                         | Topical knowledge bases (bash, git, CICD, Docker, K8s, OS notes).                                                                                                                                                                                             |
| `.agents/skills/`                               | Canonical repository-local skills; `.claude/skills` is the compatibility link.                                                                                                                                                                                |
| `assets/`                                       | Binary blobs + fonts used by installers.                                                                                                                                                                                                                      |

## Important Files

- **`run`** — Executable symlink to `run.sh`; use `./run [selectors and flags]` from the checkout root. Installer payloads include both files.
- **`run.sh`** — Entrypoint. Local vs remote mode, flag parsing (`--files`, `--preset`, `--debug`, `--refresh`, `--dryrun`, `--remove`), drives the node→bash pipeline.
- **`Makefile`** — Setup / validation / CI targets.
- **`software/index.js`** — Dual-purpose: shared utility library (parsers, IO, network, platform detection, tagged templates) AND bootstrap orchestrator discovering + running scripts.
- **`software/common.js`** — Helpers shared with individual scripts.
- **`software/bootstrap/common-env.sh`** — Sets `REPO_PATH_IDENTIFIER`, `REPO_BRANCH_NAME`, `ALL_OS_FLAGS`; consumed by engine and `vite.config.js`.
- **`software/scripts/_init.js` / `~cleanup.js` / `~wrapup.sh`** — Lifecycle scripts; `filterRepoScripts()` owns ordering, including scripts explicitly pinned after post-scripts.
- **`software/scripts/steamos/setup.bash`** — Separate interactive Desktop Mode setup; not an installer selector. See `DEV.md` → SteamOS manual setup.
- **`software/scripts/advanced/llm/_common/v_current/`** — Canonical shared instruction and skill bodies; named PR worker personas are retired.
- **`software/scripts/advanced/llm/llm-common.js`** — Shared deployment registries and placeholder resolution; client setup scripts render the same sources.
- **`software/tools/build-include.js`** — Include/marker compiler; resolves `theme/sy/_palette_{dark,light}.jsonc` and renders native-shaped Sy templates.
- **`theme/sy/` / `theme/baseline/`** — Active palette/template sources / immutable reference captures; historical audit metadata is not application configuration.
- **`install.sh`** — Public installer wrapper (`curl | bash`).
- **`vitest*.config.js`** — Suite discovery and coverage ownership; `vitest.config.js` is the default unit configuration.
- **`AGENTS.md` / `DEV.md` / `README.md`** — Rules / dev quick-start / user overview.

## Source ownership

Use these sources instead of maintaining another inventory or registry:

- `software/metadata/presets.jsonc` owns named bundles; `run.sh` exports it as `PRESETS_JSON`.
- `software/metadata/ci-binaries.json` owns required/warn binary checks; `software/tools/generate-ci-binary-list.js` renders the action's `ci-binary-checks` block.
- `software/metadata/autocomplete.common.js` owns `DYNAMIC_TOKENS` and `expandSpecMacros`.
- `software/metadata/script-list.config` is the canonical sorted script list.
- `software/bootstrap/common-env.sh` owns `LIMITED_SUPPORT_OSES` and `ALL_OS_FLAGS`; build-time includes propagate them into `run.sh`.
- `software/tools/build-include.js` owns BEGIN/END expansion and `{{map.key}}` theme bindings.
- `software/scripts/advanced/browser-launch-options.common.js` owns shared Brave, Chrome, and Edge launch options.
- `theme/sy/_palette_{dark,light}.jsonc` owns foundations and recipes; paired app templates own native-shaped bindings.
- `software/tools/refresh-llm-upstream-skills.js` owns reviewed provider pins and generates `software/metadata/llm-upstream-skills.common.js` with complete selected-resource inventories and SHA-256 hashes.
- `software/scripts/advanced/llm/llm-upstream.common.js` installs immutable upstream resources outside discovery roots before publishing adapters; cache identity includes commit and selected-resource fingerprint.
- `_common/v_current/instructions-pr-workflow.md` owns PR creation and all three publication states; its optional upstream description component has no publication authority.
- `vitest.config.js` owns default-suite discovery and coverage thresholds.
- `$BASHRC_TEMP_DIR/run_timing.json` records per-script status and timing consumed by CI.

## Browser launch-option flow

The shared browser registry renders Bash launch arrays and PowerShell option maps.
Shell launchers consume the arrays; macOS `_only.js` creates signed flags-only app bundles; Windows `_init.js` renders the existing-shortcut updater.
The macOS browser registry owns launcher names and legacy identities; Windows preserves unrelated shortcuts and only updates supported browser entries.
Read `DEV.md` → Chromium browser launchers for maintenance boundaries and focused checks.
SteamOS manual setup remains a separate entry point rather than another consumer of this registry.

## Theme data flow

Managed Sy colors have one source: paired foundations in `theme/sy/`. The compiler resolves recipes/variants and replaces app placeholder literals.
Setup consumers load the paired app sources through `readSyTheme`, then render native syntax or deploy native JSON/settings. The installer bundles active sources for offline use.

New feature colors follow `theme/README.md` → Required workflow for new feature colors; do not add another app-local palette.
Tab/title-bar identity and native fallback choices remain separate from shared terminal content colors. Baseline references are immutable; current audit statuses are not historical measurement counts.

## Execution Pipeline

1. **Shared environment.** `software/bootstrap/common-env.sh` is inlined into `run.sh` so the entry point works without sourcing a separate checkout file.
2. **Detection.** OS flags select the platform; the Debian-family catch-all follows other distro checks. Work-profile detection defaults to personal, with the documented macOS hostname rule and explicit override.
3. **Argument bridge.** Bash handles setup intent, verbose output, color, and GUI overrides before Node runs. It JSON-encodes all arguments into `BASHRC_RAW_ARGS`; `parseRawArgs()` owns the remaining selectors and modes.
4. **Engine loading.** `run_files()` reads local `software/index.js` when present; otherwise it downloads that engine into the pipeline. The engine resolves script content locally or remotely.
5. **Logged execution.** Engine source feeds `node | tee | bash | tee`. The first log captures emitted bash; the second captures execution output. `PIPESTATUS` preserves failure from every stage.
6. **Script execution.** Node exposes shared helpers and emits selected scripts. Bash installs tools, writes configurations, and registers profile blocks; `ScriptSkipError` represents a clean script skip.
7. **Finalization.** `~cleanup.js` flushes profile blocks and removes unfilled markers. `run.sh` merges start/end times and duration into `run_timing.json`, preserving per-script results.

Output redirection: only `emitBash()` writes stdout; everything human-readable uses `log()` (stderr).

## Script Discovery & Ordering

`filterRepoScripts()` and `getSoftwareScriptFiles()` in `software/index.js` own discovery:

1. Keep `.js` and `.sh` script paths; `.bash` files are not discoverable installer entries.
2. Exclude automatic `.common.js` helpers and `.standalone.js` entries; omit `_full-setup.*` outside setup mode and `advanced/` on limited-support systems.
3. Apply OS-folder and exact `.personal.{js,sh}` / `.work.{js,sh}` guards; explicit and preset selections also enforce these guards.
4. Order root `_init.js`, OS `_init` scripts, setup scripts, ordinary scripts, then `~` post-scripts and explicitly pinned last files.
5. Sort ordinary scripts by byte order with `/advanced/` removed from the sort key; keep profile siblings common → personal → work.

Explicit file selections append `~refresh-source.standalone.js` to refresh runtime SOURCE blocks.
The manual SteamOS script is a separate flow: it installs its prerequisites and registers native applications and Brave website tiles.
Both HTTP and HTTPS site URLs are accepted; exact-title matching supports repeat updates.
Keep its title/URL inventory in the script, not a second registry.

## Decky package flow

`software/metadata/decky-packages.json` owns the exact Loader version and selected package list.
Compact entries reference trusted ZIPs in `assets/steamos/decky_loader_plugins/`; the shared package module derives hashes, native roots, kinds, and theme IDs.
Rich HTTPS/hash entries remain supported. The self-extracting installer includes approved ZIPs, and cache recovery cannot override their derived hashes.
Every installation reapplies selected archive members, restarts `plugin_loader.service`, and verifies it is active without removing unrelated plugins/settings.
SteamOS collects operational choices before installation; only verbose package-manager operations redirect output to a timestamped private temporary log.

## Profile Assembly

Ordinary installer scripts never write `~/.bash_syle` directly — they buffer via `registerWithBashSyleProfile(configKey, content)` (append/replace a BEGIN/END block), `registerPlatformTweaks(platform, content, subKey?)`, autocomplete/powershell variants, and `removeFromBashSyleProfile` (for `--remove`). All writes accumulate in `_profileBlockBuffer`, flushed once per bundle + in `~cleanup.js`. Duplicate `configKey` throws. Empty marker pairs pre-placed in `profile-core.sh` / `profile-advanced.sh` so blocks update in place.

## BEGIN/END Inlining vs SOURCE Runtime Includes

Two distinct mechanisms:

| Mechanism                         | When                                     | Use case                                                                                                                                                  |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `# BEGIN <path>` / `# END <path>` | Build time (`make format_build_include`) | Inline a partial into a generated/checked-in file (e.g. `common-env.sh` into `run.sh`). Edit the source file — block contents overwritten on next format. |
| `# SOURCE <path>`                 | Runtime (`readText()`, every run)        | Pull live shell into `~/.bash_syle` each run without full setup. Only the marker is committed; materialized block lives in generated profiles only.       |

Rule: shipped-at-build-time config → BEGIN/END; live shell refreshed each run → SOURCE.

## Preset Composition

`presets.jsonc` is JSONC (stripped by `stripJsoncComments` before parse). Each entry: optional `files[]`, recursive `presets[]`, `description`. `expandPresetFiles()` flattens with cycle detection; cycles throw at parse time (`presets.spec.js` guards).

CLI resolution (`parseRawArgs`): `--file` / `--files` select scripts; `--preset` / `--presets` select presets. Both accept `=value` or separate values.
Scripts resolve exact paths first, then exact basenames or stems within folder boundaries; preset names match exactly. Name matching is case-insensitive.
Bare `<x>` searches scripts first, then presets; `@<x>` forces preset lookup. Hash-prefixed preset shorthand is unsupported.
A shared literal matcher handles `name*`, `*name`, and `*name*` as prefix, suffix, and contains selectors; internal stars are unsupported.
Preset parsing and file preflight collect multiple-match requests. Before emitting selected scripts, the runner lists every match in a red warning naming files or presets.
The shared terminal prompt defaults to Yes on Enter and reads `/dev/tty`, never pipeline stdin. No, EOF, timeout, or no terminal cancels execution.
The presence flag `--skip-prompt` (also `-skip-prompt`) explicitly accepts all matches without that prompt; warnings remain visible.
Missing-name validation, OS/work-profile filtering, and unrelated prompts remain unchanged. Both SteamOS setup installer calls opt in.
Unmatched selections fail before any selected script is emitted, and bootstrap errors exit nonzero.
No short selector aliases are added; `-f` retains force-refresh behavior.

Composites: `lightweight`, `heavyweight` (= all building blocks: `editors`, `emulators`, `apps`, `browsers`, `terminal`, `prompt`, `llm`).

## Build & Release Flow

CI = `.github/workflows/build-main.yml`, phased:

1. **Decky bundle** — builds and verifies the pinned package bundle in a read-only job before prep. Only trusted default-branch pushes publish its rolling cache asset.
2. **Prep** (Ubuntu) — formatting, include generation, local integration/dry-run checks, and installer/webapp builds; uploads the prep patch and distribution artifacts.
3. **OS builds** — Ubuntu, RHEL, Arch, Debian, and macOS apply prep output and upload generated configurations/profiles. Arch and Debian are explicitly allowed to fail.
4. **Publish** — combines generated artifacts, amends HEAD with `--force-with-lease`, copies profiles into `dist/`, and deploys Pages.
5. **Test** — unit/profile/integration/buildconfig/coverage jobs validate published output and render binary, timing, and coverage summaries. Successful builds use the installer version computed in prep, `v0.YYYYMMDD.HHMM.<short_sha>`.

`workflow_dispatch` with `run_mode=test_only` skips rebuild phases; `.github/workflows/build-main.yml` owns exact conditions and dependencies.
Publish can change the default-branch SHA. Before an authorized default-branch push, synchronize with `git pull --rebase`.
Feature branches follow the merge-only rule in the shared PR workflow. Distribution uses the rolling default branch, binary-cache assets, and Pages.
