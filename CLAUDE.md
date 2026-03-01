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
2. `run_files()` in common-env.sh does: `cat software/index.js | node | bash` (local) or `curl ... | node | bash` (prod)
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

| Flag | Folder | Platform |
|------|--------|----------|
| `is_os_mac` | `software/scripts/mac/` | macOS |
| `is_os_ubuntu` | (none) | Ubuntu, Debian, Mint |
| `is_os_chromeos` | `software/scripts/chromeos/` | ChromeOS |
| `is_os_mingw64` | (none) | MSYS2/Cygwin |
| `is_os_android_termux` | `software/scripts/android_termux/` | Android Termux |
| `is_os_arch_linux` | `software/scripts/arch_linux/` | Arch Linux |
| `is_os_steamdeck` | (none) | Steam Deck (SteamOS) |
| `is_os_redhat` | (none) | Fedora, RHEL, CentOS |
| `is_os_window` | `software/scripts/window/` | Windows (WSL/MinGW) |
| `is_os_wsl` | (none) | Windows Subsystem for Linux |

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

## Key Patterns

- `getRuntimeOption(key, parseFunc)` - Standard way to read env vars/CLI args in index.js
- `writeToFile(filePath, content)` / `appendToFile()` - File output helpers
- `writeToBuildFile(name, content)` - Write to `.build/` directory (used by build-configs step)
- `processScriptFile()` - Generates bash commands to fetch/execute a script via temp files
- `printScriptProcessingResults()` - Emits summary of script execution results, cleans temp files
- No test suite exists; `make test` runs all scripts locally as a smoke test
