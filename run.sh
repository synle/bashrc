#!/usr/bin/env bash
################################################################################
# ---- run.sh - Unified test runner script ----
#
# Usage:
#   bash run.sh                                    # Full run (auto-detects local repo or fetches from GitHub)
#   bash run.sh --files="git.js"                   # Run specific file(s)
#   bash run.sh --files="vim.js,git.js"            # Multiple files (comma-separated)
#   bash run.sh --files="""                        # Multiple files (multiline)
#     vim.js
#     git.js
#     vundle.js
#   """
#   bash run.sh git.js                             # Bare args treated as files
#   bash run.sh git.js vim.js                      # Multiple bare args
#   bash run.sh --force-refresh                    # Force refresh node and reinstall
#   bash run.sh -f                                 # Shorthand for --force-refresh
#   bash run.sh --lightweight                      # Export IS_LIGHT_WEIGHT_MODE=1 for lightweight installs
#   bash run.sh --debug                            # Enable debug mode (keep temp scripts for inspection)
#   bash run.sh -D                                 # Shorthand for --debug
#   bash run.sh --verbose                          # Enable verbose mode (set -x for bash tracing)
#   bash run.sh -V                                 # Shorthand for --verbose
#   bash run.sh --dryrun                           # Show what would change without writing files
#   bash run.sh --remove --files="fzf.js"          # Remove a script's config (runs undoWork)
#
# Single dash also works: -files=..., -force-refresh, -f, -lightweight, -debug, -D, -verbose, -V, -dryrun, -remove
################################################################################

################################################################################
# ---- Prerequisites - OS Flags & Helpers ----
################################################################################

################################################################################
# ---- common-env.sh - Shared environment setup for run.sh and Makefile build targets ----
# Sets up repo identifiers, URL exports, OS detection flags,
# and writes ~/.bash_syle_common
################################################################################
################################################################################
# ---- Repo & Path Constants ----
################################################################################
# BEGIN software/bootstrap/common-env.sh
# software/bootstrap/common-env.sh | d87a3dd0446abd091f1e526aff3bfff5 | 800 B
# Shared environment constants sourced by run.sh (via BEGIN/END) and vite.config.js.
export TZ=UTC
export REPO_PATH_IDENTIFIER="synle/bashrc"
export REPO_BRANCH_NAME="master"
export BASH_SYLE_PATH="$HOME/.bash_syle"
export BASH_SYLE_COMMON_PATH="$HOME/.bash_syle_common"
export BASH_PROFILE_CODE_REPO_RAW_URL="https://raw.githubusercontent.com/$REPO_PATH_IDENTIFIER/$REPO_BRANCH_NAME" # https://raw.githubusercontent.com/synle/bashrc/master
export LIGHT_WEIGHT_SCRIPTS="git.js,vim-configurations.js,vim-vundle.sh,bash-inputrc.js,bash-syle-content.js"
export LIMITED_SUPPORT_OSES="is_os_android_termux,is_os_mingw64"
export ALL_OS_FLAGS="is_os_mac,is_os_ubuntu,is_os_chromeos,is_os_mingw64,is_os_android_termux,is_os_arch_linux,is_os_steamos,is_os_redhat,is_os_windows,is_os_wsl"
# END software/bootstrap/common-env.sh

################################################################################
# ---- User Identity ----
################################################################################
export REPO_USER_NAME="syle"
export REPO_USER_EMAIL="$(git config --global user.email 2> /dev/null)"

################################################################################
# ---- Environment Tooling ----
################################################################################
export NODE_JS_VERSION="24"
export FNM_DIR="$HOME/.local/share/fnm"

################################################################################
# ---- Formatting Constants ----
################################################################################
export LINE_BREAK_COUNT=80
export LINE_BREAK_HASH=$(printf '#%.0s' $(seq 1 $LINE_BREAK_COUNT))
export PRINT_WIDTH_BREAK_COUNT=140
export BASHRC_TEMP_DIR="/tmp/$REPO_PATH_IDENTIFIER/$(date '+%Y_%m_%d_%H_%M')"
# Snapshot $HOME before any sudo runs. RHEL/Fedora sudoers sets `always_set_home`,
# which resets HOME to /root even with `sudo -E`. .su.js bundles run under sudo,
# so os.homedir() and $HOME both return /root there. This custom env var survives
# because sudoers only resets HOME, not arbitrary vars.
export BASE_HOMEDIR_LINUX="$HOME"

################################################################################
# ---- OS Detection ----
################################################################################
is_os_mac=0 && { [[ "$OSTYPE" == "darwin"* ]] || [ -d /Applications ]; } && is_os_mac=1
is_os_ubuntu=0 && command grep -Eiq "ID(_LIKE)?=(ubuntu|debian|mint)" /etc/os-release 2> /dev/null && is_os_ubuntu=1
is_os_chromeos=0 && { [ -f /dev/.cros_milestone ] || { command grep -qi "cros" /proc/version 2> /dev/null && ! command grep -qi "microsoft" /proc/version 2> /dev/null; }; } && is_os_chromeos=1
is_os_mingw64=0 && { [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]] || [ -d /mingw64 ]; } && is_os_mingw64=1
is_os_android_termux=0 && { [ -n "$TERMUX_VERSION" ] || [ -d /data/data/com.termux ]; } && is_os_android_termux=1
is_os_arch_linux=0 && command grep -Eiq "ID(_LIKE)?=(arch|steamos)" /etc/os-release 2> /dev/null && is_os_arch_linux=1
is_os_steamos=0 && command grep -qi "ID=steamos" /etc/os-release 2> /dev/null && is_os_steamos=1
is_os_redhat=0 && command grep -Eiq "ID(_LIKE)?=(fedora|rhel|centos|rocky|alma)" /etc/os-release 2> /dev/null && is_os_redhat=1
is_os_windows=0 && { [ -d /mnt/c/Windows ] || [ -d /c/Windows ]; } && is_os_windows=1
is_os_wsl=0 && { ((is_os_windows)) || command grep -qi microsoft /proc/version 2> /dev/null; } && is_os_wsl=1

IS_CI=0 && [ -n "$CI" ] && IS_CI=1
NO_COLOR="${NO_COLOR:-0}" && [ -n "$NO_COLOR" ] && [ "$NO_COLOR" != "0" ] && NO_COLOR=1 || NO_COLOR=0

os_flags=""
for var in $(compgen -v | grep '^is_os_\|^IS_CI$\|^NO_COLOR$'); do
  os_flags="$os_flags
export $var=${!var}"
  unset "$var"
done
unset var

################################################################################
# ---- Signal Handling ----
################################################################################
# Ctrl+C / SIGTERM: kill the entire process group (node|tee|bash pipeline) and exit immediately.
trap 'trap - INT TERM; kill 0' INT TERM

################################################################################
# ---- Utility Functions ----
################################################################################

# prevent curl from using cached responses
alias curl="curl -H 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0' -H 'Pragma: no-cache' -H 'Expires: 0' -H 'If-None-Match:' -H 'If-Modified-Since:'"

# make current user owner of ~/.local (only if ownership differs)
if [ -d "${HOME}/.local" ] && [ "$(stat -c '%u' "${HOME}/.local" 2> /dev/null || stat -f '%u' "${HOME}/.local" 2> /dev/null)" != "$(id -u)" ]; then
  sudo chown -R "$(whoami)" "${HOME}/.local" 2> /dev/null
fi

################################################################################
# ---- CI Mode ----
################################################################################
if ((IS_CI)); then
  function echo() {
    case "$*" in
    ">"* | "<"*)
      command echo "::endgroup::"
      local icons="" remainder="$*"
      while case "$remainder" in ">"*) icons="${icons}🚀" remainder="${remainder#?}" ;; *) false ;; esac do :; done
      while case "$remainder" in "<"*) icons="${icons}⭐" remainder="${remainder#?}" ;; *) false ;; esac do :; done
      command echo "::group::${icons}${remainder}"
      ;;
    *) command echo "$@" ;;
    esac
  }
fi

################################################################################
# ---- Bootstrap Node ----
################################################################################

# install_bootstrap_node - Ensure node (and npm) is available for running software/index.js
# Checks for existing node first, then falls back to downloading
# a standalone Node binary to /tmp/synle/bashrc/node/.
function install_bootstrap_node() {
  local node_tmp="/tmp/synle/bashrc/node"
  export PATH="$PATH:$node_tmp/bin"

  # Use existing node if already available
  if type -P node > /dev/null 2>&1; then
    echo ">> Using node from PATH ($(node -v 2> /dev/null))"
    return
  fi

  # Fallback: download standalone node to /tmp
  echo ">> Downloading standalone Node $NODE_JS_VERSION"
  rm -rf "$node_tmp"
  mkdir -p "$node_tmp"

  local os arch
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)
  case "$arch" in
  x86_64) arch="x64" ;;
  aarch64 | arm64) arch="arm64" ;;
  armv7l) arch="armv7l" ;;
  esac

  local full_version
  full_version=$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_JS_VERSION}.x/SHASUMS256.txt" \
    | head -1 | grep -o 'node-v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*' | head -1 | sed 's/node-//')

  if [ -z "$full_version" ]; then
    echo "[Error] Failed to resolve Node $NODE_JS_VERSION version. Exiting."
    exit 1
  fi

  curl -fsSL "https://nodejs.org/dist/${full_version}/node-${full_version}-${os}-${arch}.tar.xz" \
    | tar -xJ --strip-components=1 -C "$node_tmp"

  if [ ! -x "$node_tmp/bin/node" ]; then
    echo "[Error] Failed to download standalone Node binary. Exiting."
    exit 1
  fi

  echo ">> Using standalone node $(node -v 2> /dev/null) from $node_tmp"

  # Make node/npm/npx available to sudo (secure_path ignores user PATH)
  if [ -d "$node_tmp/bin" ] && [ -d /usr/local/bin ]; then
    for bin in "$node_tmp/bin"/*; do
      [ -x "$bin" ] || continue
      sudo ln -sf "$bin" "/usr/local/bin/$(basename "$bin")" 2> /dev/null \
        || ln -sf "$bin" "/usr/local/bin/$(basename "$bin")" 2> /dev/null \
        || true
    done
  fi
}

################################################################################
# ---- Run Files ----
################################################################################

# run_files - Run script files through software/index.js
# Args are parsed by parseRawArgs() in index.js via BASHRC_RAW_ARGS env var.
# Auto-detects local repo (software/index.js exists) or fetches via tarball/git.
function run_files() {
  # temp dir contents (keep in sync with run.sh summary and JS scripts):
  #   run.sh         - re-runnable script of all emitted bash commands
  #   run.log        - stdout/stderr output from executing run.sh
  #   bash_syle.0-before-run       - pre-run backup (_init.js)
  #   bash_syle.1-after-bootstrap  - after template assembly (_init.js)
  #   bash_syle.2-before-cleanup   - after all scripts, before cleanup (~cleanup.js)
  #   bash_syle.3-after-cleanup    - after cleanup (~cleanup.js)
  #   bash_syle.4-after-flush      - after final flushProfileBlocks (index.js)
  mkdir -p "$BASHRC_TEMP_DIR"
  cp "$BASH_SYLE_COMMON_PATH" "$BASHRC_TEMP_DIR/run.sh" 2> /dev/null
  if [ -f "software/index.js" ]; then
    cat software/index.js
  else
    curl -fsSL "$BASH_PROFILE_CODE_REPO_RAW_URL/software/index.js"
  fi | node | tee >(sed 's/\x1b\[[0-9;]*m//g' >> "$BASHRC_TEMP_DIR/run.sh") | bash 2>&1 | tee >(sed 's/\x1b\[[0-9;]*m//g' >> "$BASHRC_TEMP_DIR/run.log") 2>&1
}

################################################################################
# ---- Write ~/.bash_syle_common ----
################################################################################
# Populates BASH_SYLE_COMMON_PATH with function definitions + env vars for login shells.

echo '' > "$BASH_SYLE_COMMON_PATH"
echo """
$LINE_BREAK_HASH
# Auto-generated by common-env.sh (https://github.com/$REPO_PATH_IDENTIFIER/blob/$REPO_BRANCH_NAME/software/bootstrap/common-env.sh)
# Do not edit by hand as it will be overridden
$LINE_BREAK_HASH

$os_flags

export REPO_PATH_IDENTIFIER='$REPO_PATH_IDENTIFIER'
export REPO_BRANCH_NAME='$REPO_BRANCH_NAME'
export BASH_PROFILE_CODE_REPO_RAW_URL='$BASH_PROFILE_CODE_REPO_RAW_URL'
export BASH_SYLE_PATH='$BASH_SYLE_PATH'
export BASH_SYLE_COMMON_PATH='$BASH_SYLE_COMMON_PATH'

export LINE_BREAK_COUNT='$LINE_BREAK_COUNT'
export LINE_BREAK_HASH='$LINE_BREAK_HASH'
export PRINT_WIDTH_BREAK_COUNT='$PRINT_WIDTH_BREAK_COUNT'

alias osflags=\"env | grep '^is_os_.*=1' | awk -F= '{print \$1}'\"
""" >> "$BASH_SYLE_COMMON_PATH"

. "$BASH_SYLE_COMMON_PATH"
export BASH_ENV="$BASH_SYLE_COMMON_PATH"
unset os_flags

################################################################################
# ---- Pre-scan for flags that must take effect before node runs ----
# All other flags are parsed by parseRawArgs in index.js.
# Only --verbose (set -x) and --no-color must apply before node starts.
################################################################################
for arg in "$@"; do
  case "$arg" in
  --verbose | -verbose | -V) set -x ;;
  --no-color | -no-color) export NO_COLOR=1 ;;
  esac
done

################################################################################
# ---- Encode $@ as JSON for node arg parsing (parseRawArgs in index.js) ----
# BASHRC_RAW_ARGS is a JSON array of all CLI arguments passed to run.sh
# (e.g. '["--files=git.js","--force-refresh"]'). Exported so that
# parseRawArgs() in software/index.js can parse flags like --files,
# --force-refresh, --dryrun, --remove, --lightweight, --setup, etc.
################################################################################
BASHRC_RAW_ARGS='['
_sep=""
for arg in "$@"; do
  _esc="${arg//\\/\\\\}"
  _esc="${_esc//\"/\\\"}"
  BASHRC_RAW_ARGS="${BASHRC_RAW_ARGS}${_sep}\"${_esc}\""
  _sep=","
done
BASHRC_RAW_ARGS="${BASHRC_RAW_ARGS}]"
export BASHRC_RAW_ARGS

################################################################################
# ---- script: Run (single pipeline for files) ----
################################################################################

# ---- Backup ~/.bash_syle for rollback ----
if [ -f "$BASH_SYLE_PATH" ] && [ -s "$BASH_SYLE_PATH" ]; then
  cp "$BASH_SYLE_PATH" "${BASH_SYLE_PATH}.bak"
  echo ">> Backed up ~/.bash_syle to ~/.bash_syle.bak"
fi

_run_start_epoch=$(date +%s)
_run_start_time=$(date '+%Y-%m-%d %H:%M:%S')

#benchmark
mkdir -p "$BASHRC_TEMP_DIR"
echo "{\"start\":\"$_run_start_time\"}" > "$BASHRC_TEMP_DIR/run_timing.json"

install_bootstrap_node

if type -P node > /dev/null 2>&1; then
  run_files
else
  echo "[Skip] Node is not installed — skipping main script."
fi

_run_end_epoch=$(date +%s)
_run_end_time=$(date '+%Y-%m-%d %H:%M:%S')
_run_duration=$((_run_end_epoch - _run_start_epoch))

#benchmark - merge end/duration into existing timing file (preserves scripts data from JS)
if type -P node &> /dev/null; then
  node -e "var f=require('fs'),p='$BASHRC_TEMP_DIR/run_timing.json',d={};try{d=JSON.parse(f.readFileSync(p,'utf8'))}catch(e){}d.start='$_run_start_time';d.end='$_run_end_time';d.duration_seconds=$_run_duration;f.writeFileSync(p,JSON.stringify(d))"
else
  echo "{\"start\":\"$_run_start_time\",\"end\":\"$_run_end_time\",\"duration_seconds\":$_run_duration}" > "$BASHRC_TEMP_DIR/run_timing.json"
fi

echo "
$LINE_BREAK_HASH
>> run.sh started at $_run_start_time
>> run.sh done at $_run_end_time (${_run_duration}s)
>> script: $BASHRC_TEMP_DIR/run.sh
>> log: $BASHRC_TEMP_DIR/run.log
>> timing: $BASHRC_TEMP_DIR/run_timing.json
>> snapshots: $BASHRC_TEMP_DIR/bash_syle.{0-before-run,1-after-bootstrap,2-before-cleanup,3-after-cleanup,4-after-flush}
>> tmp: $BASHRC_TEMP_DIR
$LINE_BREAK_HASH
"

exit
