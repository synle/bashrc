# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal bash profile and dotfiles management system (`synle/bashrc`). Automates setup of shell configuration, editor settings, fonts, Git config, and OS-specific tweaks across macOS, Ubuntu/Debian, WSL, Android Termux, Arch Linux/Steam Deck, and ChromeOS.

## Commands

```bash
make test              # Run all scripts locally (bash run.sh --force)
make build             # Run build.sh + format code
make format            # Format code with Prettier
make clean             # Run clean.sh
make start             # Run run.sh
make nuke              # Remove all bashrc config (~/.bash_sy*, fnm, hushlogin)
npm test               # Run unit tests (vitest)
```

### run.sh - Test/install scripts

```bash
bash run.sh                          # Full local run
bash run.sh --prod                   # Full run fetching from GitHub
bash run.sh --files="git.js"         # Run specific script(s)
bash run.sh git.js vim-config.js     # Bare args as files
bash run.sh --debug                  # Keep temp files, show retry commands
bash run.sh --force-refresh          # Reinstall fnm/Node
bash run.sh --verbose                # Enable bash tracing (set -x)
bash run.sh --lightweight            # Lightweight install mode
```

### build.sh - Build pipeline

```bash
bash build.sh                        # Run all build steps
bash build.sh --steps="jsdocs,webapp" # Run specific steps
```

Steps: `jsdocs`, `script-indexes`, `prebuild-hosts`, `build-configs`, `host-mappings`, `backup-xfce`, `webapp`, `build-include`

## Architecture

### Execution Pipeline: `node | bash`

The core execution model pipes Node.js output into bash:

1. `run.sh` or `build.sh` sources `bootstrap/common-env.sh` (inlined via BEGIN/END blocks)
2. `run_files(mode, files)` in common-env.sh does: `cat software/index.js | node | bash` (mode=local) or `curl ... | node | bash` (mode=prod)
3. `software/index.js` runs in Node, discovers script files, and **prints bash commands to stdout**
4. Bash receives and executes those commands

This means Node generates commands instantly but bash executes them over time. Any timing/status tracking must happen on the bash side, not in Node.

### software/index.js (~1900 lines)

Dual-purpose file:

- **Utility library**: Provides globals (file I/O, text processing, network helpers, platform detection) that individual scripts depend on
- **Bootstrap entry point**: Discovers platform-specific scripts, generates temp files in `/tmp/bashrc_syle_sw_*`, and emits bash commands to execute them

Key constants: `IS_TEST_SCRIPT_MODE`, `IS_DEBUG`, `TEMP_SCRIPT_PREFIX`, `OS_SCRIPT_PATHS`

JSDoc is used throughout and `tsc --declaration --allowJs` generates `software/index.d.ts`. OS flag constants need explicit `const` declarations for .d.ts generation.

### OS Flags Convention

OS detection happens in `bootstrap/common-env.sh` and exports `is_os_<name>=1` env vars. In `index.js`, these become boolean globals via `getRuntimeOption()`.

Each flag maps to a script folder: `is_os_<name>` -> `software/scripts/<name>/`

| Flag                   | Folder                             | Platform                    |
| ---------------------- | ---------------------------------- | --------------------------- |
| `is_os_mac`            | `software/scripts/mac/`            | macOS                       |
| `is_os_ubuntu`         | `software/scripts/ubuntu/`         | Ubuntu, Debian, Mint        |
| `is_os_chromeos`       | `software/scripts/chromeos/`       | ChromeOS                    |
| `is_os_mingw64`        | `software/scripts/mingw64/`        | MSYS2/Cygwin                |
| `is_os_android_termux` | `software/scripts/android_termux/` | Android Termux              |
| `is_os_arch_linux`     | `software/scripts/arch_linux/`     | Arch Linux                  |
| `is_os_steamdeck`      | `software/scripts/steamdeck/`      | Steam Deck (SteamOS)        |
| `is_os_steamos`        | `software/scripts/steamos/`        | SteamOS                     |
| `is_os_redhat`         | `software/scripts/redhat/`         | Fedora, RHEL, CentOS        |
| `is_os_window`         | `software/scripts/window/`         | Windows (WSL/MinGW)         |
| `is_os_wsl`            | `software/scripts/wsl/`            | Windows Subsystem for Linux |

### bootstrap/common-env.sh

Shared environment setup inlined into `run.sh` and `build.sh` via `# BEGIN`/`# END` markers. Contains:

- Repository URL exports
- OS detection (sets `is_os_*` flags)
- `run_files()` helper function
- CI mode echo override for GitHub Actions groups

### build-include system

`software/build-include.cjs` processes `# BEGIN path/to/file` / `# END path/to/file` markers in target files, replacing the block content with the referenced file. This is how `common-env.sh` gets inlined into `run.sh` and `build.sh`.

Run with: `bash build.sh --steps="build-include"` or `node software/build-include.cjs`

### Script Files

- `software/scripts/*.js` - Cross-platform scripts (git, vim, fonts, editors, etc.)
- `software/scripts/<os>/` - OS-specific scripts
- `software/scripts/<os>/_only.sh` - Shell scripts run only on that OS
- `software/metadata/` - Generated configs (script list, host mappings, IP addresses)

### Webapp

A React webapp at `webapp/` built with Vite. Provides a web UI for browsing scripts and configuration. Built via `bash build.sh --steps="webapp"` or `npm run build`.

## CI/CD

GitHub Actions (`.github/workflows/build-main.yml`):

- Triggers on push to master
- Runs `build.sh`, commits artifacts back to repo
- Deploys to GitHub Pages

## Coding Conventions

- **Bash functions must use the `function` keyword**: Always write `function foo() {` not `foo() {`
- **JSDoc on all functions/constants** in `software/index.js` — used by `tsc --declaration --allowJs` to generate `software/index.d.ts`
- **Private helpers** in script files are prefixed with `_` (e.g., `_getGitConfig()`)
- **Unit tests** use vitest (`npm test`). Tests live in `software/tests/`. Run after modifying `software/index.js` utilities. See "Testing" section below.
- `make test` runs all scripts locally as a smoke test (not unit tests)
- **Comment section headers** use two standardized forms:
  - **Paired** (for major sections): `################################################################################` (80 chars) / `# ---- Title ----` / `################################################################################`
  - **Standalone** (for sub-sections): `# ---- title ----`

## Script File Conventions

### Script structure

Each script in `software/scripts/` follows this pattern:

```javascript
// 1. Optional helper functions (prefixed with _)
async function _getConfig() { ... }

// 2. Main entry point — always named doWork()
/** * Description of what this script does. */
async function doWork() {
  // Guard clauses first
  exitIfUnsupportedOs("is_os_android_termux");
  exitIfPathNotFound(targetPath);

  // Then do the work
  writeText(targetPath, content);
}
```

### File extension determines execution mode

| Extension   | Execution              | Example                       |
| ----------- | ---------------------- | ----------------------------- |
| `.js`       | `node`                 | `git.js`                      |
| `.sh`       | `bash`                 | `diff-so-fancy.sh`            |
| `.sh.js`    | `node \| bash`         | (node outputs bash commands)  |
| `.su.js`    | `sudo -E node`         | `etc-hosts.su.js`             |
| `.su.sh.js` | `sudo -E node \| bash` | (elevated node piped to bash) |

### Guard functions (call at top of `doWork()`)

- `exitIfUnsupportedOs(...osFlags)` — Exit early if running on a listed OS. Example: `exitIfUnsupportedOs("is_os_android_termux", "is_os_chromeos")`
- `exitIfPathNotFound(targetPath, message?)` — Exit if required path doesn't exist
- `exitIfPathFound(targetPath, message?)` — Exit if path already exists (skip install)

### File writing utilities

- `writeText(filePath, text, override?, suppressError?)` — Write text file, skips if content unchanged
- `writeConfigToFile(basePath, fileName, data, isJson?)` — Write JSON config files (editors)
- `touchFile(filePath, defaultContent?)` — Create file only if it doesn't exist
- `writeToBuildFile([{file, data, commentStyle?}])` — Write to `.build/` directory (build-configs step)
- `registerProfileBlock({profilePath, configKey, content, isPrepend?, addCodeFolding?})` — Generic: reads file, inserts/updates a delimited block, writes back. `isPrepend` (default false) controls position, `addCodeFolding` (default true) wraps content in `{ }`
- `registerWithBashSyleProfile(configKey, content)` — Delegates to `registerProfileBlock` with `BASH_SYLE_PATH`, prepend, code folding
- `registerWithBashSyleAutocompleteWithRawContent(configKey, content)` — Delegates to `registerProfileBlock` with `BASH_SYLE_AUTOCOMPLETE_PATH`, append, no code folding
- `registerWithBashSyleAutocompleteWithCompleteSpec(command, specUrl)` — Downloads spec file and registers spec-based autocomplete (see Complete-Spec section)
- `prependTextBlock(content, configKey, configValue)` / `appendTextBlock(...)` — Manage delimited sections within file content (uses `# BEGIN_CONTENT key` / `# END_CONTENT key` markers)

### Complete-Spec Autocomplete System

A spec-file-based bash autocomplete system. Instead of hand-writing per-command completion functions, a simple text spec file maps commands/subcommands to their options, and a generic completer reads it at tab-completion time.

**Spec file format** — one line per command/subcommand:

```
command|subcommand1,subcommand2,--flag1,--flag2
command subcommand1|--opt1,--opt2,-s
```

- Left of `|` = command prefix (space-separated), right of `|` = comma-separated completions
- Base command line lists subcommands; subcommand lines list flags/options

**Files:**

| File                                                     | Purpose                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `software/scripts/bash-autocomplete-complete-spec.js`    | Script that registers spec-based autocomplete (currently docker) |
| `software/scripts/bash-autocomplete-complete-spec-<cmd>` | Spec data file for `<cmd>`                                       |
| `~/.bash_syle_complete-spec-<cmd>`                       | Runtime copy on user's machine                                   |
| `~/.bash_syle_autocomplete`                              | Where the generated completer function is written                |

**Registration flow** (`registerWithBashSyleAutocompleteWithCompleteSpec(command, specUrl)`):

1. Downloads spec file via `fetchUrlAsString`
2. Saves to `~/.bash_syle_complete-spec-<command>`
3. Generates a `__spec_complete_<command>()` bash function that greps the spec file at completion time (tries longest prefix first)
4. Registers via `complete -F __spec_complete_<command> <command>` into `~/.bash_syle_autocomplete`

**Adding a new command:**

1. Create spec file: `software/scripts/bash-autocomplete-complete-spec-<command>`
2. Add to existing script or create new one calling `registerWithBashSyleAutocompleteWithCompleteSpec("<command>", "software/scripts/bash-autocomplete-complete-spec-<command>")`

### Runtime flags

- `IS_FORCE_REFRESH` — When true, delete and re-download resources before installing. Example: `if (IS_FORCE_REFRESH) { await deleteFolder(targetPath); }`
- `IS_LIGHT_WEIGHT_MODE` — When true, skip advanced/heavy features. Scripts check this to skip optional installs.
- `IS_DEBUG` — When true, keep temp scripts in `/tmp` and show retry commands on failure

### Other common utilities

- `getRuntimeOption(key, parseFunc)` — Read env vars/CLI args with parser (`parseString`, `parseBoolean`, `parseInteger`)
- `readText(filePath)` — Read file contents (returns empty string on error)
- `fetchUrlAsString(url)` / `fetchUrlAsJson(url)` — Fetch remote content
- `downloadAsset(url, destination)` — Download file to disk
- `execBash(cmd, sync?, options?)` — Execute shell command
- `trimLeftSpaces(text)` — Remove common leading whitespace (for heredoc-style template strings)
- `convertTextToList(...texts)` — Split text to unique trimmed lines, filtering comments
- `resolveOsKey({mac, windows, linux})` — Returns the value matching the current OS
- **Logging:** `echo(coloredStr)` — emits `node -e "console.log(...)"` into the bash pipeline (orchestration layer); `log(coloredStr)` — calls `console.log()` directly (script files). Both auto-color each argument via `_applyAutoColor` → `_getAutoColor` per element.
- **Color helpers:** `colorGreen`, `colorYellow`, `colorCyan`, `colorDim`, `colorRed`, `colorBgRed`, `colorBgYellow`, `colorBgOrange`, `colorBgCyan`, `colorBgMagenta`, `colorMagenta`, `colorOrange`, `colorBlue` — return ANSI-colored strings. Legacy `consoleLogColor{N}` aliases exist on globalThis for backward compatibility in script files.
- **Auto-color system** (`_getAutoColor` / `_applyAutoColor`): Colors each log argument independently. Priority: (1) repeated-char markers (highest), (2) error keywords → `colorBgRed`, (3) success keywords → `colorGreen`, (4) path/URL-like strings → `colorDim`. Markers use repeated characters to indicate nesting level (level = char count - 1). `_applyAutoColor` strips markers to a single char with indentation spaces equal to the marker count. Elements with existing ANSI codes are preserved.

#### Log marker format

Use repeated marker characters to indicate nesting depth. The number of characters determines the color level:

| Marker | Level 0 | Level 1  | Level 2  | Level 3 | Level 4+  |
| ------ | ------- | -------- | -------- | ------- | --------- |
| `>`    | yellow  | green    | cyan     | blue    | magenta   |
| `<`    | orange  | red      | blue     | magenta | magenta   |
| `#`    | —       | bgYellow | bgOrange | bgCyan  | bgMagenta |

Examples: `log("> Installing")`, `log(">> Setting up", path)`, `log(">>> Downloaded", file)`, `echo("## ${header}")`

## Testing

Unit tests use **vitest** (v0.34.6) with a **Node `vm` sandbox** that executes actual `software/index.js` code.

### Test setup (`software/tests/setup.js`)

- Loads `software/index.js`, strips the IIFE bootstrap, replaces `const`/`let` with `var` so declarations become sandbox properties
- Runs in `vm.runInNewContext` with mocked `require` (fs, path, os, child_process), `process.env`, and `process.exit`
- Overrides I/O functions with in-memory mocks: `readText`/`writeText` use `fileSystem` object, `fetchUrlAsString`/`fetchUrlAsJson` use `fetchResponses` object
- `getIndexFunction(name)` / `getIndexConstant(name)` — access any sandbox function or constant by name
- `fileSystem` and `fetchResponses` auto-reset between tests via `beforeEach`

### Test files

| File                        | Covers                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateTextBlock.test.js`   | `updateTextBlock`, `appendTextBlock`, `prependTextBlock`                                                                                                                                                 |
| `registerProfile.test.js`   | `registerProfileBlock`, `registerWithBashSyleProfile`, `registerWithBashSyleAutocompleteWithRawContent`, `registerWithBashSyleAutocompleteWithCompleteSpec`                                              |
| `parsers.test.js`           | `parseString`, `parseInteger`, `parseBoolean`                                                                                                                                                            |
| `textUtils.test.js`         | `cleanupExtraWhitespaces`, `convertTextToList`, `convertRawTextToList`, `convertTextToHosts`, `trimLeftSpaces`, `trimSpacesOnBothEnd`, `calculatePercentage`, `getRootDomainFrom`, `clone`, `getFullUrl` |
| `colorAndAutoColor.test.js` | `color`, `_getAutoColor`, `_applyAutoColor`                                                                                                                                                              |
| `fileIO.test.js`            | `readText`, `writeText`, `appendText`, `writeJson`, `writeConfigToFile`, `parseJsonWithComments`                                                                                                         |
| `guardClauses.test.js`      | `resolveOsKey`                                                                                                                                                                                           |
