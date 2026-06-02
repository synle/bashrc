# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repo.

## Project Overview

Personal bash profile and dotfiles management system (`synle/bashrc`). Automates setup of shell config, editor settings, fonts, Git config, and OS-specific tweaks across macOS, Ubuntu/Debian, WSL, Android Termux, Arch Linux/Steam Deck, ChromeOS.

## Reference Docs

Read first for unfamiliar work:

- **[DEV.md](DEV.md)** — How the system executes, layer breakdown, data flow, where to add scripts.
- **[§ Architecture](#architecture) / Key Files** — Important paths (embedded below; other repos may use `ARCHITECTURE.md`).

CLAUDE.md is the rules; DEV.md + architecture notes are the map. Consult the map before applying rules.

## Rules

### Protected Content

- **Do not modify anything in `.build/`.** Generated artifacts — enforced by PreToolUse hook.
- **`.build/profile_bashrc_*.sh` is gitignored.** Each CI build writes a per-OS profile, uploads it as `profile-build-<os>` artifact, and mirrors to the `binary-cache` rolling release. Do not commit locally.
- **Do not modify owner/CI-managed files in `software/metadata/`.** Includes `autocomplete-complete-spec/` (e.g. `git`, `docker`), `hosts-*.consolidated.config`, `hosts-blocked-ads.config`.
- **Leave locally-modified protected files alone.** If `.build/`, `autocomplete-complete-spec/git`, or `hosts-blocked-ads.config` show as modified in `git status`, don't edit, revert, stage, or commit them.
- **Do not modify `assets/` directly.** Owner-managed. Release backups for `display-dj`, `sqlui-native`, `url-porter`, `skiff-files`, `proxie` live in the `binary-cache` rolling release (refreshed by `software/tools/ci-download-release-binaries.sh`). `assets/binaries/` is gitignored.
- **Do not modify content inside `# BEGIN`/`# END` markers.** Managed by `build-include`; overwritten on next `make format_build_include`. Edit the source file referenced in the marker.
- **Do not modify `SOURCE_BEGIN`/`SOURCE_END` blocks in generated profile files.** Runtime SOURCE includes — re-fetched each run. Edit the source file. In repo sources only the single-line `# SOURCE path` or `// SOURCE path` marker should appear.

### Code Style

- **Always add JSDoc for ALL code in every change.** Mandatory on every function, constant, type, interface, and any code you touch. Script files start with `/** Description. */` (note: `/**` not `/** *`).
- **Always use lowercase hex colors.** `#1e1e1e` not `#1E1E1E`.
- **Never use `node:` prefix for Node built-in imports.** Write `require("fs")` not `require("node:fs")` — breaks on older Node (e.g. Volta-pinned).
- **Always use `curl -fsSL`** for curl commands. No other flag combos.
- **Always use `raw.githubusercontent.com` for GitHub raw URLs.** `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}` — not `github.com/.../blob/...?raw=1` (no CORS) and not `api.github.com/.../contents/...` (returns JSON). Use `getGitHubRawUrl(path)` in JS or `get_github_raw_url <path>` in bash.
- **Use `log()` for all output. Never raw `console.log`/`console.error`.** `log()` writes to stderr, safe in the `node | bash` pipeline. Only `emitBash()` writes to stdout.

### Shell Conventions

- **New `.sh`/`.bash` scripts in `software/scripts/` start with `#!/usr/bin/env bash` and `# SOURCE software/bootstrap/common-functions.bash`.** Omit the SOURCE line only if no shared helpers are used.
- **Use `.profile.bash` extension for profile partials.** Files inlined into `~/.bash_syle` via `# SOURCE |` markers are not standalone — no `# SOURCE common-functions.bash` needed.
- **Always use `"$HOME/"` not `~/` in scripts.** `~` is not quote-safe.
- **Use `safe_touch`, `safe_mkdir` for paths inside `$HOME`.** Fixes root ownership from prior `sudo`. `safe_mkdir` includes `-p` by default. Plain `touch`/`mkdir` OK outside `$HOME`.
- **Use `safe_chown` / `safe_chmod` instead of `chown`/`chmod`.** Skip non-existent and already-correct paths. One path per call. `safe_chown [-R] [user] <path>` defaults user to `$USER`.
- **Default to bash; POSIX `sh` only when shebang says so.** All `software/scripts/` use `#!/usr/bin/env bash`. If shebang is `#!/system/bin/sh` or `#!/bin/sh`, write POSIX-only: no arrays, no `function`, no `[[ ]]`, no `${var,,}`, no `(( ))`. Use `fname() {`, `[ ]`, `case`.
- **Prefer `curl -fsSL <url> | bash` installers over package managers** for CLI tools. Fall back to `npm_install_global` only when no official installer exists. **Exception — LLM CLIs (`claude`, `copilot`, `gemini`, `opencode`) use `npm_install_global` even when a curl|bash installer exists.** Reason: `npm_install_global` auto-mirrors to the Windows host on WSL via `cmd.exe /c npm install -g`, giving side-by-side Linux+Windows installs from a single call. curl|bash installers only land on the current OS, so WSL users would need a separate winget/scoop step on the Windows side. Cost accepted: lose vendor-blessed self-update; trade is worth it for WSL parity.
- **Use grep/regex compatible with both `grep` and `rg`.** `grep` may alias to `rg`. Avoid `grep -E`. Use basic regex (`[0-9][0-9]*` not `[0-9]+`).
- **Use `((var))` for boolean flag checks.** All flags (`is_os_*`, `IS_CI`, `IS_FORCE_REFRESH`) use `0`/`1`. Check `((IS_CI))` or `! ((IS_CI))`. `IS_CI` is derived from `$CI` in `run.sh` — don't use `$CI` directly.
- **`is_os_ubuntu` is the catch-all Debian-family flag — MUST stay last in `run.sh` detection.** Gated by `! ((is_os_mac || is_os_chromeos || is_os_mingw64 || is_os_android_termux || is_os_arch_linux || is_os_steamos || is_os_redhat))` so containerized Linux runners can't leak `is_os_ubuntu=1` onto Arch/RHEL/SteamOS. New OS flags go above. `is_os_windows`/`is_os_wsl` stay below (WSL Ubuntu legitimately sets ubuntu+windows together).
- **Use `command <tool>` to bypass shell aliases when running commands.**
- **Use `has_persistent_binary` (scripts) / `type -P` (shell)** for binary detection. Never `which` or `command -v`. `has_persistent_binary <name>` excludes `/tmp/` matches (so bootstrap node fallback `/tmp/synle/bashrc/node/bin` doesn't short-circuit real installs), prints resolved path on success. Use plain `type -P` only in `profile-*.sh`, `common-functions.bash`, `run.sh`, `common-env.sh`.
- **Use `npm_install_global <pkg> [binary]` for npm global installs.** Handles skip-if-installed; installs to `$HOME/.local`; on WSL also to Windows via `cmd.exe`. Pass explicit binary name when it differs from package (e.g. `npm_install_global @google/gemini-cli gemini`). Don't duplicate skip logic.
- **Use `ensure_binary_alias <canonical>` when a package installs under a non-canonical binary name.** apt installs `bat` as `batcat`, `fd-find` as `fdfind`. Helper reads its OS override table and symlinks `$HOME/.local/bin/<canonical>`. To add: extend the inline `case` in `ensure_binary_alias` + call from the relevant Linux `_full-setup.sh`. Tests in `software/tests/ensureBinaryAlias.spec.js`.
- **Always use `print_action_summary <target> [<binary> [<extra_args>...]]` when acting on a single file/folder** (cd, view, edit, cat). Prints copy-paste-runnable `PWD:`/`cd "..."`/`<binary> "..."` block (+ WSL Windows path) before the side effect. Lives in `profile-core.sh` above all SOURCE partials. Callers: `view_file`, `fuzzy_edit`, `fuzzy_cd`, `run_editor`. Do not hand-roll an echo block. For WSL path conversion, use sibling `to_windows_path <unix_path>` (don't call `wslpath -m` directly).
- **Bash functions must use the `function` keyword.** `function foo() {` not `foo() {`. Mandatory in every bash context (scripts, `.profile.bash` partials, and bash emitted from JS `` code`...` ``). Bash 3.2 (pre-Catalina) can fail to parse `name() { ... }` inside `if ...; then ... fi` — the keyword disambiguates.
- **Never put literal `(` or `)` in bash path/glob string literals — replace with `*`.** Bash 3.2 parses `*(`, `+(`, `?(`, `@(`, `!(` as extglob operators even inside double quotes. Write `"/mnt/c/Program*Files*86*/..."` instead of `".../Program Files (x86)/..."`. `*` matches space+paren on real FS. Enforced by `software/tests/pathArrayValidation.spec.js`.
- **Do not use `disown` in shell scripts.** Use `( ... ) &` instead.
- **Use `safe_source` instead of `source`/`. `.** Validates syntax with `bash -n` first. Do NOT append `> /dev/null 2>&1`. Exception: in `run.sh` common-env section, use `. ` (safe_source not yet defined).
- **Prefer one-liner `&&` chains for `eval`/`init`/`source` guards.** `type -P zoxide &>/dev/null && eval "$(zoxide init bash --cmd cd)"` not multi-line `if`/`then`/`fi`.
- **Use `> /dev/null` (not `&> /dev/null`) for standalone install commands** (`curl ... | bash > /dev/null`). Keeps stderr visible. `&> /dev/null` is fine inside conditionals and for checks (`type -P`, `command`, `grep`).
- **Use `< /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log` for package-manager commands in `_full-setup.sh`.** `< /dev/null` prevents the subprocess from consuming the heredoc's stdin (crashes the heredoc bash). `&>>` appends both streams to the log dumped by `~wrapup.sh` in CI.
- **Use `LINE_BREAK_HASH`** (and `LINE_BREAK_SLASH`, `LINE_BREAK_EQUAL`) instead of hardcoded `#` strings.
- **User-facing bash functions need inline `--help` via `is_help_arg`.** Check `if is_help_arg "${1:-}"; then ...` (not a hand-rolled regex) and print help via single multi-line `echo`. Helper is mirrored in `profile-core.sh` and `common-functions.bash` (keep bodies byte-identical). Recognizes `help`, `--help`, `-help`, `/help`, `-h`, `?`, `-?`, `/?` case-insensitively. First line: `"funcname: short description"`. Keep a matching `#` comment above the function. Inline help is source of truth — don't duplicate in comments. To extend triggers: edit both `is_help_arg` copies + update `software/tests/isHelpArg.spec.js`.
- **Never use `"""` or `'''`** — bash has no triple-quote syntax; use `"` for multi-line strings.
- **Use `find_path` / `find_path_list` to resolve paths from a candidate list.** First match vs all matches (newline-separated). Modes: `--file`, `--folder`, `--exec`, `--any`. Wildcards supported. Pass via array: `local candidates=(...); find_path "${candidates[@]}" --folder`. Ambiguous wildcard matches skip in `--file`/`--folder`/`--any`; `--exec` iterates all. JS equivalents: `findPath(srcDir, regex, { type })`, `findPathList(...)`. `find_existing` is a deprecated wrapper.
- **Use `is_truthy` for string boolean checks.** Matches `1`, `true`, `y`, `yes` (case-insensitive). For user-facing flags: `is_truthy "${1:-}" && do_something`. For internal `0`/`1`, keep `((var))`.
- **Use `exit_if_not_sudo` as the first line of root-required shell scripts.** Bash analog of JS `exitIfNotSudo()`. Lives in `common-functions.bash`. Exits 0 with `>>> Skipped <script>: must run as root (use sudo)` if `id -u` is non-zero. Replaces hand-rolled `[ "$(id -u)" -ne 0 ] && exit` guards.
- **Use `prompt_yes_no <prompt> [default]` for interactive yes/no prompts.** In `common-functions.bash`. Returns 0/1. Default arg `Y` or `N`; empty input → default. Use as `prompt_yes_no 'Continue?' && do_thing`.
- **Use "folder" not "dir"/"path"/"directory" in function/variable names.** E.g. `_dropbox_folder`, `godownload --folder`, `_RECENT_FOLDERS_FILE`.
- **Always use `command cat` in scripts/functions, never raw `cat`.** Raw `cat` is fragile — future wrappers/aliases (`bat`) can mangle the byte stream and pollute output. `command cat` bypasses shell wrappers. Applies to all forms (`command cat "$file"`, `command cat -`, `command cat > "$file"`, `command cat << 'EOF'`). Only exception: the user-facing alias `c="command cat"`. Raw `cat` is OK only in CLI examples inside echoed help text.
- **Profile partials must parse on bash 3.2 (macOS `/bin/bash`).** `safe_source` runs `bash -n`, which on macOS is `/bin/bash` 3.2.57 — bash 4+ parse errors break `~/.bash_syle` loading entirely. Avoid in `profile-*.sh` and `*.profile.bash`: `[[ -v VAR ]]` (4.2+ — use `[ -n "${VAR+x}" ]`), `${var,,}`/`${var^^}` (4.0+ — use `tr`), `declare -A` (4.0+), `coproc` (4.0+), `${var@Q}` (4.4+). Runtime-only 4+ features (`mapfile`/`readarray`, `wait -n`) parse fine on 3.2 but fail at runtime — replace if the code path can run on 3.2 (e.g. autocomplete). Existing precedent: `while IFS= read -r line; do COMPREPLY+=("$line"); done` instead of `mapfile`.

### JS Conventions

- **Prefer tagged template literals over function calls.** Use `code`, `list`, `set`, `json`, `readText`, `readJson`. `readText`/`readJson` are async (use `await`). Escape `${VAR}` as `\${VAR}`; backticks as `` \` ``.
- **External files read by `readText` must avoid `${` and backticks** (interpreted by JS template literals). Skip this rule for files over 150 lines.
- **Never use bare `fs.copyFileSync`.** Its `FICLONE`/`copy_file_range` syscalls fail with `EPERM` on cross-device and network (SMB) mounts. Wrap: `try { fs.copyFileSync(src, dest); } catch { fs.writeFileSync(dest, fs.readFileSync(src)); }`. In `_cp_node_helpers` contexts, use `safeCopyFile(src, dest)`.
- **`.su.js` scripts run as root via `sudo -E node`.** Self-contained — no state from other scripts. Guard with `exitIfNotSudo()` as first line of `doWork()`. All `.su.js` scripts are bundled into one sudo call to avoid multiple prompts.

### Profile & Config Conventions

- **Place code in the correct section.** Every organized file uses section markers in this style: `// --- Title ---` in JS/JSONC/TS, `# --- Title ---` in bash, `[section]` in git config. **Do NOT use the older `////// Title //////` style** — when touching a file that still has those markers, convert them to `// --- Title ---` in the same edit so the codebase converges on one style. Read existing sections before adding new code so similar things cluster together.
- **Pre-place empty markers for every registered block.** Short form: `# BEGIN/END - key`. Pre-core → `profile-core.sh` top. Platform tweaks / post-profile → `profile-advanced.sh` bottom. Autocomplete → `profile-advanced.sh` (before post-profile). PowerShell → `powershell-profile.ps1.bash`.
- **Do not use `/` in config key names** — Prettier inserts stray blank lines. Use `-`.
- **Use `registerWithBashSyleProfile` / `registerPlatformTweaks` for writes to `BASH_SYLE_PATH`.** Never read/write directly — conflicts with buffered flush. Exception: `~cleanup.js`.
- **Never pass comment-only content to `registerProfileBlock` / `registerPlatformTweaks`.** Bash `{ }` requires at least one real command. Add `: # no-op` if empty.
- **One block per logical thing — duplicate `configKey` throws.** `registerProfileBlock` (and wrappers) errors on duplicate keys within a flush window (silent overwrites previously dropped real config). For multiple blocks per platform, pass a `subKey` to `registerPlatformTweaks(platformName, content, subKey)` → `"<platform> OS-specific Tweaks - <subKey>"`, or pick distinct keys. Precedent: `Browser Launchers - Brave`/`Chrome`, `Editor Launchers - Vim`/`Sublime Text`, `Mac OS-specific Tweaks - iTerm2`.
- **Use `isForceRefreshStale(path)` / `is_force_refresh_stale` instead of checking `IS_FORCE_REFRESH` directly.** Ensures force-refresh only triggers when target is stale (>2 weeks).
- **Always `await backupConfigFile(path)` before writing to a user config file.** Creates `.bak_original` (first-ever snapshot, never overwritten) and `.bak_latest` (previous state). Applies to all `writeText`/`writeJson`/`writeConfigToFile` targeting real app configs (Sublime, VS Code, Brave, Git, Vim). Not for `writeBuildArtifact` or `BASH_SYLE_PATH`.

### Other Conventions

- **Git aliases: lowercase with hyphens.** `clean-and-fetch` not `clean_and_fetch`.
- **Prefer POSIX-compatible shell in git aliases.** They run through MSYS2/MinGW `sh` on Windows.
- **Zed keymaps use `-` not `+`** for key combinations. `alt-q` not `alt+q`.
- **`EDITOR_CONFIGS` is the single source for ignored folders and binary file extensions.** Edit only in `software/index.js`.
- **Makefile uses `.ONESHELL` (GNU Make 4+).** `$$` to escape `$` for shell vars. Script filenames match Makefile target (e.g. `format_shell` → `software/tools/format-shell.sh`).

## Change Workflow Checklist

1. **Add JSDoc** on ALL functions, constants, and code touched.
2. **`make validate`** — automated by `Stop` hook when uncommitted changes exist.
3. **Test command reminder** — automated by `PostToolUse` hook for `software/scripts/` files.
4. If you modified `software/index.js` or `software/tools/build-include.js`, write/update unit tests in `software/tests/`.
5. **Update CLAUDE.md** — when changing `software/index.js`, `run.sh`, `software/bootstrap/common-env.sh`, or `.github/actions/ci-build/action.yml`, update relevant sections (Architecture, Key Files, CI/CD) to match.
6. **Update keybinding reference** — when changing any keybinding (any editor/terminal/browser/CLI tool), update `docs/editor-keybindings.md`. Single source of truth.

## Commands

```bash
make init                  # Install deps + mkdir .build
make setup                 # Alias for setup_local_full
make setup_local_full      # Full setup from local files (installs deps via _full-setup.sh)
make setup_local_profile   # Refresh profile only (no dep install)
make setup_prod            # Bootstrap from GitHub (prod)
make validate              # Format + run unit tests (Stop hook)
make format                # Run all formatting
make format_build_include  # Process BEGIN/END markers
make format_ci_binaries    # Regenerate CI binary checks block from ci-binaries.json
make build                 # All default build steps
make build_webapp          # Build webapp for production
make build_installer       # Build .build/install-bashrc.sh (self-extracting; uploaded to binary-cache in CI)
make test_unit             # Unit tests
make test_coverage         # Unit tests + istanbul coverage report (thresholds pinned in vitest.config.js)
make test_profile          # bash -n profile syntax checks
make test_smoke            # Puppeteer webapp smokes (live)
make test_smoke_local      # Puppeteer webapp smokes (local dist)
make test_buildconfig      # Inline snapshot shape checks
make test_buildconfig_update  # Update inline snapshots
make test_dryrun           # Dry-run setup (JS scripts only, no writes)
make test_all              # All test suites except coverage
make dry_run               # Unit tests + dry-run all scripts
make clean                 # Clean prebuilt profiles + autogen + BEGIN/END
make doctor                # Diagnostics
make new-script name=<n> [os=mac] [type=sh]   # Scaffold a new script file
```

### Single test

One Vitest config per suite. Pass a file path as a positional arg, or `-t` to filter by test name:

```bash
npx vitest run --config vitest.config.js software/tests/parseRawArgs.spec.js
npx vitest run --config vitest.config.js -t "parses --files flag"
npx vitest run --config vitest.profile.config.js software/tests/profileSyntax.spec.js
npx vitest run --config vitest.buildconfig.config.js software/tests/buildConfigShape.spec.js
```

Suite → config: unit → `vitest.config.js`, profile syntax → `vitest.profile.config.js`, buildconfig snapshots → `vitest.buildconfig.config.js`, Puppeteer smokes → `vitest.smoke.config.js` (live) / `vitest.smoke.local.config.js` (local dist). Update snapshots: `make test_buildconfig_update`.

### run.sh

```bash
bash run.sh                          # Full run (auto-detects local repo or fetches from GitHub)
bash run.sh --files="git.js"         # Run specific script(s)
bash run.sh git.js vim-config.js     # Bare args as files
bash run.sh --debug                  # Keep temp files, show retry commands
bash run.sh --force-refresh          # Force reinstall (heavy items only if stale >2 weeks)
bash run.sh --refresh="fzf.js,fonts.js" # Force refresh specific scripts
bash run.sh --verbose                # Bash tracing (set -x)
bash run.sh --preset=lightweight     # Run a named preset (see software/metadata/presets.jsonc)
bash run.sh --preset=a,b             # Compose multiple presets — file lists union
bash run.sh --preset=editor          # Partial match: case-insensitive substring; auto-resolves if 1 hit
bash run.sh @llm                     # Bare @-marker → strict preset lookup (skip script search)
bash run.sh editors                  # Bare arg → script-first; falls back to preset on miss
bash run.sh --files=vim              # Same partial match; ambiguous matches print suggestions
bash run.sh --dryrun                 # Show what would change without writing
bash run.sh --remove --files="fzf.js" # Remove a script's config (runs undoWork)
```

**When sharing a `bash run.sh` command, offer both forms when applicable:** `--files=<script>` (narrow) AND `--preset=<name>` (broad bundle). E.g. after editing `bash-keys.profile.bash`, suggest both `--files=bash-keys` and `--preset=terminal`. Share only one form if only one applies.

## Architecture

Full architecture guide (execution pipeline, data flow, layer breakdown, script system, adding scripts): **[DEV.md](DEV.md)**.

Key concepts at a glance:

- **`node | bash` pipeline**: Node generates bash to stdout; bash executes.
- **`index.js` is dual-purpose**: utility library (globals for scripts) + bootstrap entry. `tsc --declaration --allowJs` generates `software/index.d.ts` (full API).
- **OS flags**: `is_os_<name>=1` env vars from `common-env.sh`; boolean globals in `index.js` via `getRuntimeOption()`.
- **Script discovery**: `getSoftwareScriptFiles()`. Priority tiers: `_init` → `_full-setup` → `a-z` → `~cleanup` → `lastFiles`. Consecutive same-type scripts bundled. `.common.js` (shared helpers) and `.standalone.js` (on-demand) excluded from full/setup/dryrun.
- **`--files` auto-refresh**: `_doWorkTestFiles()` appends `~refresh-source.standalone.js` to every `--files` run to refresh SOURCE_BEGIN/SOURCE_END in `~/.bash_syle`. Full runs use `~cleanup.js` instead.
- **Profile assembly**: `~/.bash_syle` from `profile-core.sh` + `profile-advanced.sh` via `registerWithBashSyleProfile()` / `registerPlatformTweaks()`.
- **BEGIN/END**: build-time inlining (`make format_build_include`). **SOURCE**: runtime includes via `readText()`.
- **Presets** (`software/metadata/presets.jsonc`): named `--preset=<name>` bundles. JSONC format — supports `//` and `/* */` comments and trailing commas; `loadPresets()` in `software/index.js` strips them via `stripJsoncComments` before `JSON.parse`. Each entry has `files[]` and/or `presets[]` (references to other presets — composed recursively) + optional description. End-user composites: `lightweight` and `heavyweight` (every building block — symmetric counterpart to `lightweight`). Building blocks: `editors`, `emulators`, `apps`, `browsers`, `terminal`, `prompt`, `llm`. Compose at the CLI: `--preset=a,b` unions lists. Recursive expansion is cycle-detected at parse time — self-references and transitive loops (A→B→A) throw with the offending chain; `software/tests/presets.spec.js` guards the checked-in file. `printRunInfo` prints each preset's description, referenced presets, and fully-expanded file list. To add: edit `presets.jsonc`, `make format`, `bash run.sh --preset=<new>`.
- **CLI resolution**: `--files=<x>` strict script; `--preset=<x>` (and `--preset=@<x>`, leading `@` stripped) strict preset with case-insensitive substring fuzzy fallback; bare `<x>` script-first then preset-fallback (`_resolveBareArgPresetFallback`, exposed via `BASHRC_BARE_ARGS` env); bare `@<x>` strict preset (skip script search). Script matches via `_resolveScriptFile`'s three tiers (exact path → exact basename → partial regex) — script always wins on collision (e.g. `bash run.sh llm` resolves to `llm-common.js` partial match, not the `llm` preset; use `@llm` to force preset). 1 match auto-resolves; 2+ matches print copy-paste suggestions formatted for the matching CLI form; 0 matches → not-found error.
- **LLM client setup** (`software/scripts/advanced/llm/`): per-CLI subfolders for `claude`, `copilot`, `gemini`, `opencode`, plus `ollama.sh` / `ollama.profile.bash`. Claude is the base — shared rules + commands + keybindings live in `_common/` (e.g. `instructions.md` is the single source for the global CLAUDE.md / AGENTS.md / GEMINI.md generated files — never hand-edit those; `_common/commands/*.md` feeds Claude + opencode-via-symlink). Full surface-parity matrix + settings-intent table + migration guide (Claude Code → OpenCode / Copilot): [`software/scripts/advanced/llm/llm.md`](software/scripts/advanced/llm/llm.md). Refresh all four CLIs at once: `bash run.sh --preset=llm`. `llm-common.js` is the shared JS helper.
- **Self-extracting installer** (`make build_installer` → `.build/install-bashrc.sh`): bash script with base64'd `tar.gz` of `run.sh` + `software/{index.js,common.js,bootstrap,scripts,metadata}` after a `__BASHRC_INSTALLER_PAYLOAD_BELOW__` sentinel. Extracts to per-PID tmp dir (`BASHRC_INSTALLER_DIR` to override; `BASHRC_INSTALLER_KEEP=1` to persist) and `exec`s `run.sh "$@"`. Built in Prep CI (`make ci_prep`), mirrored to binary-cache as `bashrc-installer__install-bashrc.sh`. `.build/` is gitignored.

### Key Files

| Path                                                 | Purpose                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run.sh`                                             | Entry point. Bash pre-scan, JSON-encodes args, calls `run_files()`                                                                                      |
| `software/bootstrap/common-env.sh`                   | Shared constants (`LIMITED_SUPPORT_OSES`, `ALL_OS_FLAGS`); sourced by `run.sh` via BEGIN/END                                                            |
| `software/metadata/presets.jsonc`                    | Named install presets (`--preset=<name>`); JSONC (comments + trailing commas allowed); read by `run.sh` into `PRESETS_JSON`, expanded by `parseRawArgs` |
| `software/bootstrap/common-functions.bash`           | Shared shell helpers; sourced by `.sh` scripts via SOURCE markers                                                                                       |
| `software/index.js`                                  | Arg parsing (`parseRawArgs`), utility library, script runner, run info                                                                                  |
| `software/scripts/_full-setup.common.linux.bash`     | Shared Linux helpers (fnm/node, lock waits, display-dj, power mgmt); sourced by all Linux `_full-setup.sh`                                              |
| `software/scripts/*.js`                              | Cross-platform scripts                                                                                                                                  |
| `software/scripts/<os>/`                             | OS-specific scripts                                                                                                                                     |
| `software/common.js`                                 | Core shared constants and `replaceBlock`. Inlined into index.js                                                                                         |
| `software/tools/build-include.js`                    | BEGIN/END block substitution engine + inline marker processor                                                                                           |
| `software/tools/generate-ci-binary-list.js`          | Renders BEGIN/END `ci-binary-checks` block in `action.yml` from `ci-binaries.json`                                                                      |
| `software/tools/build-installer.js`                  | Builds `.build/install-bashrc.sh` self-extracting installer                                                                                             |
| `software/metadata/autocomplete.common.js`           | Single source for spec-based autocomplete mappings, dynamic-token list (`DYNAMIC_TOKENS`), and build-time macro expander (`expandSpecMacros`)           |
| `software/metadata/ci-binaries.json`                 | Single source for CI binary verification (`required` + `warn`). YAML block in `action.yml` is auto-generated                                            |
| `software/metadata/script-list.js` / `.config`       | Scans `software/scripts/` and emits the canonical sorted script list consumed at build time                                                             |
| `software/metadata/ip-address.config.js` / `.config` | Parses hostname/IP groups; feeds host-mapping build steps (`build_host_mappings`)                                                                       |
| `software/scripts/advanced/llm/`                     | Per-CLI LLM client setup (`claude/`, `copilot/`, `gemini/`, `opencode/`, `ollama.sh`) plus shared `_common/` (instructions, commands, keys)             |
| `vitest.config.js`                                   | Unit test config + istanbul coverage thresholds (one-off override of rule 38; numbers live here, not in CLAUDE.md)                                      |
| `$BASHRC_TEMP_DIR/run_timing.json`                   | Per-run timing data (start/end, per-script duration+status); read by CI                                                                                 |

## Testing

Six suites: `make test_unit` (vitest sandbox tests for index.js), `make test_coverage` (unit tests + istanbul coverage report), `make test_profile` (bash -n syntax checks), `make test_smoke` (Puppeteer webapp), `make test_buildconfig` (inline snapshot shape), `make test_dryrun` (dry-run all JS, no writes). `make test_all` runs everything except coverage.

**Coverage:** Vitest unit suite uses istanbul. Thresholds (lines/statements/branches/functions) are pinned in `vitest.config.js` — that file is the source of truth for the actual numbers and for the `include`/`exclude` globs. Treat it as authoritative; do not duplicate the percentage here. The current floor is a one-off override of the default 80/90 gate (rule 38), justified inline in `vitest.config.js`. There is no Rust / `cargo-llvm-cov` in this repo; if a future sibling project (Rust, Tauri) is added under this tree, document its coverage config path alongside the vitest entry rather than hardcoding numbers.

**VSCode debugging:** `.vscode/launch.json` provides launch configs for the current script (via `software/.debug-runner.js`) and Vitest (run-all + debug-current-file).

Test setup (`software/tests/setup.js`): loads index.js in VM sandbox. Access via `getIndexFunction(name)` / `getIndexConstant(name)`. `fileSystem` and `fetchResponses` for in-memory mocks, auto-reset in `beforeEach`.

When adding new `.sh` files, register them in `software/tests/profileSyntax.spec.js`.

**OS-detection regression tests** (`software/tests/osDetection.spec.js`): hermetic harness pulls `_detect_os` from `run.sh` by line markers (no hardcoded line numbers) and replays it against fake `/etc/os-release`, fake `/proc/version`, isolated sandbox `PATH`, and per-test overrides. When you change OS flags or add an OS, add a case here covering the positive detection AND that no other Linux distro flag leaks.

## CI/CD

GitHub Actions (`.github/workflows/build-main.yml`): push to master → Prep → Build (parallel OS builds) → Publish (GitHub Pages) → Test. All steps use Makefile targets.

**Adding/removing a CLI tool: edit `software/metadata/ci-binaries.json`.** Single source for binary verification. The `# BEGIN/END ci-binary-checks` block in `.github/actions/ci-build/action.yml` is auto-generated via `make format_ci_binaries` (part of `make format`). Only non-GUI command-line binaries belong in the manifest.

**Binary check tiers:**

- `check_binary_required <name>` — fails build if missing. Reserve for binaries shipped on EVERY platform. Must install foreground on mac (`installBrewPackage`, not `installBrewPackageInBackground`) because mac's background queue is skipped in CI (`((IS_CI)) && return`). Apt/dnf/pacman background installs DO complete (waited on by `_waitForBackgroundPackages`), so background is fine on Linux.
- `check_binary_warn <name>` — warns but never fails. Use for: `advanced/*.sh` GitHub-release fallbacks (network flakiness), AUR-only on Arch, or anything via `installBrewPackageInBackground` on mac.

CI build action (`ci-build/action.yml`) generates a job summary with collapsible sections in order: **OS Flags** (active first, from `~/.bash_syle_common`), Profile Syntax, Binary Verification, Download Asset Verification, Script Results (from `run_timing.json`), Build Summary. Binary check also echoes `Failed: <names>` / `Warned: <names>` to stdout.

## GitHub Codespaces

`install.sh` is the single source for codespace setup. Codespace-specific aliases → `.devcontainer/codespaces-profile.sh`. Don't hand-edit `devcontainer.json` extensions — auto-generated by `vs-code-ext.js`.

## Skills Reference

Step-by-step playbooks live in `.claude/skills/<name>/SKILL.md`. Read the matching SKILL.md before reinventing the steps.

| Skill / slash command | When to use                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `/add-package`        | Adding a new CLI tool / package across platforms                                                    |
| `/remove-package`     | Dropping a CLI tool from the setup                                                                  |
| `/add-os`             | Onboarding a new Linux distro, macOS variant, or platform                                           |
| `/remove-os`          | Dropping platform support                                                                           |
| `/run`                | Resolving `bash run.sh --files="..."` from a script-name keyword (handles fuzzy match + OS subdirs) |
| `/check`              | Verifying changes from this session survived a merge / rebase / hook (restores if missing)          |

## Git / PR Merge Policy

- Always **squash and merge** PRs. Never merge commits or rebase merges.
- May `git merge origin/main` or `git merge origin/master` locally to sync, but PR merges are always squash.
- **Always rebase before pushing** (`git pull --rebase` before `git push`).
