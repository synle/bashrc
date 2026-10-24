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

A marker-based build system inlines file content between `# BEGIN path` / `# END path` markers and renders `// {{theme.key}}` colors from paired `theme/sy/_palette_{dark,light}.jsonc` foundations. One `make format_build_include` resolves recipes/variants and updates application templates.

### Editor Configuration

Manages settings, keybindings, extensions, and themes for VS Code, Sublime Text, Zed, and Vim across all platforms. Managed colors flow from shared dark/light foundations through app placeholder comments to native output.

For new feature colors, follow [the shared theme workflow](theme/README.md#required-workflow-for-new-feature-colors). Reuse a semantic role or add it to both foundations, bind both app templates, generate, and deploy through the existing renderer. Do not add local color literals or a second Sy palette.

```bash
./run --files="sublime-text.js,sublime-merge.js,vs-code-ext.sh"
```

### AI CLI Setup

Unified setup for the major terminal AI clients: Claude Code, GitHub Copilot CLI, Gemini CLI, and OpenCode. Lives under `software/scripts/advanced/llm/` with active rules and slash commands in `_common/v_current/` and shared runtime helpers in `_common/` (the `v_current/instructions.md` file is the single source for the generated global `AGENTS` / `AGENTS.md` / `GEMINI.md` configs). Includes an Ollama installer + dynamic provider discovery shared between Zed and OpenCode.

### CI/CD

GitHub Actions with 5 parallel OS builds (Ubuntu, RHEL, Arch, Debian, macOS), automated formatting, webapp deployment to GitHub Pages, and profile syntax testing across all platforms.

## Installation

### Option A — single-file installer (recommended)

Self-extracting bash script bundling `run` + `run.sh` + runtime `software/` sources + `theme/sy/` as a base64 payload. One HTTP request, no runtime raw fetches — works behind proxies and rate limits. Re-published on every push to `main`.

Download once, then pass any `run.sh` flag:

```bash
tmp=$(mktemp -d) && cd "$tmp" && curl -fsSL https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh -o run && chmod +x run

./run --setup                          # full setup (deps + profile)
./run --preset=heavyweight             # everything
./run --preset=lightweight             # minimal
./run                                  # profile refresh only
./run --files=git.js                   # one script
./run --files=url-porter,skippy-ff,tmux,vim-config,vim-jetpack             # a few scripts
./run --dryrun --setup                 # preview, no writes
```

Downloading first avoids a harmless `curl: (56)` pipe-close noise you'd get from piping straight into bash. Extracts to `$TMPDIR/synle-bashrc-installer-$$/` (override: `BASHRC_INSTALLER_DIR=...`; keep: `BASHRC_INSTALLER_KEEP=1`). Build locally with `make build_installer` → `.build/install-bashrc.sh` (~1 MB).

### Option B — stream from GitHub (legacy)

<!-- BEGIN software/bootstrap/setup.sh -->

```bash
if [ "$(echo "${SKIP_SETUP:-}" | tr -d '[:space:]')" = "true" ] || [ "$(echo "${SKIP_SETUP:-}" | tr -d '[:space:]')" = "1" ]; then
  echo ">> SKIP_SETUP is set, skipping dependency setup"
  curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/run.sh | bash
else
  curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/run.sh | bash -s -- --setup
fi
```

<!-- END software/bootstrap/setup.sh -->

### Option C - via git and make

```bash
tmp=$(mktemp -d) && cd "$tmp" && git clone --depth 1 https://github.com/synle/bashrc.git && cd bashrc && ./run --files=url-porter,skippy-ff,tmux,vim-config,vim-jetpack
```

## Usage

```bash
make setup               # Full setup from local files
make setup_local_profile # Profile refresh only
make setup_prod          # Bootstrap from GitHub
make validate            # Format + tests — run before pushing
make build_installer     # .build/install-bashrc.sh
make test_all            # All test suites (skips coverage)
make clean / make doctor # Clean up / diagnostics
```

### ./run

```bash
./run                             # Full run (local repo or fetches from GitHub)
./run --files="git.js"            # Specific file(s); bare args work too
./run --preset=lightweight        # Named preset; partial match auto-resolves if 1 hit
./run --refresh="fzf.js,fonts.js" # Force-refresh specific scripts
./run --force-refresh             # Reinstall heavy items only if stale >2 weeks
./run --dryrun                    # Preview without writing
./run --remove --files="fzf.js"   # Remove a script's config
./run --debug --verbose           # Keep temp files, bash tracing
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
