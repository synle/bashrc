# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal bash profile and dotfiles management system (`synle/bashrc`). Automates setup of shell configuration, editor settings, fonts, Git config, and OS-specific tweaks across macOS, Ubuntu/Debian, WSL, Android Termux, Arch Linux/Steam Deck, and ChromeOS.

## Rules

### Protected Content

- **Do not modify anything in the `.build/` folder.** Contains generated artifacts — never manually edit. (Also enforced by PreToolUse hook.)
- **Do not modify anything in the `assets/` folder directly.** Release asset backups (display-dj, sqlui-native, url-porter) are uploaded by the CI prep step or the repo owner's release workflow. Font files and other static assets are managed by the owner.
- **Do not modify content inside `# BEGIN`/`# END` markers in generated files.** These blocks are managed by `build-include` and will be overwritten on the next `make format_build_include`. Edit the source file referenced in the marker instead.
- **Do not modify `SOURCE_BEGIN`/`SOURCE_END` blocks in generated profile files.** These are runtime SOURCE includes — content is re-fetched from the referenced file on every run. Edit the source file instead. In repo source files, only the single-line `# SOURCE path` or `// SOURCE path` marker should appear.

### Code Style

- **Always add JSDoc for ALL code in every change.** Mandatory on every function, constant, type, interface, and any code you touch. Script files must start with a single-line `/** Description. */` file header (note: `/**` not `/** *`).
- **Always use lowercase hex colors.** Write `#1e1e1e` not `#1E1E1E`.
- **Never use `node:` prefix for Node built-in module requires/imports.** Write `require("fs")` not `require("node:fs")`. The `node:` prefix breaks on older Node versions (e.g., Volta-pinned projects).
- **Always use `curl -fsSL` for curl commands.** No other flag combos.
- **Never use `raw.githubusercontent.com` or `api.github.com/repos/.../contents`. Always use the blob/HEAD `?raw=1` format.** Write `https://github.com/{owner}/{repo}/blob/HEAD/{path}?raw=1` — not `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` and not `https://api.github.com/repos/{owner}/{repo}/contents/{path}`. This applies to all GitHub repos, not just this one. For this repo, use `getGitHubRawUrl(path)` in JS or `get_github_raw_url <path>` in bash (both construct the full URL from `$BASH_PROFILE_CODE_REPO_RAW_URL`).
- **Use `log()` for all output. Never use raw `console.log` or `console.error`.** `log()` outputs to stderr via `console.error`, safe in the `node | bash` pipeline. Only `emitBash()` should write to stdout.

### Shell Conventions

- **New `.sh`/`.bash` scripts in `software/scripts/` must start with `#!/usr/bin/env bash` and `# SOURCE software/bootstrap/common-functions.bash`.** This ensures shared functions (`npm_install_global`, `has_persistent_binary`, `curl_bash_install`, `is_force_refresh_stale`, etc.) are available at runtime. Only omit the SOURCE line if the script genuinely uses none of those functions.
- **Always use `"$HOME/"` not `~/` in `.sh`/`.bash` scripts.** `~` is not quoted-safe and inconsistent with the rest of the codebase. Write `"$HOME/.config"` not `~/.config`.
- **Use `safe_touch`, `safe_mkdir` instead of `touch`, `mkdir` for paths inside `$HOME`.** These fix root ownership from prior `sudo` runs. `safe_mkdir` includes `-p` by default — do not pass `-p`. Plain `touch`/`mkdir` are fine for paths outside `$HOME` (e.g. `/mnt/`, `/tmp/`).
- **Use `safe_chown` and `safe_chmod` instead of `chown`, `chmod`.** Both skip paths that do not exist and skip when already correct. Always pass one path per call. `safe_chown [-R] [user] <path>` runs `sudo chown` (defaults to `$USER`, pass a username to chown to another user). `safe_chmod [-R] <mode> <path>` runs `chmod`.
- **Default to bash; use POSIX `sh` only when the shebang says so.** All scripts under `software/scripts/` use `#!/usr/bin/env bash` and full bash syntax unless there is a specific reason for `#!/bin/sh`. If a file starts with `#!/system/bin/sh` or `#!/bin/sh`, write POSIX `sh`-compatible code only — no bash arrays, no `function` keyword, no `[[ ]]`, no `${var,,}`, no `local arr=(...)`, no `(( ))`. Use `fname() {`, `[ ]`, `case`, and newline-delimited strings instead.
- **Prefer `curl -fsSL <url> | bash` installers over package managers (npm, pip, etc.) for CLI tools.** Official installer scripts are more reliable and up-to-date than package manager distributions. Only fall back to `npm_install_global` when no official installer exists.
- **Use grep/regex syntax compatible with both `grep` and `rg`.** `grep` may be aliased to `rg`. Avoid `grep -E` (rg interprets `-E` as encoding). Use basic regex — e.g. `[0-9][0-9]*` instead of `[0-9]+`.
- **Use `((var))` for boolean flag checks (no spaces).** All boolean flags (`is_os_*`, `IS_CI`, `IS_FORCE_REFRESH`, etc.) use `0`/`1` values. Check with `((IS_CI))` (truthy) or `! ((IS_CI))` (falsy). `IS_CI` is derived from `$CI` in `run.sh` — do not use `$CI` directly.
- **Use `command <tool>` to bypass shell aliases/wrappers when running commands.**
- **Use `has_persistent_binary` for binary detection in scripts, `type` for shell functions.** Do not use `which` or `command -v`. In `software/scripts/*.sh` files, always use `has_persistent_binary <name>` instead of `type -P` for checking if a binary is installed. It excludes `/tmp/` matches so the bootstrap node fallback directory (`/tmp/synle/bashrc/node/bin`) doesn't short-circuit real installs. On success it prints the resolved path to stdout. Use plain `type -P` only in `profile-*.sh`, `common-functions.bash`, `run.sh`, and `common-env.sh` (where `has_persistent_binary` may not yet be defined).
- **Use `npm_install_global <pkg> [binary]` for npm global installs.** Handles skip-if-installed checks (via `has_persistent_binary`) and installs to `$HOME/.local` on the current system. On WSL, also installs to the Windows host via `cmd.exe`. The `binary` arg is the binary name to check (defaults to the last segment of `pkg`, e.g. `yarn` from `yarn`, `gemini-cli` from `@google/gemini-cli`). Pass an explicit binary name when it differs from the package (e.g. `npm_install_global @google/gemini-cli gemini`). Callers should not duplicate skip logic — just call `npm_install_global`.
- **Bash functions must use the `function` keyword.** `function foo() {` not `foo() {`.
- **Do not use `disown` in shell scripts.** Use `( ... ) &` instead.
- **Use `safe_source` instead of `source`/`. ` for sourcing scripts.** Validates syntax with `bash -n` before sourcing. Do NOT append `> /dev/null 2>&1`. **Exception:** In `run.sh` itself (the common-env section), use plain `. ` (safe_source not yet defined).
- **Prefer one-liner `&&` chains for `eval`/`init`/`source` guards.** Write `type -P zoxide &>/dev/null && eval "$(zoxide init bash --cmd cd)"` instead of multi-line `if`/`then`/`fi`.
- **Use `> /dev/null` (not `&> /dev/null`) for standalone install commands** (e.g. `curl ... | bash > /dev/null`). Keeps stderr visible for debugging. Leave `&> /dev/null` alone inside `if`/`elif` conditionals and for checks (`type -P`, `command`, `grep`).
- **Use `< /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log` for package manager commands in `_full-setup.sh` scripts.** `< /dev/null` prevents the command from reading the heredoc's stdin (subprocesses can consume remaining script commands, crashing the heredoc bash). `&>>` appends both stdout and stderr to the log for debugging. The log is dumped by `~wrapup.sh` in CI.
- **Use `LINE_BREAK_HASH`** (and `LINE_BREAK_SLASH`, `LINE_BREAK_EQUAL`) instead of hardcoded `#` strings.
- **User-facing bash functions must include inline `--help` support.** Check `[[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]` and print help text using a single multi-line `echo` call. Format: first line is `"funcname: short description"`, subsequent lines indented with usage/examples. Keep a matching one-liner `#` comment above the function declaration. Do not duplicate usage details in comments — the inline help is the source of truth.
- **Never use `"""`** or `'''` — bash has no triple-quote syntax; use `"` for multi-line strings.
- **Use `find_path` / `find_path_list` to resolve paths from a list of candidates.** `find_path` returns the first match; `find_path_list` returns all matches (newline-separated). Both support `--file`, `--folder`, `--exec`, `--any` modes and wildcard patterns. Pass candidates via an array: `local candidates=(...); find_path "${candidates[@]}" --folder`. Use `--exec` mode for binary/editor resolution. Ambiguous wildcard matches (multiple results) are skipped in `--file`/`--folder`/`--any` modes; `--exec` iterates all matches. JS equivalents: `findPath(srcDir, regex, { type })` and `findPathList(srcDir, regex, { type })`. `find_existing` is a deprecated wrapper for `find_path`.
- **Use `is_truthy` for string boolean checks.** Matches `1`, `true`, `y`, `yes` (case-insensitive). Use for user-facing flags: `is_truthy "${1:-}" && do_something`. For internal `0`/`1` flags, continue using `((var))`.
- **Use "folder" not "dir" or "path" or "directory" in function/variable names.** Consistent naming convention across the codebase (e.g., `_dropbox_folder`, `godownload`'s `--folder` mode, `_RECENT_FOLDERS_FILE`).

### JS Conventions

- **Prefer tagged template literals over function calls.** Use `code`, `list`, `set`, `json`, `readText`, `readJson` tagged template literals. `readText`/`readJson` are async (use `await`). Escape `${VAR}` as `\${VAR}`; backticks as `` \` ``.
- **External files read by `readText` must avoid `${` and backticks** (interpreted by JS template literals). Skip this rule for files over 150 lines.
- **Never use bare `fs.copyFileSync` for file copies.** It uses `FICLONE`/`copy_file_range` syscalls that fail with `EPERM` on cross-device and network (SMB) mounts. Wrap with a read+write fallback: `try { fs.copyFileSync(src, dest); } catch { fs.writeFileSync(dest, fs.readFileSync(src)); }`. In `_cp_node_helpers` contexts, use `safeCopyFile(src, dest)` instead.

### Profile & Config Conventions

- **Place code in the correct section.** Every organized file uses section markers (`//////` in JS, `# ----` in bash, `// ---` in JSONC, `[section]` in git config). Read existing sections and place new code where it logically belongs.
- **Pre-place empty markers for every registered block.** Short form: `# BEGIN/END - key`. Pre-core blocks -> `profile-core.sh` (top). Platform tweaks / post-profile -> `profile-advanced.sh` (bottom). Autocomplete -> `profile-advanced.sh` (before post-profile). PowerShell -> `powershell-profile.ps1.bash`.
- **Do not use `/` in config key names** — causes Prettier to insert stray blank lines. Use `-` instead.
- **Use `registerWithBashSyleProfile` / `registerPlatformTweaks` for writing to `BASH_SYLE_PATH`.** Never read/write `BASH_SYLE_PATH` directly — conflicts with buffered flush. Exception: `~cleanup.js`.
- **Never pass comment-only content to `registerProfileBlock` / `registerPlatformTweaks`.** Bash `{ }` requires at least one real command. Add `: # no-op` if no commands yet.
- **Use `isForceRefreshStale(path)` / `is_force_refresh_stale` instead of checking `IS_FORCE_REFRESH` directly.** Ensures force-refresh only triggers when target is stale (>2 weeks).
- **Always call `await backupConfigFile(path)` before writing to any user config file.** Creates `.bak_original` (first-ever snapshot, never overwritten) and `.bak_latest` (previous state before each write). This applies to all `writeText`/`writeJson`/`writeConfigToFile` calls targeting real app configs (Sublime, VS Code, Brave, Git, Vim, etc.). Does not apply to `writeBuildArtifact` or `BASH_SYLE_PATH` writes.

### Other Conventions

- **Git aliases use lowercase with hyphens.** Write `clean-and-fetch` not `clean_and_fetch`.
- **Prefer POSIX-compatible shell in git aliases.** They run through MSYS2/MinGW `sh` on Windows.
- **Zed keymaps use `-` not `+` for key combinations.** Write `alt-q` not `alt+q`.
- **`EDITOR_CONFIGS` is the single source of truth for ignored folders and binary file extensions.** Only edit in `software/index.js`.
- **Makefile uses `.ONESHELL` (requires GNU Make 4+).** Use `$$` to escape `$` for shell variables. Script filenames must match the Makefile target name (e.g., target `format_shell` -> `software/tools/format-shell.sh`).

## Change Workflow Checklist

1. **Add JSDoc** — on ALL functions, constants, and code touched.
2. **`make validate`** — automated by `Stop` hook when there are uncommitted changes.
3. **Test command reminder** — automated by `PostToolUse` hook for `software/scripts/` files.

If you modified `software/index.js` or `software/tools/build-include.js`, you **must** write or update unit tests in `software/tests/`.

4. **Update CLAUDE.md** — When you make changes to `software/index.js`, `run.sh`, or `software/bootstrap/common-env.sh`, update the relevant sections of this file (Architecture, Key Files, etc.) to reflect the new flow, new functions, changed behavior, or new conventions. These are the core files — their documentation here must stay in sync with the code.

## Commands

```bash
make init                  # Install dependencies + mkdir .build
make setup                 # Alias for setup_local_full
make setup_local_full      # Full setup from local files (installs dependencies via _full-setup.sh)
make setup_local_profile   # Refresh profile only from local files (no dependency install)
make setup_prod            # Bootstrap setup from GitHub (prod)
make validate              # Format code + run unit tests (automated by Stop hook)
make format                # Run all formatting steps
make format_build_include  # Process BEGIN/END block markers
make build                 # Build all default steps
make build_webapp          # Build webapp for production
make test_unit             # Run unit tests
make test_profile          # Run profile syntax tests
make test_dryrun           # Run dry-run setup test (JS scripts only, no writes)
make test_all              # Run all test suites (unit, profile, smoke, buildconfig, dryrun)
make test_buildconfig_update  # Update build config shape inline snapshots
make dry_run               # Run unit tests + dry-run all scripts (no file writes)
make clean                 # Clean prebuilt profiles, autogen notes, BEGIN/END inclusions
make doctor                # Run diagnostics to check for common issues
```

### run.sh

```bash
bash run.sh                          # Full run (auto-detects local repo or fetches from GitHub)
bash run.sh --files="git.js"         # Run specific script(s)
bash run.sh git.js vim-config.js     # Bare args as files
bash run.sh --debug                  # Keep temp files, show retry commands
bash run.sh --force-refresh          # Force reinstall (heavy items only if stale >2 weeks)
bash run.sh --refresh="fzf.js,fonts.js" # Force refresh specific scripts
bash run.sh --verbose                # Enable bash tracing (set -x)
bash run.sh --lightweight            # Lightweight install mode
bash run.sh --dryrun                 # Show what would change without writing
bash run.sh --remove --files="fzf.js" # Remove a script's config (runs undoWork)
```

## Architecture

For the full architecture guide (execution pipeline, data flow diagrams, layer breakdown, script system, adding new scripts, etc.), see **[DEV.md](DEV.md)**.

Key concepts at a glance:

- **`node | bash` pipeline**: Node generates bash commands to stdout; bash executes them.
- **`index.js` is dual-purpose**: utility library (globals used by scripts) + bootstrap entry point. `tsc --declaration --allowJs` generates `software/index.d.ts` — read that for the full API.
- **OS flags**: `is_os_<name>=1` env vars from `common-env.sh`, boolean globals in `index.js` via `getRuntimeOption()`.
- **Script discovery**: Auto-discovered by `getSoftwareScriptFiles()`. Sorted by priority tiers (`_init` -> `_full-setup` -> `a-z` -> `~cleanup` -> `lastFiles`). Consecutive same-type scripts are bundled. `.common.js` (shared helpers) and `.standalone.js` (run-only-on-demand) files are excluded from full/setup/dryrun runs.
- **`--files` auto-refresh**: `_doWorkTestFiles()` auto-appends `~refresh-source.standalone.js` to every `--files` run to refresh SOURCE_BEGIN/SOURCE_END blocks in `~/.bash_syle`. Full runs handle this via `~cleanup.js` instead.
- **Profile assembly**: `~/.bash_syle` assembled from `profile-core.sh` + `profile-advanced.sh` via `registerWithBashSyleProfile()` / `registerPlatformTweaks()`.
- **BEGIN/END**: Build-time file inlining (`make format_build_include`). **SOURCE**: Runtime-only includes resolved by `readText()`.

### Key Files

| Path                                       | Purpose                                                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run.sh`                                   | Entry point. Bash pre-scan, JSON-encodes args, calls `run_files()`                                                                                                     |
| `software/bootstrap/common-env.sh`         | Shared constants (`LIMITED_SUPPORT_OSES`, `LIGHT_WEIGHT_SCRIPTS`), sourced by `run.sh` via BEGIN/END                                                                   |
| `software/bootstrap/common-functions.bash` | Shared shell helpers (`npm_install_global`, `has_persistent_binary`, `curl_bash_install`, `is_force_refresh_stale`, etc.), sourced by `.sh` scripts via SOURCE markers |
| `software/index.js`                        | Arg parsing (`parseRawArgs`), utility library, script runner, run info                                                                                                 |
| `software/scripts/*.js`                    | Cross-platform scripts                                                                                                                                                 |
| `software/scripts/<os>/`                   | OS-specific scripts                                                                                                                                                    |
| `software/common.js`                       | Core shared constants and `replaceBlock`. Inlined into index.js                                                                                                        |
| `software/tools/build-include.js`          | BEGIN/END block substitution engine + inline marker processor                                                                                                          |
| `software/metadata/autocomplete.common.js` | Single source of truth for spec-based autocomplete mappings                                                                                                            |
| `$BASHRC_TEMP_DIR/run_timing.json`         | Per-run timing data: start/end, per-script duration+status, results array (read by CI)                                                                                 |

## Testing

Five suites: `make test_unit` (vitest, sandbox tests for index.js), `make test_profile` (bash -n syntax checks), `make test_smoke` (Puppeteer webapp tests), `make test_buildconfig` (inline snapshot shape tests), `make test_dryrun` (dry-run all JS scripts, no file writes). `make test_all` runs all.

Test setup (`software/tests/setup.js`): loads index.js in VM sandbox. Access via `getIndexFunction(name)` / `getIndexConstant(name)`. `fileSystem` and `fetchResponses` objects for in-memory mocks, auto-reset in `beforeEach`.

When adding new `.sh` files, register them in `software/tests/profileSyntax.spec.js` for `bash -n` syntax checks.

## CI/CD

GitHub Actions (`.github/workflows/build-main.yml`): push to master triggers Prep -> Build (parallel OS builds) -> Publish (GitHub Pages) -> Test. All CI steps use Makefile targets.

**When adding or removing a CLI tool, update the `check_binary` calls in `.github/actions/ci-build/action.yml`.** Only non-GUI command-line binaries.

The CI build action (`ci-build/action.yml`) generates a job summary with collapsible sections: Profile Syntax Check, Binary Verification, Download Asset Verification, Script Results (reads `run_timing.json` for per-script status/duration), and a Build Summary table.

## GitHub Codespaces

`install.sh` is the single source of truth for codespace setup. Codespace-specific aliases go in `.devcontainer/codespaces-profile.sh`. Do not hand-edit the extensions list in `devcontainer.json` — auto-generated by `vs-code-ext.js`.

## Skills Reference

Use `/add-package` and `/add-os` skills for adding new packages or OS support — they contain the full step-by-step workflow. Use `/remove-package` and `/remove-os` for removal. Use `/run` to generate test commands. Use `/validate` to run formatting and tests.
