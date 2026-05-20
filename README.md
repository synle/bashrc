# synle/bashrc

[![build](https://github.com/synle/bashrc/actions/workflows/build-main.yml/badge.svg)](https://github.com/synle/bashrc/actions/workflows/build-main.yml)

Personal bash profile and dotfiles management system. Automates shell configuration, editor settings, fonts, Git config, and OS-specific tweaks across 6+ platforms from a single codebase.

## Demo

https://synle.github.io/bashrc/

## Supported Platforms

- macOS
- Ubuntu / Debian / Mint
- Windows (PowerShell + MinGW) / WSL
- Android Termux
- Arch Linux / SteamOS
- ChromeOS
- Red Hat / Fedora

## Highlights

### Cross-Platform Tab Completion System (Complete-Spec)

A custom spec-based autocomplete system that works on both Bash and PowerShell from the same source files. Plain text spec files define completions for any command -- no shell-specific syntax required.

- **37 spec files** covering **49 commands** (including aliases like `g` for `git`, `n` for `npm`)
- **20 dynamic tokens** that expand at tab time (`__git_branches__`, `__npm_scripts__`, `__makefile_targets__`, `__ssh_hosts__`, etc.) — plus **per-spec `>__name__|...` macros** for static flag lists, resolved at build time
- **Nested subcommand support** (`kubectl rollout status <TAB>` gives resource types + flags)
- **Spec generators** that auto-build specs from `--help` output (git, docker, npm)
- **Alias proxying** -- one line to give any alias the same completions as its target command

Spec format -- one line per subcommand, one file per command:

```
checkout|__git_branches__,__git_files__,--force,-f,-b,-B,--track,-t
commit|__git_commit_flags__
push|__git_remotes__,__git_branches__,--force,-f,--set-upstream,-u
run|__npm_scripts__
```

### Marker-Based Profile Assembly

`~/.bash_syle` is assembled from 20+ self-contained scripts using `# BEGIN`/`# END` markers. Each script owns its own section -- add a tool by creating one file, remove it by deleting that file. No central config to edit.

### Node | Bash Pipeline

Scripts are written in Node.js but execute as bash. `cat index.js | node | bash` -- Node generates bash commands to stdout, bash executes them. This gives you the full power of Node (async I/O, JSON parsing, template literals) with native shell integration.

### Tagged Template Literal API

Six tagged template literals replace a dozen legacy functions with one consistent pattern:

```js
code`...`; // dedented string
list`...`; // array of lines
json`{ "key": "value" }`; // parsed JSONC
await readText`software/scripts/foo.bash`; // universal reader (file, URL, or repo path)
await readJson`software/scripts/foo.jsonc`; // universal JSONC reader
```

### Build-Include System

A marker-based build system that inlines file content between `# BEGIN path` / `# END path` markers and processes `// {{theme.key}}` inline markers in JSONC files from a central color map. One `make format_build_include` keeps everything in sync.

### Editor Configuration

Manages settings, keybindings, extensions, and themes for VS Code, Sublime Text, Zed, and Vim across all platforms. Dark/light theme colors are centralized in one color map and propagated to all editor configs at build time.

```bash
bash run.sh --files="sublime-text.js,sublime-merge.js,vs-code-ext.sh"
```

### AI CLI Setup

Unified setup for the major terminal AI clients: Claude Code, GitHub Copilot CLI, Gemini CLI, and OpenCode. Lives under `software/scripts/advanced/llm/` with shared rules + slash commands + keybindings in `_common/` (the `instructions.md` in there is the single source for the generated global `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` configs). Includes an Ollama installer + dynamic provider discovery shared between Zed and OpenCode.

### CI/CD

GitHub Actions with 5 parallel OS builds (Ubuntu, RHEL, Arch, Debian, macOS), automated formatting, webapp deployment to GitHub Pages, and profile syntax testing across all platforms.

## Installation

### Option A — single-file installer (recommended)

A self-extracting bash script that bundles `run.sh` + the entire `software/` tree as a base64 payload. **One HTTP request, zero `raw.githubusercontent.com` fetches at runtime** — works on locked-down networks, behind corporate proxies, and survives GitHub API rate limits. CI re-publishes it on every push to `main`.

**Recommended — download then run (avoids stray `curl: (56)` pipe-close noise):**

```bash
# Full setup (installs dependencies + writes profile)
tmp=$(mktemp).sh && curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh -o "$tmp" && bash "$tmp" --setup
```

Every `run.sh` flag works — swap `--setup` for any of these:

```bash
# Profile refresh only (no dependency install)
tmp=$(mktemp).sh && curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh -o "$tmp" && bash "$tmp"

# One specific script
tmp=$(mktemp).sh && curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh -o "$tmp" && bash "$tmp" --files=git.js

# A preset
tmp=$(mktemp).sh && curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh -o "$tmp" && bash "$tmp" --preset=lightweight

# Dry-run (preview without writing)
tmp=$(mktemp).sh && curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh -o "$tmp" && bash "$tmp" --dryrun --setup
```

Or save the installer once and reuse it:

```bash
curl -fsSLO https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh
bash bashrc-installer__install-bashrc.sh --setup
bash bashrc-installer__install-bashrc.sh --files=git.js
BASHRC_INSTALLER_KEEP=1 bash bashrc-installer__install-bashrc.sh --dryrun   # keep the extracted dir for inspection
```

**Also works (but emits a harmless `curl: (56)` after success — curl complaining about its closed pipe, not a real error):**

```bash
curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh | bash -s -- --setup
```

The installer extracts to `$TMPDIR/synle-bashrc-installer-$$/` (override with `BASHRC_INSTALLER_DIR=...`), `exec`s `run.sh` against that copy, and cleans up on exit.

Build it locally:

```bash
make build_installer   # writes .build/install-bashrc.sh (~1 MB)
```

### Option B — stream from GitHub (legacy)

<!-- BEGIN software/bootstrap/setup.sh -->

```bash
if [ "$(echo "${SKIP_SETUP:-}" | tr -d '[:space:]')" = "true" ] || [ "$(echo "${SKIP_SETUP:-}" | tr -d '[:space:]')" = "1" ]; then
  echo ">> SKIP_SETUP is set, skipping dependency setup"
  curl -fsSL https://github.com/synle/bashrc/blob/HEAD/run.sh?raw=1 | bash
else
  curl -fsSL https://github.com/synle/bashrc/blob/HEAD/run.sh?raw=1 | bash -s -- --setup
fi
```

<!-- END software/bootstrap/setup.sh -->

## Usage

```bash
make setup             # Full setup from local files (installs dependencies)
make setup_local_profile # Refresh profile only (no dependency install)
make setup_prod        # Bootstrap from GitHub
make validate          # Format + run tests
make build             # Build all artifacts
make build_installer   # Build .build/install-bashrc.sh (self-extracting; ~1 MB)
make test_all          # Run all test suites (skips coverage)
make test_coverage     # Unit tests + istanbul coverage report (thresholds in vitest.config.js)
make dry_run           # Unit tests + dry-run all scripts (no file writes)
make clean             # Clean up
make doctor            # Run diagnostics
```

### run.sh

```bash
bash run.sh                          # Full run (auto-detects local repo or fetches from GitHub)
bash run.sh --files="git.js"         # Run specific file(s)
bash run.sh git.js vim-config.js     # Bare args as files
bash run.sh --debug                  # Keep temp files, show retry commands
bash run.sh --force-refresh          # Force reinstall (heavy items only if stale >2 weeks)
bash run.sh --refresh="fzf.js,fonts.js" # Force refresh specific scripts
bash run.sh --verbose                # Enable bash tracing (set -x)
bash run.sh --preset=lightweight     # Run a named preset (expands to its file list); see software/metadata/presets.jsonc
bash run.sh --preset=editor          # Partial-name match (case-insensitive); auto-resolves if exactly 1 hit
bash run.sh --files=vim              # Same partial match for files; ambiguous matches print copy-paste suggestions
bash run.sh --dryrun                 # Show what would change without writing
bash run.sh --remove --files="fzf.js"  # Remove a script's config
```

## Architecture

```
run.sh / Makefile
  -> source common-env.sh (OS detection, env vars)
  -> cat software/index.js | node | bash
       -> index.js discovers scripts, emits bash commands to stdout
       -> bash executes them (installs tools, writes configs, assembles profile)
  -> ~cleanup.js strips unfilled markers, writes build artifacts
```

Scripts are auto-discovered from `software/scripts/`. Filename prefixes control execution order (`_init` first, `~cleanup` last, alphabetical in between). OS-specific scripts live in `software/scripts/<os>/`.

For the full architecture deep-dive (execution lifecycle, data flow diagrams, script bundling, adding new scripts, etc.), see **[DEV.md](DEV.md)**.

## Fun Facts

### Current Equipment

#### Legion Go Deck

Upgraded to 2TB 2280 NVMe with an adapter. Installed SteamOS.

#### Laptop (Asus ROG G14)

- AMD 7940S
- GeForce 4060
- Upgraded to 40GB RAM
- Upgraded to 2TB NVMe
- Dual boot Windows 11 IoT LTSC (with WSL 2 / Ubuntu 24.04) / Linux Mint

#### AI Workstation (HP Omen 45L)

- Intel Core Ultra 9 285K
- 64GB Kingston FURY DDR5-5600
- NVIDIA GeForce RTX 5090 (32GB GDDR7)
- Dual boot Windows 11 IoT LTSC (with WSL 2 / Ubuntu 24.04) / Linux Mint

### Past Equipments

#### Steam Deck

Upgraded from 64GB eMMC to 1TB 2230 NVMe.

#### Laptop (Gigabyte Aero 16)

- Intel Core i7-12700H
- GeForce 3070 Ti
- Upgraded to 64GB RAM, 2TB NVMe
- Windows 10 IoT LTSC (with WSL 2 / Debian)

#### macOS Laptop (MacBook Pro 14" M1 - 16GB / 512GB)

#### Chromebook (Samsung - 8GB / 128GB)

- ChromeOS with Ubuntu container

#### Desktop (Lenovo P520)

- Intel Xeon W-2145
- Upgraded to 128GB RAM
- 2x2TB NVMe, 8TB HDD
- Gigabyte Eagle 3090
- Custom fan mods (2x120mm intake, 120mm exhaust)
- Dual boot Windows 10 IoT LTSC / Ubuntu 22.04
