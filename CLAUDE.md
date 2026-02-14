# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal bash profile/dotfiles repository with a web-based configuration interface. It provides automated setup scripts for multiple platforms (Mac, Linux, Windows WSL, Android Termux, Arch Linux) and generates customized shell configurations, editor settings, and system configurations.

The repository has two main components:
1. **Shell Configuration System**: Platform-specific setup scripts that generate bash profiles, git configs, editor settings, etc.
2. **Web App**: A React/Vite-based configuration generator (accessible at https://synle.github.io/bashrc/) that provides a UI for creating installation commands

## Key Commands

### Building
```bash
# Full build (formats code, generates artifacts, builds webapp)
bash build.sh
# or
make build

# Format code only
bash format.sh
# or
make format
```

The build process:
1. Generates `software/metadata/script-list.config` (index of all scripts)
2. Pre-builds host mappings and IP address configs
3. Backs up XFCE configuration (if on Linux with XFCE)
4. Builds configuration artifacts to `.build/` directory
5. Builds the web app to `dist/` directory

### Testing

```bash
# Run all tests
make test
# or
sh test-full-run.sh

# Test dependencies only
make test_dependencies

# Test hosts setup
make test_setup_hosts

# Test a single script interactively
make test_single_run

# Test specific script(s) directly
sh test.sh "software/scripts/git.js"
sh test.sh "software/scripts/vim.js,software/scripts/git.js"
```

### Web App Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Code Architecture

### Script System (software/scripts/)

The core of the repository is a JavaScript-based configuration generator that produces bash scripts and configuration files. Scripts are organized by platform and functionality:

- `software/scripts/*.js` - Cross-platform scripts (git, vim, fzf, etc.)
- `software/scripts/mac/` - macOS-specific scripts
- `software/scripts/windows/` - Windows/WSL-specific scripts
- `software/scripts/android-termux/` - Android Termux-specific scripts
- `software/scripts/arch-linux/` - Arch Linux/Steam Deck-specific scripts
- `software/scripts/chrome-os/` - ChromeOS-specific scripts

### Script Execution Model

Scripts use a hybrid Node.js + Bash approach:

1. **base-node-script.js** provides the runtime environment with:
   - Global utilities (`fs`, `path`, `https`, `http`)
   - Path constants (`BASE_HOMEDIR_LINUX`, `BASE_BASH_SYLE`, etc.)
   - Editor config defaults (`EDITOR_CONFIGS`)
   - Helper functions (likely defined further in the file)

2. **Scripts are executed by piping through Node.js**:
   ```bash
   { cat software/base-node-script.js && cat software/scripts/git.js } | node | bash
   ```
   This pattern allows JavaScript to generate bash commands dynamically.

3. **Test mode** sets `TEST_SCRIPT_MODE=1` environment variable to run scripts in test/dry-run mode

### Key Scripts

- `software/test.sh.js` - Test runner logic
- `software/index.sh.js` - Main entry point for full setup
- `software/metadata/script-list.config.js` - Generates script index
- `software/metadata/ip-address.config.js` - Pre-builds host mappings
- `software/metadata/hosts-blocked-ads.config.js` - Generates ad-blocking hosts file

### Web App (webapp/)

A React/Vite SPA that generates installation commands based on user selections:

- `webapp/index.jsx` - Main React app
- `webapp/styles.scss` - Styles
- `webapp/sw-bashrc.js` - Service worker for offline functionality
- Built using `vite-plugin-singlefile` to produce a single HTML file in `dist/`

The web app detects the user's platform and generates appropriate installation commands like:
```bash
. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/setup-full.sh?$(date +%s))"
```

### Setup Scripts (Root Directory)

- `setup-full.sh` - Full system setup (loads barebone bash profile, then runs all scripts)
- `setup-lightweight.sh` - Minimal setup
- `setup-dependencies.sh` - Installs required dependencies
- `setup-hosts.sh` - Configures /etc/hosts for ad blocking
- `bash-profile-barebone.sh` - Minimal bash profile bootstrap
- `bash-profile-more-advanced.sh` - Extended bash profile

### Build Artifacts

The `.build/` directory contains generated configuration files:
- Editor keybindings (VS Code, Sublime Text) for different platforms
- Font installation instructions
- Windows-specific configs (registry, PowerShell profile)
- Git/vim/inputrc configurations

### Platform Detection

The codebase uses OS detection flags set in `bash-profile-barebone.sh` (likely):
- `is_os_android_termux`
- `is_os_window` (Windows/WSL)
- Platform-specific directory detection for Windows mount points

### Script Naming Conventions

- Files prefixed with `_` are utilities or platform-specific helpers
- Files ending in `.su.js` likely require sudo/superuser privileges
- Files ending in `.sh.js` are JavaScript files that generate shell scripts
- Files ending in `.sh` are pure bash scripts

## Development Workflow

1. Modify scripts in `software/scripts/` or web app in `webapp/`
2. Run `make format` to format code
3. Run `make test` to test changes locally
4. Run `make build` to generate artifacts
5. Commit changes (CI will automatically run build and format)

## CI/CD

GitHub Actions workflow (`.github/workflows/build-main.yml`) runs on push to master/main:
- Uses shared workflow from `synle/gha-workflow`
- Runs build script and commits artifacts back to the repository
