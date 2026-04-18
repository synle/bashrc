# NOTE: STOP - do not edit by hand - this file is auto-generated [2026-04-18]
# 
# Precompiled bash profile for arch_linux
# ################################################################################

################################################################################
# ---- begin core profile ----
################################################################################

#!/usr/bin/env bash
# software/bootstrap/profile-core.sh

################################################################################
# ---- Pre-core Profile Blocks (registerWithBashSyleProfile) ----
#
# BEGIN Profile Generated Timestamp
# Generated: 2026-04-18T05:02:41.130Z
# END Profile Generated Timestamp
#
################################################################################
# SOURCE_BEGIN software/scripts/bash-history-profile.bash
# software/scripts/bash-history-profile.bash | aa9ebe5f993a76f967e0f2d0a7a56c01 | 4.5 KB | 2026-04-18
# SOURCE_BEGIN software/bootstrap/common-functions.bash
# software/bootstrap/common-functions.bash | d9ed8ad8376248729ca94dc654c98d87 | 8.9 KB | 2026-04-18
# Shared shell functions for run.sh and SH scripts (via SOURCE markers).
# Source of truth — inlined into run.sh via BEGIN/END, included in .sh scripts at runtime.

# safe_source <source> [dest] - Fetches and sources a bash script with syntax validation.
#   source: URL (http/https), absolute path, or relative path
#   dest:   optional local path to store the fetched content (useful for caching URL downloads)
# URLs are downloaded via curl, files are used directly (or copied to dest if given).
# Always validates with bash -n before sourcing.
function safe_source() {
  local src="$1"
  local dest="${2:-}"
  local target="$src"
  case "$src" in
  http://* | https://*)
    target="${dest:-/tmp/bashrc_safe_source_$$.sh}"
    curl -fsSL -o "$target" "$src" 2> /dev/null || {
      echo "[Warning] safe_source download $src failed" >&2
      return 1
    }
    ;;
  *)
    if [ ! -f "$src" ]; then
      echo "[Warning] safe_source $src not found" >&2
      return 1
    fi
    if [ -n "$dest" ]; then
      cp "$src" "$dest" 2> /dev/null
      target="$dest"
    fi
    ;;
  esac
  bash -n "$target" 2> /dev/null && . "$target" || echo "[Warning] source $target failed" >&2
}

# curl_bash_install <url> [script args...] - Runs a curl|bash installer with output
# suppressed. In verbose mode (set -x), stderr is kept visible for debugging.
# Extra args are passed to the install script via bash -s -- <args>.
function curl_bash_install() {
  local url="$1"
  shift
  if [[ $- == *x* ]]; then
    curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  else
    curl -fsSL "$url" | bash -s -- "$@" &> /dev/null
  fi
}

# npm_install_global <pkg> [binary] - Installs an npm package globally. Skips if already installed.
#   pkg:    npm package name (e.g. @google/gemini-cli, yarn)
#   binary: binary name to check (defaults to last segment of pkg, e.g. gemini-cli from @google/gemini-cli)
# Installs to $HOME/.local on the current system. On WSL, also installs to the Windows host
# via cmd.exe. Logs status (Skipped/Success/Error) for each target.
function npm_install_global() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # install for current system
  local _resolved
  _resolved=$(has_persistent_binary "$bin")
  if [ -n "$_resolved" ]; then
    echo ">> $pkg >> Installing with npm global >> Skipped ($_resolved)"
  else
    echo -n ">> $pkg >> Installing with npm global >> "
    if npm install -g --prefix "$HOME/.local" "$pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi

  # install for Windows host via WSL
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    if cmd.exe /c "where $bin" &> /dev/null; then
      echo ">> $pkg >> Installing with npm global (Windows) >> Skipped"
    else
      echo -n ">> $pkg >> Installing with npm global (Windows) >> "
      if cmd.exe /c "npm install -g $pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
  fi
}

# has_persistent_binary <name> - Returns 0 (true) when the binary is found in PATH and is NOT
# inside /tmp/. During run.sh, /tmp/synle/bashrc/node/bin is on PATH (bootstrap node fallback),
# so binaries installed there by a prior run appear installed but are ephemeral. Use this for
# install-skip checks; use plain `type -P` for dependency-available checks where /tmp is fine.
# On success, prints the resolved path to stdout (capture with $()).
function has_persistent_binary() {
  local bin
  bin=$(type -P "$1" 2> /dev/null) || return 1
  [[ "$bin" == /tmp/* ]] && return 1
  echo "$bin"
}

# sudo <args...> - Wrapper that logs the caller and command before executing sudo.
# Helps track which script/function is requesting elevated privileges.
function sudo() {
  echo "[sudo] ${FUNCNAME[1]:-shell}: sudo $*" >&2
  command sudo "$@"
}

# safe_touch <file...> - Creates the file only if it does not exist. Skips existing files to
# avoid updating mtime (which would reset staleness checks). For files inside $HOME,
# fixes ownership to current user if owned by root.
function safe_touch() {
  for f in "$@"; do
    if [ ! -e "$f" ]; then
      command touch "$f"
      echo ">> safe_touch >> $f >> Created"
    elif [[ "$f" == "$HOME"/* ]] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_touch >> $f >> Fixed ownership"
    else
      echo ">> safe_touch >> $f >> Skipped"
    fi
  done
}

# safe_mkdir <dir...> - Creates directories (-p by default), then fixes ownership to
# current user for any resulting dir inside $HOME that is owned by root.
function safe_mkdir() {
  command mkdir -p "$@"
  for f in "$@"; do
    [[ "$f" == -* ]] && continue
    if [[ "$f" == "$HOME"/* ]] && [ -d "$f" ] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_mkdir >> $f >> Fixed ownership"
    else
      echo ">> safe_mkdir >> $f >> OK"
    fi
  done
}

# safe_chown [-R] [user] <path> - Runs sudo chown on a single path only if it exists
# and is not already owned by the target user. Defaults to $USER if no user given.
# Pass -R as the first argument to chown recursively. Always pass one path per call.
# Usage:
#   safe_chown "$HOME/.bashrc"              # chown to $USER
#   safe_chown -R "$HOME/.config"           # chown -R to $USER
#   safe_chown otheruser "$HOME/.bashrc"    # chown to otheruser
#   safe_chown -R otheruser "$HOME/.config" # chown -R to otheruser
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local target_user="$USER"
  if [ -n "$1" ] && [ ! -e "$1" ] && id "$1" &> /dev/null; then
    target_user="$1"
    shift
  fi
  local target_uid
  target_uid=$(id -u "$target_user")
  local f="$1"
  if [ ! -e "$f" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" = "$target_uid" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (already correct)"
  else
    sudo chown $flags "$target_user" "$f"
    echo ">> safe_chown $flags $target_user >> $f >> Done"
  fi
}

# safe_chmod [-R] <mode> <path> - Runs chmod on a single path only if it exists
# and permissions differ from the target mode. Always pass one path per call.
# Pass -R as the first argument to chmod recursively.
# Usage:
#   safe_chmod 700 "$HOME/.ssh"
#   safe_chmod 600 "$HOME/.ssh/id_rsa"
function safe_chmod() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local mode="$1"
  local f="$2"
  if [ ! -e "$f" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%a' "$f" 2> /dev/null || stat -f '%Lp' "$f" 2> /dev/null)" = "$mode" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (already correct)"
  else
    chmod $flags "$mode" "$f"
    echo ">> safe_chmod $flags $mode >> $f >> Done"
  fi
}

# get_github_raw_url <path> - Constructs a GitHub raw content URL for a file in this repo.
# Uses BASH_PROFILE_CODE_REPO_RAW_URL as the base and appends ?raw=1.
# Usage: curl -fsSL "$(get_github_raw_url software/bootstrap/setup.sh)" | bash
function get_github_raw_url() {
  echo "${BASH_PROFILE_CODE_REPO_RAW_URL}/${1}?raw=1"
}

# is_path_stale <path> [max_age_seconds] - Returns 0 (true) when the path is older than
# max_age_seconds or missing. Defaults to 2 weeks (1209600s) when no max age given.
function is_path_stale() {
  ((IS_REFRESH_MODE)) && return 0
  local target="$1"
  local max_age="${2:-1209600}"
  if [ -e "$target" ]; then
    local mtime
    mtime=$(stat -c '%Y' "$target" 2> /dev/null || stat -f '%m' "$target" 2> /dev/null || echo 0)
    [ $(($(date +%s) - mtime)) -gt "$max_age" ] && return 0
    return 1
  fi
  return 0
}

# is_force_refresh_stale [path] - Returns 0 (true) only when IS_FORCE_REFRESH=1 AND the path
# is stale. Defaults to BASH_SYLE_PATH when no path given.
# Used by medium/heavy scripts to avoid unnecessary re-downloads when the install is still fresh.
function is_force_refresh_stale() {
  ! ((IS_FORCE_REFRESH)) && return 1
  ((IS_REFRESH_MODE)) && return 0
  local target="${1:-$BASH_SYLE_PATH}"
  if is_path_stale "$target"; then return 0; fi
  echo ">> Force refresh skipped (not stale): $target"
  return 1
}

# is_bash_syle_stale - Returns 0 (true) when ~/.bash_syle is older than 2 weeks or missing.
# Used by dependency scripts to skip package index updates.
function is_bash_syle_stale() {
  is_path_stale "$BASH_SYLE_PATH"
}

# exit_if_limited_support_os - Exits the script if the current OS is a limited-support
# platform (LIMITED_SUPPORT_OSES) or if IS_LIGHT_WEIGHT_MODE is enabled.
function exit_if_limited_support_os() {
  ((IS_LIGHT_WEIGHT_MODE)) && {
    echo ">>> Skipped : Lightweight mode"
    exit 0
  }
  local IFS=','
  for os_flag in $LIMITED_SUPPORT_OSES; do
    ((${os_flag:-0})) && {
      echo ">>> Skipped : Not supported on $os_flag"
      exit 0
    }
  done
}
# SOURCE_END software/bootstrap/common-functions.bash
################################################################################
# ---- Bash History Backup & Search ----
#
# fuzzy_history        — Interactive fzf search over bash history (deduped)
# history_list_backups — List available backups with date and line count
# history_restore      — Restore ~/.bash_history from a backup by date
#
# Automatic daily backup on shell startup with rotation (7-day retention).
# Backups stored in: ~/.bash_history_backups/bash_history_YYYY-MM-DD
################################################################################
#
HISTORY_BACKUP_DIR="$HOME/.bash_history_backups"
HISTORY_BACKUP_MAX=7

# backs up ~/.bash_history daily (rotated, keeps HISTORY_BACKUP_MAX copies)
# runs automatically on shell startup
function _backup_history() {
  local today
  today=$(command date +%Y-%m-%d)
  local backup_file="$HISTORY_BACKUP_DIR/bash_history_$today"

  # skip if already backed up today
  [ -f "$backup_file" ] && return

  mkdir -p "$HISTORY_BACKUP_DIR"
  cp "$HOME/.bash_history" "$backup_file" 2> /dev/null

  # rotate: keep only the most recent backups
  ls -1t "$HISTORY_BACKUP_DIR"/bash_history_* 2> /dev/null | tail -n +$((HISTORY_BACKUP_MAX + 1)) | xargs rm -f 2> /dev/null
}
_backup_history

# interactive fuzzy history search using fzf — requires fzf, falls back to Ctrl+R
function fuzzy_history() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "fuzzy_history: interactive fzf search over bash history"
    echo "  fuzzy_history [query]    search with optional initial query"
    echo "  fuzzy_history help       show this help"
    return
  fi
  if ! type -P fzf &> /dev/null; then
    echo "fuzzy_history: fzf not installed, use Ctrl+R for built-in search"
    return 1
  fi

  local selected
  selected=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' ~/.bash_history | command grep -v '^#' | awk '!seen[$0]++' | fzf --no-sort --tac --layout=reverse --query="$1")

  if [ -n "$selected" ]; then
    echo "$selected"
    history -s "$selected"
    eval "$selected"
  fi
}

# lists all available history backups with date and line count
function history_list_backups() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "history_list_backups: list all available history backups"
    echo "  history_list_backups help  show this help"
    return
  fi
  local backups
  backups=$(ls -1t "$HISTORY_BACKUP_DIR"/bash_history_* 2> /dev/null)

  if [ -z "$backups" ]; then
    echo "history_list_backups: no backups found in $HISTORY_BACKUP_DIR"
    return 1
  fi

  echo "Available history backups:"
  while IFS= read -r file; do
    local date_part lines
    date_part=$(basename "$file" | sed 's/bash_history_//')
    lines=$(wc -l < "$file" 2> /dev/null | tr -d ' ')
    echo "  $date_part  $lines lines  $file"
  done <<< "$backups"
}

# restores ~/.bash_history from a backup
function history_restore() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "history_restore: restore ~/.bash_history from a backup"
    echo "  history_restore              restore latest (only if history is empty)"
    echo "  history_restore YYYY-MM-DD   restore specific date (overwrites)"
    echo "  history_restore help         show this help"
    return
  fi
  local target_date="$1"

  if [ -n "$target_date" ]; then
    # restore a specific date (overwrites current history)
    local specific_file="$HISTORY_BACKUP_DIR/bash_history_$target_date"
    if [ ! -f "$specific_file" ]; then
      echo "history_restore: backup not found: $specific_file"
      echo "Run history_list_backups to see available dates"
      return 1
    fi
    cp "$specific_file" "$HOME/.bash_history"
    history -c
    history -r
    local lines
    lines=$(wc -l < "$HOME/.bash_history" | tr -d ' ')
    echo "history_restore: restored $lines lines from $specific_file"
  else
    # restore latest (safe mode: only if history is empty or missing)
    if [ -s "$HOME/.bash_history" ]; then
      echo "history_restore: ~/.bash_history is not empty, skipping"
      echo "To force restore a specific date: history_restore YYYY-MM-DD"
      return 0
    fi
    local latest
    latest=$(ls -1t "$HISTORY_BACKUP_DIR"/bash_history_* 2> /dev/null | head -1)
    if [ -n "$latest" ]; then
      cp "$latest" "$HOME/.bash_history"
      history -c
      history -r
      local lines
      lines=$(wc -l < "$HOME/.bash_history" | tr -d ' ')
      echo "history_restore: restored $lines lines from $latest"
    else
      echo "history_restore: no backups found in $HISTORY_BACKUP_DIR"
    fi
  fi
}
# SOURCE_END software/scripts/bash-history-profile.bash
# BEGIN fnm - fast node manager
# hookup binary - add default node version to PATH
export FNM_DIR="/github/home/.local/share/fnm"
export PATH="/github/home/.local/share/fnm:$PATH"
export PATH="/bin:$PATH"

# initialize fnm
type -P fnm &>/dev/null && eval "$(fnm env)"
# END fnm - fast node manager
# BEGIN format script
# === timeout script ===
# Runs a command with a timeout, killing it if it exceeds the allowed duration.
# Usage: timeout [seconds] <command> (default: 17s)
function timeout() {
  local delay cmd
  if [ "$#" -eq 1 ]; then delay=17; cmd="$1"
  elif [ "$#" -eq 2 ]; then delay="$1"; cmd="$2"
  else echo "Usage: timeout [seconds] <command>" >&2; return 1; fi

  echo "Running with ${delay}s timeout: $cmd" >&2
  (
    eval "$cmd" &
    local cmd_pid=$!
    (
      sleep "$delay"
      if kill -0 "$cmd_pid" 2>/dev/null; then
        echo "Timeout after ${delay}s: killing '$cmd'" >&2
        kill -9 "$cmd_pid" 2>/dev/null
      fi
    ) &
    wait "$cmd_pid"
  )
}

# === format script ===
function format() {
  local verbose=0
  if [ "$(echo "$1" | tr '[:upper:]' '[:lower:]')" = "1" ] || [ "$(echo "$1" | tr '[:upper:]' '[:lower:]')" = "true" ]; then
    verbose=1
    shift
  fi

  echo "Running full project format sequence..."

  # Merge macOS resource fork (._*) files into their parent files
  if type -P dot_clean &>/dev/null; then
    if [ "$verbose" -eq 1 ]; then
      timeout "dot_clean ." || echo "dot_clean failed or skipped."
    else
      timeout "dot_clean ." > /dev/null 2>&1 || true
    fi
  fi

  if [ "$verbose" -eq 1 ]; then
    timeout format_cleanup || echo "format_cleanup failed or skipped."
    timeout format_other_text_based_files || echo "format_other_text_based_files failed or skipped."
    timeout format_python || echo "format_python failed or skipped."
    timeout format_js || echo "format_js failed or skipped."
    echo "All formatting steps complete (some may have warnings)."
  else
    timeout format_cleanup > /dev/null 2>&1 || true
    timeout format_other_text_based_files > /dev/null 2>&1 || true
    timeout format_python > /dev/null 2>&1 || true
    timeout format_js > /dev/null 2>&1 || true
  fi
}

function format_js() {
  echo "Running Prettier on JavaScript/TypeScript files..."

  if ! type -P npx &>/dev/null; then
    echo "npx not found. Please install Node.js (https://nodejs.org/) first."
    return 1
  fi

  # Create a temporary .prettierignore file
  local temp_ignore_file=$(mktemp)
  cat <<'EOF' > "$temp_ignore_file"
.angular
.astro
.bundle
.cache
.docusaurus
.ebextensions
.eggs
.generated
.git
.gradle
.hg
.hypothesis
.idea
.mypy_cache
.next
.nox
.nuxt
.nx
.parcel-cache
.pnpm-store
.pytest_cache
.ruff_*
.ruff_cache
.sass-cache
.serverless
.svelte-kit
.svn
.terraform
.tox
.turbo
.uv
.venv
.yarn
CVS
__pycache*
__pycache__
__pypackages__
bower_components
build
coverage
dist
htmlcov
node_modules
target
tmp
vendor
venv
webpack-dist
EOF

  npx prettier --write --cache --ignore-unknown --no-error-on-unmatched-pattern --ignore-path "$temp_ignore_file" --print-width 140 . > /dev/null 2>&1
  local status=$?
  rm -f "$temp_ignore_file"

  if [ $status -eq 0 ]; then
    echo "JS/TS formatting complete."
  else
    echo "Prettier encountered some errors."
    return 1
  fi
}

function format_python() {
  # Only activate venv if not already active
  if [ -n "$VIRTUAL_ENV" ]; then
    echo "Python environment already active: $VIRTUAL_ENV"
  else
    if [ -f ".venv/bin/activate" ]; then
      echo "Activating local virtual environment (.venv)..."
      source .venv/bin/activate
    elif [ -f "$HOME/venv/bin/activate" ]; then
      echo "Activating fallback environment ($HOME/venv)..."
      source "$HOME/venv/bin/activate"
    else
      echo "No virtual environment found. Using global Python."
    fi
  fi

  if ! type -P ruff &>/dev/null; then
    echo "Installing Ruff..."
    pip install ruff || uv pip install ruff || { echo "Failed to install Ruff."; return 1; }
  fi

  echo "Running Ruff checks and formatting..."
  ruff format --line-length 140 --exclude ".angular,.astro,.bundle,.cache,.docusaurus,.ebextensions,.eggs,.generated,.git,.gradle,.hg,.hypothesis,.idea,.mypy_cache,.next,.nox,.nuxt,.nx,.parcel-cache,.pnpm-store,.pytest_cache,.ruff_*,.ruff_cache,.sass-cache,.serverless,.svelte-kit,.svn,.terraform,.tox,.turbo,.uv,.venv,.yarn,CVS,__pycache*,__pycache__,__pypackages__,bower_components,build,coverage,dist,htmlcov,node_modules,target,tmp,vendor,venv,webpack-dist" > /dev/null 2>&1 || return 1
  ruff check --fix --line-length 140 --exclude ".angular,.astro,.bundle,.cache,.docusaurus,.ebextensions,.eggs,.generated,.git,.gradle,.hg,.hypothesis,.idea,.mypy_cache,.next,.nox,.nuxt,.nx,.parcel-cache,.pnpm-store,.pytest_cache,.ruff_*,.ruff_cache,.sass-cache,.serverless,.svelte-kit,.svn,.terraform,.tox,.turbo,.uv,.venv,.yarn,CVS,__pycache*,__pycache__,__pypackages__,bower_components,build,coverage,dist,htmlcov,node_modules,target,tmp,vendor,venv,webpack-dist" > /dev/null 2>&1 || return 1
  echo "Python formatting complete."
}

# ----------------------------------------------------
# Aggressive Junk Cleanup (macOS metadata, OS artifacts,
# patch rejects, and other system files)
# ----------------------------------------------------
function format_cleanup() {
  echo "Cleaning junk files..."

  local base_dir="${1:-.}"

  if [ ! -d "$base_dir" ]; then
    echo "Directory '$base_dir' not found."
    return 1
  fi

  local deleted
  deleted=$(find "$base_dir" \
    \( \
      -type f \( \
        -name '._*' -o \
        -name '.AppleDouble' -o \
        -name '.DS_Store' -o \
        -name '.LSOverride' -o \
        -name '*.Identifier' -o \
        -name '*.orig' -o \
        -name '*.rej' -o \
        -name 'Desktop.ini' -o \
        -name 'ehthumbs.db' -o \
        -name 'Icon?' -o \
        -name 'Thumbs.db' \
      \) -o \
      -type d \( \
        -name '.Spotlight-V100' -o \
        -name '.Trashes' -o \
        -name '.fseventsd' -o \
        -name '__MACOSX' \
      \) \
    \) \
    -not -path '*/.angular/*' \
    -not -path '*/.astro/*' \
    -not -path '*/.bundle/*' \
    -not -path '*/.cache/*' \
    -not -path '*/.docusaurus/*' \
    -not -path '*/.ebextensions/*' \
    -not -path '*/.eggs/*' \
    -not -path '*/.generated/*' \
    -not -path '*/.git/*' \
    -not -path '*/.gradle/*' \
    -not -path '*/.hg/*' \
    -not -path '*/.hypothesis/*' \
    -not -path '*/.idea/*' \
    -not -path '*/.mypy_cache/*' \
    -not -path '*/.next/*' \
    -not -path '*/.nox/*' \
    -not -path '*/.nuxt/*' \
    -not -path '*/.nx/*' \
    -not -path '*/.parcel-cache/*' \
    -not -path '*/.pnpm-store/*' \
    -not -path '*/.pytest_cache/*' \
    -not -path '*/.ruff_*/*' \
    -not -path '*/.ruff_cache/*' \
    -not -path '*/.sass-cache/*' \
    -not -path '*/.serverless/*' \
    -not -path '*/.svelte-kit/*' \
    -not -path '*/.svn/*' \
    -not -path '*/.terraform/*' \
    -not -path '*/.tox/*' \
    -not -path '*/.turbo/*' \
    -not -path '*/.uv/*' \
    -not -path '*/.venv/*' \
    -not -path '*/.yarn/*' \
    -not -path '*/CVS/*' \
    -not -path '*/__pycache*/*' \
    -not -path '*/__pycache__/*' \
    -not -path '*/__pypackages__/*' \
    -not -path '*/bower_components/*' \
    -not -path '*/build/*' \
    -not -path '*/coverage/*' \
    -not -path '*/dist/*' \
    -not -path '*/htmlcov/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/target/*' \
    -not -path '*/tmp/*' \
    -not -path '*/vendor/*' \
    -not -path '*/venv/*' \
    -not -path '*/webpack-dist/*' \
    -print -exec rm -rf {} + 2>/dev/null)

  local count=$(echo "$deleted" | grep -c . 2>/dev/null || echo 0)
  if [ "$count" -gt 0 ]; then
    echo "Removed $count junk items."
  else
    echo "No junk found."
  fi
}

# ----------------------------------------------------
# Light Cleanup (depth limited)
# ----------------------------------------------------
function format_cleanup_light() {
  local base_dir="${1:-.}"
  local max_depth=3

  if [ ! -d "$base_dir" ]; then
    return 1
  fi

  # Merge macOS resource fork (._*) files before deleting leftovers
  if type -P dot_clean &>/dev/null; then
    dot_clean "$base_dir" 2>/dev/null || true
  fi

  find "$base_dir" \
    -maxdepth "$max_depth" \
    \( \
      -type f \( \
        -name '._*' -o \
        -name '.AppleDouble' -o \
        -name '.DS_Store' -o \
        -name '.LSOverride' -o \
        -name '*.Identifier' -o \
        -name '*.orig' -o \
        -name '*.rej' -o \
        -name 'Desktop.ini' -o \
        -name 'ehthumbs.db' -o \
        -name 'Icon?' -o \
        -name 'Thumbs.db' -o -name '.*._' -o -name '._*' \
      \) -o \
      -type d \( \
        -name '.Spotlight-V100' -o \
        -name '.Trashes' -o \
        -name '.fseventsd' -o \
        -name '__MACOSX' \
      \) \
    \) \
    -not -path '*/.angular/*' \
    -not -path '*/.astro/*' \
    -not -path '*/.bundle/*' \
    -not -path '*/.cache/*' \
    -not -path '*/.docusaurus/*' \
    -not -path '*/.ebextensions/*' \
    -not -path '*/.eggs/*' \
    -not -path '*/.generated/*' \
    -not -path '*/.git/*' \
    -not -path '*/.gradle/*' \
    -not -path '*/.hg/*' \
    -not -path '*/.hypothesis/*' \
    -not -path '*/.idea/*' \
    -not -path '*/.mypy_cache/*' \
    -not -path '*/.next/*' \
    -not -path '*/.nox/*' \
    -not -path '*/.nuxt/*' \
    -not -path '*/.nx/*' \
    -not -path '*/.parcel-cache/*' \
    -not -path '*/.pnpm-store/*' \
    -not -path '*/.pytest_cache/*' \
    -not -path '*/.ruff_*/*' \
    -not -path '*/.ruff_cache/*' \
    -not -path '*/.sass-cache/*' \
    -not -path '*/.serverless/*' \
    -not -path '*/.svelte-kit/*' \
    -not -path '*/.svn/*' \
    -not -path '*/.terraform/*' \
    -not -path '*/.tox/*' \
    -not -path '*/.turbo/*' \
    -not -path '*/.uv/*' \
    -not -path '*/.venv/*' \
    -not -path '*/.yarn/*' \
    -not -path '*/CVS/*' \
    -not -path '*/__pycache*/*' \
    -not -path '*/__pycache__/*' \
    -not -path '*/__pypackages__/*' \
    -not -path '*/bower_components/*' \
    -not -path '*/build/*' \
    -not -path '*/coverage/*' \
    -not -path '*/dist/*' \
    -not -path '*/htmlcov/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/target/*' \
    -not -path '*/tmp/*' \
    -not -path '*/vendor/*' \
    -not -path '*/venv/*' \
    -not -path '*/webpack-dist/*' \
    -exec rm -rf {} +
}

# ----------------------------------------------------
# Text File Formatting (trim trailing whitespace)
# ----------------------------------------------------
function format_other_text_based_files() {
  echo '> Formatting text-based files...'

  EXCLUDE_DIRS=(
    ".angular"
    ".astro"
    ".bundle"
    ".cache"
    ".docusaurus"
    ".ebextensions"
    ".eggs"
    ".generated"
    ".git"
    ".gradle"
    ".hg"
    ".hypothesis"
    ".idea"
    ".mypy_cache"
    ".next"
    ".nox"
    ".nuxt"
    ".nx"
    ".parcel-cache"
    ".pnpm-store"
    ".pytest_cache"
    ".ruff_*"
    ".ruff_cache"
    ".sass-cache"
    ".serverless"
    ".svelte-kit"
    ".svn"
    ".terraform"
    ".tox"
    ".turbo"
    ".uv"
    ".venv"
    ".yarn"
    "CVS"
    "__pycache*"
    "__pycache__"
    "__pypackages__"
    "bower_components"
    "build"
    "coverage"
    "dist"
    "htmlcov"
    "node_modules"
    "target"
    "tmp"
    "vendor"
    "venv"
    "webpack-dist"
  )

  EXCLUDE_FILES=(
    "*.Identifier"
    "*.min.css"
    "*.min.js"
    "*.orig"
    "*.rej"
    ".DS_Store"
    "package-lock.json"
    "pnpm-lock.yaml"
    "yarn.lock"
  )

  dir_args=()
  for i in "${!EXCLUDE_DIRS[@]}"; do
    dir_args+=("-name" "${EXCLUDE_DIRS[$i]}")
    [ $i -lt $((${#EXCLUDE_DIRS[@]} - 1)) ] && dir_args+=("-o")
  done

  file_exclude_args=()
  for i in "${!EXCLUDE_FILES[@]}"; do
    file_exclude_args+=("-name" "${EXCLUDE_FILES[$i]}")
    [ $i -lt $((${#EXCLUDE_FILES[@]} - 1)) ] && file_exclude_args+=("-o")
  done

  find . -type d \( "${dir_args[@]}" \) -prune -o     -type f ! \( "${file_exclude_args[@]}" \) -print |     while read -r file; do

      if file --mime-type "$file" | grep -q "text/"; then
        sed -i 's/[ \t]*$//' "$file"
      fi
    done

  echo '> DONE Formatting All Text-Based Files'
}
# END format script

# BEGIN temporal-cli
export PATH="/github/home/.temporalio/bin:$PATH"
# END temporal-cli
# SOURCE_BEGIN software/scripts/bash-path-candidate-profile.bash
# software/scripts/bash-path-candidate-profile.bash | 7909f5dee1b62ecf48b0b7df599e251e | 3.6 KB | 2026-04-18
# SOURCE_BEGIN software/bootstrap/common-functions.bash
# software/bootstrap/common-functions.bash | d9ed8ad8376248729ca94dc654c98d87 | 8.9 KB | 2026-04-18
# Shared shell functions for run.sh and SH scripts (via SOURCE markers).
# Source of truth — inlined into run.sh via BEGIN/END, included in .sh scripts at runtime.

# safe_source <source> [dest] - Fetches and sources a bash script with syntax validation.
#   source: URL (http/https), absolute path, or relative path
#   dest:   optional local path to store the fetched content (useful for caching URL downloads)
# URLs are downloaded via curl, files are used directly (or copied to dest if given).
# Always validates with bash -n before sourcing.
function safe_source() {
  local src="$1"
  local dest="${2:-}"
  local target="$src"
  case "$src" in
  http://* | https://*)
    target="${dest:-/tmp/bashrc_safe_source_$$.sh}"
    curl -fsSL -o "$target" "$src" 2> /dev/null || {
      echo "[Warning] safe_source download $src failed" >&2
      return 1
    }
    ;;
  *)
    if [ ! -f "$src" ]; then
      echo "[Warning] safe_source $src not found" >&2
      return 1
    fi
    if [ -n "$dest" ]; then
      cp "$src" "$dest" 2> /dev/null
      target="$dest"
    fi
    ;;
  esac
  bash -n "$target" 2> /dev/null && . "$target" || echo "[Warning] source $target failed" >&2
}

# curl_bash_install <url> [script args...] - Runs a curl|bash installer with output
# suppressed. In verbose mode (set -x), stderr is kept visible for debugging.
# Extra args are passed to the install script via bash -s -- <args>.
function curl_bash_install() {
  local url="$1"
  shift
  if [[ $- == *x* ]]; then
    curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  else
    curl -fsSL "$url" | bash -s -- "$@" &> /dev/null
  fi
}

# npm_install_global <pkg> [binary] - Installs an npm package globally. Skips if already installed.
#   pkg:    npm package name (e.g. @google/gemini-cli, yarn)
#   binary: binary name to check (defaults to last segment of pkg, e.g. gemini-cli from @google/gemini-cli)
# Installs to $HOME/.local on the current system. On WSL, also installs to the Windows host
# via cmd.exe. Logs status (Skipped/Success/Error) for each target.
function npm_install_global() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # install for current system
  local _resolved
  _resolved=$(has_persistent_binary "$bin")
  if [ -n "$_resolved" ]; then
    echo ">> $pkg >> Installing with npm global >> Skipped ($_resolved)"
  else
    echo -n ">> $pkg >> Installing with npm global >> "
    if npm install -g --prefix "$HOME/.local" "$pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi

  # install for Windows host via WSL
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    if cmd.exe /c "where $bin" &> /dev/null; then
      echo ">> $pkg >> Installing with npm global (Windows) >> Skipped"
    else
      echo -n ">> $pkg >> Installing with npm global (Windows) >> "
      if cmd.exe /c "npm install -g $pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
  fi
}

# has_persistent_binary <name> - Returns 0 (true) when the binary is found in PATH and is NOT
# inside /tmp/. During run.sh, /tmp/synle/bashrc/node/bin is on PATH (bootstrap node fallback),
# so binaries installed there by a prior run appear installed but are ephemeral. Use this for
# install-skip checks; use plain `type -P` for dependency-available checks where /tmp is fine.
# On success, prints the resolved path to stdout (capture with $()).
function has_persistent_binary() {
  local bin
  bin=$(type -P "$1" 2> /dev/null) || return 1
  [[ "$bin" == /tmp/* ]] && return 1
  echo "$bin"
}

# sudo <args...> - Wrapper that logs the caller and command before executing sudo.
# Helps track which script/function is requesting elevated privileges.
function sudo() {
  echo "[sudo] ${FUNCNAME[1]:-shell}: sudo $*" >&2
  command sudo "$@"
}

# safe_touch <file...> - Creates the file only if it does not exist. Skips existing files to
# avoid updating mtime (which would reset staleness checks). For files inside $HOME,
# fixes ownership to current user if owned by root.
function safe_touch() {
  for f in "$@"; do
    if [ ! -e "$f" ]; then
      command touch "$f"
      echo ">> safe_touch >> $f >> Created"
    elif [[ "$f" == "$HOME"/* ]] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_touch >> $f >> Fixed ownership"
    else
      echo ">> safe_touch >> $f >> Skipped"
    fi
  done
}

# safe_mkdir <dir...> - Creates directories (-p by default), then fixes ownership to
# current user for any resulting dir inside $HOME that is owned by root.
function safe_mkdir() {
  command mkdir -p "$@"
  for f in "$@"; do
    [[ "$f" == -* ]] && continue
    if [[ "$f" == "$HOME"/* ]] && [ -d "$f" ] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_mkdir >> $f >> Fixed ownership"
    else
      echo ">> safe_mkdir >> $f >> OK"
    fi
  done
}

# safe_chown [-R] [user] <path> - Runs sudo chown on a single path only if it exists
# and is not already owned by the target user. Defaults to $USER if no user given.
# Pass -R as the first argument to chown recursively. Always pass one path per call.
# Usage:
#   safe_chown "$HOME/.bashrc"              # chown to $USER
#   safe_chown -R "$HOME/.config"           # chown -R to $USER
#   safe_chown otheruser "$HOME/.bashrc"    # chown to otheruser
#   safe_chown -R otheruser "$HOME/.config" # chown -R to otheruser
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local target_user="$USER"
  if [ -n "$1" ] && [ ! -e "$1" ] && id "$1" &> /dev/null; then
    target_user="$1"
    shift
  fi
  local target_uid
  target_uid=$(id -u "$target_user")
  local f="$1"
  if [ ! -e "$f" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" = "$target_uid" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (already correct)"
  else
    sudo chown $flags "$target_user" "$f"
    echo ">> safe_chown $flags $target_user >> $f >> Done"
  fi
}

# safe_chmod [-R] <mode> <path> - Runs chmod on a single path only if it exists
# and permissions differ from the target mode. Always pass one path per call.
# Pass -R as the first argument to chmod recursively.
# Usage:
#   safe_chmod 700 "$HOME/.ssh"
#   safe_chmod 600 "$HOME/.ssh/id_rsa"
function safe_chmod() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local mode="$1"
  local f="$2"
  if [ ! -e "$f" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%a' "$f" 2> /dev/null || stat -f '%Lp' "$f" 2> /dev/null)" = "$mode" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (already correct)"
  else
    chmod $flags "$mode" "$f"
    echo ">> safe_chmod $flags $mode >> $f >> Done"
  fi
}

# get_github_raw_url <path> - Constructs a GitHub raw content URL for a file in this repo.
# Uses BASH_PROFILE_CODE_REPO_RAW_URL as the base and appends ?raw=1.
# Usage: curl -fsSL "$(get_github_raw_url software/bootstrap/setup.sh)" | bash
function get_github_raw_url() {
  echo "${BASH_PROFILE_CODE_REPO_RAW_URL}/${1}?raw=1"
}

# is_path_stale <path> [max_age_seconds] - Returns 0 (true) when the path is older than
# max_age_seconds or missing. Defaults to 2 weeks (1209600s) when no max age given.
function is_path_stale() {
  ((IS_REFRESH_MODE)) && return 0
  local target="$1"
  local max_age="${2:-1209600}"
  if [ -e "$target" ]; then
    local mtime
    mtime=$(stat -c '%Y' "$target" 2> /dev/null || stat -f '%m' "$target" 2> /dev/null || echo 0)
    [ $(($(date +%s) - mtime)) -gt "$max_age" ] && return 0
    return 1
  fi
  return 0
}

# is_force_refresh_stale [path] - Returns 0 (true) only when IS_FORCE_REFRESH=1 AND the path
# is stale. Defaults to BASH_SYLE_PATH when no path given.
# Used by medium/heavy scripts to avoid unnecessary re-downloads when the install is still fresh.
function is_force_refresh_stale() {
  ! ((IS_FORCE_REFRESH)) && return 1
  ((IS_REFRESH_MODE)) && return 0
  local target="${1:-$BASH_SYLE_PATH}"
  if is_path_stale "$target"; then return 0; fi
  echo ">> Force refresh skipped (not stale): $target"
  return 1
}

# is_bash_syle_stale - Returns 0 (true) when ~/.bash_syle is older than 2 weeks or missing.
# Used by dependency scripts to skip package index updates.
function is_bash_syle_stale() {
  is_path_stale "$BASH_SYLE_PATH"
}

# exit_if_limited_support_os - Exits the script if the current OS is a limited-support
# platform (LIMITED_SUPPORT_OSES) or if IS_LIGHT_WEIGHT_MODE is enabled.
function exit_if_limited_support_os() {
  ((IS_LIGHT_WEIGHT_MODE)) && {
    echo ">>> Skipped : Lightweight mode"
    exit 0
  }
  local IFS=','
  for os_flag in $LIMITED_SUPPORT_OSES; do
    ((${os_flag:-0})) && {
      echo ">>> Skipped : Not supported on $os_flag"
      exit 0
    }
  done
}
# SOURCE_END software/bootstrap/common-functions.bash
################################################################################
# ---- PATH Setup ----
#
# No user-callable functions. Assembles PATH from a candidate list:
# prepend user tools, dedupe (first-seen wins), prune non-existent dirs.
#
# path_candidates array is the single source of truth for binary paths.
# Edit it when adding tools that install to non-standard locations.
################################################################################

# Shared PATH candidates array. Single source of truth for both:
#   - profile-core.sh (inlined via BEGIN/END build-include)
#   - .github/actions/ci-build/action.yml (sourced directly)
# When adding a new tool/package, add its binary path here if
# it installs to a non-standard location (e.g. ~/.tool/bin, /opt/...).
path_candidates=(
  ################################################################################
  # ---- user tools first (take precedence over system packages) ----
  ################################################################################
  ~/.fzf/bin # fzf fuzzy finder
  # ---- node / javascript ----
  ~/.local/share/fnm # fnm (fast node manager)
  ~/.volta/bin       # volta node version manager
  ~/.bun/bin         # bun javascript runtime
  ~/.deno/bin        # deno javascript runtime
  # ---- go ----
  /usr/local/go/bin # go sdk
  ~/go/bin          # go binaries (GOPATH)
  # ---- rust ----
  ~/.cargo/bin # rust / cargo
  # ---- python ----
  ~/miniconda3/bin      # miniconda python
  ~/miniconda3/condabin # conda command
  # ---- cli tools ----
  ~/.claude/bin     # claude cli
  ~/.local/bin      # pip / user-local binaries
  ~/.temporalio/bin # temporal cli
  # ---- mac (before system dirs so homebrew bash/tools take priority) ----
  /opt/homebrew/opt/make/libexec/gnubin                             # gnu make 4+ (mac only, overrides macOS 3.81)
  /opt/homebrew/bin                                                 # homebrew (apple silicon)
  /opt/homebrew/sbin                                                # homebrew admin (apple silicon)
  /opt/homebrew/opt/mysql-client/bin                                # mysql client (homebrew keg-only)
  /usr/local/Homebrew/bin                                           # homebrew (intel mac)
  "/Applications/Visual Studio Code.app/Contents/Resources/app/bin" # vs code (code)
  "/Applications/Sublime Text.app/Contents/SharedSupport/bin"       # sublime text (subl)
  "/Applications/Zed.app/Contents/MacOS"                            # zed editor
  ################################################################################
  # ---- common system (both mac and linux) ----
  ################################################################################
  /usr/local/bin  # user-installed binaries
  /usr/local/sbin # local admin binaries
  /usr/bin        # standard unix binaries
  /usr/sbin       # standard unix admin binaries
  /bin            # core system binaries
  /sbin           # core system admin binaries
  # ---- linux / wsl ----
  /snap/bin        # snap packages
  /usr/games       # linux game binaries
  /usr/local/games # local game binaries
  /usr/lib/wsl/lib # wsl gpu / system libs
)

# build PATH from candidates in order (first entry = highest priority),
# then dedupe and prune non-existent directories — all in one pipeline
export PATH="$(
  {
    for p in "${path_candidates[@]}"; do echo "${p/#\~/$HOME}"; done
    echo "$PATH" | tr ':' '\n'
  } \
    | awk '!seen[$0]++' \
    | while IFS= read -r d; do [ -d "$d" ] && echo "$d"; done \
    | tr '\n' ':' | sed 's/:$//'
)"

unset path_candidates
# SOURCE_END software/scripts/bash-path-candidate-profile.bash
export EDITOR='vim'
export BASH_PATH=~/.bash_syle
export LINE_BREAK_COUNT=100
export LINE_BREAK_HASH=$(printf '#%.0s' $(seq 1 $LINE_BREAK_COUNT))

################################################################################
# ---- Aliases: Coreutils Defaults ----
################################################################################
alias cp='cp -p'                              # preserve timestamps and permissions
alias ping='ping -c 5'                        # stop after 5 pings instead of infinite
alias mkdir='mkdir -p'                        # create parent dirs automatically
alias df='df -h'                              # human-readable sizes
alias du='du -h'                              # human-readable sizes
alias free='free -h'                          # human-readable sizes (linux)
function less() { command vim -R "${@:--}"; } # open in vim read-only mode (supports piping)
alias grep='grep --color'                     # colorize matches
alias ls="ls -1 -F --color"
alias ll="ls -lah"
alias ls_newest="ll -t"               # sort by modification time (newest first)
alias ls_newest_last="ls_newest -r"   # sort by modification time (oldest first)
alias ls_biggest="ll -S"              # sort by file size (biggest first)
alias ls_biggest_last="ls_biggest -r" # sort by file size (smallest first)
# prevent curl from using cached responses
alias curl="curl \
  -H 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0' \
  -H 'Pragma: no-cache' \
  -H 'Expires: 0' \
  -H 'If-None-Match:' \
  -H 'If-Modified-Since:'"
# Cache-Control: no-cache, no-store, must-revalidate, max-age=0 — HTTP/1.1: don't cache, don't store, revalidate, expire immediately
# Pragma: no-cache — HTTP/1.0 fallback
# Expires: 0 — forces expiration
# If-None-Match: — empties ETag to prevent 304 responses
# If-Modified-Since: — empties last-modified check to prevent 304 responses

################################################################################
# ---- end core profile ----
################################################################################################################################################################
# ---- begin advanced profile ----
# skipped in Claude Code sessions (CLAUDECODE=1) for a lean, fast shell
################################################################################
if [ -z "$CLAUDECODE" ]; then

#!/usr/bin/env bash

# software/bootstrap/profile-advanced.sh
################################################################################
# ---- Early Profile Blocks (registerWithBashSyleProfile) ----
################################################################################

################################################################################
# ---- History ----
################################################################################
export HISTSIZE=80000
export HISTFILESIZE=80000
export HISTTIMEFORMAT="[%F %T] "
export HISTCONTROL=ignoreboth:erasedups       # avoid duplicate entries, commands starting with space, and erase older dupes
shopt -s histappend 2> /dev/null              # append instead of overwrite history file
shopt -s cmdhist 2> /dev/null                 # save multi-line commands as one entry
shopt -s cdspell 2> /dev/null                 # auto-correct minor typos in cd directory names
shopt -s checkwinsize 2> /dev/null            # update LINES and COLUMNS after each command
shopt -s no_empty_cmd_completion 2> /dev/null # skip searching all commands when tab is pressed on empty line
# bash 4+ only — silently ignored on older shells
shopt -s autocd 2> /dev/null   # type a directory name to cd into it
shopt -s globstar 2> /dev/null # enable recursive globbing with ** (e.g. ls **/*.js)
shopt -s dirspell 2> /dev/null # auto-correct directory typos during tab completion

ignored_history=(
  "ls"
  "ll"
  "l"
  "cd"
  "cd *"
  ".."
  "cd ."
  "cd ..*"
  "pwd"
  "exit"
  "clear"
  "br"
  "history"
  "cl"
  "cm"
  "git add*"
  "git commit*"
  "git amend*"
  "git push*"
  "git pull*"
  "git stash*"
  "git checkout*"
  "git status"
  "git diff"
  "git log"
  "git fetch*"
  "fuzzy_*"
  "npm install*"
  "npm i*"
  "npm ci"
  "npm run *"
  "npm start"
  "npm test"
  "n install*"
  "n i*"
  "n ci"
  "n run *"
  "n start"
  "n test"
  "yarn install*"
  "yarn add*"
  "yarn run *"
  "yarn start"
  "yarn test"
  "y install*"
  "y add*"
  "y run *"
  "y start"
  "y test"
  "pip install*"
  "pip3 install*"
  "uv pip install*"
)
export HISTIGNORE=$(
  IFS=":"
  echo "${ignored_history[*]}"
)
unset ignored_history

# prune a recents file, removing entries that fail the given test (-d or -f)
# usage: _prune_recents <file> <test_flag>
function _prune_recents() {
  local file="$1" flag="$2" tmp="$1.tmp"
  touch "$file"
  while IFS= read -r entry; do
    [ "$flag" "$entry" ] && echo "$entry"
  done < "$file" 2> /dev/null > "$tmp"
  mv "$tmp" "$file"
}

# prepend stdin lines to a recents file (deduped, capped at max)
# usage: echo "entry" | _prepend_recents <file> <max>
function _prepend_recents() {
  local file="$1" max="$2" tmp="$1.tmp"
  cat - "$file" 2> /dev/null | awk '!seen[$0]++' | head -n "$max" > "$tmp"
  mv "$tmp" "$file"
}

################################################################################
# ---- Track Visited Directories ----
# Maintains a list of recently visited directories in
# _RECENT_FOLDERS_FILE. The list is capped at _RECENT_FOLDERS_MAX
# entries, most recent first, deduplicated, and auto-pruned
# of directories that no longer exist.
#
# Used by:
#   _track_folder - runs via PROMPT_COMMAND after every command
#   _recent_folders - reads and cleans the folders file
#   last_folder - cd to the most recently visited directory
#   fuzzy_cd - fzf cd picker for directories
################################################################################
_RECENT_FOLDERS_FILE=~/.bash_syle_paths
_RECENT_FOLDERS_MAX=100

# reads the folders file, removes entries that no longer exist, and outputs the cleaned list
function _recent_folders() {
  _prune_recents "$_RECENT_FOLDERS_FILE" -d
  cat "$_RECENT_FOLDERS_FILE"
}

# prepends the current directory to the folders file (deduped, capped at _RECENT_FOLDERS_MAX)
# skips home directory. runs automatically via PROMPT_COMMAND.
function _track_folder() {
  local current="$(pwd)"
  [ "$current" = "$HOME" ] && return
  echo "$current" | _prepend_recents "$_RECENT_FOLDERS_FILE" "$_RECENT_FOLDERS_MAX"
}

# cd to the most recently visited directory
function last_folder() {
  local dir
  dir=$(_recent_folders | head -1)
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    cd "$dir"
  else
    echo "last_folder: no valid folder found"
  fi
}

# append history to file after every command (but do NOT clear+reload with -c/-r,
# so Up arrow navigates current tab's session history instead of showing commands
# from other tabs. Ctrl+R / fuzzy_history search the shared file for cross-tab history)
PROMPT_COMMAND="_track_folder; history -a; echo -ne '\033]0;'\"$(shorter_pwd_path)\"'\007'${PROMPT_COMMAND:+;$PROMPT_COMMAND}"

################################################################################
# ---- Track Recent Files ----
# Maintains a list of recently opened files in
# _RECENT_FILES_FILE. The list is capped at _RECENT_FILES_MAX
# entries, most recent first, deduplicated, and auto-pruned
# of files that no longer exist.
#
# Used by:
#   _track_file - called by editor wrappers (vim, subl, zed, code)
#   _recent_files - reads and cleans the files list
#   last_file - open the most recently opened file
#   fuzzy_recent_files - fzf picker for recently opened files
################################################################################
_RECENT_FILES_FILE=~/.bash_syle_recent_files
_RECENT_FILES_MAX=100

# reads the files list, removes entries that no longer exist, and outputs the cleaned list
function _recent_files() {
  _prune_recents "$_RECENT_FILES_FILE" -f
  cat "$_RECENT_FILES_FILE"
}

# prepends the given file path(s) to the recent files list (deduped, capped at _RECENT_FILES_MAX)
function _track_file() {
  for arg in "$@"; do
    [ -f "$arg" ] || continue
    local full
    full=$(realpath "$arg" 2> /dev/null) || continue
    echo "$full"
  done | _prepend_recents "$_RECENT_FILES_FILE" "$_RECENT_FILES_MAX"
}

# open the most recently opened file with view_file
function last_file() {
  local f
  f=$(_recent_files | head -1)
  if [ -n "$f" ] && [ -f "$f" ]; then
    view_file "$f"
  else
    echo "last_file: no valid file found"
  fi
}

################################################################################
# ---- Autocomplete Filters ----
################################################################################
ignored_commands=(
  "*/CleanPCCSP*"
  "*/cleanmgr*"
  "*/clean-staging*"
  "*/clear_console*"
  "*/clear"
)
ignored_files=(
  ".rej"
  ".pyc"
  ".tmp"
  ".DS_Store"
)
cmd_string=$(printf ":%s" "${ignored_commands[@]}")
file_string=$(printf ":%s" "${ignored_files[@]}")
export EXECIGNORE="$EXECIGNORE${cmd_string}"
export FIGNORE="$FIGNORE${file_string}"
unset ignored_commands cmd_string ignored_files file_string

################################################################################
# ---- Bat / Cat Setup ----
# uses bat (mac/homebrew) or batcat (debian/ubuntu), falls back to cat
################################################################################
function batcat() {
  if type -P bat &> /dev/null; then
    command bat --paging=never --style=plain "$@"
  elif type -P batcat &> /dev/null; then
    command batcat --paging=never --style=plain "$@"
  else
    command cat "$@"
  fi
}

################################################################################
# ---- Shell Utilities ----
################################################################################
# find all existing paths from a list of candidates (supports wildcards)
function find_path_list() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      find_path_list: find all existing paths from a list of candidates
        find_path_list path1 path2 ...                any existing paths (default)
        find_path_list path1 path2 ... --file       all existing files
        find_path_list path1 path2 ... --folder     all existing directories
        find_path_list path1 path2 ... --exec       all executable binaries
        find_path_list path1 path2 ... --any        any existing paths (explicit)
        Candidates can be passed inline or via an array:
          local candidates=(\"/path/a\" \"/path/b\")
          find_path_list \"\${candidates[@]}\" --folder
        Wildcards are supported (quoted to prevent premature expansion):
          find_path_list '/mnt/z/drop*' --folder      skipped if ambiguous
          find_path_list '/usr/bin/vim*' --exec       all executable matches
    "
    return 0
  fi

  local args=("$@") mode="any"
  local last="${args[-1]}"
  if [[ "$last" == "--file" || "$last" == "--folder" || "$last" == "--exec" || "$last" == "--any" ]]; then
    mode="${last#--}"
    unset 'args[-1]'
  fi
  local found=0
  # enable nullglob so unmatched globs expand to nothing instead of the
  # literal pattern string (e.g. /mnt/z/drop* becomes empty, not tested as-is)
  shopt -s nullglob
  for pattern in "${args[@]}"; do
    local matches=($pattern) # unquoted — allows glob expansion
    if [[ "$mode" == "exec" ]]; then
      # exec mode: iterate all glob matches to find executables
      for p in "${matches[@]}"; do
        [[ -x "$p" ]] && echo "$p" && found=1
      done
    else
      # file/folder/any mode: skip ambiguous wildcards (multiple matches)
      [ "${#matches[@]}" -eq 1 ] || continue
      local p="${matches[0]}"
      case "$mode" in
      file) [ -f "$p" ] && echo "$p" && found=1 ;;
      folder) [ -d "$p" ] && echo "$p" && found=1 ;;
      *) [ -e "$p" ] && echo "$p" && found=1 ;;
      esac
    fi
  done
  shopt -u nullglob # restore default glob behavior
  ((found)) && return 0 || return 1
}

# find first existing path from a list of candidates (delegates to find_path_list)
function find_path() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      find_path: find first existing path from a list of candidates
        find_path path1 path2 ...                any existing path (default)
        find_path path1 path2 ... --file       first existing file
        find_path path1 path2 ... --folder     first existing directory
        find_path path1 path2 ... --exec       first executable binary
        find_path path1 path2 ... --any        any existing path (explicit)
        Candidates can be passed inline or via an array:
          local candidates=(\"/path/a\" \"/path/b\")
          find_path \"\${candidates[@]}\" --folder
        Wildcards are supported (quoted to prevent premature expansion):
          find_path '/mnt/z/drop*' --folder      skipped if ambiguous
          find_path '/usr/bin/vim*' --exec       first executable match
    "
    return 0
  fi

  local result
  result=$(find_path_list "$@" | head -1)
  [[ -n "$result" ]] && echo "$result" && return 0
  return 1
}

# @deprecated Use find_path instead.
function find_existing() {
  find_path "$@"
}

# checks if a value is truthy (1, true, y, yes — case-insensitive)
function is_truthy() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      is_truthy: check if a value is truthy (1, true, y, yes — case-insensitive)
        is_truthy 1           returns 0 (success)
        is_truthy yes         returns 0 (success)
        is_truthy false       returns 1 (failure)
        is_truthy \"\${1:-}\" && do_something
    "
    return 0
  fi
  case "${1,,}" in 1 | true | y | yes) return 0 ;; *) return 1 ;; esac
}

################################################################################
# ---- Aliases: Navigation ----
################################################################################
alias ..="cd .."
alias ...="cd ../../"
alias ....="cd ../../../"
alias clear='printf "\033[H\033[2J"'

# ---- cd (plain wrapper, zoxide override appended later by starship-config.js) ----
function cd() {
  command cd "$@"
}

# ---- Aliases: File Listing (eza override) ----
if type -P eza &> /dev/null; then
  function ls() { command eza -1 -F --color=always "$@"; }
  alias ll="ls -lah --git"
  alias ls_newest="ll --sort=modified"         # sort by modification time (newest first)
  alias ls_newest_last="ls_newest --reverse"   # sort by modification time (oldest first)
  alias ls_biggest="ll --sort=size"            # sort by file size (biggest first)
  alias ls_biggest_last="ls_biggest --reverse" # sort by file size (smallest first)
fi

# ---- find (fd wrapper) ----
if type -P fd &> /dev/null; then
  alias f='fd'
elif type -P fdfind &> /dev/null; then
  alias f='fdfind'
  alias fd='fdfind'
fi

# ---- Aliases: Editors / Tools ----
alias bs="bash"
alias vi="vim"
alias v="vim"
alias cat='batcat'
alias c="command cat"
# ---- Aliases: Git ----
# git wrapper: invalidates branch cache on state-changing commands
function git() {
  command git "$@"
  local _git_exit=$?
  case "${1-}" in
  # core commands
  checkout | switch | pull | push | fetch | merge | rebase | commit | reset | stash | cherry-pick | revert | am | apply)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: commit (c, cm, amend, wip, unwip)
  c | cm | amend | amendm | wip | unwip)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: checkout/branch (co, cob, del, gone)
  co | cob | del | gone)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: pull/push/fetch (p, pu, po, pof, fap, fapr, track)
  p | pu | po | pof | fap | fapr | track)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: rebase/merge/revert (r, rc, ri, rv, rvc, mc, cp, cpc, cpn)
  r | rc | ri | rv | rvc | mc | cp | cpc | cpn)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: undo/cleanup (undo, cleanfd, patch)
  undo | cleanfd | patch)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  # git aliases: status/branch/log/diff info
  s | stat | status | b | ba | del | branch | d | ds | dh | diff | l | ll | ls | lls | log)
    type _invalidate_git_cache &> /dev/null && _invalidate_git_cache
    ;;
  esac
  return $_git_exit
}
alias g="git"
alias gg="git --no-pager"

# ---- Aliases: Node ----
alias n="node"
alias y="yarn"
alias a_node="activate_node"

# ---- Aliases: Python ----
alias a_py="activate_py"
alias pytest="python -m pytest"
alias pytest-single="python -m pytest -vvl -k"
alias flake="flake8"
alias flake8="python -m flake8"

# ---- Aliases: Git ----
alias stash="git stash"
alias pop="git stash pop"
alias amend="git amend"

# ---- Aliases: Claude ----
alias cl="claude --dangerously-skip-permissions"
alias cm='cl --model claude-opus-4-6[1m]'
alias cm1='cm'
alias cm2='cl --model opus'

# ---- Aliases: Gemini ----
alias gem="gemini"

# ---- Aliases: SSH ----
alias s="ssh"

################################################################################
# ---- Utility Functions ----
################################################################################
function pwd2() {
  command pwd
  echo "cd \"$(command pwd)\""
  echo "$LINE_BREAK_HASH"
}

################################################################################
# ---- Diff (file diff or git hash compare) ----
################################################################################
# smart diff for files or git commits
function diff() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      diff: smart diff for files or git commits
        diff file1 file2       side-by-side diff (VS Code if available)
        diff abc123 def456     git diff between two commit hashes
        diff <flags> <files>   forward to /usr/bin/diff
        diff help              show this help
    "
    return
  fi
  if [ $# -ne 2 ]; then
    command diff -w --color -y --suppress-common-lines "$@"
    return
  fi

  local file1_valid=false file2_valid=false
  [ -f "$1" ] && file1_valid=true
  [ -f "$2" ] && file2_valid=true

  # both files exist — diff them
  if $file1_valid && $file2_valid; then
    if type -P code &> /dev/null; then
      code --diff "$1" "$2"
    else
      command diff -w --color -y --suppress-common-lines "$1" "$2"
    fi
    return
  fi

  # one file exists, one doesn't
  if $file1_valid && ! $file2_valid; then
    echo "File not found: $2"
    return 1
  fi
  if ! $file1_valid && $file2_valid; then
    echo "File not found: $1"
    return 1
  fi

  # neither file exists — check if they look like git hashes
  local hash_re='^[a-f0-9]{4,40}$'
  local hash1_valid=false hash2_valid=false
  if [[ "$1" =~ $hash_re ]] && git rev-parse --verify "$1" &> /dev/null; then
    hash1_valid=true
  fi
  if [[ "$2" =~ $hash_re ]] && git rev-parse --verify "$2" &> /dev/null; then
    hash2_valid=true
  fi

  if $hash1_valid && $hash2_valid; then
    echo "git diff $1 $2"
    git diff "$1" "$2"

    # open github compare if remote is available
    local repo_url
    repo_url=$(git config --get remote.origin.url 2> /dev/null)
    if [ -n "$repo_url" ]; then
      repo_url="${repo_url#*:}"
      repo_url="${repo_url%.git}"
      repo_url="${repo_url#*github.com/}"
      local compare_url="https://github.com/${repo_url}/compare/${1}...${2}"
      echo "$compare_url"
      open "$compare_url"
    fi
    return
  fi

  # partial match — tell user which is invalid
  if ! $hash1_valid && ! $file1_valid; then
    echo "File or hash not found: $1"
  fi
  if ! $hash2_valid && ! $file2_valid; then
    echo "File or hash not found: $2"
  fi
  return 1
}

################################################################################
# ---- Git Helpers ----
################################################################################
alias clean='_clean_reset_head_to_main_branch' # hard reset current branch to origin default branch
alias empty='_commit_empty_trigger_deploy'

# list source repo names for a GitHub user (default: synle)
function repos() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "repos: list source repo names for a GitHub user
  Usage: repos [owner]
  Examples:
    repos
    repos synle
    repos facebook"
    return 1
  fi

  local owner="${1:-synle}"
  gh repo list "$owner" --limit 100 --source --json name -q '.[].name'
}

# Opens the GitHub repo page for the current git remote in the browser
function repo() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "repo: open the GitHub repo page for the current git remote
  Usage: repo
  Examples:
    repo"
    return 1
  fi

  local remote_url
  remote_url=$(git remote get-url origin 2> /dev/null)
  if [ -z "$remote_url" ]; then
    echo "Error: no git remote found"
    return 1
  fi
  # Normalize to https URL (handles git@, ssh://, and https:// remotes)
  remote_url=$(echo "$remote_url" | sed 's|ssh://[^@]*@github.com/|https://github.com/|' | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
  echo "$remote_url"
  open "$remote_url"
}

# Opens the PR for the current branch in the browser (alternative: gh pr view --web)
function pr() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "pr: open the pull request for the current branch
  Usage: pr
  Examples:
    pr"
    return 1
  fi

  local remote_url
  remote_url=$(git remote get-url origin 2> /dev/null)
  if [ -z "$remote_url" ]; then
    echo "Error: no git remote found"
    return 1
  fi
  # Normalize to https URL (handles git@, ssh://, and https:// remotes)
  remote_url=$(echo "$remote_url" | sed 's|ssh://[^@]*@github.com/|https://github.com/|' | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
  local branch
  branch=$(git branch --show-current)
  local pr_url="$remote_url/pull/$branch"
  echo "$pr_url"
  open "$pr_url"
}

# Detects the default branch (main or master) from origin
function _get_default_branch() {
  local default_branch
  default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2> /dev/null | sed 's|refs/remotes/origin/||')
  if [ -z "$default_branch" ]; then
    for b in main master; do
      if git rev-parse --verify "origin/$b" > /dev/null 2>&1; then
        default_branch="$b"
        break
      fi
    done
  fi

  if [ -z "$default_branch" ]; then
    echo "Error: could not determine default branch from origin" >&2
    return 1
  fi

  echo "$default_branch"
}

# Purges a file or directory (-r) from entire git history, rewrites all commits, and force-pushes
function purge() {
  local recursive=""
  if [ "$1" = "-r" ]; then
    recursive="-r"
    shift
  fi

  local file_path="$1"
  if [ -z "$file_path" ] || [[ "$file_path" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      purge: remove a file or directory from entire git history
        Usage: purge [-r] <path-to-file-or-dir>
    "
    return 1
  fi

  local confirm
  read -rp "Purge '$file_path' from entire git history? [y/N] " confirm
  confirm="$(echo "$confirm" | tr '[:lower:]' '[:upper:]' | xargs)"
  if [ "$confirm" != "Y" ] && [ "$confirm" != "YES" ]; then
    echo ">> Aborted."
    return 1
  fi

  echo ">> Purging '$file_path' from git history..."
  git filter-branch --force \
    --index-filter "git rm $recursive --cached --ignore-unmatch $file_path" \
    --prune-empty \
    --tag-name-filter cat \
    -- --all

  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
}

# Merges origin/main (or origin/master) into the current branch
function merge_origin_main_branch() {
  git abort
  git clean-and-fetch

  local default_branch
  default_branch=$(_get_default_branch) || return 1

  git merge "origin/$default_branch"

  echo "# ---- Merged origin/$default_branch into $(git branch --show-current) ----"
  git lastd
}

# Rebases current branch onto origin/main (or origin/master)
function rebase_origin_main_branch() {
  git abort
  git clean-and-fetch

  local default_branch
  default_branch=$(_get_default_branch) || return 1

  git rebase "origin/$default_branch"

  echo "# ---- Rebased $(git branch --show-current) onto origin/$default_branch ----"
  git lastd
}

# Resets the local default branch HEAD to match origin (fetches and force-resets)
function _clean_reset_head_to_main_branch() {
  git abort
  git clean-and-fetch

  local default_branch
  default_branch=$(_get_default_branch) || return 1

  local current_branch
  current_branch=$(git branch --show-current)

  # Back up current branch to a temp branch
  local temp_branch="temp/$(command date +%Y%m%d-%H%M%S)"
  git checkout -b "$temp_branch" > /dev/null 2>&1

  # Checkout default branch and rebase onto origin
  git del "$default_branch" > /dev/null 2>&1
  git checkout "$default_branch" > /dev/null 2>&1
  git rebase "origin/$default_branch" > /dev/null 2>&1
  git del "$temp_branch" > /dev/null 2>&1

  echo "# ---- Reset to origin/$default_branch ----"
  git lastd
}

# Creates an empty commit on a new branch and pushes it to trigger a deployment
function _commit_empty_trigger_deploy() {
  local temp_branch_name="empty-commit-$(command date +%s)"
  git checkout -b "$temp_branch_name" > /dev/null 2>&1
  git commit --allow-empty -m "Trigger deployment - EMPTY PR" > /dev/null 2>&1
  git push -u origin "$temp_branch_name" > /dev/null 2>&1
}

# cd to git home directory ($MY_GIT_HOME or ~/git)
function gogit() {
  local git_home="${MY_GIT_HOME:-$HOME/git}"
  mkdir -p "$git_home" 2> /dev/null
  cd "$git_home"
}

# clone a repo by URL or owner/repo shorthand, tries SSH then falls back to HTTPS
function clone() {
  if [ -z "${1:-}" ] || [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "clone: clone a repo by URL or owner/repo shorthand
  Usage: clone <url-or-owner/repo>
  Examples:
    clone git@github.com:synle/bashrc.git
    clone https://github.com/synle/bashrc.git
    clone synle/bashrc"
    return 1
  fi

  local input="$1"
  local clone_url=""

  if [[ "$input" =~ ^git@ ]] || [[ "$input" =~ ^https:// ]] || [[ "$input" =~ ^ssh:// ]]; then
    # Full SSH or HTTPS URL — use as-is
    clone_url="$input"
    if ! git ls-remote "$clone_url" &> /dev/null; then
      echo "clone: cannot access '$clone_url'"
      return 1
    fi
  elif [[ "$input" =~ ^[^/]+/[^/]+$ ]]; then
    # Short form: owner/repo — try SSH first, fall back to HTTPS
    local ssh_url="git@github.com:${input}.git"
    local https_url="https://github.com/${input}.git"
    if git ls-remote "$ssh_url" &> /dev/null; then
      clone_url="$ssh_url"
    elif git ls-remote "$https_url" &> /dev/null; then
      clone_url="$https_url"
      echo "clone: SSH access failed, falling back to HTTPS"
    else
      echo "clone: cannot access '$input' via SSH or HTTPS"
      return 1
    fi
  else
    echo "clone: invalid input '$input' — expected a URL or owner/repo"
    return 1
  fi

  git cl1 "$clone_url"
}

# cd to Downloads directory (tries multiple paths in order)
function godownload() {
  local candidates=(
    "$HOME/Downloads"
    "/mnt/d/Downloads"
  )
  # on WSL, try to resolve the Windows user Downloads folder via wslpath
  if type -P wslpath &> /dev/null; then
    local win_home
    win_home="$(wslpath "$(cmd.exe /C 'echo %USERPROFILE%' 2> /dev/null | tr -d '\r')" 2> /dev/null)"
    if [ -n "$win_home" ]; then
      candidates+=("$win_home/Downloads")
    fi
  fi
  local target
  target=$(find_path "${candidates[@]}" --folder) || {
    echo "godownload: no Downloads folder found"
    return 1
  }
  cd "$target"
}

################################################################################
# ---- Search Functions ----
################################################################################
if type -P rg &> /dev/null; then
  alias gr="rg -in"      # recursive, case-insensitive, line numbers (rg is recursive by default)
  alias gre="rg -inw -F" # gr + fixed string, whole word match
else
  alias gr="grep --color -rin"    # recursive, case-insensitive, line numbers
  alias gre="grep --color -rinFw" # gr + fixed string, whole word match
fi

# search content in files: uses rg if available, git grep in git repos, falls back to grep
# flags: -F fixed string, -w whole word, -i case-insensitive, -n line numbers
function search() {
  if type -P rg &> /dev/null; then
    rg -Fwin "$@" # ripgrep: fixed string, whole word, case-insensitive, line numbers (respects .gitignore)
  elif git rev-parse --is-inside-work-tree &> /dev/null; then
    git grep -Fwin "$@" # fixed string, whole word, case-insensitive, line numbers (respects .gitignore)
  else
    grep --color -rFwin "$@" . # recursive, fixed string, whole word, case-insensitive, line numbers
  fi
}

################################################################################
# ---- Rainbow / Visual ----
################################################################################
rainbow_block="##########"
rainbow_colors=(91 93 92 96 94 95)

function rainbow_print() {
  local colors
  if [[ -n "$1" && "$1" =~ ^[0-9[:space:]]+$ ]]; then
    colors=($1)
    shift
  else
    colors=("${rainbow_colors[@]}")
  fi

  local input="${1:-$(cat -)}"
  local color_count=${#colors[@]}

  for ((i = 0; i < ${#input}; i++)); do
    local color_idx=$((i % color_count))
    local color=${colors[$color_idx]}
    printf "\e[%sm%s\e[0m" "$color" "${input:$i:1}"
  done
  echo
}

# br [count] [no-clear] [reverse]
function br() {
  local repeat_count=${1:-5}
  local clear_flag=${2:-"clear"}
  local reverse_flag=${3:-"normal"}

  [[ "$clear_flag" != "no-clear" ]] && /usr/bin/clear

  local colors=("${rainbow_colors[@]}")

  if [[ "$reverse_flag" == "reverse" ]]; then
    local reversed=()
    for ((i = ${#colors[@]} - 1; i >= 0; i--)); do
      reversed+=("${colors[i]}")
    done
    colors=("${reversed[@]}")
  fi

  local line=""
  for ((i = 0; i < repeat_count; i++)); do
    line+="$rainbow_block"
  done

  echo "$line" | rainbow_print "${colors[*]}"
}

# spinner &; SPIN_PID=$!; sleep 3; kill $SPIN_PID
function spinner() {
  local chars="/-\|"
  local colors=(91 93 92 96 94 95)
  local c_idx=0

  tput civis
  trap "tput cnorm; exit" SIGINT

  while true; do
    for ((i = 0; i < ${#chars}; i++)); do
      local color="${colors[$c_idx]}"
      echo -ne $'\e[1;'"${color}m${chars:$i:1}"$'\e[m'"\r"
      sleep 0.1
      c_idx=$(((c_idx + 1) % ${#colors[@]}))
    done
  done
}

################################################################################
# ---- Chmod ----
################################################################################
function chmod() {
  if [ $# -eq 0 ]; then
    echo "
      chmod cheat sheet:
        chmod +x file        # add execute for everyone
        chmod u+x file       # add execute for owner
        chmod g+w file       # add write for group
        chmod o-r file       # remove read for others
        chmod u+rwx file     # owner: read + write + execute
        chmod go-wx file     # group & others: remove write + execute
        chmod a+r file       # all: add read
        chmod u+x,g+r,o-w file

        Who:   u (user/owner), g (group), o (others), a (all)
        What:  + (add), - (remove), = (set exactly / replaces)
        Perms: r (read), w (write), x (execute)
    "
  else
    command chmod "$@"
  fi
}

################################################################################
# ---- Date / Time ----
################################################################################
# Returns HH:MM:SS AM/PM with colored AM/PM indicator for PS1
function get_time() {
  local tz=${1:-""}
  local time_str ampm

  if [ "$tz" = "UTC" ]; then
    time_str=$(command date -u +'%I:%M:%S')
    ampm=$(command date -u +'%p')
  elif [ -n "$tz" ]; then
    time_str=$(TZ="$tz" command date +'%I:%M:%S')
    ampm=$(TZ="$tz" command date +'%p')
  else
    time_str=$(command date +'%I:%M:%S')
    ampm=$(command date +'%p')
  fi

  if [ "$ampm" = "AM" ]; then
    printf '%s\001\e[1;97m\002%s\001\e[m\002' "$time_str" "$ampm"
  else
    printf '%s\001\e[0;90m\002%s\001\e[m\002' "$time_str" "$ampm"
  fi
}

# no args: show UTC, PST, LOCAL; with args: passthrough to date
function date() {
  if [ $# -eq 0 ]; then
    echo $'\e[1;31m>> UTC\e[m'
    command date -u +'%a, %b %d, %Y  %r'

    echo $'\e[1;96m>> PST (California)\e[m'
    TZ="America/Los_Angeles" command date +'%a, %b %d, %Y  %r'

    echo $'\e[1;92m>> LOCAL\e[m'
    command date +'%a, %b %d, %Y  %r'
  else
    command date "$@"
  fi
}

################################################################################
# ---- Telemetry ----
################################################################################
# universal
export DO_NOT_TRACK="1" # universal opt-out respected by many CLI tools (consoledonottrack.com)
# anthropic - claude code
export DISABLE_TELEMETRY="1"                        # opt out of Claude Code telemetry
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1" # disable Claude Code non-essential traffic (telemetry, autoupdater, error reporting)
# aws
export SAM_CLI_TELEMETRY="0" # opt out of AWS SAM CLI telemetry
# google - angular
export ANGULAR_CLI_ANALYTICS="false" # opt out of Angular CLI analytics
# hashicorp
export CHECKPOINT_DISABLE="1" # opt out of HashiCorp telemetry (Terraform, Vagrant, etc.)
# microsoft - azure
export FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT="1" # opt out of Azure CLI telemetry
# microsoft - dotnet
export DOTNET_CLI_TELEMETRY_OPTOUT="1" # opt out of .NET CLI telemetry
# vercel
export NEXT_TELEMETRY_DISABLED="1"  # opt out of Next.js telemetry
export TURBO_TELEMETRY_DISABLED="1" # opt out of Turborepo telemetry
# web frameworks
export ASTRO_TELEMETRY_DISABLED="1"  # opt out of Astro telemetry
export GATSBY_TELEMETRY_DISABLED="1" # opt out of Gatsby telemetry
export NUXT_TELEMETRY_DISABLED="1"   # opt out of Nuxt telemetry

################################################################################
# ---- Environment ----
################################################################################
# anthropic - claude code
export CLAUDE_CODE_DISABLE_TERMINAL_TITLE="1" # prevent Claude Code from overwriting the terminal tab title
# astral - uv
export UV_VENV_CLEAR="1" # skip "replace existing venv?" prompt in uv venv
# github - electron
export ELECTRON_ENABLE_LOGGING="0" # suppress Electron's internal console spam for slight perf gain
# terminal
export TERM="xterm-256color" # enable 256-color support in terminal emulators
export COLORTERM="truecolor" # advertise 24-bit RGB color support to CLI apps

################################################################################
# ---- Prompt Helpers ----
################################################################################
# shows branch name, remote (if not origin), and ahead/behind counts
# cached: refreshes on branch change, after max_age seconds, or max_calls calls
# invalidated automatically by git() wrapper on state-changing commands
_git_branch_cache=""
_git_branch_last=""
_git_branch_count=0
_git_branch_time=0
_git_branch_max_age=1200 # 20 minutes
_git_branch_max_calls=30
function _invalidate_git_cache() {
  _git_branch_cache=""
  _git_branch_last=""
}
function _parse_git_branch_fetch() {
  local branch ahead behind remote remote_name info=""
  branch=$(git symbolic-ref --short HEAD 2> /dev/null) || return
  remote=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2> /dev/null)
  if [ -n "$remote" ]; then
    remote_name="${remote%%/*}"
    [ "$remote_name" != "origin" ] && info+=" ${remote_name}/"
    ahead=$(git rev-list --count @{u}..HEAD 2> /dev/null)
    behind=$(git rev-list --count HEAD..@{u} 2> /dev/null)
    [ "$ahead" -gt 0 ] 2> /dev/null && info+=" +${ahead}"
    [ "$behind" -gt 0 ] 2> /dev/null && info+=" -${behind}"
  fi
  echo "[${branch}${info}]"
}
function parse_git_branch() {
  type -P git &> /dev/null || return
  local branch now
  branch=$(git symbolic-ref --short HEAD 2> /dev/null) || {
    _git_branch_cache=""
    _git_branch_last=""
    return
  }
  now=$(command date +%s)
  _git_branch_count=$((_git_branch_count + 1))
  # refresh on branch change, time expiry, or call count
  if [ "$branch" != "$_git_branch_last" ] || [ -z "$_git_branch_cache" ] || [ $((now - _git_branch_time)) -ge $_git_branch_max_age ] || [ $_git_branch_count -ge $_git_branch_max_calls ]; then
    _git_branch_cache=$(_parse_git_branch_fetch)
    _git_branch_last="$branch"
    _git_branch_time=$now
    _git_branch_count=0
  fi
  echo "$_git_branch_cache"
}

# shows local IP addresses (cached, refreshes after max_age seconds or max_calls calls)
_ifconfig2_cache=""
_ifconfig2_count=0
_ifconfig2_time=0
_ifconfig2_max_age=1800 # 30 minutes
_ifconfig2_max_calls=60
function _ifconfig2_fetch() {
  hostname -I 2> /dev/null | tr ' ' '\n' | grep '\.' | grep -v '^127\.' | sort -u | paste -sd',' - \
    || command ifconfig 2> /dev/null | grep 'inet ' | awk '{print $2}' | grep -v '^127\.' | sort -u | paste -sd',' -
}
# running ifconfig manually invalidates the IP cache and shows full output
function ifconfig() {
  _ifconfig2_cache=""
  command ifconfig "$@"
}
function ifconfig2() {
  local now=$(command date +%s)
  _ifconfig2_count=$((_ifconfig2_count + 1))
  if [ -z "$_ifconfig2_cache" ] || [ $((now - _ifconfig2_time)) -ge $_ifconfig2_max_age ] || [ $_ifconfig2_count -ge $_ifconfig2_max_calls ]; then
    _ifconfig2_cache=$(_ifconfig2_fetch)
    _ifconfig2_time=$now
    _ifconfig2_count=0
  fi
  echo "$_ifconfig2_cache"
}

# truncates deep paths, keeping last 3 parts full
function shorter_pwd_path() {
  local trim_count=3
  local current_path="${PWD/#$HOME/\~}"
  IFS='/' read -r -a splits <<< "$current_path"
  result=""

  for idx in "${!splits[@]}"; do
    if [ $idx -lt $((${#splits[@]} - $trim_count)) ]; then
      result+="${splits[$idx]:0:1}/"
    else
      result+="${splits[$idx]}/"
    fi
  done

  echo "${result%/}"
}

################################################################################
# ---- Prompt ----
################################################################################
# 08:32:43PM U=04:32:43AM syle @ Sy-Omen45L 10.255.255.254,172.28.2.202
# ~/git/bashrc [master]
# >>>
export PS1="\[\e[1;92m\]\$(get_time) \
\[\e[1;93m\]U=\$(get_time \"UTC\") \
\[\e[1;94m\]\u\[\e[m\] @ \
\[\e[1;95m\]\h \
\[\e[1;93m\]\$(ifconfig2)\[\e[m\]\n\
\[\e[1;31m\]\$(shorter_pwd_path)\[\e[m\] \
\[\e[1;36m\]\$(parse_git_branch)\[\e[m\]\n\
>>> "

################################################################################
# ---- Aliases: Docker ----
################################################################################
alias d='docker'
alias drun='docker run'
alias dexec='dexec_bash'
alias apt='sudo apt-get'

################################################################################
# ---- Docker ----
################################################################################
function dexec_bash() {
  echo "docker exec -it $@ /bin/bash"
  docker exec -it $@ /bin/bash
}

################################################################################
# ---- Open (cross-platform) ----
################################################################################
function open() {
  echo "open $@ | $(pwd)"
  if ((is_os_mac)); then
    command open "$@"
  elif type -P explorer.exe &> /dev/null; then
    explorer.exe "$@"
  elif type -P dolphin &> /dev/null; then
    dolphin "$@" 1>&- 2>&- &
  elif type -P thunar &> /dev/null; then
    thunar "$@" 1>&- 2>&- &
  elif type -P xdg-open &> /dev/null; then
    xdg-open "$@" 1>&- 2>&- &
  else
    echo "No file manager found"
  fi
}

################################################################################
# ---- Clipboard (copy / paste) ----
# universal clipboard with graceful fallbacks:
#   mac: native pbcopy/pbpaste
#   wsl: clip.exe / powershell.exe Get-Clipboard
#   wayland: wl-copy / wl-paste
#   x11: xclip -selection clipboard
#   fallback: folder-only (no native clipboard)
# all copies are saved to ~/.bash_syle_copies/ (last 10 entries)
################################################################################
_CLIPBOARD_DIR=~/.bash_syle_copies
_CLIPBOARD_MAX=10
mkdir -p "$_CLIPBOARD_DIR"

if ((is_os_mac)); then
  _COPY_CMD="pbcopy"
  _PASTE_CMD="pbpaste"
elif ((is_os_wsl)) && type -P clip.exe &> /dev/null && type -P powershell.exe &> /dev/null; then
  _COPY_CMD="clip.exe"
  _PASTE_CMD="powershell.exe -NoProfile -Command Get-Clipboard | sed 's/\r$//'"
elif [ -n "$WAYLAND_DISPLAY" ] && type -P wl-copy &> /dev/null && type -P wl-paste &> /dev/null; then
  _COPY_CMD="wl-copy"
  _PASTE_CMD="wl-paste"
elif [ -n "$DISPLAY" ] && type -P xclip &> /dev/null; then
  _COPY_CMD="xclip -selection clipboard"
  _PASTE_CMD="xclip -selection clipboard -o"
else
  _COPY_CMD=""
  _PASTE_CMD=""
fi

# save stdin to clipboard history folder + native clipboard (if available)
# prunes entries beyond _CLIPBOARD_MAX
function _clipboard_save() {
  local clip_file="$_CLIPBOARD_DIR/$(date +%Y-%m-%d_%H-%M-%S)"
  [ -f "$clip_file" ] && clip_file="${clip_file}_${RANDOM}"
  if [ -n "$_COPY_CMD" ]; then
    tee "$clip_file" | eval "$_COPY_CMD"
  else
    cat > "$clip_file"
  fi
  ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | tail -n +$((_CLIPBOARD_MAX + 1)) | while read -r f; do
    rm -f "$_CLIPBOARD_DIR/$f"
  done
}

# copy: stdin or files/strings into clipboard + history
function copy() {
  if [ $# -eq 0 ]; then
    _clipboard_save
  elif [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      copy: stdin or files/strings into clipboard + history
        echo foo | copy        pipe stdin into clipboard
        copy file.txt          copy file contents into clipboard
        copy a.txt b.txt       copy multiple files (concatenated) into clipboard
        copy \"hello world\"     copy a string into clipboard
        copy help              show this help
    "
  else
    for arg in "$@"; do
      if [ -f "$arg" ]; then
        cat "$arg"
      else
        echo "$arg"
      fi
    done | _clipboard_save
  fi
}

# paste: print clipboard, recall from history, or forward to real paste(1)
function paste() {
  if [ $# -eq 0 ]; then
    if [ -n "$_PASTE_CMD" ]; then
      eval "$_PASTE_CMD"
    else
      local latest
      latest=$(ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | head -1)
      [ -n "$latest" ] && cat "$_CLIPBOARD_DIR/$latest"
    fi
  elif [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      paste: print clipboard, recall from history, or forward to paste(1)
        paste                  print clipboard contents to stdout
        paste list             show clipboard history entries
        paste <entry>          recall a specific entry from history
        paste help             show this help
        paste file1 file2      forward to /usr/bin/paste (merge lines)
    "
  elif [ "$1" = "list" ]; then
    ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | head -n "$_CLIPBOARD_MAX"
  elif [ -f "$_CLIPBOARD_DIR/$1" ]; then
    cat "$_CLIPBOARD_DIR/$1"
  else
    command paste "$@"
  fi
}

################################################################################
# ---- TLDR (shell function aware) ----
# wraps tldr to show inline --help for shell functions before falling back to real tldr
################################################################################
function tldr() {
  # type -t returns the type as a single word (function, alias, builtin, file)
  # we use -t here (not -P) because we need to distinguish functions from binaries
  if [ "$(type -t "$1" 2> /dev/null)" = "function" ]; then
    "$1" --help
  else
    command tldr "$@"
  fi
}

################################################################################
# ---- Network Utilities ----
################################################################################
# _expand_port_args: expand a list of port args (single ports and ranges) into individual ports
function _expand_port_args() {
  local arg
  for arg in "$@"; do
    if [[ "$arg" =~ ^([0-9]+)-([0-9]+)$ ]]; then
      local start="${BASH_REMATCH[1]}"
      local end="${BASH_REMATCH[2]}"
      if [ "$start" -gt "$end" ]; then
        echo ">> Invalid range: $arg (start > end)" >&2
        return 1
      fi
      seq "$start" "$end"
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
      echo "$arg"
    else
      echo ">> Invalid port: $arg (must be a number or range like 3000-4000)" >&2
      return 1
    fi
  done
}

# list_ports: list processes listening on the given ports
function list_ports() {
  if [ $# -eq 0 ] || [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "list_ports: list processes listening on the given TCP ports
  Usage: list_ports <port|range> [port|range ...]
  Examples:
    list_ports 3000
    list_ports 3000 3001 4000
    list_ports 3000-3010
    list_ports 80 3000-3005 8080"
    return 0
  fi

  local ports
  ports="$(_expand_port_args "$@")" || return 1

  local port found=0
  while IFS= read -r port; do
    if lsof -i tcp:"$port" -sTCP:LISTEN &> /dev/null; then
      echo "Port $port is in use:"
      lsof -i tcp:"$port" -sTCP:LISTEN
      echo ""
      found=1
    fi
  done <<< "$ports"

  if ! ((found)); then
    echo ">> No processes found on the given ports."
  fi
}

# kill_port: kill the process listening on a single port
function kill_port() {
  if [ $# -eq 0 ] || [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "kill_port: kill the process listening on a single TCP port
  Usage: kill_port <port>"
    return 0
  fi

  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2> /dev/null)"
  if [ -z "$pids" ]; then
    echo "  > Kill > Port $port > Skipped (nothing running on port)"
    return 0
  fi
  if echo "$pids" | xargs kill -9 2> /dev/null; then
    echo "  > Kill > Port $port > Success"
  else
    if [ "$port" -lt 1024 ]; then
      echo "  > Kill > Port $port > Error (privileged port, sudo may be required)"
    else
      echo "  > Kill > Port $port > Error (failed to kill process)"
    fi
    return 1
  fi
}

# kill_ports: kill processes listening on the given TCP ports
function kill_ports() {
  if [ $# -eq 0 ] || [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "kill_ports: kill processes listening on the given TCP ports
  Usage: kill_ports <port|range> [port|range ...]
  Examples:
    kill_ports 3000
    kill_ports 3000 3001 4000
    kill_ports 3000-4000
    kill_ports 80 3000-3005 8080"
    return 0
  fi

  local ports
  ports="$(_expand_port_args "$@")" || return 1

  local port needs_sudo=0 port_list=""
  while IFS= read -r port; do
    local status="free"
    if lsof -i tcp:"$port" -sTCP:LISTEN &> /dev/null; then
      status="in use"
    fi
    if [ "$port" -lt 1024 ]; then
      port_list="${port_list}  port $port ($status) [requires sudo]\n"
      needs_sudo=1
    else
      port_list="${port_list}  port $port ($status)\n"
    fi
  done <<< "$ports"

  echo "The following ports will be targeted:"
  echo -e "$port_list"

  if ((needs_sudo)); then
    echo ">> Warning: some ports are below 1024 and may require admin/sudo to kill."
    echo ""
  fi

  local confirm
  read -rp "Proceed with killing processes on these ports? [y/N] " confirm
  confirm="$(echo "$confirm" | tr '[:lower:]' '[:upper:]' | xargs)"
  if [ "$confirm" != "Y" ] && [ "$confirm" != "YES" ]; then
    echo ">> Aborted."
    return 1
  fi

  echo ""
  while IFS= read -r port; do
    kill_port "$port"
  done <<< "$ports"
}

# portcheck: check if a TCP port is in use
function portcheck() {
  local port="$1"
  if [ -z "$port" ] || [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "portcheck: check if a TCP port is in use
  Usage: portcheck <port>"
    return 1
  fi
  if lsof -i tcp:"$port" -sTCP:LISTEN &> /dev/null; then
    echo "Port $port is in use:"
    lsof -i tcp:"$port" -sTCP:LISTEN
  else
    echo "Port $port is free"
  fi
}

# tunnel: expose a local server via Cloudflare Tunnel (cloudflared)
if type -P cloudflared &> /dev/null; then
  function tunnel() {
    if [ $# -eq 0 ] || [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
      echo "
        tunnel: expose a local server via Cloudflare Tunnel
          Usage: tunnel [port|url]
          tunnel 3000              → tunnel http://localhost:3000
          tunnel 8080              → tunnel http://localhost:8080
          tunnel http://localhost   → tunnel http://localhost (port 80)
      "
      return 0
    fi
    local target="$1"
    case "$target" in
    http://* | https://*) ;;
    *) target="http://localhost:$target" ;;
    esac
    echo ">> Tunneling $target via cloudflared"
    command cloudflared tunnel --url "$target"
  }
fi

################################################################################
# ---- Retry ----
################################################################################
function retry() {
  local count="$1"
  shift

  if [ -z "$count" ] || [ -z "$1" ] || [[ "$count" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      retry: retry a command up to N times
        Usage: retry <count> <command...>
    "
    return 1
  fi

  local attempt=1
  while [ "$attempt" -le "$count" ]; do
    echo ">> Attempt $attempt/$count: $*"
    if "$@"; then
      return 0
    fi
    attempt=$((attempt + 1))
    [ "$attempt" -le "$count" ] && sleep "$attempt"
  done

  echo ">> Failed after $count attempts: $*"
  return 1
}

################################################################################
# ---- Benchmark ----
################################################################################
function benchmark() {
  if [ -z "$1" ] || [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      benchmark: measure how long a command takes
        Usage: benchmark <command...>
    "
    return 1
  fi

  local start_time end_time elapsed
  start_time=$(date +%s%N 2> /dev/null || date +%s)
  "$@"
  local exit_code=$?
  end_time=$(date +%s%N 2> /dev/null || date +%s)

  if [ ${#start_time} -gt 10 ]; then
    # nanosecond precision available
    elapsed=$(((end_time - start_time) / 1000000))
    echo ">> Completed in ${elapsed}ms (exit $exit_code)"
  else
    # seconds only (macOS date without coreutils)
    elapsed=$((end_time - start_time))
    echo ">> Completed in ${elapsed}s (exit $exit_code)"
  fi
  return $exit_code
}

################################################################################
# ---- Shared Network Folder ----
# Common base for features that use the shared network volume (dropbox, patches,
# notes, screenshots). Callers append their own subpath.
################################################################################
# shared helper to find the network share root (WSL /mnt/z or macOS /Volumes)
function _shared_folder() {
  local candidates=(
    "/mnt/z"
    "/Volumes/192.168.1.1"
  )
  find_path "${candidates[@]}" --folder
}

# shared helper to find the dropbox folder (used by patch and note functions)
function _dropbox_folder() {
  local shared_folder
  shared_folder=$(_shared_folder) || return 1
  local dropbox="${shared_folder}/dropbox"
  [ -d "$dropbox" ] && echo "$dropbox" || return 1
}

# dropbox: open the dropbox folder
function dropbox() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "dropbox: open the dropbox folder
  Usage: dropbox"
    return 0
  fi

  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  open "$dropbox_folder" &> /dev/null || echo "$dropbox_folder"
}

################################################################################
# ---- Git Patch Helpers (Dropbox) ----
# Transfers git patches between machines via a shared Dropbox folder.
# _patch_create_and_upload: exports the last commit as a .patch, renames with
#   a repo-date prefix, and moves it to Dropbox.
# _patch_download_and_apply: finds the most recent .patch in Dropbox, applies
#   it, commits, and archives the file.
################################################################################

# download and apply a patch from the dropbox folder, then archive it
function _patch_download_and_apply() {
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local archive_folder="${dropbox_folder}/archived_patch"

  mkdir -p "$archive_folder"

  # find most recently modified .patch file with content (cross-platform via node)
  local latest_patch
  latest_patch=$(
    _PATCH_ARG="$dropbox_folder" node << '_PATCH_FIND_EOF_'
    const fs=require('fs'),path=require('path'),dir=process.env._PATCH_ARG;
    const patches=fs.readdirSync(dir)
      .filter(f=>{
        if(!f.endsWith('.patch')||f.startsWith('._'))return false;
        const fp=path.join(dir,f),st=fs.statSync(fp);
        return st.isFile()&&st.size>0;
      })
      .map(f=>({p:path.join(dir,f),m:fs.statSync(path.join(dir,f)).mtimeMs}))
      .sort((a,b)=>b.m-a.m);
    if(patches.length)console.log(patches[0].p);
_PATCH_FIND_EOF_
  )

  echo "latest_patch: $latest_patch"

  if [ -z "$latest_patch" ]; then
    echo "No .patch files found in $dropbox_folder"
    return 1
  fi

  # extract decoded commit subject from the patch (handles MIME/RFC-2047 encoded headers)
  local commit_msg
  commit_msg=$(git mailinfo /dev/null /dev/null < "$latest_patch" | command grep "^Subject: " | sed 's/^Subject: //')
  commit_msg="${commit_msg:-applied patch}"

  echo "Applying: $latest_patch"
  echo "Message: $commit_msg"

  if git apply --reject --whitespace=fix "$latest_patch" && git add -A && git commit --allow-empty --no-verify -m "$commit_msg"; then
    mv "$latest_patch" "$archive_folder"
    echo "Successfully applied and archived."
  else
    echo "Error occurred during patching/committing. Patch was NOT moved to archive."
    return 1
  fi
}

# create a patch from the last commit, rename with repo-date prefix, and upload to dropbox
function _patch_create_and_upload() {
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  git patch-get

  # rename with mtime prefix and move to dest (cross-platform via node)
  # uses heredoc (single-quoted delimiter) to avoid bash expanding ! and $ inside the script
  _PATCH_ARG="$dropbox_folder" node << '_PATCH_UPLOAD_EOF_' || return 1
    const fs=require('fs'),path=require('path');
    const dest=process.env._PATCH_ARG,proj=path.basename(process.cwd());
    const patches=fs.readdirSync('.').filter(f=>f.endsWith('.patch')&&fs.statSync(f).isFile());
    if(!patches.length){console.log('No .patch files generated');process.exit(1);}
    for(const f of patches){
      const mtime=fs.statSync(f).mtime;
      const ts=mtime.getFullYear()+'_'+String(mtime.getMonth()+1).padStart(2,'0')+'_'+String(mtime.getDate()).padStart(2,'0')+'_'+String(mtime.getHours()).padStart(2,'0')+'_'+String(mtime.getMinutes()).padStart(2,'0');
      const newName=proj+'-'+ts+'-'+f;
      const target=path.join(dest,newName);try{fs.copyFileSync(f,target);}catch{fs.writeFileSync(target,fs.readFileSync(f));}fs.unlinkSync(f);
      console.log('Moved: '+newName);
    }
_PATCH_UPLOAD_EOF_

  dot_clean "${dropbox_folder}" &> /dev/null &
  open "${dropbox_folder}" &> /dev/null &
  echo "${dropbox_folder}"
}

# copy the last commit's patch to clipboard
function _patch_view_copy() {
  clear
  git patch-view | copy
}

# patch_cleanup: archive loose .patch files, keep only the N newest in archived_patch
function patch_cleanup() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "patch_cleanup: move loose .patch files into archived_patch and keep only the newest N
  Usage: patch_cleanup [keep=3]
  Examples:
    patch_cleanup       keep 3 newest patches (default)
    patch_cleanup 5     keep 5 newest patches"
    return
  fi

  local keep="${1:-3}"
  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local archive_folder="${dropbox_folder}/archived_patch"

  mkdir -p "$archive_folder"

  # move any loose .patch files from dropbox root into the archive folder
  local moved=0
  for f in "$dropbox_folder"/*.patch; do
    [ -f "$f" ] || continue
    mv "$f" "$archive_folder/"
    moved=$((moved + 1))
  done
  echo "Moved $moved .patch file(s) to $archive_folder"

  # sort by modification time (newest first), remove all but the newest N
  local removed=0
  local count=0
  while IFS= read -r f; do
    count=$((count + 1))
    if [ "$count" -gt "$keep" ]; then
      echo "  Removing: $(basename "$f")"
      rm "$f"
      removed=$((removed + 1))
    fi
  done < <(ls -t "$archive_folder"/*.patch 2> /dev/null)

  echo "Kept $keep newest, removed $removed old .patch file(s)"
}

alias patch0='_patch_create_and_upload' # create
alias patch1='_patch_view_copy'
alias patch2='_patch_download_and_apply'
alias patch="patch2"

################################################################################
# ---- Notes (Dropbox) ----
# Opens a shared notes file from the Dropbox notes folder.
# With a truthy arg, creates and opens a timestamped note instead.
################################################################################
# open notes file
function note() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "
      note: open a shared notes file from Dropbox
        note               open _note.txt
        note 1             create and open a timestamped _note_<timestamp>.txt
        note true|y|yes    same as above
    "
    return 0
  fi

  local dropbox_folder
  dropbox_folder=$(_dropbox_folder) || {
    echo "No dropbox folder found"
    return 1
  }
  local notes_folder="${dropbox_folder}/notes"
  if [ ! -d "$notes_folder" ]; then
    echo "No dropbox notes folder found: $notes_folder"
    return 1
  fi
  local file
  if is_truthy "${1:-}"; then
    file="${notes_folder}/_note_$(command date +%Y-%m-%d-%H-%M).txt"
    touch "$file"
  else
    file="${notes_folder}/_note.txt"
  fi
  subl "$file"
}

################################################################################
# ---- Screenshots (Shared Network Folder) ----
# Backs up local screenshots to the shared network folder, skipping duplicates
# by MD5 hash. Only copies image files (png, jpg, jpeg, gif, bmp, webp, tiff).
################################################################################
# find the local screenshots source folder
function _screenshot_local_folder() {
  local candidates=(
    /mnt/d/Desktop/_screenshots
    "/mnt/c/Users/[Ss][Yy]*/Desktop/_screenshots"
    "/mnt/c/Users/[Ss][Yy]*/Desktop"
    ~/Desktop/_screenshots
    ~/Desktop/
  )
  find_path "${candidates[@]}" --folder
}

# screenshot_backup: copy local screenshots to the shared network folder via cpsync
function screenshot_backup() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "screenshot_backup: copy local screenshots to the shared network folder
  Uses cpsync to skip unchanged files.
  Usage: screenshot_backup"
    return 0
  fi

  local shared_folder
  shared_folder=$(_shared_folder) || {
    echo "No shared network folder found"
    return 1
  }
  local dest_folder="${shared_folder}/share/_screenshots"
  mkdir -p "$dest_folder"

  local src_folder
  src_folder=$(_screenshot_local_folder) || {
    echo "No local screenshots folder found"
    return 1
  }

  cpsync "$src_folder" "$dest_folder"
}

# screenshot_open_local: open the local screenshots folder
function screenshot_open_local() {
  local src_folder
  src_folder=$(_screenshot_local_folder) || {
    echo "No local screenshots folder found"
    return 1
  }
  open "$src_folder" &> /dev/null || echo "$src_folder"
}

# screenshot_open_shared: open the shared network screenshots folder
function screenshot_open_shared() {
  local shared_folder
  shared_folder=$(_shared_folder) || {
    echo "No shared network folder found"
    return 1
  }
  local dest_folder="${shared_folder}/share/_screenshots"
  if [ -d "$dest_folder" ]; then
    open "$dest_folder" &> /dev/null || echo "$dest_folder"
  else
    echo "No shared screenshots folder found: $dest_folder"
    return 1
  fi
}

alias screenshot_open='screenshot_open_local'

################################################################################
# ---- Sync ----
# Runs common housekeeping tasks: screenshot backup and patch cleanup.
################################################################################
# sync: run backup, screenshot backup, and patch cleanup
function sync() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "sync: run backup, screenshot backup, and patch cleanup
  Usage: sync"
    return 0
  fi

  local ts
  ts=$(date +%Y_%m_%d_%H_%M)

  local sync_start=$SECONDS
  echo "sync started at $(date)"

  (
    local log="/tmp/log_${ts}_patch_cleanup.txt"
    local start=$SECONDS
    echo "  > patch_cleanup started at $(date)" | tee -a "$log"
    patch_cleanup &> "$log"
    echo "  > patch_cleanup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
  ) &
  (
    local log="/tmp/log_${ts}_screenshot_backup.txt"
    local start=$SECONDS
    echo "  > screenshot_backup started at $(date)" | tee -a "$log"
    screenshot_backup &> "$log"
    echo "  > screenshot_backup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
  ) &
  if type backup &> /dev/null; then
    (
      local log="/tmp/log_${ts}_backup.txt"
      local start=$SECONDS
      echo "  > backup started at $(date)" | tee -a "$log"
      backup &> "$log"
      echo "  > backup done at $(date) ($((SECONDS - start))s)" | tee -a "$log"
    ) &
  fi

  wait
  echo "sync done at $(date) ($((SECONDS - sync_start))s). Logs: /tmp/log_${ts}_*.txt"
}

################################################################################
# ---- Bookmarks ----
################################################################################
if type add_bookmark &> /dev/null; then
  add_bookmark fuzzy_edit
  add_bookmark fuzzy_recent_files
  add_bookmark commit_empty_trigger_deploy
fi

################################################################################
# ---- refresh / upgrade ----
################################################################################
# refresh: re-run profile setup only (skip OS dependency installation)
alias refresh="SKIP_SETUP=1 curl -fsSL $BASH_PROFILE_CODE_REPO_RAW_URL/software/bootstrap/setup.sh?raw=1 | bash"
# upgrade: update OS packages + full setup with OS dependency installation
alias upgrade="update && curl -fsSL $BASH_PROFILE_CODE_REPO_RAW_URL/software/bootstrap/setup.sh?raw=1 | bash"

################################################################################
# ---- Update Notifier ----
# Checks if local bashrc clone is behind origin/master (at most once per day).
# Background fetch writes to a temp file; the next prompt displays it via
# _bashrc_update_check_show (avoids echoing from a background process, which
# collides with starship prompt rendering and causes blank-line hangs).
################################################################################
function _bashrc_update_check() {
  local repo_dir=""
  for _candidate in "$HOME/Downloads/bashrc" "$HOME/bashrc" "$HOME/.bashrc-repo"; do
    if [ -d "$_candidate/.git" ]; then
      repo_dir="$_candidate"
      break
    fi
  done
  [ -z "$repo_dir" ] && return

  # throttle: at most once per day
  local stamp_file="/tmp/.bashrc_update_check_stamp"
  if [ -f "$stamp_file" ]; then
    local stamp_age
    stamp_age=$(($(date +%s) - $(stat -c '%Y' "$stamp_file" 2> /dev/null || stat -f '%m' "$stamp_file" 2> /dev/null || echo 0)))
    [ "$stamp_age" -lt 86400 ] && return
  fi
  touch "$stamp_file"

  local msg_file="/tmp/.bashrc_update_check_msg"

  # fetch and compare (suppress all output from git)
  git -C "$repo_dir" fetch origin master --quiet 2> /dev/null || return
  local behind
  behind=$(git -C "$repo_dir" rev-list --count HEAD..origin/master 2> /dev/null)
  if [ -n "$behind" ] && [ "$behind" -gt 0 ]; then
    printf '\n  bashrc is %s commit(s) behind origin/master.\n  Run '\''cd %s && git pull'\'' or '\''make setup'\'' to update.\n\n' "$behind" "$repo_dir" > "$msg_file"
  fi
}
(_bashrc_update_check &) 2> /dev/null

# displays the update notification (written by the background check) on the next
# prompt, then removes the file so it only shows once.
function _bashrc_update_check_show() {
  local msg_file="/tmp/.bashrc_update_check_msg"
  if [ -f "$msg_file" ]; then
    cat "$msg_file"
    rm -f "$msg_file"
  fi
}
PROMPT_COMMAND="_bashrc_update_check_show${PROMPT_COMMAND:+;$PROMPT_COMMAND}"

################################################################################
# ---- Deferred Profile Blocks (heavy or late-loading) ----
# ---- Post-profile Integrations (registerWithBashSyleProfile) ----
################################################################################
# SOURCE_BEGIN software/scripts/bash-keys-profile.bash
# software/scripts/bash-keys-profile.bash | 2b84edec845b02a7dc3d09a220eec80d | 4.8 KB | 2026-04-18
# SOURCE_BEGIN software/bootstrap/common-functions.bash
# software/bootstrap/common-functions.bash | d9ed8ad8376248729ca94dc654c98d87 | 8.9 KB | 2026-04-18
# Shared shell functions for run.sh and SH scripts (via SOURCE markers).
# Source of truth — inlined into run.sh via BEGIN/END, included in .sh scripts at runtime.

# safe_source <source> [dest] - Fetches and sources a bash script with syntax validation.
#   source: URL (http/https), absolute path, or relative path
#   dest:   optional local path to store the fetched content (useful for caching URL downloads)
# URLs are downloaded via curl, files are used directly (or copied to dest if given).
# Always validates with bash -n before sourcing.
function safe_source() {
  local src="$1"
  local dest="${2:-}"
  local target="$src"
  case "$src" in
  http://* | https://*)
    target="${dest:-/tmp/bashrc_safe_source_$$.sh}"
    curl -fsSL -o "$target" "$src" 2> /dev/null || {
      echo "[Warning] safe_source download $src failed" >&2
      return 1
    }
    ;;
  *)
    if [ ! -f "$src" ]; then
      echo "[Warning] safe_source $src not found" >&2
      return 1
    fi
    if [ -n "$dest" ]; then
      cp "$src" "$dest" 2> /dev/null
      target="$dest"
    fi
    ;;
  esac
  bash -n "$target" 2> /dev/null && . "$target" || echo "[Warning] source $target failed" >&2
}

# curl_bash_install <url> [script args...] - Runs a curl|bash installer with output
# suppressed. In verbose mode (set -x), stderr is kept visible for debugging.
# Extra args are passed to the install script via bash -s -- <args>.
function curl_bash_install() {
  local url="$1"
  shift
  if [[ $- == *x* ]]; then
    curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  else
    curl -fsSL "$url" | bash -s -- "$@" &> /dev/null
  fi
}

# npm_install_global <pkg> [binary] - Installs an npm package globally. Skips if already installed.
#   pkg:    npm package name (e.g. @google/gemini-cli, yarn)
#   binary: binary name to check (defaults to last segment of pkg, e.g. gemini-cli from @google/gemini-cli)
# Installs to $HOME/.local on the current system. On WSL, also installs to the Windows host
# via cmd.exe. Logs status (Skipped/Success/Error) for each target.
function npm_install_global() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # install for current system
  local _resolved
  _resolved=$(has_persistent_binary "$bin")
  if [ -n "$_resolved" ]; then
    echo ">> $pkg >> Installing with npm global >> Skipped ($_resolved)"
  else
    echo -n ">> $pkg >> Installing with npm global >> "
    if npm install -g --prefix "$HOME/.local" "$pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi

  # install for Windows host via WSL
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    if cmd.exe /c "where $bin" &> /dev/null; then
      echo ">> $pkg >> Installing with npm global (Windows) >> Skipped"
    else
      echo -n ">> $pkg >> Installing with npm global (Windows) >> "
      if cmd.exe /c "npm install -g $pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
  fi
}

# has_persistent_binary <name> - Returns 0 (true) when the binary is found in PATH and is NOT
# inside /tmp/. During run.sh, /tmp/synle/bashrc/node/bin is on PATH (bootstrap node fallback),
# so binaries installed there by a prior run appear installed but are ephemeral. Use this for
# install-skip checks; use plain `type -P` for dependency-available checks where /tmp is fine.
# On success, prints the resolved path to stdout (capture with $()).
function has_persistent_binary() {
  local bin
  bin=$(type -P "$1" 2> /dev/null) || return 1
  [[ "$bin" == /tmp/* ]] && return 1
  echo "$bin"
}

# sudo <args...> - Wrapper that logs the caller and command before executing sudo.
# Helps track which script/function is requesting elevated privileges.
function sudo() {
  echo "[sudo] ${FUNCNAME[1]:-shell}: sudo $*" >&2
  command sudo "$@"
}

# safe_touch <file...> - Creates the file only if it does not exist. Skips existing files to
# avoid updating mtime (which would reset staleness checks). For files inside $HOME,
# fixes ownership to current user if owned by root.
function safe_touch() {
  for f in "$@"; do
    if [ ! -e "$f" ]; then
      command touch "$f"
      echo ">> safe_touch >> $f >> Created"
    elif [[ "$f" == "$HOME"/* ]] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_touch >> $f >> Fixed ownership"
    else
      echo ">> safe_touch >> $f >> Skipped"
    fi
  done
}

# safe_mkdir <dir...> - Creates directories (-p by default), then fixes ownership to
# current user for any resulting dir inside $HOME that is owned by root.
function safe_mkdir() {
  command mkdir -p "$@"
  for f in "$@"; do
    [[ "$f" == -* ]] && continue
    if [[ "$f" == "$HOME"/* ]] && [ -d "$f" ] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_mkdir >> $f >> Fixed ownership"
    else
      echo ">> safe_mkdir >> $f >> OK"
    fi
  done
}

# safe_chown [-R] [user] <path> - Runs sudo chown on a single path only if it exists
# and is not already owned by the target user. Defaults to $USER if no user given.
# Pass -R as the first argument to chown recursively. Always pass one path per call.
# Usage:
#   safe_chown "$HOME/.bashrc"              # chown to $USER
#   safe_chown -R "$HOME/.config"           # chown -R to $USER
#   safe_chown otheruser "$HOME/.bashrc"    # chown to otheruser
#   safe_chown -R otheruser "$HOME/.config" # chown -R to otheruser
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local target_user="$USER"
  if [ -n "$1" ] && [ ! -e "$1" ] && id "$1" &> /dev/null; then
    target_user="$1"
    shift
  fi
  local target_uid
  target_uid=$(id -u "$target_user")
  local f="$1"
  if [ ! -e "$f" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" = "$target_uid" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (already correct)"
  else
    sudo chown $flags "$target_user" "$f"
    echo ">> safe_chown $flags $target_user >> $f >> Done"
  fi
}

# safe_chmod [-R] <mode> <path> - Runs chmod on a single path only if it exists
# and permissions differ from the target mode. Always pass one path per call.
# Pass -R as the first argument to chmod recursively.
# Usage:
#   safe_chmod 700 "$HOME/.ssh"
#   safe_chmod 600 "$HOME/.ssh/id_rsa"
function safe_chmod() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local mode="$1"
  local f="$2"
  if [ ! -e "$f" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%a' "$f" 2> /dev/null || stat -f '%Lp' "$f" 2> /dev/null)" = "$mode" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (already correct)"
  else
    chmod $flags "$mode" "$f"
    echo ">> safe_chmod $flags $mode >> $f >> Done"
  fi
}

# get_github_raw_url <path> - Constructs a GitHub raw content URL for a file in this repo.
# Uses BASH_PROFILE_CODE_REPO_RAW_URL as the base and appends ?raw=1.
# Usage: curl -fsSL "$(get_github_raw_url software/bootstrap/setup.sh)" | bash
function get_github_raw_url() {
  echo "${BASH_PROFILE_CODE_REPO_RAW_URL}/${1}?raw=1"
}

# is_path_stale <path> [max_age_seconds] - Returns 0 (true) when the path is older than
# max_age_seconds or missing. Defaults to 2 weeks (1209600s) when no max age given.
function is_path_stale() {
  ((IS_REFRESH_MODE)) && return 0
  local target="$1"
  local max_age="${2:-1209600}"
  if [ -e "$target" ]; then
    local mtime
    mtime=$(stat -c '%Y' "$target" 2> /dev/null || stat -f '%m' "$target" 2> /dev/null || echo 0)
    [ $(($(date +%s) - mtime)) -gt "$max_age" ] && return 0
    return 1
  fi
  return 0
}

# is_force_refresh_stale [path] - Returns 0 (true) only when IS_FORCE_REFRESH=1 AND the path
# is stale. Defaults to BASH_SYLE_PATH when no path given.
# Used by medium/heavy scripts to avoid unnecessary re-downloads when the install is still fresh.
function is_force_refresh_stale() {
  ! ((IS_FORCE_REFRESH)) && return 1
  ((IS_REFRESH_MODE)) && return 0
  local target="${1:-$BASH_SYLE_PATH}"
  if is_path_stale "$target"; then return 0; fi
  echo ">> Force refresh skipped (not stale): $target"
  return 1
}

# is_bash_syle_stale - Returns 0 (true) when ~/.bash_syle is older than 2 weeks or missing.
# Used by dependency scripts to skip package index updates.
function is_bash_syle_stale() {
  is_path_stale "$BASH_SYLE_PATH"
}

# exit_if_limited_support_os - Exits the script if the current OS is a limited-support
# platform (LIMITED_SUPPORT_OSES) or if IS_LIGHT_WEIGHT_MODE is enabled.
function exit_if_limited_support_os() {
  ((IS_LIGHT_WEIGHT_MODE)) && {
    echo ">>> Skipped : Lightweight mode"
    exit 0
  }
  local IFS=','
  for os_flag in $LIMITED_SUPPORT_OSES; do
    ((${os_flag:-0})) && {
      echo ">>> Skipped : Not supported on $os_flag"
      exit 0
    }
  done
}
# SOURCE_END software/bootstrap/common-functions.bash
################################################################################
# ---- Bash Readline Keybindings ----
#
# No user-callable functions. Sets up readline bindings for interactive shells:
#
# --- Tab Completion ---
# Tab        — fzf-tab-completion (falls back to menu-complete)
# Shift+Tab  — cycle completions backward
#
# --- Cursor Movement ---
# Ctrl+Up/Down    — jump to beginning/end of line (Linux/WSL)
# Ctrl+Left/Right — jump one word backward/forward (Linux/WSL)
# Option+arrows   — same as above (macOS)
#
# --- History Navigation ---
# Up/Down — search history matching current prefix
#
# --- Shortcuts ---
# Ctrl+A/E — beginning/end of line
# Ctrl+L   — clear screen
# Ctrl+R   — fzf history search (places command on prompt)
# Ctrl+T   — fuzzy edit with vim
# Ctrl+Y   — fuzzy edit (default editor)
# Ctrl+P   — fuzzy cd to directory
# Ctrl+B   — fuzzy favorite command picker
# Ctrl+G   — fuzzy git log browser
# Ctrl+N   — fuzzy make-component scaffold
# Ctrl+X   — open command in $EDITOR
#
# All bindings guarded by interactive shell check ([[ $- == *i* ]]).
################################################################################
if [[ $- == *i* ]]; then

  # Tab Completion — fzf-tab-completion with fallback to menu-complete
  if [ -f ~/.fzf-tab-completion/bash/fzf-bash-completion.sh ] && type -P fzf &> /dev/null && . ~/.fzf-tab-completion/bash/fzf-bash-completion.sh 2> /dev/null && type fzf_bash_completion &> /dev/null; then
    # Wrap fzf_bash_completer to strip trailing space after directory slash
    # so tab-completing into nested paths works without the extra space
    eval "$(declare -f fzf_bash_completer | command sed '1s/fzf_bash_completer/_fzf_bash_completer_orig/')"
    function fzf_bash_completer() {
      _fzf_bash_completer_orig "$@"
      COMPREPLY="${COMPREPLY/%\/ /\/}"
    }
    bind -x '"\t": fzf_bash_completion'
  else
    bind '"\t": menu-complete'
  fi
  bind '"\e[Z": menu-complete-backward' # Shift+Tab — cycle completions backward

  # Cursor Movement — Linux / WSL
  bind '"\e[1;5A": beginning-of-line' # Ctrl+Up — jump to beginning of line
  bind '"\e[1;5B": end-of-line'       # Ctrl+Down — jump to end of line
  bind '"\e[1;5D": backward-word'     # Ctrl+Left — jump one word backward
  bind '"\e[1;5C": forward-word'      # Ctrl+Right — jump one word forward

  # Cursor Movement — macOS (Option key)
  bind '"\e\e[C": forward-word'      # Option+Right — jump one word forward
  bind '"\e\e[D": backward-word'     # Option+Left — jump one word backward
  bind '"\e\e[A": beginning-of-line' # Option+Up — jump to beginning of line
  bind '"\e\e[B": end-of-line'       # Option+Down — jump to end of line

  # History Navigation
  bind '"\e[A": history-search-backward' # Up arrow — search history backward matching prefix
  bind '"\e[B": history-search-forward'  # Down arrow — search history forward matching prefix

  # Shortcuts
  bind '"\C-a": beginning-of-line'          # Ctrl+A — jump to beginning of line
  bind '"\C-e": end-of-line'                # Ctrl+E — jump to end of line
  bind '"\C-l": clear-screen'               # Ctrl+L — clear screen
  bind '"\C-x": edit-and-execute-command'   # Ctrl+X — open command in $EDITOR
  bind '"\C-t": "fuzzy_edit vim\r"'         # Ctrl+T — fuzzy edit with vim
  bind '"\C-y": "fuzzy_edit\r"'             # Ctrl+Y — fuzzy edit (default editor)
  bind '"\C-p": "fuzzy_cd\r"'               # Ctrl+P — fuzzy cd to directory
  bind '"\C-b": "fuzzy_favorite_command\r"' # Ctrl+B — fuzzy favorite command picker
  bind '"\C-g": "fuzzy_git_show\r"'         # Ctrl+G — fuzzy git log browser
  bind '"\C-n": "fuzzy_make_component\r"'   # Ctrl+N — fuzzy make-component scaffold

  # ---- bind -x here (requires bash 5+) ----
  # bind -x executes a shell function directly instead of injecting keystrokes via
  # readline macros. The function sets READLINE_LINE / READLINE_POINT to place the
  # result on the prompt — more reliable than the old macro approach.

  # Ctrl+R — fzf history search (places selected command on prompt)
  # reads from ~/.bash_history file directly so it searches commands from all tabs
  # (since we no longer reload shared history into memory with history -c/-r)
  if type -P fzf &> /dev/null; then
    function __fzf_history__() {
      local selected
      selected=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' ~/.bash_history | command grep -v '^#' | $(type -P tac &> /dev/null && echo tac || echo 'tail -r') | awk 'NF && !seen[$0]++' | fzf --height=60% --reverse --tac +s)
      if [ -n "$selected" ]; then
        READLINE_LINE="$selected"
        READLINE_POINT=${#selected}
      fi
    }
    bind -x '"\C-r": __fzf_history__'
  fi

fi # end interactive shell guard
# SOURCE_END software/scripts/bash-keys-profile.bash
# SOURCE_BEGIN software/scripts/bash-file-utils.bash
# software/scripts/bash-file-utils.bash | 10c649d8f9d25c511725df9c1dab11fa | 27.7 KB | 2026-04-18
# SOURCE_BEGIN software/bootstrap/common-functions.bash
# software/bootstrap/common-functions.bash | d9ed8ad8376248729ca94dc654c98d87 | 8.9 KB | 2026-04-18
# Shared shell functions for run.sh and SH scripts (via SOURCE markers).
# Source of truth — inlined into run.sh via BEGIN/END, included in .sh scripts at runtime.

# safe_source <source> [dest] - Fetches and sources a bash script with syntax validation.
#   source: URL (http/https), absolute path, or relative path
#   dest:   optional local path to store the fetched content (useful for caching URL downloads)
# URLs are downloaded via curl, files are used directly (or copied to dest if given).
# Always validates with bash -n before sourcing.
function safe_source() {
  local src="$1"
  local dest="${2:-}"
  local target="$src"
  case "$src" in
  http://* | https://*)
    target="${dest:-/tmp/bashrc_safe_source_$$.sh}"
    curl -fsSL -o "$target" "$src" 2> /dev/null || {
      echo "[Warning] safe_source download $src failed" >&2
      return 1
    }
    ;;
  *)
    if [ ! -f "$src" ]; then
      echo "[Warning] safe_source $src not found" >&2
      return 1
    fi
    if [ -n "$dest" ]; then
      cp "$src" "$dest" 2> /dev/null
      target="$dest"
    fi
    ;;
  esac
  bash -n "$target" 2> /dev/null && . "$target" || echo "[Warning] source $target failed" >&2
}

# curl_bash_install <url> [script args...] - Runs a curl|bash installer with output
# suppressed. In verbose mode (set -x), stderr is kept visible for debugging.
# Extra args are passed to the install script via bash -s -- <args>.
function curl_bash_install() {
  local url="$1"
  shift
  if [[ $- == *x* ]]; then
    curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  else
    curl -fsSL "$url" | bash -s -- "$@" &> /dev/null
  fi
}

# npm_install_global <pkg> [binary] - Installs an npm package globally. Skips if already installed.
#   pkg:    npm package name (e.g. @google/gemini-cli, yarn)
#   binary: binary name to check (defaults to last segment of pkg, e.g. gemini-cli from @google/gemini-cli)
# Installs to $HOME/.local on the current system. On WSL, also installs to the Windows host
# via cmd.exe. Logs status (Skipped/Success/Error) for each target.
function npm_install_global() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # install for current system
  local _resolved
  _resolved=$(has_persistent_binary "$bin")
  if [ -n "$_resolved" ]; then
    echo ">> $pkg >> Installing with npm global >> Skipped ($_resolved)"
  else
    echo -n ">> $pkg >> Installing with npm global >> "
    if npm install -g --prefix "$HOME/.local" "$pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi

  # install for Windows host via WSL
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    if cmd.exe /c "where $bin" &> /dev/null; then
      echo ">> $pkg >> Installing with npm global (Windows) >> Skipped"
    else
      echo -n ">> $pkg >> Installing with npm global (Windows) >> "
      if cmd.exe /c "npm install -g $pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
  fi
}

# has_persistent_binary <name> - Returns 0 (true) when the binary is found in PATH and is NOT
# inside /tmp/. During run.sh, /tmp/synle/bashrc/node/bin is on PATH (bootstrap node fallback),
# so binaries installed there by a prior run appear installed but are ephemeral. Use this for
# install-skip checks; use plain `type -P` for dependency-available checks where /tmp is fine.
# On success, prints the resolved path to stdout (capture with $()).
function has_persistent_binary() {
  local bin
  bin=$(type -P "$1" 2> /dev/null) || return 1
  [[ "$bin" == /tmp/* ]] && return 1
  echo "$bin"
}

# sudo <args...> - Wrapper that logs the caller and command before executing sudo.
# Helps track which script/function is requesting elevated privileges.
function sudo() {
  echo "[sudo] ${FUNCNAME[1]:-shell}: sudo $*" >&2
  command sudo "$@"
}

# safe_touch <file...> - Creates the file only if it does not exist. Skips existing files to
# avoid updating mtime (which would reset staleness checks). For files inside $HOME,
# fixes ownership to current user if owned by root.
function safe_touch() {
  for f in "$@"; do
    if [ ! -e "$f" ]; then
      command touch "$f"
      echo ">> safe_touch >> $f >> Created"
    elif [[ "$f" == "$HOME"/* ]] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_touch >> $f >> Fixed ownership"
    else
      echo ">> safe_touch >> $f >> Skipped"
    fi
  done
}

# safe_mkdir <dir...> - Creates directories (-p by default), then fixes ownership to
# current user for any resulting dir inside $HOME that is owned by root.
function safe_mkdir() {
  command mkdir -p "$@"
  for f in "$@"; do
    [[ "$f" == -* ]] && continue
    if [[ "$f" == "$HOME"/* ]] && [ -d "$f" ] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_mkdir >> $f >> Fixed ownership"
    else
      echo ">> safe_mkdir >> $f >> OK"
    fi
  done
}

# safe_chown [-R] [user] <path> - Runs sudo chown on a single path only if it exists
# and is not already owned by the target user. Defaults to $USER if no user given.
# Pass -R as the first argument to chown recursively. Always pass one path per call.
# Usage:
#   safe_chown "$HOME/.bashrc"              # chown to $USER
#   safe_chown -R "$HOME/.config"           # chown -R to $USER
#   safe_chown otheruser "$HOME/.bashrc"    # chown to otheruser
#   safe_chown -R otheruser "$HOME/.config" # chown -R to otheruser
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local target_user="$USER"
  if [ -n "$1" ] && [ ! -e "$1" ] && id "$1" &> /dev/null; then
    target_user="$1"
    shift
  fi
  local target_uid
  target_uid=$(id -u "$target_user")
  local f="$1"
  if [ ! -e "$f" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" = "$target_uid" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (already correct)"
  else
    sudo chown $flags "$target_user" "$f"
    echo ">> safe_chown $flags $target_user >> $f >> Done"
  fi
}

# safe_chmod [-R] <mode> <path> - Runs chmod on a single path only if it exists
# and permissions differ from the target mode. Always pass one path per call.
# Pass -R as the first argument to chmod recursively.
# Usage:
#   safe_chmod 700 "$HOME/.ssh"
#   safe_chmod 600 "$HOME/.ssh/id_rsa"
function safe_chmod() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local mode="$1"
  local f="$2"
  if [ ! -e "$f" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%a' "$f" 2> /dev/null || stat -f '%Lp' "$f" 2> /dev/null)" = "$mode" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (already correct)"
  else
    chmod $flags "$mode" "$f"
    echo ">> safe_chmod $flags $mode >> $f >> Done"
  fi
}

# get_github_raw_url <path> - Constructs a GitHub raw content URL for a file in this repo.
# Uses BASH_PROFILE_CODE_REPO_RAW_URL as the base and appends ?raw=1.
# Usage: curl -fsSL "$(get_github_raw_url software/bootstrap/setup.sh)" | bash
function get_github_raw_url() {
  echo "${BASH_PROFILE_CODE_REPO_RAW_URL}/${1}?raw=1"
}

# is_path_stale <path> [max_age_seconds] - Returns 0 (true) when the path is older than
# max_age_seconds or missing. Defaults to 2 weeks (1209600s) when no max age given.
function is_path_stale() {
  ((IS_REFRESH_MODE)) && return 0
  local target="$1"
  local max_age="${2:-1209600}"
  if [ -e "$target" ]; then
    local mtime
    mtime=$(stat -c '%Y' "$target" 2> /dev/null || stat -f '%m' "$target" 2> /dev/null || echo 0)
    [ $(($(date +%s) - mtime)) -gt "$max_age" ] && return 0
    return 1
  fi
  return 0
}

# is_force_refresh_stale [path] - Returns 0 (true) only when IS_FORCE_REFRESH=1 AND the path
# is stale. Defaults to BASH_SYLE_PATH when no path given.
# Used by medium/heavy scripts to avoid unnecessary re-downloads when the install is still fresh.
function is_force_refresh_stale() {
  ! ((IS_FORCE_REFRESH)) && return 1
  ((IS_REFRESH_MODE)) && return 0
  local target="${1:-$BASH_SYLE_PATH}"
  if is_path_stale "$target"; then return 0; fi
  echo ">> Force refresh skipped (not stale): $target"
  return 1
}

# is_bash_syle_stale - Returns 0 (true) when ~/.bash_syle is older than 2 weeks or missing.
# Used by dependency scripts to skip package index updates.
function is_bash_syle_stale() {
  is_path_stale "$BASH_SYLE_PATH"
}

# exit_if_limited_support_os - Exits the script if the current OS is a limited-support
# platform (LIMITED_SUPPORT_OSES) or if IS_LIGHT_WEIGHT_MODE is enabled.
function exit_if_limited_support_os() {
  ((IS_LIGHT_WEIGHT_MODE)) && {
    echo ">>> Skipped : Lightweight mode"
    exit 0
  }
  local IFS=','
  for os_flag in $LIMITED_SUPPORT_OSES; do
    ((${os_flag:-0})) && {
      echo ">>> Skipped : Not supported on $os_flag"
      exit 0
    }
  done
}
# SOURCE_END software/bootstrap/common-functions.bash
################################################################################
# ---- File Utilities ----
#
# --- Simple Utilities (no dependencies) ---
# download — Download a file from a URL via curl
# tree     — Display directory tree (falls back to find+sed)
# cp2      — Copy with progress bar via pv (supports file->file)
# watch    — Run a command when files change (md5-based polling)
#
# --- Copy Chain (dependency order: base -> helpers -> consumers) ---
# _cp_node_helpers — [internal] Shared Node.js helpers piped into node heredocs
# cpsync  — Base copy: file->folder or folder->folder (recursive). Skips
#            unchanged files by size (binary) or size+wordcount+age (text).
#            Progress, ETA, cross-device safe.
# cpstamp — Copy a file with a timestamp suffix. Delegates to cpsync.
# cprepo  — Non-git: passes folder to _cp_zip_to_dest (zips everything).
#            Git: syncs repo, writes tracked file list, passes to _cp_zip_to_dest.
# cpfiles — Node writes glob-matched file list, passes to _cp_zip_to_dest.
# cpenv   — Shorthand for cpfiles with ".env*" pattern
# cpdb    — Shorthand for cpfiles with "*.sqlite*" pattern
#
# --- File Operations ---
# dedup   — Scan for duplicates by MD5+size, move extras to _recycleBin.
#
# Node.js logic runs via inline heredocs. Bash wrappers handle arg
# validation and defaults, then pipe shared helpers + function code into node.
################################################################################

################################################################################
# ---- Simple Utilities ----
################################################################################
# download: download a file from a URL via curl
function download() {
  local url="$1"
  local dest="${2:-.}"

  if [ -z "$url" ] || [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "download: download a file from a URL via curl
  Usage: download <url> [dest_path_or_dir]"
    return 1
  fi

  local filename
  filename=$(basename "$url")

  if [ -d "$dest" ]; then
    # dest is an existing directory — download into it
    command curl -fsSL -o "${dest%/}/${filename}" "$url"
  elif [ -d "$(dirname "$dest")" ]; then
    # dest looks like a file path — download and rename
    command curl -fsSL -o "$dest" "$url"
  else
    echo "download: destination directory does not exist: $(dirname "$dest")"
    return 1
  fi
}

# tree: display directory tree (falls back to find+sed when tree is not installed)
function tree() {
  if type -P tree &> /dev/null; then
    command tree "$@"
  else
    command find . -type d | sed -e "s/[^-][^\/]*\//  |/g" -e "s/|\([^ ]\)/|-\1/"
  fi
}

# cp2: copy a single file with progress bar via pv (supports file->file)
function cp2() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cp2: copy with progress bar via pv
  Usage: cp2 <src> <dest>"
    return
  fi
  echo "==== copy ===="
  echo "src: $1"
  echo "dest: $2"
  pv "$1" > "$2"
}

# watch: run a command when files change (polls with md5, checks every 2s)
function watch() {
  local dir="${1:-.}"
  local filter="${2:-*}"
  local cmd="$3"
  local chsum1="" chsum2=""

  if [ -z "$cmd" ] || [[ "$1" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "watch: run a command when files change
  Usage: watch <dir> <filter> <command>
  Example: watch src '*.js' 'npm test'"
    return 1
  fi

  # use md5sum on linux, md5 on mac
  local md5cmd="md5sum"
  type -P md5sum &> /dev/null || md5cmd="md5"

  while true; do
    chsum2=$(find -L "$dir" -type f -name "$filter" -exec $md5cmd {} \; 2> /dev/null)
    if [ "$chsum1" != "$chsum2" ]; then
      [ -n "$chsum1" ] && echo "File change detected, running: $cmd"
      eval "$cmd"
      chsum1="$chsum2"
    fi
    sleep 2
  done
}

################################################################################
# ---- Copy Chain: Internal Helpers ----
################################################################################
# _cp_node_helpers: prints shared Node.js helper functions to stdout for piping to node.
# Used by cpsync, cpfiles, and dedup. Each pipes this + its own logic into a single node process.
function _cp_node_helpers() {
  cat << '_HELPERS_EOF'
/** Shared helpers for cp utility functions. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

/** Formats byte count as human-readable string (e.g., 1.2GB, 45.3MB, 8.5KB). Returns 'N/A' for negative values. */
function fmtBytes(bytes) {
  if (bytes < 0) return 'N/A';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + 'GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

/** Formats seconds as HH:MM:SS or MM:SS. */
function fmtDuration(secs) {
  const s = Math.floor(secs);
  if (s >= 3600) return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':');
  return [Math.floor(s / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':');
}

/** Formats a timestamp string as YYYY_MM_DD_HH_MM for file naming. */
function fmtTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '_' + pad(d.getMonth() + 1) + '_' + pad(d.getDate()) + '_' + pad(d.getHours()) + '_' + pad(d.getMinutes());
}

/** Formats current datetime as YYYY-MM-DD HH:MM:SS in local time. */
function fmtNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

/** Collects files from a directory, optionally recursing. Skips .DS_Store and .git. */
function collectFiles(dir, recurse) {
  let files = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store' || entry.name === '.git') continue;
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory() && recurse) files = files.concat(collectFiles(fp, true));
      else if (entry.isFile()) files.push(fp);
    }
  } catch {}
  return files.sort();
}

/** Returns total byte size of all files under a directory (recursive). Skips scan when file count exceeds cap (returns -1). */
const DIR_TOTAL_SIZE_CAP = 500;
function dirTotalSize(dir) {
  const files = collectFiles(dir, true);
  if (files.length > DIR_TOTAL_SIZE_CAP) return -1;
  let total = 0;
  for (const f of files) try { total += fs.statSync(f).size; } catch {}
  return total;
}

/** Extensions for binary/media files where word counting is meaningless. */
const BINARY_EXTS = new Set([
  '.png','.jpg','.jpeg','.gif','.bmp','.webp','.tiff','.ico','.svg',
  '.mp4','.mkv','.avi','.mov','.wmv','.flv','.webm',
  '.mp3','.wav','.flac','.aac','.ogg','.wma',
  '.zip','.tar','.gz','.bz2','.xz','.7z','.rar','.dmg','.iso',
  '.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx',
  '.exe','.dll','.so','.dylib','.bin','.dat','.db','.sqlite',
]);

/** Counts whitespace-separated words in a file (equivalent to wc -w). Skips binary files and files over 2MB. */
function wordCount(fp) {
  if (BINARY_EXTS.has(path.extname(fp).toLowerCase())) return 0;
  try { if (fs.statSync(fp).size > 2 * 1048576) return 0; } catch { return 0; }
  try { return fs.readFileSync(fp, 'utf8').split(/\s+/).filter(Boolean).length; } catch { return 0; }
}

/** Checks if a string value represents truthy (true/1). */
function isTruthy(val) { return val === 'true' || val === '1'; }

/** Copies a file with read+write fallback. copyFileSync uses FICLONE/copy_file_range which fails with EPERM on cross-device/network (SMB) mounts. */
function safeCopyFile(src, dest) { try { fs.copyFileSync(src, dest); } catch { fs.writeFileSync(dest, fs.readFileSync(src)); } }

const LINE_BREAK = '#'.repeat(80);
_HELPERS_EOF
}

################################################################################
# ---- Copy Chain: Base ----
################################################################################
# cpsync: smart copy file->folder or folder->folder (recursive), with progress, ETA,
# skip-if-unchanged (by size for binary, size+wordcount+age for text), cross-device safe
function cpsync() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpsync: smart file/dir copy with progress, ETA, and skip-if-unchanged
  Usage: cpsync <src> <dest> [lookback_days=7] [max_size_gb=1]
  Modes:
    cpsync file.txt /backup/       file -> folder (keeps filename)
    cpsync /photos/ /backup/       folder -> folder (recursive, preserves structure)
  dest is always a folder (created if missing). src file -> dest file rename is not supported.
  Skip logic:
    binary files (images, video, archives, etc.): skip if same file size
    text files: skip if same size + word count and older than lookback_days
  Options:
    lookback_days  re-copy threshold for text files (default 7, ignored for binary)
    max_size_gb    abort if total source size exceeds this (default 1, max 100)"
    return
  fi
  local src="${1:?Usage: cpsync <src> <dest> [lookback_days=7] [max_size_gb=1]}"
  local dest="${2:?Usage: cpsync <src> <dest> [lookback_days=7] [max_size_gb=1]}"
  local lookback_days="${3:-7}"
  local max_size_gb="${4:-1}"
  if [ "$max_size_gb" -gt 100 ]; then
    echo "cpsync: max_size_gb cannot exceed 100GB"
    return 1
  fi
  {
    _cp_node_helpers
    cat << 'CPSYNC_NODE'
/** Smart file/dir copy with progress, ETA, and skip-if-unchanged logic. */
const src = process.env.CPSYNC_SRC;
const dest = process.env.CPSYNC_DEST;
const lookbackDays = parseInt(process.env.CPSYNC_LOOKBACK, 10);
const lookbackSecs = lookbackDays * 86400;
const maxSizeGb = parseInt(process.env.CPSYNC_MAXGB, 10);
const maxBytes = maxSizeGb * 1073741824;

if (!fs.existsSync(src)) { console.log('cpsync: source not found: ' + src); process.exit(1); }
if (fs.existsSync(dest) && !fs.statSync(dest).isDirectory()) { console.log('cpsync: dest must be a directory: ' + dest); process.exit(1); }

let files;
let isDir = false;
const srcStat = fs.statSync(src);
if (srcStat.isDirectory()) { isDir = true; files = collectFiles(src, true); }
else { files = [src]; }

const total = files.length;
if (total === 0) { console.log('cpsync: no files found in ' + src); process.exit(0); }

let prescanBytes = 0;
for (const f of files) try { prescanBytes += fs.statSync(f).size; } catch {}
if (prescanBytes > maxBytes) {
  console.log('cpsync: total size ' + fmtBytes(prescanBytes) + ' exceeds ' + maxSizeGb + 'GB limit, aborting');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

let copied = 0, skipped = 0, failed = 0, copiedBytes = 0, skippedBytes = 0, totalBytes = 0;
const startTime = Date.now() / 1000;

console.log('cpsync: ' + src + ' -> ' + dest);
console.log('  ' + total + ' files, skip if unchanged for ' + lookbackDays + ' days, Max: ' + maxSizeGb + 'GB');
console.log('  Source size: ' + fmtBytes(prescanBytes) + ', scanning dest...');

const destBeforeBytes = dirTotalSize(dest);
console.log('  Dest size: ' + fmtBytes(destBeforeBytes));
console.log('  Started at ' + fmtNow());
console.log(LINE_BREAK);

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const idx = i + 1;
  const remaining = total - idx;
  const pct = Math.floor(idx * 100 / total);

  let destFile;
  if (isDir) {
    const rel = file.slice(src.length).replace(/^\//, '');
    destFile = path.join(dest, rel);
  } else {
    destFile = path.join(dest, path.basename(file));
  }

  let srcSize = 0;
  try { srcSize = fs.statSync(file).size; } catch {}
  const srcWc = wordCount(file);
  totalBytes += srcSize;

  const now = Date.now() / 1000;
  const elapsed = now - startTime;
  let etaStr = '--:--';
  if (i > 0 && elapsed > 0) etaStr = fmtDuration(Math.floor(elapsed / i * remaining));

  let skip = false;
  try {
    const ds = fs.statSync(destFile);
    if (ds.isFile() && srcSize === ds.size) {
      // same size: skip binary files immediately, skip text files if word count matches
      // lookback only forces re-copy for text files modified within the lookback window
      const destWc = wordCount(destFile);
      const modAge = Math.floor(now) - Math.floor(fs.statSync(file).mtimeMs / 1000);
      if (srcWc === 0 && destWc === 0) skip = true;
      else if (srcWc === destWc && modAge > lookbackSecs) skip = true;
    }
  } catch {}

  const prefix = '[' + idx + '/' + total + ' ' + pct + '% ETA:' + etaStr + ']';
  const sizeStr = fmtBytes(srcSize);
  const wcStr = srcWc > 0 ? ', ' + srcWc + 'w' : '';

  if (skip) {
    skipped++;
    skippedBytes += srcSize;
    console.log(prefix + ' SKIP ' + file + ' (' + sizeStr + wcStr + ') -> Skipped');
  } else {
    try {
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      safeCopyFile(file, destFile);
      copied++;
      copiedBytes += srcSize;
      console.log(prefix + ' COPY ' + file + ' -> ' + destFile + ' (' + sizeStr + wcStr + ') -> Copied');
    } catch (e) {
      failed++;
      console.log(prefix + ' FAIL ' + file + ' -> Failed: ' + e.message);
    }
  }
}

const duration = Math.floor(Date.now() / 1000 - startTime);
const destAfterBytes = dirTotalSize(dest);

console.log(LINE_BREAK);
console.log('Done in ' + fmtDuration(duration));
console.log('  Copied:  ' + copied + ' files (' + fmtBytes(copiedBytes) + ')');
console.log('  Skipped: ' + skipped + ' files (' + fmtBytes(skippedBytes) + ')');
if (failed > 0) console.log('  Failed:  ' + failed + ' files');
console.log('  Total:   ' + total + ' files (' + fmtBytes(totalBytes) + ')');
console.log('  Dest:    ' + fmtBytes(destBeforeBytes) + ' -> ' + fmtBytes(destAfterBytes));
console.log('  Finished at ' + fmtNow());
CPSYNC_NODE
  } | CPSYNC_SRC="$src" CPSYNC_DEST="$dest" CPSYNC_LOOKBACK="$lookback_days" CPSYNC_MAXGB="$max_size_gb" node
}

# _cp_zip_to_dest: zip files and copy the .zip to dest via cpsync, then clean up all tmp files
function _cp_zip_to_dest() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "_cp_zip_to_dest: zip files and copy .zip to dest via cpsync
  Usage: _cp_zip_to_dest <folder_or_file_list> <dest> [zip_name] [max_size_gb=1] [should_add_time_stamp=false]
  Folder mode:    _cp_zip_to_dest ~/Documents /backup
  File list mode: _cp_zip_to_dest /tmp/myfiles.list /backup \"myzip\"
  Folder mode zips everything recursively.
  File list mode reads absolute paths (one per line) from the temp file, zips those, deletes the temp file.
  Both modes: create zip, check size limit, copy via cpsync, clean up."
    return
  fi
  local src="$1"
  local dest="$2"
  if [ -z "$src" ] || [ -z "$dest" ]; then
    _cp_zip_to_dest --help
    return 1
  fi
  local zip_name="${3:-}"
  local max_size_gb="${4:-1}"
  local should_add_time_stamp="${5:-false}"

  local zip_root=""
  local file_list=""

  if [ -d "$src" ]; then
    # src is a folder — zip everything in it
    zip_root=$(cd "$src" && command pwd)
  elif [ -f "$src" ]; then
    # src is a file list with absolute paths — derive zip root from the paths
    file_list="$src"
    zip_root=$(dirname "$(head -1 "$file_list")")
    # walk up to the common ancestor of all paths
    while IFS= read -r _f; do
      while [[ "$_f" != "$zip_root/"* ]] && [ "$zip_root" != "/" ]; do
        zip_root=$(dirname "$zip_root")
      done
    done < "$file_list"
  else
    echo "_cp_zip_to_dest: not found: $src"
    return 1
  fi

  # generate zip name from the zip root if not provided
  if [ -z "$zip_name" ]; then
    zip_name="${zip_root#/}"
    zip_name="${zip_name//\//-}"
  fi
  is_truthy "$should_add_time_stamp" && zip_name="${zip_name}_$(command date +%Y_%m_%d_%H_%M)"
  local tmp_zip="/tmp/${zip_name}.zip"
  rm -f "$tmp_zip"

  # create zip: from file list (selective) or entire folder (recursive)
  if [ -n "$file_list" ]; then
    # convert absolute paths to relative (strip zip_root prefix) and zip
    sed "s|^${zip_root}/|./|" "$file_list" | (cd "$zip_root" && zip -q "$tmp_zip" -@) || {
      echo "_cp_zip_to_dest: failed to create zip from file list"
      rm -f "$file_list"
      return 1
    }
    rm -f "$file_list"
  else
    (cd "$zip_root" && zip -q -r "$tmp_zip" .)
    local _zip_rc=$?
    # zip exit 18 = "some files could not be read" (sockets, broken symlinks, etc.) — treat as success
    if [ "$_zip_rc" -ne 0 ] && [ "$_zip_rc" -ne 18 ]; then
      echo "_cp_zip_to_dest: failed to create zip"
      return 1
    fi
  fi

  if [ ! -f "$tmp_zip" ]; then
    echo "_cp_zip_to_dest: zip not found: $tmp_zip"
    return 1
  fi

  # check size limit
  local zip_size
  zip_size=$(stat -f%z "$tmp_zip" 2> /dev/null || stat -c%s "$tmp_zip" 2> /dev/null)
  local max_bytes=$((max_size_gb * 1073741824))
  if [ "$zip_size" -gt "$max_bytes" ]; then
    echo "_cp_zip_to_dest: zip size exceeds ${max_size_gb}GB limit, aborting"
    rm -f "$tmp_zip"
    return 1
  fi

  # copy to dest via cpsync (handles skip-if-same-size, progress, cross-device)
  cpsync "$tmp_zip" "$dest"
  rm -f "$tmp_zip"
}

################################################################################
# ---- Copy Chain: Consumers ----
################################################################################
# cpstamp: copy a file with a timestamp suffix (e.g. file.txt.2026_04_13_19_15), delegates to cpsync
function cpstamp() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpstamp: copy a file with a timestamp suffix appended
  Usage: cpstamp <src_file> <dest_dir>
  Output: dest_dir/filename.2026_03_24_17_30"
    return
  fi
  local src="${1:?Usage: cpstamp <src_file> <dest_dir>}"
  local dest="${2:?Usage: cpstamp <src_file> <dest_dir>}"
  if [ ! -f "$src" ]; then
    echo "cpstamp: source file not found: $src"
    return 1
  fi
  local ts
  ts=$(command date +%Y_%m_%d_%H_%M)
  local stamped="/tmp/$(basename "$src").${ts}"
  cp "$src" "$stamped"
  cpsync "$stamped" "$dest"
  rm -f "$stamped"
}

# cprepo: zip a git repo or plain folder and copy the .zip to dest.
# Git repos: stash, checkout default branch, pull, clean, then write tracked file list
#   and pass it to _cp_zip_to_dest (only tracked files are zipped).
# Non-git folders: pass the folder to _cp_zip_to_dest (zips everything recursively).
function cprepo() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cprepo: zip a git repo (tracked files) or folder and copy .zip to dest
  Usage: cprepo <src_dir> <dest_dir> [max_size_gb=1] [should_add_time_stamp=false]
  For git repos: syncs to default branch, zips only tracked files.
  For non-git: zips entire folder recursively.
  should_add_time_stamp  if true/1, append timestamp to zip name"
    return
  fi
  local src="${1:?Usage: cprepo <src> <dest> [max_size_gb=1] [should_add_time_stamp=false]}"
  local dest="${2:?Usage: cprepo <src> <dest> [max_size_gb=1] [should_add_time_stamp=false]}"
  local max_size_gb="${3:-1}"
  if [ "$max_size_gb" -gt 1 ]; then
    echo "cprepo: max_size_gb cannot exceed 1GB"
    return 1
  fi
  local should_add_time_stamp="${4:-false}"

  if [ ! -d "$src" ]; then
    echo "cprepo: source directory not found: $src"
    return 1
  fi

  local abs_src
  abs_src=$(cd "$src" && command pwd)

  # non-git: list all files, filter out unwanted paths, zip the remainder
  if ! git -C "$abs_src" rev-parse --is-inside-work-tree &> /dev/null; then
    echo "cprepo: $abs_src -> $dest (not a git repo, zipping entire folder)"
    local file_list="/tmp/_cprepo_files_$$"
    (cd "$abs_src" && find . -type f | filter_unwanted | sed "s|^\./|${abs_src}/|") > "$file_list"
    if [ ! -s "$file_list" ]; then
      echo "cprepo: no files to zip after filtering"
      rm -f "$file_list"
      return 1
    fi
    _cp_zip_to_dest "$file_list" "$dest" "" "$max_size_gb" "$should_add_time_stamp"
    return
  fi

  # git: sync to default branch, write tracked file list (absolute paths) to temp file,
  # pass it to _cp_zip_to_dest which zips those files and copies to dest
  echo "cprepo: $abs_src -> $dest (git repo, syncing and zipping tracked files only)"
  local default_branch="main"
  default_branch=$(git -C "$abs_src" symbolic-ref refs/remotes/origin/HEAD 2> /dev/null | sed 's|refs/remotes/origin/||') || default_branch="main"
  git -C "$abs_src" stash &> /dev/null
  git -C "$abs_src" checkout "$default_branch" &> /dev/null
  GIT_TERMINAL_PROMPT=0 git -C "$abs_src" pull &> /dev/null || echo "  WARN: git pull skipped (credentials required or remote unavailable)"
  git -C "$abs_src" clean -fd &> /dev/null

  local file_list="/tmp/_cprepo_files_$$"
  (cd "$abs_src" && git ls-files | sed "s|^|${abs_src}/|") > "$file_list"
  _cp_zip_to_dest "$file_list" "$dest" "" "$max_size_gb" "$should_add_time_stamp"
}

# cpfiles: zip files matching a glob pattern and copy the .zip to dest.
# Node does the glob matching and writes matching file paths (absolute, one per line)
# to a temp file. _cp_zip_to_dest zips those files and copies to dest.
function cpfiles() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpfiles: zip files matching a glob pattern and copy .zip to dest
  Usage: cpfiles <src_dir> <dest_dir> <pattern> [should_add_time_stamp=false]
  pattern  glob (e.g., \".env*\", \"*.log\", \"*.conf\")
  should_add_time_stamp  if true/1, append timestamp to zip name
  Examples:
    cpfiles ~/myproject /backup \".env*\"
    cpfiles . /backup \"*.conf\" true"
    return
  fi
  local src="${1:?Usage: cpfiles <src> <dest> <pattern> [should_add_time_stamp=false]}"
  local dest="${2:?Usage: cpfiles <src> <dest> <pattern> [should_add_time_stamp=false]}"
  local pattern="${3:?Usage: cpfiles <src> <dest> <pattern> [should_add_time_stamp=false]}"
  local should_add_time_stamp="${4:-false}"

  if [ ! -d "$src" ]; then
    echo "cpfiles: source directory not found: $src"
    return 1
  fi

  local abs_src
  abs_src=$(cd "$src" && command pwd)

  # node does glob matching and writes absolute file paths (one per line) to a temp file
  local file_list="/tmp/_cpfiles_list_$$"
  {
    _cp_node_helpers
    cat << 'CPFILES_NODE'
const absSrc = fs.realpathSync(process.env.CPFILES_SRC);
const pattern = process.env.CPFILES_PATTERN;

function matchGlob(name, pat) {
  const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return re.test(name);
}

const files = collectFiles(absSrc, true).filter(f => matchGlob(path.basename(f), pattern));
if (!files.length) { console.error("cpfiles: no files matching '" + pattern + "' in " + absSrc); process.exit(1); }

console.error('cpfiles: ' + absSrc + ' (pattern: ' + pattern + ', ' + files.length + ' files)');
for (const f of files) console.log(f);
CPFILES_NODE
  } | CPFILES_SRC="$abs_src" CPFILES_PATTERN="$pattern" node > "$file_list" || {
    rm -f "$file_list"
    return 1
  }

  # generate zip name: /Users/syle/git/myproject + ".env*" -> Users-syle-git-myproject_.env*
  # strip leading /, slashes become dashes, spaces become underscores, pattern appended after _
  local zip_name="${abs_src#/}"
  zip_name="${zip_name//\//-}_${pattern//\//-}"
  zip_name="${zip_name// /_}"

  _cp_zip_to_dest "$file_list" "$dest" "$zip_name" "1" "$should_add_time_stamp"
}

# cpenv: shorthand for cpfiles — zip all .env* files and copy .zip to dest
function cpenv() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpenv: zip all .env* files and copy .zip to dest (timestamp on by default)
  Usage: cpenv <src_dir> <dest_dir> [should_add_time_stamp=true]
  Shorthand for: cpfiles <src> <dest> \".env*\" [should_add_time_stamp]"
    return
  fi
  cpfiles "$1" "$2" ".env*" "${3:-true}"
}

# cpdb: shorthand for cpfiles — zip all *.sqlite* files and copy .zip to dest
function cpdb() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "cpdb: zip all *.sqlite* files and copy .zip to dest (timestamp on by default)
  Usage: cpdb <src_dir> <dest_dir> [should_add_time_stamp=true]
  Shorthand for: cpfiles <src> <dest> \"*.sqlite*\" [should_add_time_stamp]"
    return
  fi
  cpfiles "$1" "$2" "*.sqlite*" "${3:-true}"
}

################################################################################
# ---- File Operations ----
################################################################################
# dedup: scan a folder for duplicates (by MD5 hash + file size), move extras to _recycleBin keeping newest
function dedup() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "dedup: move duplicate files to _recycleBin, keeping the newest"
    echo "  dedup <path> [recursive=false] [across_folders=false]"
    echo "  recursive       if true/1, scan subdirectories recursively"
    echo "  across_folders  if true/1, deduplicate across all subdirectories globally"
    return
  fi
  local target="${1:?Usage: dedup <path> [recursive=false] [across_folders=false]}"
  local recursive="${2:-false}"
  local across_folders="${3:-false}"
  if [ ! -d "$target" ]; then
    echo "dedup: directory not found: $target"
    return 1
  fi
  local abs_target
  abs_target=$(cd "$target" && command pwd)
  {
    _cp_node_helpers
    cat << 'DEDUP_NODE'
/** Moves duplicate files to a recycle bin, keeping the newest original. */
const targetDir = process.env.DEDUP_PATH;
const recursive = isTruthy(process.env.DEDUP_RECURSIVE);
const acrossFolders = isTruthy(process.env.DEDUP_ACROSS);
const recycleBin = path.join(targetDir, '_recycleBin');

const startTime = Date.now() / 1000;

console.log('dedup: ' + targetDir);
console.log('  Recursive: ' + recursive + ', Across folders: ' + acrossFolders);
console.log('  Recycle bin: ' + recycleBin);
console.log('  Started at ' + fmtNow());
console.log(LINE_BREAK);

const files = collectFiles(targetDir, recursive).filter(f => !f.startsWith(recycleBin + '/') && !f.startsWith(recycleBin + path.sep));
console.log('  ' + files.length + ' files to scan');

/** Groups files by comparison scope (global or per-directory). */
const groups = {};
for (const file of files) {
  const scope = acrossFolders ? '__global__' : path.dirname(file);
  if (!groups[scope]) groups[scope] = [];
  groups[scope].push(file);
}

let totalMoved = 0, totalFreed = 0, totalScanned = 0, totalDupSets = 0;

for (const [scope, scopeFiles] of Object.entries(groups)) {
  /** Hash map keyed by "md5:size" to group identical files. */
  const hashMap = {};
  for (const file of scopeFiles) {
    totalScanned++;
    try {
      const stat = fs.statSync(file);
      const hash = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
      const key = hash + ':' + stat.size;
      if (!hashMap[key]) hashMap[key] = [];
      hashMap[key].push({ path: file, mtime: stat.mtimeMs, size: stat.size });
    } catch (e) {
      console.log('  WARN: ' + file + ': ' + e.message);
    }
  }

  for (const dupes of Object.values(hashMap)) {
    if (dupes.length < 2) continue;
    totalDupSets++;
    dupes.sort((a, b) => b.mtime - a.mtime);
    const kept = dupes[0];
    console.log('  KEEP ' + kept.path + ' (' + fmtBytes(kept.size) + ')');
    for (let i = 1; i < dupes.length; i++) {
      const dup = dupes[i];
      const rel = dup.path.slice(targetDir.length).replace(/^\//, '');
      const destFile = path.join(recycleBin, rel);
      try {
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.renameSync(dup.path, destFile);
        totalMoved++;
        totalFreed += dup.size;
        console.log('  MOVE ' + dup.path + ' -> ' + destFile + ' (dup of ' + path.basename(kept.path) + ')');
      } catch (e) {
        console.log('  FAIL ' + dup.path + ': ' + e.message);
      }
    }
  }
}

console.log('  Scanned: ' + totalScanned + ' files');
console.log('  Duplicate sets: ' + totalDupSets);
console.log('  Moved: ' + totalMoved + ' files (' + fmtBytes(totalFreed) + ' freed)');
console.log('  Recycle bin: ' + recycleBin);

const duration = Math.floor(Date.now() / 1000 - startTime);
console.log(LINE_BREAK);
console.log('Done in ' + fmtDuration(duration));
console.log('  Finished at ' + fmtNow());
DEDUP_NODE
  } | DEDUP_PATH="$abs_target" DEDUP_RECURSIVE="$recursive" DEDUP_ACROSS="$across_folders" node
}
# SOURCE_END software/scripts/bash-file-utils.bash
# SOURCE_BEGIN software/scripts/bash-fzf-profile.bash
# software/scripts/bash-fzf-profile.bash | 69d9d10444242fda6c971eb2924d201c | 17.2 KB | 2026-04-18
# SOURCE_BEGIN software/bootstrap/common-functions.bash
# software/bootstrap/common-functions.bash | d9ed8ad8376248729ca94dc654c98d87 | 8.9 KB | 2026-04-18
# Shared shell functions for run.sh and SH scripts (via SOURCE markers).
# Source of truth — inlined into run.sh via BEGIN/END, included in .sh scripts at runtime.

# safe_source <source> [dest] - Fetches and sources a bash script with syntax validation.
#   source: URL (http/https), absolute path, or relative path
#   dest:   optional local path to store the fetched content (useful for caching URL downloads)
# URLs are downloaded via curl, files are used directly (or copied to dest if given).
# Always validates with bash -n before sourcing.
function safe_source() {
  local src="$1"
  local dest="${2:-}"
  local target="$src"
  case "$src" in
  http://* | https://*)
    target="${dest:-/tmp/bashrc_safe_source_$$.sh}"
    curl -fsSL -o "$target" "$src" 2> /dev/null || {
      echo "[Warning] safe_source download $src failed" >&2
      return 1
    }
    ;;
  *)
    if [ ! -f "$src" ]; then
      echo "[Warning] safe_source $src not found" >&2
      return 1
    fi
    if [ -n "$dest" ]; then
      cp "$src" "$dest" 2> /dev/null
      target="$dest"
    fi
    ;;
  esac
  bash -n "$target" 2> /dev/null && . "$target" || echo "[Warning] source $target failed" >&2
}

# curl_bash_install <url> [script args...] - Runs a curl|bash installer with output
# suppressed. In verbose mode (set -x), stderr is kept visible for debugging.
# Extra args are passed to the install script via bash -s -- <args>.
function curl_bash_install() {
  local url="$1"
  shift
  if [[ $- == *x* ]]; then
    curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  else
    curl -fsSL "$url" | bash -s -- "$@" &> /dev/null
  fi
}

# npm_install_global <pkg> [binary] - Installs an npm package globally. Skips if already installed.
#   pkg:    npm package name (e.g. @google/gemini-cli, yarn)
#   binary: binary name to check (defaults to last segment of pkg, e.g. gemini-cli from @google/gemini-cli)
# Installs to $HOME/.local on the current system. On WSL, also installs to the Windows host
# via cmd.exe. Logs status (Skipped/Success/Error) for each target.
function npm_install_global() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # install for current system
  local _resolved
  _resolved=$(has_persistent_binary "$bin")
  if [ -n "$_resolved" ]; then
    echo ">> $pkg >> Installing with npm global >> Skipped ($_resolved)"
  else
    echo -n ">> $pkg >> Installing with npm global >> "
    if npm install -g --prefix "$HOME/.local" "$pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi

  # install for Windows host via WSL
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    if cmd.exe /c "where $bin" &> /dev/null; then
      echo ">> $pkg >> Installing with npm global (Windows) >> Skipped"
    else
      echo -n ">> $pkg >> Installing with npm global (Windows) >> "
      if cmd.exe /c "npm install -g $pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
  fi
}

# has_persistent_binary <name> - Returns 0 (true) when the binary is found in PATH and is NOT
# inside /tmp/. During run.sh, /tmp/synle/bashrc/node/bin is on PATH (bootstrap node fallback),
# so binaries installed there by a prior run appear installed but are ephemeral. Use this for
# install-skip checks; use plain `type -P` for dependency-available checks where /tmp is fine.
# On success, prints the resolved path to stdout (capture with $()).
function has_persistent_binary() {
  local bin
  bin=$(type -P "$1" 2> /dev/null) || return 1
  [[ "$bin" == /tmp/* ]] && return 1
  echo "$bin"
}

# sudo <args...> - Wrapper that logs the caller and command before executing sudo.
# Helps track which script/function is requesting elevated privileges.
function sudo() {
  echo "[sudo] ${FUNCNAME[1]:-shell}: sudo $*" >&2
  command sudo "$@"
}

# safe_touch <file...> - Creates the file only if it does not exist. Skips existing files to
# avoid updating mtime (which would reset staleness checks). For files inside $HOME,
# fixes ownership to current user if owned by root.
function safe_touch() {
  for f in "$@"; do
    if [ ! -e "$f" ]; then
      command touch "$f"
      echo ">> safe_touch >> $f >> Created"
    elif [[ "$f" == "$HOME"/* ]] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_touch >> $f >> Fixed ownership"
    else
      echo ">> safe_touch >> $f >> Skipped"
    fi
  done
}

# safe_mkdir <dir...> - Creates directories (-p by default), then fixes ownership to
# current user for any resulting dir inside $HOME that is owned by root.
function safe_mkdir() {
  command mkdir -p "$@"
  for f in "$@"; do
    [[ "$f" == -* ]] && continue
    if [[ "$f" == "$HOME"/* ]] && [ -d "$f" ] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_mkdir >> $f >> Fixed ownership"
    else
      echo ">> safe_mkdir >> $f >> OK"
    fi
  done
}

# safe_chown [-R] [user] <path> - Runs sudo chown on a single path only if it exists
# and is not already owned by the target user. Defaults to $USER if no user given.
# Pass -R as the first argument to chown recursively. Always pass one path per call.
# Usage:
#   safe_chown "$HOME/.bashrc"              # chown to $USER
#   safe_chown -R "$HOME/.config"           # chown -R to $USER
#   safe_chown otheruser "$HOME/.bashrc"    # chown to otheruser
#   safe_chown -R otheruser "$HOME/.config" # chown -R to otheruser
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local target_user="$USER"
  if [ -n "$1" ] && [ ! -e "$1" ] && id "$1" &> /dev/null; then
    target_user="$1"
    shift
  fi
  local target_uid
  target_uid=$(id -u "$target_user")
  local f="$1"
  if [ ! -e "$f" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" = "$target_uid" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (already correct)"
  else
    sudo chown $flags "$target_user" "$f"
    echo ">> safe_chown $flags $target_user >> $f >> Done"
  fi
}

# safe_chmod [-R] <mode> <path> - Runs chmod on a single path only if it exists
# and permissions differ from the target mode. Always pass one path per call.
# Pass -R as the first argument to chmod recursively.
# Usage:
#   safe_chmod 700 "$HOME/.ssh"
#   safe_chmod 600 "$HOME/.ssh/id_rsa"
function safe_chmod() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local mode="$1"
  local f="$2"
  if [ ! -e "$f" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%a' "$f" 2> /dev/null || stat -f '%Lp' "$f" 2> /dev/null)" = "$mode" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (already correct)"
  else
    chmod $flags "$mode" "$f"
    echo ">> safe_chmod $flags $mode >> $f >> Done"
  fi
}

# get_github_raw_url <path> - Constructs a GitHub raw content URL for a file in this repo.
# Uses BASH_PROFILE_CODE_REPO_RAW_URL as the base and appends ?raw=1.
# Usage: curl -fsSL "$(get_github_raw_url software/bootstrap/setup.sh)" | bash
function get_github_raw_url() {
  echo "${BASH_PROFILE_CODE_REPO_RAW_URL}/${1}?raw=1"
}

# is_path_stale <path> [max_age_seconds] - Returns 0 (true) when the path is older than
# max_age_seconds or missing. Defaults to 2 weeks (1209600s) when no max age given.
function is_path_stale() {
  ((IS_REFRESH_MODE)) && return 0
  local target="$1"
  local max_age="${2:-1209600}"
  if [ -e "$target" ]; then
    local mtime
    mtime=$(stat -c '%Y' "$target" 2> /dev/null || stat -f '%m' "$target" 2> /dev/null || echo 0)
    [ $(($(date +%s) - mtime)) -gt "$max_age" ] && return 0
    return 1
  fi
  return 0
}

# is_force_refresh_stale [path] - Returns 0 (true) only when IS_FORCE_REFRESH=1 AND the path
# is stale. Defaults to BASH_SYLE_PATH when no path given.
# Used by medium/heavy scripts to avoid unnecessary re-downloads when the install is still fresh.
function is_force_refresh_stale() {
  ! ((IS_FORCE_REFRESH)) && return 1
  ((IS_REFRESH_MODE)) && return 0
  local target="${1:-$BASH_SYLE_PATH}"
  if is_path_stale "$target"; then return 0; fi
  echo ">> Force refresh skipped (not stale): $target"
  return 1
}

# is_bash_syle_stale - Returns 0 (true) when ~/.bash_syle is older than 2 weeks or missing.
# Used by dependency scripts to skip package index updates.
function is_bash_syle_stale() {
  is_path_stale "$BASH_SYLE_PATH"
}

# exit_if_limited_support_os - Exits the script if the current OS is a limited-support
# platform (LIMITED_SUPPORT_OSES) or if IS_LIGHT_WEIGHT_MODE is enabled.
function exit_if_limited_support_os() {
  ((IS_LIGHT_WEIGHT_MODE)) && {
    echo ">>> Skipped : Lightweight mode"
    exit 0
  }
  local IFS=','
  for os_flag in $LIMITED_SUPPORT_OSES; do
    ((${os_flag:-0})) && {
      echo ">>> Skipped : Not supported on $os_flag"
      exit 0
    }
  done
}
# SOURCE_END software/bootstrap/common-functions.bash
# run: bash run.sh --files="fzf.js"
################################################################################
# ---- FZF Fuzzy Finder Integration ----
#
# --- Filter ---
# filter_unwanted        — Pipe filter: removes ignored folders/binary paths
#
# --- Pickers ---
# fuzzy_recent_files     — FZF picker for recently opened files
# view_file              — Open a file with the default editor (subl)
# fuzzy_favorite_command — FZF picker for bookmarked commands (Ctrl+B)
# fuzzy_cd               — FZF cd picker: recent paths + folders (Ctrl+P)
# fuzzy_edit             — FZF file/dir picker, open with editor (Ctrl+T/Y)
# fuzzy_git_show         — Interactive git log browser with preview (Ctrl+G)
#
# --- Bookmarks ---
# add_bookmark           — Add a command to the bookmark file
# add_bookmark_dir       — Bookmark a directory (as "cd <dir>")
#
# Configures FZF defaults, aliases (glog, fvim), and provides the
# _fuzzy_list_all directory crawler (Node.js BFS with git fast path).
################################################################################
export FZF_COMPLETION_TRIGGER='*'
export FZF_DEFAULT_OPTS="
  --info-command='_fzf_info_line'
  --bind 'shift-left:preview-page-up'
  --bind 'shift-right:preview-page-down'
  --bind 'ctrl-left:preview-page-up'
  --bind 'ctrl-right:preview-page-down'
  --bind 'ctrl-up:preview-up'
  --bind 'ctrl-down:preview-down'
  --bind 'ctrl-\\:toggle-preview'
"

# ---- Aliases: Git (fzf) ----
alias glog='fuzzy_git_show'
alias fzf='fzf --ansi --no-sort --cycle --layout=reverse --tiebreak=index'
alias fvim='fuzzy_edit vim'

################################################################################
# ---- Filter Functions ----
# Shared by fuzzy_edit, autocomplete nested tokens, and fzf-tab-completion.
# Single source of truth — sourced into profile-advanced.sh and autocomplete tests.
################################################################################
function filter_unwanted() {
  # _IGNORED_FOLDER_PATTERNS is bootstrapped from EDITOR_CONFIGS.ignoredFolders
  # by software/scripts/editor-launchers.js. Fallback list below covers minimal
  # shell environments where the bootstrap hasn't run yet.
  local patterns=()
  if declare -p _IGNORED_FOLDER_PATTERNS &> /dev/null; then
    patterns=("${_IGNORED_FOLDER_PATTERNS[@]}")
  fi
  if [ ${#patterns[@]} -eq 0 ]; then
    patterns=(
      '\.DS_Store'
      '\.pyc'
      '\.cache/'
      '\.git/'
      '\.gradle/'
      '\.hg/'
      '\.idea/'
      '\.mypy_cache/'
      '\.next/'
      '\.nuxt/'
      '\.parcel-cache/'
      '\.pytest_cache/'
      '\.ruff_'
      '\.sass-cache/'
      '\.svn/'
      '\.tox/'
      '\.turbo/'
      '\.uv/'
      '\.venv/'
      '\.yarn/'
      '__pycache'
      'bower_components'
      'node_modules'
      '/build/'
      '/coverage/'
      '/cov/'
      '/dist/'
      '/htmlcov/'
      '/out/'
      '/target/'
      '/vendor/'
    )
  fi
  local joined
  joined=$(
    IFS='|'
    echo "${patterns[*]}"
  )
  command grep -v -E "$joined"
}

################################################################################
# ---- Fuzzy List All ----
# Lists all paths: dirs with trailing /, files without.
# Used by fuzzy_edit and autocomplete nested tokens.
################################################################################
# TODO: pass these patterns in from editor-launchers.js (derived from EDITOR_CONFIGS)
#       instead of hardcoding here — keeps EDITOR_CONFIGS as single source of truth.

# JSON pattern arrays — passed directly to node as process.argv (proper JS regex strings)
# folder patterns — skip ignored dirs during traversal
_FUZZY_IGNORED_FOLDERS_JSON='["\\.DS_Store","\\.pyc","\\.cache/","\\.git/","\\.gradle/","\\.hg/","\\.idea/","\\.mypy_cache/","\\.next/","\\.nuxt/","\\.parcel-cache/","\\.pytest_cache/","\\.ruff_","\\.sass-cache/","\\.svn/","\\.tox/","\\.turbo/","\\.uv/","\\.venv/","\\.yarn/","__pycache","bower_components","node_modules","/build/","/coverage/","/cov/","/dist/","/htmlcov/","/out/","/target/","/vendor/"]'
# ignored file patterns — exclude binary files, system junk, and non-text files
_FUZZY_IGNORED_FILES_JSON='["\\.DS_Store$","Thumbs\\.db$","desktop\\.ini$","\\.Spotlight-","\\.Trashes$","\\.fseventsd$","\\.com\\.apple\\.","\\.localized$","\\.a$","\\.class$","\\.dll$","\\.dylib$","\\.exe$","\\.lib$","\\.o$","\\.obj$","\\.pyc$","\\.pyo$","\\.so$","\\.wasm$"]'
# text file extension allowlist — used by text_files mode
_FUZZY_TEXT_FILES_JSON='["\\.bash$","\\.c$","\\.cfg$","\\.clj$","\\.cmake$","\\.coffee$","\\.conf$","\\.cpp$","\\.cs$","\\.css$","\\.csv$","\\.dart$","\\.diff$","\\.dockerfile$","\\.el$","\\.elm$","\\.env$","\\.erl$","\\.ex$","\\.fish$","\\.go$","\\.graphql$","\\.groovy$","\\.h$","\\.hpp$","\\.hs$","\\.html$","\\.ini$","\\.java$","\\.js$","\\.json$","\\.jsonc$","\\.jsx$","\\.kt$","\\.less$","\\.lisp$","\\.log$","\\.lua$","\\.m$","\\.md$","\\.mk$","\\.ml$","\\.nim$","\\.nix$","\\.php$","\\.pl$","\\.proto$","\\.ps1$","\\.py$","\\.r$","\\.rb$","\\.rs$","\\.rst$","\\.sass$","\\.scala$","\\.scss$","\\.sh$","\\.sql$","\\.svelte$","\\.swift$","\\.tcl$","\\.tex$","\\.tf$","\\.toml$","\\.ts$","\\.tsx$","\\.txt$","\\.v$","\\.vim$","\\.vue$","\\.xml$","\\.yaml$","\\.yml$","\\.zig$","\\.zsh$","Dockerfile$","Makefile$","Rakefile$","Gemfile$","Vagrantfile$","\\.gitignore$","\\.gitattributes$","\\.editorconfig$","\\.eslintrc$","\\.prettierrc$","\\.babelrc$"]'

# usage: _fuzzy_list_all [dir] [mode] [max_depth] [timeout] [filter]
#   dir       — directory to list (default: .)
#   mode      — 'folders', 'files', 'text_files', 'paths' or '' (default: paths)
#   max_depth — optional depth limit (default: unlimited)
#   timeout   — max seconds before self-terminating (default: 3)
#   filter    — prefix filter for top-level entries (default: '' = no filter)
function _fuzzy_list_all() {
  local dir="${1:-.}" mode="${2:-paths}" max_depth="${3:-}" max_timeout="${4:-3}" filter="${5:-}"
  # resolve tilde, relative paths, and trailing slashes so "." check and node both work
  [[ "$dir" == \~* ]] && eval dir="$dir" 2> /dev/null
  dir="${dir%/}"
  # edge case: dir="/" becomes "" after stripping trailing slash — restore to "/" (root), not "."
  [ -z "$dir" ] && dir="/"
  # BFS directory crawler in node.
  #
  # Walks `dir` and emits relative paths to stdout, filtered by `mode`:
  #   paths      — files + folders (single git ls-files call, dirs derived from paths)
  #   files      — files only
  #   text_files — files matching text-file extensions only
  #   folders    — folders only
  #
  # Git fast path: when a directory is a git repo (has .git/), uses async
  # `git ls-files` / `git ls-tree` instead of readdirSync. For `paths` mode
  # only one git command runs (ls-files) and directories are derived from
  # file paths to avoid a second call. Nested git repos discovered during
  # BFS are processed in parallel via Promise.all.
  #
  # Prefix filter (optional `filter` arg): when set, only top-level entries
  # whose name starts with `filter` are processed. This is the key perf
  # optimisation for tab-completion — e.g. `vim ~/.gi<tab>` passes dir="~/"
  # and filter=".gi", so only .git/, .github/, .gitconfig etc. are crawled
  # instead of the entire home directory. The filter is case-insensitive.
  # When filter is empty (fzf pickers like fvim), everything is listed.
  #
  # Self-terminates after max_timeout seconds (deadline-based).
  node -e "
    const fs = require('fs');
    const path = require('path');
    const {exec} = require('child_process');
    const dir = process.argv[1];
    const mode = process.argv[2];
    const maxDepth = process.argv[3] ? parseInt(process.argv[3], 10) : Infinity;
    const folderPats = JSON.parse(process.argv[4]).map(p => new RegExp(p));
    const filePats = JSON.parse(process.argv[5]).map(p => new RegExp(p));
    const textPats = JSON.parse(process.argv[6]).map(p => new RegExp(p));
    const filter = (process.argv[8] || '').toLowerCase();
    const envTimeoutSec = parseInt(process.env.BASHRC_FUZZY_TIMEOUT || '0', 10);
    const argTimeoutSec = parseInt(process.argv[7], 10);
    const timeoutMs = Math.max(envTimeoutSec, argTimeoutSec) * 1000;
    const deadline = Date.now() + timeoutMs;
    const isTextFiles = mode === 'text_files';
    function matchesFilter(name) { return !filter || name.toLowerCase().startsWith(filter); }
    function isGitRepo(abs) { try { return fs.statSync(path.join(abs, '.git')).isDirectory(); } catch { return false; } }
    function emit(rp) {
      const isDir = rp.endsWith('/');
      if (folderPats.some(r => r.test(rp))) return;
      if (isDir) {
        if (mode !== 'files' && mode !== 'text_files') process.stdout.write(rp + '\n');
      } else if (mode !== 'folders') {
        if (isTextFiles && !textPats.some(r => r.test(rp))) return;
        if (!isTextFiles && filePats.some(r => r.test(rp))) return;
        process.stdout.write(rp + '\n');
      }
    }
    function remainingMs() { return Math.max(1, deadline - Date.now()); }
    function execAsync(cmd, opts) {
      return new Promise((resolve) => {
        exec(cmd, opts, (err, stdout) => resolve(err ? '' : stdout));
      });
    }
    function topName(p) { const i = p.indexOf('/'); return i === -1 ? p : p.slice(0, i); }
    async function emitGitRepo(abs, rel) {
      const useFilter = filter && !rel;
      if (mode === 'paths') {
        const out = await execAsync('git ls-files --full-name 2>/dev/null', {cwd: abs, encoding: 'utf-8', timeout: remainingMs()});
        const files = out.trim();
        if (!files) return;
        const dirs = new Set();
        for (const f of files.split('\n')) {
          if (useFilter && !matchesFilter(topName(f))) continue;
          let i = f.indexOf('/');
          while (i !== -1) { dirs.add(f.slice(0, i + 1)); i = f.indexOf('/', i + 1); }
          emit(rel ? rel + '/' + f : f);
        }
        for (const d of dirs) emit(rel ? rel + '/' + d : d);
      } else if (mode === 'folders') {
        const out = await execAsync('git ls-tree -r -d --name-only HEAD 2>/dev/null', {cwd: abs, encoding: 'utf-8', timeout: remainingMs()});
        const dirs = out.trim();
        if (dirs) for (const d of dirs.split('\n')) {
          if (useFilter && !matchesFilter(topName(d))) continue;
          emit(rel ? rel + '/' + d + '/' : d + '/');
        }
      } else {
        const out = await execAsync('git ls-files --full-name 2>/dev/null', {cwd: abs, encoding: 'utf-8', timeout: remainingMs()});
        const files = out.trim();
        if (files) for (const f of files.split('\n')) {
          if (useFilter && !matchesFilter(topName(f))) continue;
          emit(rel ? rel + '/' + f : f);
        }
      }
    }
    (async () => {
    if (isGitRepo(dir)) { await emitGitRepo(dir, ''); process.exit(0); }
    const queue = [{abs: dir, rel: '', depth: 0}];
    const gitPromises = [];
    while (queue.length) {
      if (Date.now() > deadline) break;
      const {abs, rel, depth} = queue.shift();
      let entries;
      try { entries = fs.readdirSync(abs, {withFileTypes: true}); } catch { continue; }
      for (const e of entries) {
        const name = e.name;
        if (filter && depth === 0 && !matchesFilter(name)) continue;
        const rp = rel ? rel + '/' + name : name;
        const isDir = e.isDirectory();
        const label = isDir ? rp + '/' : rp;
        if (folderPats.some(r => r.test(label))) continue;
        if (isDir) {
          if (isGitRepo(path.join(abs, name))) {
            if (mode !== 'files' && mode !== 'text_files') process.stdout.write(label + '\n');
            gitPromises.push(emitGitRepo(path.join(abs, name), rp));
            continue;
          }
          if (mode !== 'files' && mode !== 'text_files') process.stdout.write(label + '\n');
          if (depth + 1 < maxDepth) queue.push({abs: path.join(abs, name), rel: rp, depth: depth + 1});
        } else {
          emit(label);
        }
      }
    }
    await Promise.all(gitPromises);
    })();
  " "$dir" "$mode" "$max_depth" "$_FUZZY_IGNORED_FOLDERS_JSON" "$_FUZZY_IGNORED_FILES_JSON" "$_FUZZY_TEXT_FILES_JSON" "$max_timeout" "$filter"
}

################################################################################
# ---- FZF Functions ----
################################################################################
# dynamic info line for fzf - shows context-aware label based on prompt
function _fzf_info_line() {
  local label="results"
  case "$FZF_PROMPT" in
  *"Paths>"*) label="paths" ;;
  *"Files>"*) label="files" ;;
  *"Commits>"*) label="commits" ;;
  *"Bookmarks>"*) label="bookmarks" ;;
  *"Recent Files>"*) label="recent files" ;;
  "> "*) label="completions" ;;
  esac
  echo "$FZF_MATCH_COUNT of $FZF_TOTAL_COUNT $label"
}

# fzf picker for recently opened files — opens selected file with view_file or optional editor arg
function fuzzy_recent_files() {
  local VIEW_COMMAND="${1:-}"
  local OUT=$(echo "$(_recent_files)" | fzf +m --prompt="Recent Files> " \
    --preview='batcat --paging=never --style=plain --color=always {} 2>/dev/null || command cat {} 2>/dev/null' --preview-window=right:60%)
  if [ -n "$OUT" ] && [ -f "$OUT" ]; then
    if [ -n "$VIEW_COMMAND" ] && type -P "$VIEW_COMMAND" &> /dev/null; then
      echo "$VIEW_COMMAND \"$OUT\""
      "$VIEW_COMMAND" "$OUT"
    else
      echo "view_file \"$OUT\""
      view_file "$OUT"
    fi
  fi
}

################################################################################
# ---- FZF Advanced Helper Functions ----
################################################################################
# override view_file with editor
function view_file() {
  local editorCmd

  if [[ $# -eq 0 ]]; then
    return 1 # silent exit
  fi

  editorCmd=subl
  echo "$editorCmd $1"
  $editorCmd "$1"
}

################################################################################
# ---- FZF Advanced Helper Functions ----
################################################################################
# ---- Bookmark Fzf Helper Functions ----
BOOKMARK_PATH="$HOME/.${USER}_bookmark"

function add_bookmark() {
  local content
  content=$({
    echo "$1"
    cat "$BOOKMARK_PATH" 2> /dev/null
  } | sort -u)
  echo "$content" > "$BOOKMARK_PATH"
}

function add_bookmark_dir() {
  dir="${1:-$(pwd)}"
  add_bookmark "cd $dir"
}

# Ctrl+B — fuzzy favorite command picker
function fuzzy_favorite_command() {
  local cmd
  cmd=$(cat "$BOOKMARK_PATH" 2> /dev/null | sort -u | fzf --prompt="Bookmarks> " \
    --preview='cmd={};word=$(echo "$cmd" | awk "{print \$1}"); type "$word" 2>&1; echo ""; echo "---"; echo "$cmd"' \
    --preview-window=right:40% \
    --bind 'f5:reload(cat "$BOOKMARK_PATH" 2>/dev/null | sort -u)')

  if [ -n "$cmd" ]; then
    echo "### Command Selected from Bookmarks ###"
    echo "$cmd"
    eval "$cmd"
    history -s "$cmd"
  fi
}

# ---- File related Fzf Helper Functions ----
# Ctrl+P — fzf cd picker (recent paths on top, then folders)
function _fuzzy_cd_list() {
  local dir="${1:-.}"
  _recent_paths 2> /dev/null
  _fuzzy_list_all "$dir" "folders" "" 10
}
function fuzzy_cd() {
  local dir="${1:-.}"
  local OUT=$(_fuzzy_cd_list "$dir" | awk '!seen[$0]++' | fzf +m --prompt="Paths> " \
    --preview='ls -Cp --color=always {} 2>/dev/null' --preview-window=right:40% \
    --bind "f5:reload(_fuzzy_cd_list '$dir' | awk '!seen[\$0]++')")
  if [ -n "$OUT" ]; then
    if [ -d "$OUT" ]; then
      echo "pwd: $(pwd)"
      echo "cd: $OUT"
      cd "$OUT"
    else
      echo "Path no longer exists: $OUT"
    fi
  fi
}

# Ctrl+T (vim) / Ctrl+Y (default editor) — fzf editor picker for files and directories
function fuzzy_edit() {
  local VIEW_COMMAND="$1"
  local dir="${2:-.}"
  local OUT=$(_fuzzy_list_all "$dir" "paths" "" 10 | fzf --prompt="Files> " \
    --bind "f5:reload(_fuzzy_list_all '$dir' 'paths' '' 10)")

  if [ -z "$OUT" ]; then
    return
  fi

  # check if selection is a directory (trailing /)
  local IS_DIR=false
  if [[ "$OUT" == */ ]]; then
    IS_DIR=true
    OUT="${OUT%/}"
  fi

  local FULL_PATH
  FULL_PATH=$(cd "$(git rev-parse --show-toplevel 2> /dev/null || echo ".")" && realpath "$OUT")

  echo "pwd: $(pwd)"
  echo "cd: $FULL_PATH"

  if [ "$IS_DIR" = true ]; then
    cd "$FULL_PATH"
  elif [ -n "$VIEW_COMMAND" ] && type -P "$VIEW_COMMAND" &> /dev/null; then
    "$VIEW_COMMAND" "$OUT"
  else
    view_file "$OUT"
  fi
}

# Ctrl+G — interactive git log browser with commit preview
function fuzzy_git_show() {
  git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always \
    | fzf --prompt="Commits> " \
      --preview-window=right:60% \
      --preview='hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | head -1);
      git log --color=always --format="%C(yellow)%H%n%C(cyan)Author: %an <%ae>%n%C(green)Date:   %ad%n%n%C(bold white)%s%C(reset)%n%n%b" -1 $hash;
      echo "$LINE_BREAK_HASH";
      git diff-tree --no-commit-id --stat --color=always $hash;
      echo "";
      git diff-tree --no-commit-id -p --color=always $hash' \
      --bind "ctrl-m:execute:(echo {} | grep -o '[a-f0-9]\{7\}' | head -1 | xargs -I % sh -c 'git show --color=always % | (bat --paging=always --style=plain 2>/dev/null || batcat --paging=always --style=plain 2>/dev/null || less -R)')" \
      --bind "f5:reload(git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always)"
}
# SOURCE_END software/scripts/bash-fzf-profile.bash
# SOURCE_BEGIN software/scripts/advanced/editor-launchers-common.bash
# software/scripts/advanced/editor-launchers-common.bash | 2dc048398aca432ac85e44c0fa9ae18a | 2.2 KB | 2026-04-18
# SOURCE_BEGIN software/bootstrap/common-functions.bash
# software/bootstrap/common-functions.bash | d9ed8ad8376248729ca94dc654c98d87 | 8.9 KB | 2026-04-18
# Shared shell functions for run.sh and SH scripts (via SOURCE markers).
# Source of truth — inlined into run.sh via BEGIN/END, included in .sh scripts at runtime.

# safe_source <source> [dest] - Fetches and sources a bash script with syntax validation.
#   source: URL (http/https), absolute path, or relative path
#   dest:   optional local path to store the fetched content (useful for caching URL downloads)
# URLs are downloaded via curl, files are used directly (or copied to dest if given).
# Always validates with bash -n before sourcing.
function safe_source() {
  local src="$1"
  local dest="${2:-}"
  local target="$src"
  case "$src" in
  http://* | https://*)
    target="${dest:-/tmp/bashrc_safe_source_$$.sh}"
    curl -fsSL -o "$target" "$src" 2> /dev/null || {
      echo "[Warning] safe_source download $src failed" >&2
      return 1
    }
    ;;
  *)
    if [ ! -f "$src" ]; then
      echo "[Warning] safe_source $src not found" >&2
      return 1
    fi
    if [ -n "$dest" ]; then
      cp "$src" "$dest" 2> /dev/null
      target="$dest"
    fi
    ;;
  esac
  bash -n "$target" 2> /dev/null && . "$target" || echo "[Warning] source $target failed" >&2
}

# curl_bash_install <url> [script args...] - Runs a curl|bash installer with output
# suppressed. In verbose mode (set -x), stderr is kept visible for debugging.
# Extra args are passed to the install script via bash -s -- <args>.
function curl_bash_install() {
  local url="$1"
  shift
  if [[ $- == *x* ]]; then
    curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  else
    curl -fsSL "$url" | bash -s -- "$@" &> /dev/null
  fi
}

# npm_install_global <pkg> [binary] - Installs an npm package globally. Skips if already installed.
#   pkg:    npm package name (e.g. @google/gemini-cli, yarn)
#   binary: binary name to check (defaults to last segment of pkg, e.g. gemini-cli from @google/gemini-cli)
# Installs to $HOME/.local on the current system. On WSL, also installs to the Windows host
# via cmd.exe. Logs status (Skipped/Success/Error) for each target.
function npm_install_global() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # install for current system
  local _resolved
  _resolved=$(has_persistent_binary "$bin")
  if [ -n "$_resolved" ]; then
    echo ">> $pkg >> Installing with npm global >> Skipped ($_resolved)"
  else
    echo -n ">> $pkg >> Installing with npm global >> "
    if npm install -g --prefix "$HOME/.local" "$pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi

  # install for Windows host via WSL
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    if cmd.exe /c "where $bin" &> /dev/null; then
      echo ">> $pkg >> Installing with npm global (Windows) >> Skipped"
    else
      echo -n ">> $pkg >> Installing with npm global (Windows) >> "
      if cmd.exe /c "npm install -g $pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
  fi
}

# has_persistent_binary <name> - Returns 0 (true) when the binary is found in PATH and is NOT
# inside /tmp/. During run.sh, /tmp/synle/bashrc/node/bin is on PATH (bootstrap node fallback),
# so binaries installed there by a prior run appear installed but are ephemeral. Use this for
# install-skip checks; use plain `type -P` for dependency-available checks where /tmp is fine.
# On success, prints the resolved path to stdout (capture with $()).
function has_persistent_binary() {
  local bin
  bin=$(type -P "$1" 2> /dev/null) || return 1
  [[ "$bin" == /tmp/* ]] && return 1
  echo "$bin"
}

# sudo <args...> - Wrapper that logs the caller and command before executing sudo.
# Helps track which script/function is requesting elevated privileges.
function sudo() {
  echo "[sudo] ${FUNCNAME[1]:-shell}: sudo $*" >&2
  command sudo "$@"
}

# safe_touch <file...> - Creates the file only if it does not exist. Skips existing files to
# avoid updating mtime (which would reset staleness checks). For files inside $HOME,
# fixes ownership to current user if owned by root.
function safe_touch() {
  for f in "$@"; do
    if [ ! -e "$f" ]; then
      command touch "$f"
      echo ">> safe_touch >> $f >> Created"
    elif [[ "$f" == "$HOME"/* ]] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_touch >> $f >> Fixed ownership"
    else
      echo ">> safe_touch >> $f >> Skipped"
    fi
  done
}

# safe_mkdir <dir...> - Creates directories (-p by default), then fixes ownership to
# current user for any resulting dir inside $HOME that is owned by root.
function safe_mkdir() {
  command mkdir -p "$@"
  for f in "$@"; do
    [[ "$f" == -* ]] && continue
    if [[ "$f" == "$HOME"/* ]] && [ -d "$f" ] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_mkdir >> $f >> Fixed ownership"
    else
      echo ">> safe_mkdir >> $f >> OK"
    fi
  done
}

# safe_chown [-R] [user] <path> - Runs sudo chown on a single path only if it exists
# and is not already owned by the target user. Defaults to $USER if no user given.
# Pass -R as the first argument to chown recursively. Always pass one path per call.
# Usage:
#   safe_chown "$HOME/.bashrc"              # chown to $USER
#   safe_chown -R "$HOME/.config"           # chown -R to $USER
#   safe_chown otheruser "$HOME/.bashrc"    # chown to otheruser
#   safe_chown -R otheruser "$HOME/.config" # chown -R to otheruser
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local target_user="$USER"
  if [ -n "$1" ] && [ ! -e "$1" ] && id "$1" &> /dev/null; then
    target_user="$1"
    shift
  fi
  local target_uid
  target_uid=$(id -u "$target_user")
  local f="$1"
  if [ ! -e "$f" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" = "$target_uid" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (already correct)"
  else
    sudo chown $flags "$target_user" "$f"
    echo ">> safe_chown $flags $target_user >> $f >> Done"
  fi
}

# safe_chmod [-R] <mode> <path> - Runs chmod on a single path only if it exists
# and permissions differ from the target mode. Always pass one path per call.
# Pass -R as the first argument to chmod recursively.
# Usage:
#   safe_chmod 700 "$HOME/.ssh"
#   safe_chmod 600 "$HOME/.ssh/id_rsa"
function safe_chmod() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local mode="$1"
  local f="$2"
  if [ ! -e "$f" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%a' "$f" 2> /dev/null || stat -f '%Lp' "$f" 2> /dev/null)" = "$mode" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (already correct)"
  else
    chmod $flags "$mode" "$f"
    echo ">> safe_chmod $flags $mode >> $f >> Done"
  fi
}

# get_github_raw_url <path> - Constructs a GitHub raw content URL for a file in this repo.
# Uses BASH_PROFILE_CODE_REPO_RAW_URL as the base and appends ?raw=1.
# Usage: curl -fsSL "$(get_github_raw_url software/bootstrap/setup.sh)" | bash
function get_github_raw_url() {
  echo "${BASH_PROFILE_CODE_REPO_RAW_URL}/${1}?raw=1"
}

# is_path_stale <path> [max_age_seconds] - Returns 0 (true) when the path is older than
# max_age_seconds or missing. Defaults to 2 weeks (1209600s) when no max age given.
function is_path_stale() {
  ((IS_REFRESH_MODE)) && return 0
  local target="$1"
  local max_age="${2:-1209600}"
  if [ -e "$target" ]; then
    local mtime
    mtime=$(stat -c '%Y' "$target" 2> /dev/null || stat -f '%m' "$target" 2> /dev/null || echo 0)
    [ $(($(date +%s) - mtime)) -gt "$max_age" ] && return 0
    return 1
  fi
  return 0
}

# is_force_refresh_stale [path] - Returns 0 (true) only when IS_FORCE_REFRESH=1 AND the path
# is stale. Defaults to BASH_SYLE_PATH when no path given.
# Used by medium/heavy scripts to avoid unnecessary re-downloads when the install is still fresh.
function is_force_refresh_stale() {
  ! ((IS_FORCE_REFRESH)) && return 1
  ((IS_REFRESH_MODE)) && return 0
  local target="${1:-$BASH_SYLE_PATH}"
  if is_path_stale "$target"; then return 0; fi
  echo ">> Force refresh skipped (not stale): $target"
  return 1
}

# is_bash_syle_stale - Returns 0 (true) when ~/.bash_syle is older than 2 weeks or missing.
# Used by dependency scripts to skip package index updates.
function is_bash_syle_stale() {
  is_path_stale "$BASH_SYLE_PATH"
}

# exit_if_limited_support_os - Exits the script if the current OS is a limited-support
# platform (LIMITED_SUPPORT_OSES) or if IS_LIGHT_WEIGHT_MODE is enabled.
function exit_if_limited_support_os() {
  ((IS_LIGHT_WEIGHT_MODE)) && {
    echo ">>> Skipped : Lightweight mode"
    exit 0
  }
  local IFS=','
  for os_flag in $LIMITED_SUPPORT_OSES; do
    ((${os_flag:-0})) && {
      echo ">>> Skipped : Not supported on $os_flag"
      exit 0
    }
  done
}
# SOURCE_END software/bootstrap/common-functions.bash
# Resolve editor binary from a list of candidate paths (delegates to find_path exec mode)
function find_editor() {
  local editor_name="$1"
  shift
  local result
  result=$(find_path "$@" --exec) && echo "$result" && return 0
  echo "Error: $editor_name not found in search paths." >&2
  return 1
}

# Launch an editor in the background (GUI mode)
function run_editor() {
  local editor_name="$1"
  shift
  local target_binary
  target_binary=$(find_editor "$editor_name" "$@") || return 1

  # track opened files for recent file history
  type _track_file &> /dev/null && _track_file "${editor_args[@]}"

  # Prepare a new array for the converted paths
  local converted_args=()
  local unresolved_path=""
  local resolved_path=""

  for arg in "${editor_args[@]}"; do
    # Check if the argument is a path (starts with / or .)
    if [[ "$arg" == /* ]] || [[ "$arg" == .* ]]; then
      unresolved_path=$(realpath "$arg")
      if ((is_os_windows)); then
        resolved_path=$(wslpath -m "$arg")
      else
        resolved_path="$unresolved_path"
      fi
      converted_args+=("$resolved_path")
    else
      converted_args+=("$arg")
    fi
  done

  if ((is_os_windows)); then
    # Use the converted_args here
    (nohup "$target_binary" "${converted_args[@]}" > /dev/null 2>&1 &)
  else
    # If not a Windows window, you might still want standard args
    # or the same conversion depending on your setup
    (nohup "$target_binary" "${editor_args[@]}" > /dev/null 2>&1 &)
  fi

  local dir=""
  if [[ -n "$unresolved_path" ]]; then
    dir=$(dirname "$unresolved_path")
  fi

  echo "
====================================
\"$target_binary\" ${editor_args[@]}
PWD:           $(pwd)
Dir:           $dir
Path:          $unresolved_path
Resolved Path: $resolved_path
====================================
  "
}

# Run an editor command in the foreground (CLI mode, stdout preserved)
function run_editor_cli() {
  local editor_name="$1"
  shift
  local target_binary
  target_binary=$(find_editor "$editor_name" "${editor_paths[@]}") || return 1

  # track opened files for recent file history
  type _track_file &> /dev/null && _track_file "$@"

  "$target_binary" "$@"
}
# SOURCE_END software/scripts/advanced/editor-launchers-common.bash
# BEGIN Editor Launchers - Vim
_VIM_PATHS=(
  /usr/bin/vim
  /usr/local/bin/vim
  /opt/homebrew/bin/vim
)

vim() {
  local editor_paths=("${_VIM_PATHS[@]}")
  run_editor_cli "vim" "$@"
}
# END Editor Launchers - Vim
# BEGIN Editor Launchers - Sublime Text
_SUBL_PATHS=(
  "/Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl"
"/Applications/Sublime*Text.app/Contents/MacOS/sublime_text"
"/mnt/c/Program*Files/Sublime*Text*/sublime*.exe"
"/mnt/c/Program*Files/Sublime*Text*/subl*.exe"
"/mnt/c/Users/*/AppData/Local/Programs/Sublime*Text/sublime*.exe"
"/opt/sublime_text/subl*"
"/usr/bin/subl"
"/usr/local/bin/subl"
)

subl() {
  local editor_args
  # editor_args=("-n" "$@") # -n: always open a new window
  # editor_args=("-a" "$@") # -a: add to last active window (merges into existing project)
  editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

  run_editor "subl" "${_SUBL_PATHS[@]}"
}
# END Editor Launchers - Sublime Text
# BEGIN Editor Launchers - Sublime Merge
_SMERGE_PATHS=(
  /Applications/Sublime*Merge.app/Contents/SharedSupport/bin/smerge
/mnt/c/Program*Files/Sublime*Merge*/smerge.exe
/mnt/c/Program*Files/Sublime*Merge*/sublime_merge.exe
/mnt/c/Users/*/AppData/Local/Programs/Sublime*Merge/smerge.exe
/opt/sublime_merge/smerge
/usr/bin/smerge
/usr/local/bin/smerge
)

smerge() {
  local editor_args
  editor_args=("$@")

  run_editor "smerge" "${_SMERGE_PATHS[@]}"
}
# END Editor Launchers - Sublime Merge
# BEGIN Editor Launchers - VS Code
_CODE_PATHS=(
  /Applications/Visual*Studio*Code.app/Contents/Resources/app/bin/code
/Applications/Visual*Studio*Code*Insiders.app/Contents/Resources/app/bin/code
/opt/homebrew/bin/code
/usr/local/bin/code
/mnt/c/Users/*/AppData/Local/Programs/Microsoft*Code/Code.exe
/mnt/c/Users/*/AppData/Local/Programs/Microsoft*Code*Insiders/Code*.exe
/mnt/c/Program*Files/Microsoft*VS*Code/Code.exe
/usr/bin/code
/usr/local/bin/code
/snap/bin/code
)

code() {
  local editor_args
  # editor_args=("-n" "$@") # -n: always open a new window
  # editor_args=("-r" "$@") # -r: reuse last active window (replaces current project)
  editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

  run_editor "code" "${_CODE_PATHS[@]}"
}

code_list_extensions(){
  local editor_paths=("${_CODE_PATHS[@]}")
  run_editor_cli "code" --list-extensions
}
# END Editor Launchers - VS Code
# BEGIN Editor Launchers - Zed
_ZED_PATHS=(
  /Applications/Zed.app/Contents/MacOS/cli
/usr/local/bin/zed
/opt/homebrew/bin/zed
/mnt/c/Program*Files/Zed*/zed.exe
/mnt/c/Users/*/AppData/Local/Programs/Zed*/zed.exe
/mnt/c/Users/*/AppData/Local/Zed*/zed.exe
/usr/bin/zed
/usr/local/bin/zed
~/.local/bin/zed
)

zed() {
  local editor_args
  editor_args=("$@")

  run_editor "zed" "${_ZED_PATHS[@]}"
}
# END Editor Launchers - Zed

# BEGIN starship prompt
if type -P starship &> /dev/null; then
  # init starship first so it sets up its own PROMPT_COMMAND
  eval "$(starship init bash --print-full-init)"

  # plain time helper for starship env vars (no PS1 ANSI wrappers)
  # get_time() uses \001/\002 escapes that only work inside PS1
  function _starship_time() {
    local tz="$1"
    local time_str ampm
    if [ "$tz" = "UTC" ]; then
      time_str=$(command date -u +'%I:%M:%S')
      ampm=$(command date -u +'%p')
    elif [ -n "$tz" ]; then
      time_str=$(TZ="$tz" command date +'%I:%M:%S')
      ampm=$(TZ="$tz" command date +'%p')
    else
      time_str=$(command date +'%I:%M:%S')
      ampm=$(command date +'%p')
    fi
    printf '%s%s' "$time_str" "$ampm"
  }

  # get active python path shortened and version for prompt display
  # includes venv name prefix when a virtual environment is active
  function _starship_python_info() {
    local py_bin
    py_bin="$(type -P python3 2>/dev/null || type -P python 2>/dev/null)" || return
    [ -z "$py_bin" ] && return
    local py_ver
    py_ver="$("$py_bin" --version 2>&1)" || return
    py_ver="${py_ver##* }"
    local py_path
    py_path="$(readlink -f "$py_bin" 2>/dev/null || echo "$py_bin")"
    IFS='/' read -r -a parts <<< "$py_path"
    local total=${#parts[@]}
    local result=""
    local i
    for ((i=0; i<total; i++)); do
      [ -z "${parts[i]}" ] && continue
      if ((i < total - 3)); then
        result+="/${parts[i]:0:1}"
      else
        result+="/${parts[i]}"
      fi
    done
    local venv_prefix=""
    if [ -n "$VIRTUAL_ENV" ]; then
      venv_prefix="(${VIRTUAL_ENV##*/}) "
    fi
    printf '%s[%s:%s]' "$venv_prefix" "$result" "$py_ver"
  }

  # get active node path shortened and version for prompt display
  function _starship_node_info() {
    local node_bin
    node_bin="$(type -P node 2>/dev/null)" || return
    [ -z "$node_bin" ] && return
    local node_ver
    node_ver="$("$node_bin" --version 2>&1)" || return
    node_ver="${node_ver#v}"
    local node_path
    node_path="$(readlink -f "$node_bin" 2>/dev/null || echo "$node_bin")"
    IFS='/' read -r -a parts <<< "$node_path"
    local total=${#parts[@]}
    local result=""
    local i
    for ((i=0; i<total; i++)); do
      [ -z "${parts[i]}" ] && continue
      if ((i < total - 3)); then
        result+="/${parts[i]:0:1}"
      else
        result+="/${parts[i]}"
      fi
    done
    printf '[%s:%s]' "$result" "$node_ver"
  }

  # update starship env vars before each prompt render
  # must be defined after starship init so it doesn't get overwritten
  function _starship_preexec() {
    export STARSHIP_LOCAL_TIME="$(_starship_time)"
    export STARSHIP_UTC_TIME="$(_starship_time 'UTC')"
    export STARSHIP_IP_ADDR="$(ifconfig2)"
    export STARSHIP_SHORT_PWD="$(shorter_pwd_path)"
    # disabled: python/node path:version info (uncomment to re-enable)
    # local _py_info
    # _py_info="$(_starship_python_info)"
    # if [ -n "$_py_info" ]; then
    #   export STARSHIP_PYTHON_INFO="$_py_info"
    # else
    #   unset STARSHIP_PYTHON_INFO
    # fi
    # local _node_info
    # _node_info="$(_starship_node_info)"
    # if [ -n "$_node_info" ]; then
    #   export STARSHIP_NODE_INFO="$_node_info"
    # else
    #   unset STARSHIP_NODE_INFO
    # fi
  }
  starship_precmd_user_func="_starship_preexec"

  # bash version is static, set once
  export STARSHIP_BASH_VER="$BASH_VERSINFO.$(echo "$BASH_VERSION" | cut -d. -f2)"

  # run once immediately so the first prompt has values
  _starship_preexec
fi
# END starship prompt
# BEGIN zoxide init
type -P zoxide &>/dev/null && eval "$(zoxide init bash --cmd cd)"
# END zoxide init
################################################################################
# ---- Spec-based Autocomplete (bash-autocomplete-complete-spec.js) ----
################################################################################
# BEGIN Spec Autocomplete
# Shared spec-based autocomplete helpers: token expansion, COMPREPLY population, and utility functions.
# convert newline-delimited stdin to a space-separated string for compgen -W
function __to_opts() { tr '\n' ' '; }
# same as __to_opts but deduplicates and sorts first
function __to_opts_sorted() { sort -u | __to_opts; }
# same as __to_opts but escapes spaces for filesystem paths (e.g. "Display DJ.app")
function __to_path_opts() { sed 's/ /\\ /g' | __to_opts; }
# shared tab-completion handler — resolves spec data, expands dynamic tokens
# (git branches, files, npm scripts, etc.), and populates COMPREPLY.
# usage: __spec_complete "$spec_data" "$max_depth"
function __spec_complete() {
  local spec_data="$1"
  local _max_depth="$2"
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local opts=""

  if [ -n "$spec_data" ]; then
    # build the subcommand prefix from COMP_WORDS, skipping the command name (COMP_WORDS[0])
    # try longest prefix first (e.g. "rollout status"), then shorter (e.g. "rollout")
    local i matched=0
    for ((i = COMP_CWORD; i >= 2; i--)); do
      local prefix="${COMP_WORDS[*]:1:i-1}"
      local line
      line=$(command grep -m1 "^$prefix|" <<< "$spec_data")
      if [ -n "$line" ]; then
        opts="$(echo "$line" | cut -d'|' -f2- | tr ',' ' ')"
        matched=1
        break
      fi
    done

    # base command: infer subcommands from all left-of-| values, plus any |... base line for extra completions
    if [ "$matched" = "0" ]; then
      opts=$(cut -d'|' -f1 <<< "$spec_data" | command grep -v '^$' | awk '{print $1}' | __to_opts_sorted)
      local base_line
      base_line=$(command grep -m1 "^|" <<< "$spec_data")
      if [ -n "$base_line" ]; then
        opts="$opts $(echo "$base_line" | cut -d'|' -f2- | tr ',' ' ')"
      fi
    fi
  fi

  # expand dynamic tokens: __git_branches__, __git_files__, __git_remotes__
  if [[ "$opts" == *"__git_branches__"* ]]; then
    local branches=$(git branch --no-color 2> /dev/null | sed 's/^[* ]*//' | __to_opts)
    local remote_branches=$(git branch -r --no-color 2> /dev/null | sed 's/^[* ]*//' | sed 's|origin/||' | command grep -v HEAD | __to_opts)
    opts="${opts//__git_branches__/} $branches $remote_branches"
  fi
  if [[ "$opts" == *"__git_files__"* ]]; then
    local files=$(git diff --name-only 2> /dev/null | __to_path_opts)
    local untracked=$(git ls-files --others --exclude-standard 2> /dev/null | __to_path_opts)
    opts="${opts//__git_files__/} $files $untracked"
  fi
  if [[ "$opts" == *"__git_remotes__"* ]]; then
    local remotes=$(git remote 2> /dev/null | __to_opts)
    opts="${opts//__git_remotes__/} $remotes"
  fi
  # expand git flag tokens (static flag lists)
  if [[ "$opts" == *"__git_head_refs__"* ]]; then
    local head_refs="HEAD"
    local i carets
    for i in $(seq 1 100); do head_refs="$head_refs HEAD~$i"; done
    carets="^"
    for i in $(seq 1 10); do
      head_refs="$head_refs HEAD$carets"
      carets="$carets^"
    done
    opts="${opts//__git_head_refs__/} $head_refs"
  fi
  if [[ "$opts" == *"__git_commits__"* ]]; then
    local commits=$(git log --format='%h' -500 2> /dev/null | __to_opts)
    opts="${opts//__git_commits__/} $commits"
  fi
  if [[ "$opts" == *"__git_add_flags__"* ]]; then
    opts="${opts//__git_add_flags__/} --all -A --patch -p --update -u --force -f --intent-to-add -N --dry-run -n --verbose -v --edit -e"
  fi
  if [[ "$opts" == *"__git_branch_flags__"* ]]; then
    opts="${opts//__git_branch_flags__/} --all -a --delete -d -D --force -f --move -m -M --copy -c --list -l --remotes -r --verbose -v --set-upstream-to -u --unset-upstream --sort --contains --no-contains --merged --no-merged --show-current --track -t --no-track"
  fi
  if [[ "$opts" == *"__git_commit_flags__"* ]]; then
    opts="${opts//__git_commit_flags__/} --all -a --message -m --amend --no-edit --allow-empty --no-verify --fixup --squash --signoff -s --verbose -v --dry-run --patch -p --author --date"
  fi
  if [[ "$opts" == *"__git_diff_flags__"* ]]; then
    opts="${opts//__git_diff_flags__/} --staged --cached --word-diff --stat --name-only --name-status --no-index --color --no-color --ignore-all-space -w --ignore-space-change -b --compact-summary --diff-filter"
  fi
  if [[ "$opts" == *"__git_log_flags__"* ]]; then
    opts="${opts//__git_log_flags__/} --oneline --graph --all --stat --patch -p --follow --author --since --until --grep -n --decorate --abbrev-commit --date --format --no-merges --first-parent --reverse"
  fi
  if [[ "$opts" == *"__git_show_flags__"* ]]; then
    opts="${opts//__git_show_flags__/} --stat --name-only --name-status --format --patch -p --word-diff -w --no-patch --abbrev-commit --color --no-color"
  fi
  if [[ "$opts" == *"__git_rebase_flags__"* ]]; then
    opts="${opts//__git_rebase_flags__/} --abort --continue --skip --interactive -i --onto --reapply-cherry-picks --autosquash --no-autosquash --exec -x --update-refs --keep-base --quit --edit-todo"
  fi
  if [[ "$opts" == *"__npm_scripts__"* ]]; then
    local scripts=$(node -e "try{console.log(Object.keys(require('./package.json').scripts).join(' '))}catch(e){}" 2> /dev/null)
    opts="${opts//__npm_scripts__/} $scripts"
  fi
  if [[ "$opts" == *"__makefile_targets__"* ]]; then
    local targets=$([ -f Makefile ] && command grep -o '^[a-zA-Z0-9_-][a-zA-Z0-9_-]*:' Makefile | sed 's/://' | __to_opts_sorted)
    opts="${opts//__makefile_targets__/} $targets"
  fi
  if [[ "$opts" == *"__cargo_targets__"* ]]; then
    local cargo_targets=""
    if [ -f Cargo.toml ]; then
      cargo_targets=$(command grep -o '^\[\[bin\]\]' Cargo.toml > /dev/null 2>&1 && command grep 'name\s*=' Cargo.toml | sed 's/.*name\s*=\s*"\([^"]*\)".*/\1/' | __to_opts_sorted)
      cargo_targets="$cargo_targets $(command grep -o '^\[package\]' Cargo.toml > /dev/null 2>&1 && command grep 'name\s*=' Cargo.toml | head -1 | sed 's/.*name\s*=\s*"\([^"]*\)".*/\1/')"
    fi
    opts="${opts//__cargo_targets__/} $cargo_targets"
  fi
  if [[ "$opts" == *"__python_scripts__"* ]]; then
    local py_scripts=""
    if [ -f pyproject.toml ]; then
      py_scripts=$(command grep -A50 '^\[project.scripts\]' pyproject.toml 2> /dev/null | tail -n +2 | command grep -o '^[a-zA-Z0-9_-][a-zA-Z0-9_-]*' | __to_opts)
      py_scripts="$py_scripts $(command grep -A50 '^\[tool.poetry.scripts\]' pyproject.toml 2> /dev/null | tail -n +2 | command grep -o '^[a-zA-Z0-9_-][a-zA-Z0-9_-]*' | __to_opts)"
    fi
    opts="${opts//__python_scripts__/} $py_scripts"
  fi
  if [[ "$opts" == *"__gradle_tasks__"* ]]; then
    local gradle_tasks=""
    if [ -f build.gradle ] || [ -f build.gradle.kts ]; then
      if [ -x ./gradlew ]; then
        gradle_tasks=$(./gradlew tasks --all --quiet 2> /dev/null | command grep -o '^[a-zA-Z0-9:_-][a-zA-Z0-9:_-]*' | __to_opts_sorted)
      elif type -P gradle &> /dev/null; then
        gradle_tasks=$(gradle tasks --all --quiet 2> /dev/null | command grep -o '^[a-zA-Z0-9:_-][a-zA-Z0-9:_-]*' | __to_opts_sorted)
      fi
    fi
    opts="${opts//__gradle_tasks__/} $gradle_tasks"
  fi
  if [[ "$opts" == *"__composer_scripts__"* ]]; then
    local composer_scripts=""
    if [ -f composer.json ]; then
      composer_scripts=$(node -e "try{console.log(Object.keys(require('./composer.json').scripts).join(' '))}catch(e){}" 2> /dev/null)
    fi
    opts="${opts//__composer_scripts__/} $composer_scripts"
  fi
  if [[ "$opts" == *"__tldr_commands__"* ]]; then
    local tldr_cmds=$(type -P tldr &> /dev/null && tldr --list 2> /dev/null | __to_opts)
    opts="${opts//__tldr_commands__/} $tldr_cmds"
  fi
  if [[ "$opts" == *"__ssh_hosts__"* ]]; then
    local ssh_hosts=""
    if [ -f "$HOME/.ssh/config" ]; then
      ssh_hosts=$(command grep -i '^Host ' "$HOME/.ssh/config" | awk '{for(i=2;i<=NF;i++) print $i}' | command grep -v '[*?]' | __to_opts_sorted)
    fi
    if [ -d "$HOME/.ssh/config.d" ]; then
      local extra_hosts=$(command grep -i '^Host ' "$HOME/.ssh/config.d"/* 2> /dev/null | awk '{for(i=2;i<=NF;i++) print $i}' | command grep -v '[*?]' | __to_opts_sorted)
      ssh_hosts="$ssh_hosts $extra_hosts"
    fi
    opts="${opts//__ssh_hosts__/} $ssh_hosts"
  fi

  # expand filesystem tokens: __files__, __folders__, __paths__
  if [[ "$opts" == *"__files__"* ]]; then
    local cur_dir="${cur%/*}/"
    [ "$cur_dir" = "$cur/" ] && cur_dir=""
    local file_list=$(compgen -f -- "$cur" 2> /dev/null | command grep -v '/$' | __to_path_opts)
    opts="${opts//__files__/} $file_list"
  fi
  if [[ "$opts" == *"__folders__"* ]]; then
    local folder_list=$(compgen -d -- "$cur" 2> /dev/null | __to_path_opts)
    opts="${opts//__folders__/} $folder_list"
  fi
  # resolve base directory from cur (supports ~/path, ../path, /abs/path)
  # example: cur="bashrc/.build" => _nested_prefix="bashrc/", _nested_dir="bashrc/"
  # _fuzzy_list_all runs from _nested_dir and returns relative paths (e.g. ".build/")
  # results are then prefixed with _nested_prefix (e.g. "bashrc/.build/") so compgen
  # can match against the full cur value. when cur has no slash, prefix is empty (no-op).
  local _nested_dir="" _nested_prefix=""
  if [[ "$cur" == */* ]]; then
    _nested_prefix="${cur%/*}/"
    _nested_dir="$_nested_prefix"
    [[ "$_nested_dir" == \~* ]] && eval _nested_dir="$_nested_dir" 2> /dev/null
  fi
  if [[ "$opts" == *"__nested_"* ]]; then
    local _nested_base="${_nested_dir:-.}"
    local _nested_filter="${cur#"$_nested_prefix"}"
    if [[ "$opts" == *"__nested_text_files__"* ]]; then
      local nested_text_files=$(_fuzzy_list_all "$_nested_base" "text_files" "$_max_depth" "" "$_nested_filter" | command sed "s|^|${_nested_prefix}|" | __to_path_opts)
      opts="${opts//__nested_text_files__/} $nested_text_files"
    fi
    if [[ "$opts" == *"__nested_files__"* ]]; then
      local nested_files=$(_fuzzy_list_all "$_nested_base" "files" "$_max_depth" "" "$_nested_filter" | command sed "s|^|${_nested_prefix}|" | __to_path_opts)
      opts="${opts//__nested_files__/} $nested_files"
    fi
    if [[ "$opts" == *"__nested_folders__"* ]]; then
      local nested_folders=$(_fuzzy_list_all "$_nested_base" "folders" "$_max_depth" "" "$_nested_filter" | command sed "s|^|${_nested_prefix}|" | __to_path_opts)
      opts="${opts//__nested_folders__/} $nested_folders"
    fi
    if [[ "$opts" == *"__nested_paths__"* ]]; then
      local nested_paths=$(_fuzzy_list_all "$_nested_base" "paths" "$_max_depth" "" "$_nested_filter" | command sed "s|^|${_nested_prefix}|" | __to_path_opts)
      opts="${opts//__nested_paths__/} $nested_paths"
    fi
  fi
  if [[ "$opts" == *"__paths__"* ]]; then
    local path_list=$(compgen -f -- "$cur" 2> /dev/null | __to_path_opts)
    opts="${opts//__paths__/} $path_list"
  fi

  # expand tilde in cur so compgen -W can match expanded filesystem paths
  local expanded_cur="$cur"
  if [[ "$cur" == \~* ]]; then
    eval expanded_cur="$cur" 2> /dev/null
  fi

  mapfile -t COMPREPLY < <(compgen -W "$opts" -- "$expanded_cur")

  # restore tilde prefix in results so readline inserts ~/... not /Users/...
  if [[ "$cur" == \~* && "$expanded_cur" != "$cur" ]]; then
    local i
    for i in "${!COMPREPLY[@]}"; do
      COMPREPLY[$i]="${COMPREPLY[$i]/#$HOME/\~}"
    done
  fi

  # reorder: non-options first, then --flags last
  if [ "${#COMPREPLY[@]}" -gt 1 ]; then
    local _non_opts=() _flag_opts=()
    local _item
    for _item in "${COMPREPLY[@]}"; do
      if [[ "$_item" == --* ]]; then
        _flag_opts+=("$_item")
      else
        _non_opts+=("$_item")
      fi
    done
    COMPREPLY=()
    [ ${#_non_opts[@]} -gt 0 ] && COMPREPLY+=("${_non_opts[@]}")
    [ ${#_flag_opts[@]} -gt 0 ] && COMPREPLY+=("${_flag_opts[@]}")
  fi
}

# BEGIN cat Spec Autocomplete
################################################################################
# cat (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_cat() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_files__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_cat cat 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_cat cat
fi
# END cat Spec Autocomplete

# BEGIN bat Spec Autocomplete
################################################################################
# bat (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_bat() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_files__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_bat bat 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_bat bat
fi
# END bat Spec Autocomplete

# BEGIN batcat Spec Autocomplete
################################################################################
# batcat (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_batcat() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_files__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_batcat batcat 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_batcat batcat
fi
# END batcat Spec Autocomplete

# BEGIN less Spec Autocomplete
################################################################################
# less (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_less() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_files__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_less less 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_less less
fi
# END less Spec Autocomplete

# BEGIN vim Spec Autocomplete
################################################################################
# vim (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_vim() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_paths__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_vim vim 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_vim vim
fi
# END vim Spec Autocomplete

# BEGIN code Spec Autocomplete
################################################################################
# code (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_code() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_paths__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_code code 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_code code
fi
# END code Spec Autocomplete

# BEGIN subl Spec Autocomplete
################################################################################
# subl (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_subl() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_paths__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_subl subl 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_subl subl
fi
# END subl Spec Autocomplete

# BEGIN zed Spec Autocomplete
################################################################################
# zed (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_zed() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_paths__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_zed zed 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_zed zed
fi
# END zed Spec Autocomplete

# BEGIN cd Spec Autocomplete
################################################################################
# cd (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_cd() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_folders__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_cd cd 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_cd cd
fi
# END cd Spec Autocomplete

# BEGIN eza Spec Autocomplete
################################################################################
# eza (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_eza() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_folders__,--long,--all,--almost-all,--list-dirs,--recurse,--tree,--level,--classify,--color,--colour,--color-scale,--colour-scale,--color-scale-mode,--colour-scale-mode,--icons,--no-icons,--hyperlink,--absolute,--group-directories-first,--group,--header,--binary,--bytes,--time-style,--modified,--changed,--accessed,--created,--sort,--reverse,--no-sort,--oldest,--newest,--smallest,--largest,--git,--git-repos,--git-repos-no-status,--no-git,--no-permissions,--no-filesize,--no-user,--no-time,--octal-permissions,--numeric,--inode,--links,--blocksize,--blocks,--width,--oneline,--grid,--across,--total-size,--smart-group
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_eza eza 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_eza eza
fi
# END eza Spec Autocomplete

# BEGIN ls Spec Autocomplete
################################################################################
# ls (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_ls() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__nested_folders__,--long,--all,--almost-all,--list-dirs,--recurse,--tree,--level,--classify,--color,--colour,--icons,--no-icons,--hyperlink,--absolute,--group-directories-first,--group,--header,--binary,--bytes,--time-style,--modified,--changed,--accessed,--created,--sort,--reverse,--no-sort,--oldest,--newest,--smallest,--largest,--git,--oneline,--grid,--across
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_ls ls 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_ls ls
fi
# END ls Spec Autocomplete

# BEGIN tree Spec Autocomplete
################################################################################
# tree (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_tree() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|--all,--dirs-only,--full-path,--ignore-case,--follow,--no-report,--charset,--filelimit,--timefmt,--noreport,--prune,--matchdirs,--metafirst,--info,--infofile,--dirsfirst,--filesfirst,--sort,--du,--si,--inodes,--device,--nolinks,--hintro,--houtro
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_tree tree 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_tree tree
fi
# END tree Spec Autocomplete

# BEGIN zoxide Spec Autocomplete
################################################################################
# zoxide (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_zoxide() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
add
edit
import|--from,--merge
init|bash,zsh,fish,nushell,powershell,--cmd,--hook,--no-cmd
query|--all,--exclude,--interactive,--list,--score
remove
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_zoxide zoxide 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_zoxide zoxide
fi
# END zoxide Spec Autocomplete

# BEGIN fd Spec Autocomplete
################################################################################
# fd (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_fd() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|--hidden,-H,--no-ignore,-I,--no-ignore-vcs,--no-ignore-parent,--unrestricted,-u,--case-sensitive,-s,--ignore-case,-i,--glob,-g,--regex,-r,--fixed-strings,-F,--and,--type,-t,--extension,-e,--exact-depth,--min-depth,--max-depth,-d,--exclude,-E,--ignore-file,--color,--threads,-j,--size,-S,--changed-within,--changed-before,--owner,-o,--exec,-x,--exec-batch,-X,--batch-size,--list-details,-l,--follow,-L,--full-path,-p,--absolute-path,-a,--relative-path,--path-separator,--search-path,--base-directory,--one-file-system,--prune,--show-errors,--strip-cwd-prefix,--no-append-path,--quiet,-q,--max-results,--max-buffer-time,--print0,-0,--format,-f,--hyperlink
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_fd fd 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_fd fd
fi
# END fd Spec Autocomplete

# BEGIN jq Spec Autocomplete
################################################################################
# jq (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_jq() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|--raw-output,-r,--raw-output0,--join-output,-j,--compact-output,-c,--slurp,-s,--raw-input,-R,--null-input,-n,--exit-status,-e,--sort-keys,-S,--tab,--indent,--arg,--argjson,--slurpfile,--jsonargs,--args,--color-output,-C,--monochrome-output,-M,--ascii-output,-a,--from-file,-f,--jsonargs,--yaml-output,-y,--yaml-roundtrip,-Y
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_jq jq 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_jq jq
fi
# END jq Spec Autocomplete

# BEGIN rg Spec Autocomplete
################################################################################
# rg (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_rg() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|--regexp,-e,--file,-f,--ignore-case,-i,--case-sensitive,-s,--smart-case,-S,--fixed-strings,-F,--word-regexp,-w,--line-regexp,-x,--invert-match,-v,--count,-c,--count-matches,--files-with-matches,-l,--files-without-match,--files,--json,--no-filename,--with-filename,-H,--no-heading,--heading,--hidden,--no-ignore,--no-ignore-vcs,--glob,-g,--iglob,--type,-t,--type-not,-T,--type-list,--type-add,--type-clear,--max-count,-m,--max-depth,--max-filesize,--max-columns,-M,--one-file-system,--follow,-L,--multiline,-U,--multiline-dotall,--null-data,--null,-0,--only-matching,-o,--passthru,--pretty,-p,--replace,-r,--search-zip,-z,--sort,--sortr,--stats,--trim,--vimgrep,--after-context,-A,--before-context,-B,--context,-C,--color,--colors,--column,--context-separator,--dfa-size-limit,--encoding,-E,--engine,--field-context-separator,--field-match-separator,--hyperlink-format,--include-zero,--line-buffered,--line-number,-n,--no-line-number,-N,--no-messages,--no-mmap,--no-pcre2-unicode,--no-unicode,--path-separator,--pcre2,--pcre2-version,--pre,--pre-glob,--quiet,-q,--regex-size-limit,--stop-on-nonmatch,--text,-a,--threads,-j,--unrestricted,-u
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_rg rg 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_rg rg
fi
# END rg Spec Autocomplete

# BEGIN delta Spec Autocomplete
################################################################################
# delta (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_delta() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|--blame-code-style,--blame-format,--blame-palette,--blame-separator-format,--blame-separator-style,--blame-timestamp-format,--blame-timestamp-output-format,--color-only,--commit-decoration-style,--commit-regex,--commit-style,--dark,--default-language,--diff-highlight,--diff-so-fancy,--diff-stat-align-width,--features,--file-added-label,--file-copied-label,--file-decoration-style,--file-modified-label,--file-removed-label,--file-renamed-label,--file-style,--file-transformation,--grep-context-line-style,--grep-file-style,--grep-header-decoration-style,--grep-header-file-style,--grep-line-number-style,--grep-match-line-style,--grep-match-word-style,--grep-output-type,--grep-separator-symbol,--hunk-header-decoration-style,--hunk-header-file-style,--hunk-header-line-number-style,--hunk-header-style,--hunk-label,--hyperlinks,--hyperlinks-commit-link-format,--hyperlinks-file-link-format,--inline-hint-style,--inspect-raw-lines,--keep-plus-minus-markers,--light,--line-buffer-size,--line-fill-method,--line-numbers,--line-numbers-left-format,--line-numbers-left-style,--line-numbers-minus-style,--line-numbers-plus-style,--line-numbers-right-format,--line-numbers-right-style,--line-numbers-zero-style,--list-languages,--list-syntax-themes,--map-styles,--max-line-distance,--max-line-length,--merge-conflict-begin-symbol,--merge-conflict-end-symbol,--merge-conflict-ours-diff-header-decoration-style,--merge-conflict-ours-diff-header-style,--merge-conflict-theirs-diff-header-decoration-style,--merge-conflict-theirs-diff-header-style,--minus-empty-line-marker-style,--minus-emph-style,--minus-non-emph-style,--minus-style,--navigate,--navigate-regex,--no-gitconfig,--pager,--paging,--parse-ansi,--plus-emph-style,--plus-empty-line-marker-style,--plus-non-emph-style,--plus-style,--raw,--relative-paths,--right-arrow,--show-colors,--show-config,--show-syntax-themes,--show-themes,--side-by-side,-s,--syntax-theme,--tabs,--true-color,--whitespace-error-style,--width,-w,--word-diff-regex,--wrap-left-symbol,--wrap-max-lines,--wrap-right-percent,--wrap-right-prefix,--wrap-right-symbol,--zero-style,-n,-p
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_delta delta 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_delta delta
fi
# END delta Spec Autocomplete

# BEGIN g Spec Autocomplete
################################################################################
# g (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_g() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
aa|__git_files__,__git_add_flags__
abort|push,pop,apply,drop,list,show,clear,--patch,-p,--include-untracked,-u,--keep-index,-k,--message,-m
add|__git_files__,__git_add_flags__
amendm|__git_commit_flags__
amend|__git_commit_flags__
ap|__git_files__,__git_add_flags__
au|__git_files__,__git_add_flags__
a|__git_files__,__git_add_flags__
ba|__git_branches__,__git_branch_flags__
bisect|start,bad,good,reset,skip,log,run
branch|__git_branches__,__git_branch_flags__
b|__git_branches__,__git_branch_flags__
checkout|__git_branches__,__git_files__,--force,-f,-b,-B,--track,-t,--detach,--orphan,--ours,--theirs,--merge,-m,--patch,-p
cherry-pick|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m
cl0|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
cl1|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
clean-and-fetch|--global,--local,--system,--list,-l,--get,--unset,--edit,-e
cleanfd
clean|--force,-f,-d,--dry-run,-n,--interactive,-i,-x,-X
clone0|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
clone1|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
clone|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
cm|__git_commit_flags__
cob|__git_branches__,__git_files__
commit|__git_commit_flags__
config|--global,--local,--system,--list,-l,--get,--unset,--edit,-e
cop|__git_branches__,__git_files__
co|__git_branches__,__git_files__
cpc|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m
cpn|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m
cp|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m
current|__git_branches__,__git_branch_flags__
c|__git_commit_flags__
d1
del|__git_branches__,__git_branch_flags__
dh1
dhs|__git_files__,__git_diff_flags__
dh|__git_files__,__git_diff_flags__
diff|__git_files__,__git_diff_flags__
ds1
ds|__git_files__,__git_diff_flags__
d|__git_files__,__git_diff_flags__
fapr|--global,--local,--system,--list,-l,--get,--unset,--edit,-e
fap|__git_remotes__
fetch|__git_remotes__,--all,--prune,-p,--tags,--no-tags,--force,-f,--depth,--shallow-since,--dry-run
gone|__git_branches__,__git_branch_flags__
hash|__git_branches__,__git_files__
init|--bare,--template,--initial-branch,-b
l
lastd|__git_log_flags__
last|__git_log_flags__
ll
lls
logbaseline|__git_log_flags__
log|__git_log_flags__
ls
mc|__git_branches__
merge|__git_branches__,--abort,--continue,--no-ff,--ff-only,--squash,--no-commit,--strategy,-s,--no-verify
mv|--force,-f,--dry-run,-n,--verbose,-v
ours|__git_branches__,__git_files__
our|__git_branches__,__git_files__
patch
patch-download
patch-download1
patch-download10
patch-download100
patch-download1000
patch-download15
patch-download150
patch-download2
patch-download20
patch-download200
patch-download25
patch-download250
patch-download3
patch-download30
patch-download300
patch-download35
patch-download350
patch-download4
patch-download40
patch-download400
patch-download45
patch-download450
patch-download5
patch-download50
patch-download500
patch-download55
patch-download550
patch-download6
patch-download60
patch-download600
patch-download65
patch-download650
patch-download7
patch-download70
patch-download700
patch-download75
patch-download750
patch-download8
patch-download80
patch-download800
patch-download85
patch-download850
patch-download9
patch-download90
patch-download900
patch-download95
patch-download950
patch-downloadn
patch-get
patch-get1
patch-get10
patch-get100
patch-get1000
patch-get15
patch-get150
patch-get2
patch-get20
patch-get200
patch-get25
patch-get250
patch-get3
patch-get30
patch-get300
patch-get35
patch-get350
patch-get4
patch-get40
patch-get400
patch-get45
patch-get450
patch-get5
patch-get50
patch-get500
patch-get55
patch-get550
patch-get6
patch-get60
patch-get600
patch-get65
patch-get650
patch-get7
patch-get70
patch-get700
patch-get75
patch-get750
patch-get8
patch-get80
patch-get800
patch-get85
patch-get850
patch-get9
patch-get90
patch-get900
patch-get95
patch-get950
patch-getn
patch-rename
patch-view
patch-view1
patch-view10
patch-view100
patch-view1000
patch-view15
patch-view150
patch-view2
patch-view20
patch-view200
patch-view25
patch-view250
patch-view3
patch-view30
patch-view300
patch-view35
patch-view350
patch-view4
patch-view40
patch-view400
patch-view45
patch-view450
patch-view5
patch-view50
patch-view500
patch-view55
patch-view550
patch-view6
patch-view60
patch-view600
patch-view65
patch-view650
patch-view7
patch-view70
patch-view700
patch-view75
patch-view750
patch-view8
patch-view80
patch-view800
patch-view85
patch-view850
patch-view9
patch-view90
patch-view900
patch-view95
patch-view950
patch-viewn
pdel-branch|__git_remotes__,__git_branches__
pdel-tag|__git_remotes__,__git_branches__
pof|__git_remotes__,__git_branches__
pop|push,pop,apply,drop,list,show,clear,--patch,-p,--include-untracked,-u,--keep-index,-k,--message,-m
po|__git_remotes__,__git_branches__
pull|__git_remotes__,__git_branches__,--rebase,-r,--no-rebase,--ff-only,--no-ff,--squash,--autostash,--no-autostash,--all,--prune
push|__git_remotes__,__git_branches__,--force,-f,--force-with-lease,--set-upstream,-u,--delete,-d,--tags,--all,--prune,--dry-run,-n,--no-verify
pu|__git_remotes__,__git_branches__
p|__git_remotes__,__git_branches__
r0-code|__git_branches__,__git_rebase_flags__
r0-subl|__git_branches__,__git_rebase_flags__
r0|__git_branches__,__git_rebase_flags__
r1-code|__git_branches__,__git_rebase_flags__
r1-subl|__git_branches__,__git_rebase_flags__
r10-code|__git_branches__,__git_rebase_flags__
r10-subl|__git_branches__,__git_rebase_flags__
r100-code|__git_branches__,__git_rebase_flags__
r100-subl|__git_branches__,__git_rebase_flags__
r1000-code|__git_branches__,__git_rebase_flags__
r1000-subl|__git_branches__,__git_rebase_flags__
r1000|__git_branches__,__git_rebase_flags__
r100|__git_branches__,__git_rebase_flags__
r10|__git_branches__,__git_rebase_flags__
r15-code|__git_branches__,__git_rebase_flags__
r15-subl|__git_branches__,__git_rebase_flags__
r150-code|__git_branches__,__git_rebase_flags__
r150-subl|__git_branches__,__git_rebase_flags__
r150|__git_branches__,__git_rebase_flags__
r15|__git_branches__,__git_rebase_flags__
r1|__git_branches__,__git_rebase_flags__
r2-code|__git_branches__,__git_rebase_flags__
r2-subl|__git_branches__,__git_rebase_flags__
r20-code|__git_branches__,__git_rebase_flags__
r20-subl|__git_branches__,__git_rebase_flags__
r200-code|__git_branches__,__git_rebase_flags__
r200-subl|__git_branches__,__git_rebase_flags__
r200|__git_branches__,__git_rebase_flags__
r20|__git_branches__,__git_rebase_flags__
r25-code|__git_branches__,__git_rebase_flags__
r25-subl|__git_branches__,__git_rebase_flags__
r250-code|__git_branches__,__git_rebase_flags__
r250-subl|__git_branches__,__git_rebase_flags__
r250|__git_branches__,__git_rebase_flags__
r25|__git_branches__,__git_rebase_flags__
r2|__git_branches__,__git_rebase_flags__
r3-code|__git_branches__,__git_rebase_flags__
r3-subl|__git_branches__,__git_rebase_flags__
r30-code|__git_branches__,__git_rebase_flags__
r30-subl|__git_branches__,__git_rebase_flags__
r300-code|__git_branches__,__git_rebase_flags__
r300-subl|__git_branches__,__git_rebase_flags__
r300|__git_branches__,__git_rebase_flags__
r30|__git_branches__,__git_rebase_flags__
r35-code|__git_branches__,__git_rebase_flags__
r35-subl|__git_branches__,__git_rebase_flags__
r350-code|__git_branches__,__git_rebase_flags__
r350-subl|__git_branches__,__git_rebase_flags__
r350|__git_branches__,__git_rebase_flags__
r35|__git_branches__,__git_rebase_flags__
r3|__git_branches__,__git_rebase_flags__
r4-code|__git_branches__,__git_rebase_flags__
r4-subl|__git_branches__,__git_rebase_flags__
r40-code|__git_branches__,__git_rebase_flags__
r40-subl|__git_branches__,__git_rebase_flags__
r400-code|__git_branches__,__git_rebase_flags__
r400-subl|__git_branches__,__git_rebase_flags__
r400|__git_branches__,__git_rebase_flags__
r40|__git_branches__,__git_rebase_flags__
r45-code|__git_branches__,__git_rebase_flags__
r45-subl|__git_branches__,__git_rebase_flags__
r450-code|__git_branches__,__git_rebase_flags__
r450-subl|__git_branches__,__git_rebase_flags__
r450|__git_branches__,__git_rebase_flags__
r45|__git_branches__,__git_rebase_flags__
r4|__git_branches__,__git_rebase_flags__
r5-code|__git_branches__,__git_rebase_flags__
r5-subl|__git_branches__,__git_rebase_flags__
r50-code|__git_branches__,__git_rebase_flags__
r50-subl|__git_branches__,__git_rebase_flags__
r500-code|__git_branches__,__git_rebase_flags__
r500-subl|__git_branches__,__git_rebase_flags__
r500|__git_branches__,__git_rebase_flags__
r50|__git_branches__,__git_rebase_flags__
r55-code|__git_branches__,__git_rebase_flags__
r55-subl|__git_branches__,__git_rebase_flags__
r550-code|__git_branches__,__git_rebase_flags__
r550-subl|__git_branches__,__git_rebase_flags__
r550|__git_branches__,__git_rebase_flags__
r55|__git_branches__,__git_rebase_flags__
r5|__git_branches__,__git_rebase_flags__
r6-code|__git_branches__,__git_rebase_flags__
r6-subl|__git_branches__,__git_rebase_flags__
r60-code|__git_branches__,__git_rebase_flags__
r60-subl|__git_branches__,__git_rebase_flags__
r600-code|__git_branches__,__git_rebase_flags__
r600-subl|__git_branches__,__git_rebase_flags__
r600|__git_branches__,__git_rebase_flags__
r60|__git_branches__,__git_rebase_flags__
r65-code|__git_branches__,__git_rebase_flags__
r65-subl|__git_branches__,__git_rebase_flags__
r650-code|__git_branches__,__git_rebase_flags__
r650-subl|__git_branches__,__git_rebase_flags__
r650|__git_branches__,__git_rebase_flags__
r65|__git_branches__,__git_rebase_flags__
r6|__git_branches__,__git_rebase_flags__
r7-code|__git_branches__,__git_rebase_flags__
r7-subl|__git_branches__,__git_rebase_flags__
r70-code|__git_branches__,__git_rebase_flags__
r70-subl|__git_branches__,__git_rebase_flags__
r700-code|__git_branches__,__git_rebase_flags__
r700-subl|__git_branches__,__git_rebase_flags__
r700|__git_branches__,__git_rebase_flags__
r70|__git_branches__,__git_rebase_flags__
r75-code|__git_branches__,__git_rebase_flags__
r75-subl|__git_branches__,__git_rebase_flags__
r750-code|__git_branches__,__git_rebase_flags__
r750-subl|__git_branches__,__git_rebase_flags__
r750|__git_branches__,__git_rebase_flags__
r75|__git_branches__,__git_rebase_flags__
r7|__git_branches__,__git_rebase_flags__
r8-code|__git_branches__,__git_rebase_flags__
r8-subl|__git_branches__,__git_rebase_flags__
r80-code|__git_branches__,__git_rebase_flags__
r80-subl|__git_branches__,__git_rebase_flags__
r800-code|__git_branches__,__git_rebase_flags__
r800-subl|__git_branches__,__git_rebase_flags__
r800|__git_branches__,__git_rebase_flags__
r80|__git_branches__,__git_rebase_flags__
r85-code|__git_branches__,__git_rebase_flags__
r85-subl|__git_branches__,__git_rebase_flags__
r850-code|__git_branches__,__git_rebase_flags__
r850-subl|__git_branches__,__git_rebase_flags__
r850|__git_branches__,__git_rebase_flags__
r85|__git_branches__,__git_rebase_flags__
r8|__git_branches__,__git_rebase_flags__
r9-code|__git_branches__,__git_rebase_flags__
r9-subl|__git_branches__,__git_rebase_flags__
r90-code|__git_branches__,__git_rebase_flags__
r90-subl|__git_branches__,__git_rebase_flags__
r900-code|__git_branches__,__git_rebase_flags__
r900-subl|__git_branches__,__git_rebase_flags__
r900|__git_branches__,__git_rebase_flags__
r90|__git_branches__,__git_rebase_flags__
r95-code|__git_branches__,__git_rebase_flags__
r95-subl|__git_branches__,__git_rebase_flags__
r950-code|__git_branches__,__git_rebase_flags__
r950-subl|__git_branches__,__git_rebase_flags__
r950|__git_branches__,__git_rebase_flags__
r95|__git_branches__,__git_rebase_flags__
r9|__git_branches__,__git_rebase_flags__
rc|__git_branches__,__git_rebase_flags__
rebase|__git_branches__,__git_rebase_flags__
remote|__git_remotes__,add,remove,rename,get-url,set-url,show,prune,-v,--verbose
reset|__git_files__,__git_head_refs__,--soft,--mixed,--hard,--merge,--keep
restore|__git_files__,--staged,-S,--worktree,-W,--source,-s,--patch,-p
ri-code|__git_branches__,__git_rebase_flags__
ri-subl|__git_branches__,__git_rebase_flags__
ri|__git_branches__,__git_rebase_flags__
rm|--cached,-r,--force,-f,--dry-run,-n
rn-code|__git_branches__,__git_rebase_flags__
rn-subl|__git_branches__,__git_rebase_flags__
rn|__git_branches__,__git_rebase_flags__
root
rvc|__git_branches__
rv|__git_branches__
r|__git_branches__,__git_rebase_flags__
s
search-logs|__git_log_flags__
search-reflog
show1
show|__git_show_flags__
stash|push,pop,apply,drop,list,show,clear,--patch,-p,--include-untracked,-u,--keep-index,-k,--message,-m
stat
stats
switch|__git_branches__,--create,-c,--detach,-d,--force,-f,--guess,--no-guess,--track,-t
tag|--list,-l,--delete,-d,--annotate,-a,--force,-f,--message,-m,--sign,-s,--verify,-v
theirs|__git_branches__,__git_files__
their|__git_branches__,__git_files__
track|__git_branches__,__git_branch_flags__
undo|__git_files__,__git_head_refs__
unwip|__git_log_flags__
where-is|__git_branches__,__git_branch_flags__
wip|__git_files__,__git_add_flags__
worktree|add,list,lock,move,prune,remove,unlock
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_g g 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_g g
fi
# END g Spec Autocomplete

# BEGIN gh Spec Autocomplete
################################################################################
# gh (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_gh() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
auth|login,logout,refresh,setup-git,status,switch,token
auth login|--git-protocol,--hostname,-h,--scopes,-s,--web,-w,--with-token,--insecure-storage,--skip-ssh-key
auth logout|--hostname,-h
auth status|--hostname,-h,--show-token,-t,--active
auth token|--hostname,-h
browse|--branch,-b,--commit,-c,--no-browser,-n,--projects,-p,--releases,-r,--repo,-R,--settings,-s,--wiki,-w
issue|close,comment,create,delete,develop,edit,list,lock,pin,reopen,status,transfer,unlock,unpin,view
issue create|--assignee,-a,--body,-b,--body-file,-F,--label,-l,--milestone,-m,--project,-p,--recover,--template,-T,--title,-t,--web,-w,--repo,-R
issue list|--assignee,-a,--author,-A,--json,-q,--jq,--label,-l,--limit,-L,--mention,--milestone,-m,--search,-S,--state,-s,--web,-w,--repo,-R,--app
issue view|--comments,-c,--json,-q,--jq,--web,-w,--repo,-R
issue close|--comment,-c,--reason,-r,--repo,-R
issue edit|--add-assignee,--add-label,--add-project,--body,-b,--body-file,-F,--milestone,-m,--remove-assignee,--remove-label,--remove-project,--title,-t,--repo,-R
pr|checkout,checks,close,comment,create,diff,edit,list,lock,merge,ready,reopen,review,status,unlock,view
pr create|--assignee,-a,--base,-B,--body,-b,--body-file,-F,--draft,-d,--fill,-f,--fill-first,--fill-verbose,--head,-H,--label,-l,--milestone,-m,--no-maintainer-edit,--project,-p,--recover,--reviewer,-r,--template,-T,--title,-t,--web,-w,--repo,-R
pr list|--assignee,-a,--author,-A,--base,-B,--draft,-d,--head,-H,--json,-q,--jq,--label,-l,--limit,-L,--search,-S,--state,-s,--web,-w,--repo,-R,--app
pr view|--comments,-c,--json,-q,--jq,--web,-w,--repo,-R
pr checkout|--branch,-b,--detach,--force,-f,--recurse-submodules,--repo,-R
pr merge|--admin,--auto,--body,-b,--delete-branch,-d,--disable-auto,--match-head-commit,--merge,-m,--rebase,-r,--squash,-s,--subject,-t,--repo,-R
pr diff|--color,--name-only,--patch,--web,-w,--repo,-R
pr checks|--fail-fast,--interval,-i,--required,--watch,-w,--web,--repo,-R
pr close|--comment,-c,--delete-branch,-d,--repo,-R
pr edit|--add-assignee,--add-label,--add-project,--add-reviewer,--base,-B,--body,-b,--body-file,-F,--milestone,-m,--remove-assignee,--remove-label,--remove-project,--remove-reviewer,--title,-t,--repo,-R
pr review|--approve,-a,--body,-b,--body-file,-F,--comment,-c,--request-changes,-r,--repo,-R
repo|archive,clone,create,delete,deploy-key,edit,fork,list,rename,set-default,sync,unarchive,view
repo clone|--upstream-remote-name,-u
repo create|--add-readme,--clone,-c,--description,-d,--disable-issues,--disable-wiki,--gitignore,-g,--homepage,-h,--include-all-branches,--internal,--license,-l,--private,--public,--push,-p,--remote,-r,--source,-s,--team,-t,--template,-tp
repo list|--archived,--fork,--json,-q,--jq,--language,-l,--limit,-L,--no-archived,--source,--topic,--visibility
repo view|--branch,-b,--json,-q,--jq,--web,-w,--repo,-R
repo fork|--clone,--fork-name,--org,--remote,--remote-name,--repo,-R
run|cancel,delete,download,list,rerun,view,watch
run list|--branch,-b,--commit,--created,--event,-e,--json,-q,--jq,--limit,-L,--status,-s,--user,-u,--workflow,-w,--repo,-R
run view|--attempt,--exit-status,--job,-j,--json,-q,--jq,--log,--log-failed,--verbose,-v,--web,-w,--repo,-R
run watch|--exit-status,--interval,-i,--repo,-R
workflow|disable,enable,list,run,view
workflow run|--field,-f,--json,--ref,-r,--repo,-R
workflow list|--all,-a,--json,-q,--jq,--limit,-L,--repo,-R
release|create,delete,delete-asset,download,edit,list,upload,view
release create|--draft,-d,--generate-notes,--latest,--notes,-n,--notes-file,-F,--notes-start-tag,--prerelease,-p,--target,--title,-t,--verify-tag,--repo,-R
release list|--exclude-drafts,--exclude-pre-releases,--json,-q,--jq,--limit,-L,--order,--repo,-R
release view|--json,-q,--jq,--web,-w,--repo,-R
gist|clone,create,delete,edit,list,rename,view
gist create|--desc,-d,--filename,-f,--public,-p,--web,-w
gist list|--limit,-L,--public,--secret
search|code,commits,issues,prs,repos
search repos|--archived,--created,--followers,--forks,--good-first-issues,--help-wanted-issues,--include-forks,--json,-q,--jq,--language,-l,--license,--limit,-L,--match,--number-topics,--order,--owner,--size,--sort,--stars,--topic,--updated,--visibility,--web,-w
search issues|--archived,--assignee,--author,--closed,--commenter,--created,--include-prs,--interactions,--involves,--json,-q,--jq,--label,--language,-l,--limit,-L,--match,--mention,--milestone,--no-assignee,--no-label,--no-milestone,--no-project,--order,--owner,--project,--reactions,--repo,-R,--sort,--state,--team-mention,--updated,--visibility,--web,-w
search prs|--archived,--assignee,--author,--closed,--commenter,--created,--draft,--interactions,--involves,--json,-q,--jq,--label,--language,-l,--limit,-L,--match,--mention,--merged,--milestone,--no-assignee,--no-label,--no-milestone,--no-project,--order,--owner,--project,--reactions,--repo,-R,--review,--review-requested,--reviewed-by,--sort,--state,--team-mention,--team-review-requested,--updated,--visibility,--web,-w
api|--cache,--field,-f,--header,-H,--hostname,--include,-i,--input,--jq,-q,--method,-X,--paginate,-p,--preview,-P,--raw-field,-F,--silent,--slurp,--template,-t,--verbose
config|get,list,set,clear-cache
config set|--host,-h
config get|--host,-h
extension|browse,create,exec,install,list,remove,search,upgrade
secret|delete,list,set
secret set|--app,-a,--body,-b,--env,-e,--no-store,--org,-o,--repos,-r,--visibility,-v,--repo,-R
variable|delete,get,list,set
alias|delete,import,list,set
cache|delete,list
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_gh gh 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_gh gh
fi
# END gh Spec Autocomplete

# BEGIN git Spec Autocomplete
################################################################################
# git (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_git() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
aa|__git_files__,__git_add_flags__
abort|push,pop,apply,drop,list,show,clear,--patch,-p,--include-untracked,-u,--keep-index,-k,--message,-m
add|__git_files__,__git_add_flags__
amendm|__git_commit_flags__
amend|__git_commit_flags__
ap|__git_files__,__git_add_flags__
au|__git_files__,__git_add_flags__
a|__git_files__,__git_add_flags__
ba|__git_branches__,__git_branch_flags__
bisect|start,bad,good,reset,skip,log,run
branch|__git_branches__,__git_branch_flags__
b|__git_branches__,__git_branch_flags__
checkout|__git_branches__,__git_files__,--force,-f,-b,-B,--track,-t,--detach,--orphan,--ours,--theirs,--merge,-m,--patch,-p
cherry-pick|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m
cl0|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
cl1|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
clean-and-fetch|--global,--local,--system,--list,-l,--get,--unset,--edit,-e
cleanfd
clean|--force,-f,-d,--dry-run,-n,--interactive,-i,-x,-X
clone0|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
clone1|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
clone|--depth,--single-branch,--branch,-b,--bare,--mirror,--recursive,--shallow-submodules,--jobs,-j,--filter
cm|__git_commit_flags__
cob|__git_branches__,__git_files__
commit|__git_commit_flags__
config|--global,--local,--system,--list,-l,--get,--unset,--edit,-e
cop|__git_branches__,__git_files__
co|__git_branches__,__git_files__
cpc|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m
cpn|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m
cp|__git_branches__,--abort,--continue,--skip,--no-commit,-n,--edit,-e,--mainline,-m
current|__git_branches__,__git_branch_flags__
c|__git_commit_flags__
d1
del|__git_branches__,__git_branch_flags__
dh1
dhs|__git_files__,__git_diff_flags__
dh|__git_files__,__git_diff_flags__
diff|__git_files__,__git_diff_flags__
ds1
ds|__git_files__,__git_diff_flags__
d|__git_files__,__git_diff_flags__
fapr|--global,--local,--system,--list,-l,--get,--unset,--edit,-e
fap|__git_remotes__
fetch|__git_remotes__,--all,--prune,-p,--tags,--no-tags,--force,-f,--depth,--shallow-since,--dry-run
gone|__git_branches__,__git_branch_flags__
hash|__git_branches__,__git_files__
init|--bare,--template,--initial-branch,-b
l
lastd|__git_log_flags__
last|__git_log_flags__
ll
lls
logbaseline|__git_log_flags__
log|__git_log_flags__
ls
mc|__git_branches__
merge|__git_branches__,--abort,--continue,--no-ff,--ff-only,--squash,--no-commit,--strategy,-s,--no-verify
mv|--force,-f,--dry-run,-n,--verbose,-v
ours|__git_branches__,__git_files__
our|__git_branches__,__git_files__
patch
patch-download
patch-download1
patch-download10
patch-download100
patch-download1000
patch-download15
patch-download150
patch-download2
patch-download20
patch-download200
patch-download25
patch-download250
patch-download3
patch-download30
patch-download300
patch-download35
patch-download350
patch-download4
patch-download40
patch-download400
patch-download45
patch-download450
patch-download5
patch-download50
patch-download500
patch-download55
patch-download550
patch-download6
patch-download60
patch-download600
patch-download65
patch-download650
patch-download7
patch-download70
patch-download700
patch-download75
patch-download750
patch-download8
patch-download80
patch-download800
patch-download85
patch-download850
patch-download9
patch-download90
patch-download900
patch-download95
patch-download950
patch-downloadn
patch-get
patch-get1
patch-get10
patch-get100
patch-get1000
patch-get15
patch-get150
patch-get2
patch-get20
patch-get200
patch-get25
patch-get250
patch-get3
patch-get30
patch-get300
patch-get35
patch-get350
patch-get4
patch-get40
patch-get400
patch-get45
patch-get450
patch-get5
patch-get50
patch-get500
patch-get55
patch-get550
patch-get6
patch-get60
patch-get600
patch-get65
patch-get650
patch-get7
patch-get70
patch-get700
patch-get75
patch-get750
patch-get8
patch-get80
patch-get800
patch-get85
patch-get850
patch-get9
patch-get90
patch-get900
patch-get95
patch-get950
patch-getn
patch-rename
patch-view
patch-view1
patch-view10
patch-view100
patch-view1000
patch-view15
patch-view150
patch-view2
patch-view20
patch-view200
patch-view25
patch-view250
patch-view3
patch-view30
patch-view300
patch-view35
patch-view350
patch-view4
patch-view40
patch-view400
patch-view45
patch-view450
patch-view5
patch-view50
patch-view500
patch-view55
patch-view550
patch-view6
patch-view60
patch-view600
patch-view65
patch-view650
patch-view7
patch-view70
patch-view700
patch-view75
patch-view750
patch-view8
patch-view80
patch-view800
patch-view85
patch-view850
patch-view9
patch-view90
patch-view900
patch-view95
patch-view950
patch-viewn
pdel-branch|__git_remotes__,__git_branches__
pdel-tag|__git_remotes__,__git_branches__
pof|__git_remotes__,__git_branches__
pop|push,pop,apply,drop,list,show,clear,--patch,-p,--include-untracked,-u,--keep-index,-k,--message,-m
po|__git_remotes__,__git_branches__
pull|__git_remotes__,__git_branches__,--rebase,-r,--no-rebase,--ff-only,--no-ff,--squash,--autostash,--no-autostash,--all,--prune
push|__git_remotes__,__git_branches__,--force,-f,--force-with-lease,--set-upstream,-u,--delete,-d,--tags,--all,--prune,--dry-run,-n,--no-verify
pu|__git_remotes__,__git_branches__
p|__git_remotes__,__git_branches__
r0-code|__git_branches__,__git_rebase_flags__
r0-subl|__git_branches__,__git_rebase_flags__
r0|__git_branches__,__git_rebase_flags__
r1-code|__git_branches__,__git_rebase_flags__
r1-subl|__git_branches__,__git_rebase_flags__
r10-code|__git_branches__,__git_rebase_flags__
r10-subl|__git_branches__,__git_rebase_flags__
r100-code|__git_branches__,__git_rebase_flags__
r100-subl|__git_branches__,__git_rebase_flags__
r1000-code|__git_branches__,__git_rebase_flags__
r1000-subl|__git_branches__,__git_rebase_flags__
r1000|__git_branches__,__git_rebase_flags__
r100|__git_branches__,__git_rebase_flags__
r10|__git_branches__,__git_rebase_flags__
r15-code|__git_branches__,__git_rebase_flags__
r15-subl|__git_branches__,__git_rebase_flags__
r150-code|__git_branches__,__git_rebase_flags__
r150-subl|__git_branches__,__git_rebase_flags__
r150|__git_branches__,__git_rebase_flags__
r15|__git_branches__,__git_rebase_flags__
r1|__git_branches__,__git_rebase_flags__
r2-code|__git_branches__,__git_rebase_flags__
r2-subl|__git_branches__,__git_rebase_flags__
r20-code|__git_branches__,__git_rebase_flags__
r20-subl|__git_branches__,__git_rebase_flags__
r200-code|__git_branches__,__git_rebase_flags__
r200-subl|__git_branches__,__git_rebase_flags__
r200|__git_branches__,__git_rebase_flags__
r20|__git_branches__,__git_rebase_flags__
r25-code|__git_branches__,__git_rebase_flags__
r25-subl|__git_branches__,__git_rebase_flags__
r250-code|__git_branches__,__git_rebase_flags__
r250-subl|__git_branches__,__git_rebase_flags__
r250|__git_branches__,__git_rebase_flags__
r25|__git_branches__,__git_rebase_flags__
r2|__git_branches__,__git_rebase_flags__
r3-code|__git_branches__,__git_rebase_flags__
r3-subl|__git_branches__,__git_rebase_flags__
r30-code|__git_branches__,__git_rebase_flags__
r30-subl|__git_branches__,__git_rebase_flags__
r300-code|__git_branches__,__git_rebase_flags__
r300-subl|__git_branches__,__git_rebase_flags__
r300|__git_branches__,__git_rebase_flags__
r30|__git_branches__,__git_rebase_flags__
r35-code|__git_branches__,__git_rebase_flags__
r35-subl|__git_branches__,__git_rebase_flags__
r350-code|__git_branches__,__git_rebase_flags__
r350-subl|__git_branches__,__git_rebase_flags__
r350|__git_branches__,__git_rebase_flags__
r35|__git_branches__,__git_rebase_flags__
r3|__git_branches__,__git_rebase_flags__
r4-code|__git_branches__,__git_rebase_flags__
r4-subl|__git_branches__,__git_rebase_flags__
r40-code|__git_branches__,__git_rebase_flags__
r40-subl|__git_branches__,__git_rebase_flags__
r400-code|__git_branches__,__git_rebase_flags__
r400-subl|__git_branches__,__git_rebase_flags__
r400|__git_branches__,__git_rebase_flags__
r40|__git_branches__,__git_rebase_flags__
r45-code|__git_branches__,__git_rebase_flags__
r45-subl|__git_branches__,__git_rebase_flags__
r450-code|__git_branches__,__git_rebase_flags__
r450-subl|__git_branches__,__git_rebase_flags__
r450|__git_branches__,__git_rebase_flags__
r45|__git_branches__,__git_rebase_flags__
r4|__git_branches__,__git_rebase_flags__
r5-code|__git_branches__,__git_rebase_flags__
r5-subl|__git_branches__,__git_rebase_flags__
r50-code|__git_branches__,__git_rebase_flags__
r50-subl|__git_branches__,__git_rebase_flags__
r500-code|__git_branches__,__git_rebase_flags__
r500-subl|__git_branches__,__git_rebase_flags__
r500|__git_branches__,__git_rebase_flags__
r50|__git_branches__,__git_rebase_flags__
r55-code|__git_branches__,__git_rebase_flags__
r55-subl|__git_branches__,__git_rebase_flags__
r550-code|__git_branches__,__git_rebase_flags__
r550-subl|__git_branches__,__git_rebase_flags__
r550|__git_branches__,__git_rebase_flags__
r55|__git_branches__,__git_rebase_flags__
r5|__git_branches__,__git_rebase_flags__
r6-code|__git_branches__,__git_rebase_flags__
r6-subl|__git_branches__,__git_rebase_flags__
r60-code|__git_branches__,__git_rebase_flags__
r60-subl|__git_branches__,__git_rebase_flags__
r600-code|__git_branches__,__git_rebase_flags__
r600-subl|__git_branches__,__git_rebase_flags__
r600|__git_branches__,__git_rebase_flags__
r60|__git_branches__,__git_rebase_flags__
r65-code|__git_branches__,__git_rebase_flags__
r65-subl|__git_branches__,__git_rebase_flags__
r650-code|__git_branches__,__git_rebase_flags__
r650-subl|__git_branches__,__git_rebase_flags__
r650|__git_branches__,__git_rebase_flags__
r65|__git_branches__,__git_rebase_flags__
r6|__git_branches__,__git_rebase_flags__
r7-code|__git_branches__,__git_rebase_flags__
r7-subl|__git_branches__,__git_rebase_flags__
r70-code|__git_branches__,__git_rebase_flags__
r70-subl|__git_branches__,__git_rebase_flags__
r700-code|__git_branches__,__git_rebase_flags__
r700-subl|__git_branches__,__git_rebase_flags__
r700|__git_branches__,__git_rebase_flags__
r70|__git_branches__,__git_rebase_flags__
r75-code|__git_branches__,__git_rebase_flags__
r75-subl|__git_branches__,__git_rebase_flags__
r750-code|__git_branches__,__git_rebase_flags__
r750-subl|__git_branches__,__git_rebase_flags__
r750|__git_branches__,__git_rebase_flags__
r75|__git_branches__,__git_rebase_flags__
r7|__git_branches__,__git_rebase_flags__
r8-code|__git_branches__,__git_rebase_flags__
r8-subl|__git_branches__,__git_rebase_flags__
r80-code|__git_branches__,__git_rebase_flags__
r80-subl|__git_branches__,__git_rebase_flags__
r800-code|__git_branches__,__git_rebase_flags__
r800-subl|__git_branches__,__git_rebase_flags__
r800|__git_branches__,__git_rebase_flags__
r80|__git_branches__,__git_rebase_flags__
r85-code|__git_branches__,__git_rebase_flags__
r85-subl|__git_branches__,__git_rebase_flags__
r850-code|__git_branches__,__git_rebase_flags__
r850-subl|__git_branches__,__git_rebase_flags__
r850|__git_branches__,__git_rebase_flags__
r85|__git_branches__,__git_rebase_flags__
r8|__git_branches__,__git_rebase_flags__
r9-code|__git_branches__,__git_rebase_flags__
r9-subl|__git_branches__,__git_rebase_flags__
r90-code|__git_branches__,__git_rebase_flags__
r90-subl|__git_branches__,__git_rebase_flags__
r900-code|__git_branches__,__git_rebase_flags__
r900-subl|__git_branches__,__git_rebase_flags__
r900|__git_branches__,__git_rebase_flags__
r90|__git_branches__,__git_rebase_flags__
r95-code|__git_branches__,__git_rebase_flags__
r95-subl|__git_branches__,__git_rebase_flags__
r950-code|__git_branches__,__git_rebase_flags__
r950-subl|__git_branches__,__git_rebase_flags__
r950|__git_branches__,__git_rebase_flags__
r95|__git_branches__,__git_rebase_flags__
r9|__git_branches__,__git_rebase_flags__
rc|__git_branches__,__git_rebase_flags__
rebase|__git_branches__,__git_rebase_flags__
remote|__git_remotes__,add,remove,rename,get-url,set-url,show,prune,-v,--verbose
reset|__git_files__,__git_head_refs__,--soft,--mixed,--hard,--merge,--keep
restore|__git_files__,--staged,-S,--worktree,-W,--source,-s,--patch,-p
ri-code|__git_branches__,__git_rebase_flags__
ri-subl|__git_branches__,__git_rebase_flags__
ri|__git_branches__,__git_rebase_flags__
rm|--cached,-r,--force,-f,--dry-run,-n
rn-code|__git_branches__,__git_rebase_flags__
rn-subl|__git_branches__,__git_rebase_flags__
rn|__git_branches__,__git_rebase_flags__
root
rvc|__git_branches__
rv|__git_branches__
r|__git_branches__,__git_rebase_flags__
s
search-logs|__git_log_flags__
search-reflog
show1
show|__git_show_flags__
stash|push,pop,apply,drop,list,show,clear,--patch,-p,--include-untracked,-u,--keep-index,-k,--message,-m
stat
stats
switch|__git_branches__,--create,-c,--detach,-d,--force,-f,--guess,--no-guess,--track,-t
tag|--list,-l,--delete,-d,--annotate,-a,--force,-f,--message,-m,--sign,-s,--verify,-v
theirs|__git_branches__,__git_files__
their|__git_branches__,__git_files__
track|__git_branches__,__git_branch_flags__
undo|__git_files__,__git_head_refs__
unwip|__git_log_flags__
where-is|__git_branches__,__git_branch_flags__
wip|__git_files__,__git_add_flags__
worktree|add,list,lock,move,prune,remove,unlock
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_git git 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_git git
fi
# END git Spec Autocomplete

# BEGIN cargo Spec Autocomplete
################################################################################
# cargo (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_cargo() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
add|__paths__
bench|--bench,--all-targets,--lib,--bins,--examples,--tests,--benches,--package,-p,--workspace,--exclude,--jobs,-j,--release,--profile,--features,--all-features,--no-default-features,--target,--message-format,--no-run,--quiet,-q,--verbose,-v
build|--package,-p,--workspace,--exclude,--jobs,-j,--release,--profile,--features,--all-features,--no-default-features,--target,--lib,--bins,--examples,--tests,--benches,--all-targets,--message-format,--quiet,-q,--verbose,-v
check|--package,-p,--workspace,--exclude,--jobs,-j,--release,--profile,--features,--all-features,--no-default-features,--target,--lib,--bins,--examples,--tests,--benches,--all-targets,--message-format,--quiet,-q,--verbose,-v
clean|--package,-p,--release,--profile,--target,--doc,--quiet,-q,--verbose,-v
clippy|--fix,--allow-dirty,--allow-staged,--package,-p,--workspace,--all-targets,--features,--all-features,--no-default-features,--quiet,-q,--verbose,-v
doc|--open,--package,-p,--workspace,--no-deps,--document-private-items,--jobs,-j,--release,--features,--all-features,--no-default-features,--quiet,-q,--verbose,-v
fetch|--target,--quiet,-q,--verbose,-v
fix|--package,-p,--workspace,--allow-dirty,--allow-staged,--broken-code,--edition,--edition-idioms,--jobs,-j,--release,--features,--all-features,--no-default-features,--quiet,-q,--verbose,-v
fmt|--all,--check,--package,-p,--quiet,-q,--verbose,-v
init|--lib,--bin,--edition,--vcs,--name,--registry,--quiet,-q,--verbose,-v
install|--version,--git,--branch,--tag,--rev,--path,--list,--jobs,-j,--force,-f,--features,--all-features,--no-default-features,--root,--quiet,-q,--verbose,-v
new|--lib,--bin,--edition,--vcs,--name,--registry,--quiet,-q,--verbose,-v
publish|--dry-run,--token,--index,--registry,--allow-dirty,--no-verify,--jobs,-j,--features,--all-features,--no-default-features,--quiet,-q,--verbose,-v
remove|--dev,--build,--package,-p,--quiet,-q,--verbose,-v
run|--bin,--example,--package,-p,--jobs,-j,--release,--profile,--features,--all-features,--no-default-features,--target,--message-format,--quiet,-q,--verbose,-v,__cargo_targets__
test|--test,--bench,--all-targets,--lib,--bins,--examples,--tests,--benches,--doc,--package,-p,--workspace,--exclude,--jobs,-j,--release,--profile,--features,--all-features,--no-default-features,--target,--no-run,--no-fail-fast,--message-format,--quiet,-q,--verbose,-v
tree|--invert,-i,--no-dedupe,--duplicates,-d,--package,-p,--workspace,--depth,--features,--all-features,--no-default-features,--target,--quiet,-q,--verbose,-v
uninstall|--root,--quiet,-q,--verbose,-v
update|--package,-p,--aggressive,--precise,--workspace,--dry-run,--quiet,-q,--verbose,-v
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_cargo cargo 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_cargo cargo
fi
# END cargo Spec Autocomplete

# BEGIN n Spec Autocomplete
################################################################################
# n (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_n() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
access
adduser
audit
bugs
cache
ci
completion
config
dedupe
deprecate
diff
dist-tag
docs
doctor
edit
exec
explain
explore
find-dupes
fund
get
help-search
help
init
install-ci-test
install-test
install
link
ll
login
logout
ls
org
outdated
owner
pack
ping
pkg
prefix
profile
prune
publish
query
rebuild
repo
restart
root
run|__npm_scripts__
sbom
search
set
shrinkwrap
stars
start
star
stop
team
test
token
trust
undeprecate
uninstall
unpublish
unstar
update
version
view
whoami
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_n n 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_n n
fi
# END n Spec Autocomplete

# BEGIN npm Spec Autocomplete
################################################################################
# npm (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_npm() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
access
adduser
audit
bugs
cache
ci
completion
config
dedupe
deprecate
diff
dist-tag
docs
doctor
edit
exec
explain
explore
find-dupes
fund
get
help-search
help
init
install-ci-test
install-test
install
link
ll
login
logout
ls
org
outdated
owner
pack
ping
pkg
prefix
profile
prune
publish
query
rebuild
repo
restart
root
run|__npm_scripts__
sbom
search
set
shrinkwrap
stars
start
star
stop
team
test
token
trust
undeprecate
uninstall
unpublish
unstar
update
version
view
whoami
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_npm npm 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_npm npm
fi
# END npm Spec Autocomplete

# BEGIN npx Spec Autocomplete
################################################################################
# npx (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_npx() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
prettier|--write,--check,--config,--ignore-path,--single-quote,--trailing-comma,--tab-width,--print-width
ts-node|--project,-P,--transpile-only,-T,--compiler,--skip-project,--skip-ignore
tsx|--tsconfig
tsc|--init,--project,-p,--watch,-w,--build,-b,--noEmit,--declaration,-d,--outDir,--target,-t,--module,-m
eslint|--fix,--config,-c,--ignore-path,--ext,--format,-f,--quiet,--max-warnings,--cache,--no-eslintrc
vitest|run,watch,bench,--config,-c,--reporter,-r,--coverage,--ui,--run
jest|--watch,--watchAll,--coverage,--verbose,--config,-c,--testPathPattern,-t
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_npx npx 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_npx npx
fi
# END npx Spec Autocomplete

# BEGIN y Spec Autocomplete
################################################################################
# y (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_y() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__npm_scripts__
add|--dev,-D,--peer,-P,--optional,-O,--exact,-E,--tilde,-T
remove|--all,-A
install|--frozen-lockfile,--force,--production,--ignore-scripts,--check-files
run|__npm_scripts__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_y y 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_y y
fi
# END y Spec Autocomplete

# BEGIN gradlew Spec Autocomplete
################################################################################
# gradlew (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_gradlew() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__gradle_tasks__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_gradlew gradlew 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_gradlew gradlew
fi
# END gradlew Spec Autocomplete

# BEGIN make Spec Autocomplete
################################################################################
# make (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_make() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__makefile_targets__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_make make 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_make make
fi
# END make Spec Autocomplete

# BEGIN curl Spec Autocomplete
################################################################################
# curl (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_curl() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|-o,--output,-O,--remote-name,-L,--location,-f,--fail,-s,--silent,-S,--show-error,-v,--verbose,-k,--insecure,-I,--head,-X,--request,-H,--header,-d,--data,--data-raw,--data-binary,--data-urlencode,-F,--form,-u,--user,-A,--user-agent,-e,--referer,-b,--cookie,-c,--cookie-jar,-x,--proxy,-m,--max-time,--connect-timeout,-r,--range,-C,--continue-at,-T,--upload-file,-w,--write-out,--compressed,--create-dirs,-D,--dump-header,-K,--config,-q,--disable,--dns-servers,--doh-url,--http1.0,--http1.1,--http2,--http3,--retry,--retry-delay,--retry-max-time,--tcp-fastopen,--tcp-nodelay,--tls-max,--tlsv1.2,--tlsv1.3,--tr-encoding,-4,--ipv4,-6,--ipv6,-#,--progress-bar,--stderr,--trace,--trace-ascii,--trace-time,-G,--get,-j,--junk-session-cookies,-J,--remote-header-name,-R,--remote-time,--raw,--no-keepalive,--no-sessionid,-n,--netrc,--netrc-file,--netrc-optional,-N,--no-buffer,--path-as-is,-Z,--parallel,--parallel-max,--parallel-immediate
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_curl curl 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_curl curl
fi
# END curl Spec Autocomplete

# BEGIN s Spec Autocomplete
################################################################################
# s (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_s() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__ssh_hosts__,-i,-p,-l,-o,-F,-J,-N,-T,-v,-vv,-vvv,-L,-R,-D,-W,-A,-X,-Y,-C,-q,-f,-4,-6
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_s s 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_s s
fi
# END s Spec Autocomplete

# BEGIN adb Spec Autocomplete
################################################################################
# adb (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_adb() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
connect
devices|-l,--long
disconnect
forward|--list,--remove,--remove-all,--no-rebind
install|-r,-t,-d,-g,-l,-s,--abi,--instant,--no-streaming,--streaming,--fastdeploy,--no-fastdeploy,--force-agent,--date-check-agent,--version-check-agent,--local-agent
install-multi-package|-r,-t,-d,-g,-l,-s,--abi,--instant,--no-streaming,--streaming
logcat|-v,-b,-c,-d,-e,-f,-g,-L,-r,-n,-s,-t,-T,-D,-S,--pid,--wrap,--clear,--dump,--format,--buffer,--regex
pair
pull|-a,-z,-Z
push|-z,-Z,--sync
reboot|bootloader,recovery,sideload,sideload-auto-reboot
reconnect|device,offline
remount|-R
reverse|--list,--remove,--remove-all,--no-rebind
root
shell|-e,-n,-x,-T,-t
sideload
start-server
kill-server
tcpip
track-devices|-l,--long
uninstall|-k
unroot
usb
wait-for-device
wait-for-recovery
wait-for-sideload
wait-for-bootloader
bugreport
emu
get-state
get-serialno
get-devpath
jdwp
disable-verity
enable-verity
keygen
version
mdns|check,services
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_adb adb 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_adb adb
fi
# END adb Spec Autocomplete

# BEGIN journalctl Spec Autocomplete
################################################################################
# journalctl (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_journalctl() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|-u,--unit,-t,--identifier,-p,--priority,-S,--since,-U,--until,-f,--follow,-n,--lines,-o,--output,-r,--reverse,-x,--catalog,-e,--pager-end,-a,--all,-q,--quiet,--no-pager,--no-tail,-b,--boot,-k,--dmesg,--list-boots,-g,--grep,--case-sensitive,-D,--directory,--file,--root,--image,--namespace,-F,--field,-N,--fields,--system,--user,-M,--machine,--header,--disk-usage,--vacuum-size,--vacuum-time,--vacuum-files,--verify,--sync,--flush,--rotate,--force,--cursor,--cursor-file,--after-cursor,--show-cursor
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_journalctl journalctl 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_journalctl journalctl
fi
# END journalctl Spec Autocomplete

# BEGIN sqlite3 Spec Autocomplete
################################################################################
# sqlite3 (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_sqlite3() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|--append,--ascii,--bail,--batch,--box,--cmd,--column,--csv,--deserialize,--echo,--header,--help,--html,--init,--interactive,--json,--line,--list,--lookaside,--markdown,--maxsize,--memtrace,--mmap,--newline,--nofollow,--noheader,--nonce,--nullvalue,--pagecache,--pagesize,--pcachetrace,--quote,--readonly,--safe,--separator,--stats,--table,--tabs,--unsafe-testing,--version,--vfs,--zip
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_sqlite3 sqlite3 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_sqlite3 sqlite3
fi
# END sqlite3 Spec Autocomplete

# BEGIN systemctl Spec Autocomplete
################################################################################
# systemctl (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_systemctl() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
start|--no-block,--job-mode
stop|--no-block,--job-mode
restart|--no-block,--job-mode
reload|--no-block,--job-mode
enable|--now,--no-reload,--force,--runtime
disable|--now,--no-reload,--runtime
status|--no-pager,-l,--full,-n,--lines,-o,--output
is-active
is-enabled
is-failed
mask|--now,--runtime
unmask|--runtime
daemon-reload
daemon-reexec
list-units|--type,-t,--state,--no-pager,--all,-a,--full,-l,--plain,--no-legend
list-unit-files|--type,-t,--state,--no-pager,--all,-a
list-sockets|--no-pager,--all,-a,--full,-l,--show-types,--no-legend
list-timers|--no-pager,--all,-a,--full,-l,--no-legend
list-dependencies|--all,-a,--reverse,--after,--before,--no-pager,--plain
show|--no-pager,-p,--property,--all,-a,--value
cat
edit|--force,--full,--runtime,--drop-in
set-property|--runtime
reset-failed
isolate
kill|-s,--signal,--kill-who
log-level
log-target
reboot|--firmware-setup,--boot-loader-menu,--boot-loader-entry
poweroff
halt
suspend
hibernate
rescue
emergency
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_systemctl systemctl 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_systemctl systemctl
fi
# END systemctl Spec Autocomplete

# BEGIN tldr Spec Autocomplete
################################################################################
# tldr (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_tldr() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__tldr_commands__,--list,-l,--random,-r,--render,-f,--update,-u,--clear-cache,--language,-L,--platform,-p,--seed,--color,--version,-v,--help,-h
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_tldr tldr 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_tldr tldr
fi
# END tldr Spec Autocomplete

# BEGIN tmux Spec Autocomplete
################################################################################
# tmux (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_tmux() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
attach-session|-t,-d,-r,-x,-f,-E
a|-t,-d,-r,-x,-f,-E
attach|-t,-d,-r,-x,-f,-E
bind-key|-T,-n,-r,-N
break-pane|-d,-P,-F,-n,-s,-t
capture-pane|-a,-e,-p,-q,-b,-E,-S,-t,-J,-P,-N
choose-buffer|-t,-F,-f,-O,-r,-N,-Z
choose-client|-t,-F,-f,-O,-r,-N,-Z
choose-session|-t,-F,-f,-O,-r,-N,-Z
choose-tree|-t,-F,-f,-O,-r,-s,-w,-N,-Z
choose-window|-t,-F,-f,-O,-r,-N,-Z
clock-mode|-t
command-prompt|-t,-T,-1,-i,-k,-p,-I,-N
confirm-before|-t,-p,-b,-y
copy-mode|-t,-u,-H,-M,-e,-q
delete-buffer|-b
detach-client|-t,-s,-a,-P,-E
display-menu|-t,-T,-x,-y,-c,-O
display-message|-t,-c,-p,-I,-F,-v,-a,-l,-d
display-panes|-t,-d,-b
find-window|-t,-C,-i,-r,-T,-N,-Z
has-session|-t
if-shell|-b,-F,-t
join-pane|-b,-d,-h,-v,-l,-p,-s,-t
kill-pane|-a,-t
kill-server
kill-session|-a,-t,-C
kill-window|-a,-t
last-pane|-d,-e,-t,-Z
last-window|-t
link-window|-a,-d,-k,-s,-t
list-buffers|-F,-f
list-clients|-F,-f,-t
list-commands|-F
list-keys|-T,-N,-1,-a
list-panes|-a,-F,-f,-s,-t
list-sessions|-F,-f
list-windows|-a,-F,-f,-t
load-buffer|-b,-t,-w
lock-client|-t
lock-server
lock-session|-t
move-pane|-b,-d,-h,-v,-p,-l,-s,-t
move-window|-a,-b,-d,-k,-r,-s,-t
new-session|-A,-d,-D,-E,-f,-n,-P,-s,-t,-x,-y,-X,-Y,-c,-F,-e
new|-A,-d,-D,-E,-f,-n,-P,-s,-t,-x,-y,-X,-Y,-c,-F,-e
new-window|-a,-b,-d,-e,-k,-n,-P,-S,-t,-c,-F
next-layout|-t
next-window|-a,-t
paste-buffer|-b,-d,-p,-r,-s,-t
pipe-pane|-I,-O,-o,-t
previous-layout|-t
previous-window|-a,-t
refresh-client|-t,-A,-B,-C,-c,-D,-f,-l,-L,-R,-S,-U
rename-session|-t
rename-window|-t
resize-pane|-D,-L,-R,-U,-x,-y,-M,-m,-t,-Z
resize-window|-a,-A,-D,-L,-R,-U,-x,-y,-t
respawn-pane|-k,-c,-e,-t
respawn-window|-k,-c,-e,-t
rotate-window|-D,-U,-Z,-t
run-shell|-b,-d,-t,-C,-c
save-buffer|-a,-b
select-layout|-E,-n,-o,-p,-t
select-pane|-D,-d,-e,-L,-l,-M,-m,-R,-T,-t,-U,-Z
select-window|-l,-n,-p,-t,-T
send-keys|-H,-F,-l,-M,-R,-X,-N,-t
send-prefix|-2,-t
set-buffer|-a,-b,-n,-t,-w
set-environment|-g,-h,-r,-t,-u,-F
set-hook|-a,-g,-p,-R,-t,-u,-w
set-option|-a,-F,-g,-o,-p,-q,-s,-t,-u,-U,-w
set|-a,-F,-g,-o,-p,-q,-s,-t,-u,-U,-w
set-window-option|-a,-F,-g,-o,-q,-t,-u
setw|-a,-F,-g,-o,-q,-t,-u
show-buffer|-b
show-environment|-g,-h,-s,-t
show-hooks|-g,-p,-t,-w
show-messages|-J,-T,-t
show-options|-A,-g,-H,-p,-q,-s,-t,-v,-w
show-window-options|-g,-v,-t
source-file|-F,-n,-q,-v
split-window|-b,-d,-e,-f,-F,-h,-I,-l,-P,-p,-t,-v,-Z,-c
start-server
suspend-client|-t
swap-pane|-d,-D,-s,-t,-U,-Z
swap-window|-d,-s,-t
switch-client|-c,-E,-l,-n,-p,-r,-t,-T,-Z
unbind-key|-a,-n,-q,-T
unlink-window|-k,-t
wait-for|-L,-S,-U
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_tmux tmux 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_tmux tmux
fi
# END tmux Spec Autocomplete
# END Spec Autocomplete
# SOURCE_BEGIN software/scripts/bash-command-wrappers-profile.bash
# software/scripts/bash-command-wrappers-profile.bash | 8ce1b90bc3323688786739e6b887a117 | 5.5 KB | 2026-04-18
# SOURCE_BEGIN software/bootstrap/common-functions.bash
# software/bootstrap/common-functions.bash | d9ed8ad8376248729ca94dc654c98d87 | 8.9 KB | 2026-04-18
# Shared shell functions for run.sh and SH scripts (via SOURCE markers).
# Source of truth — inlined into run.sh via BEGIN/END, included in .sh scripts at runtime.

# safe_source <source> [dest] - Fetches and sources a bash script with syntax validation.
#   source: URL (http/https), absolute path, or relative path
#   dest:   optional local path to store the fetched content (useful for caching URL downloads)
# URLs are downloaded via curl, files are used directly (or copied to dest if given).
# Always validates with bash -n before sourcing.
function safe_source() {
  local src="$1"
  local dest="${2:-}"
  local target="$src"
  case "$src" in
  http://* | https://*)
    target="${dest:-/tmp/bashrc_safe_source_$$.sh}"
    curl -fsSL -o "$target" "$src" 2> /dev/null || {
      echo "[Warning] safe_source download $src failed" >&2
      return 1
    }
    ;;
  *)
    if [ ! -f "$src" ]; then
      echo "[Warning] safe_source $src not found" >&2
      return 1
    fi
    if [ -n "$dest" ]; then
      cp "$src" "$dest" 2> /dev/null
      target="$dest"
    fi
    ;;
  esac
  bash -n "$target" 2> /dev/null && . "$target" || echo "[Warning] source $target failed" >&2
}

# curl_bash_install <url> [script args...] - Runs a curl|bash installer with output
# suppressed. In verbose mode (set -x), stderr is kept visible for debugging.
# Extra args are passed to the install script via bash -s -- <args>.
function curl_bash_install() {
  local url="$1"
  shift
  if [[ $- == *x* ]]; then
    curl -fsSL "$url" | bash -s -- "$@" > /dev/null
  else
    curl -fsSL "$url" | bash -s -- "$@" &> /dev/null
  fi
}

# npm_install_global <pkg> [binary] - Installs an npm package globally. Skips if already installed.
#   pkg:    npm package name (e.g. @google/gemini-cli, yarn)
#   binary: binary name to check (defaults to last segment of pkg, e.g. gemini-cli from @google/gemini-cli)
# Installs to $HOME/.local on the current system. On WSL, also installs to the Windows host
# via cmd.exe. Logs status (Skipped/Success/Error) for each target.
function npm_install_global() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # install for current system
  local _resolved
  _resolved=$(has_persistent_binary "$bin")
  if [ -n "$_resolved" ]; then
    echo ">> $pkg >> Installing with npm global >> Skipped ($_resolved)"
  else
    echo -n ">> $pkg >> Installing with npm global >> "
    if npm install -g --prefix "$HOME/.local" "$pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi

  # install for Windows host via WSL
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    if cmd.exe /c "where $bin" &> /dev/null; then
      echo ">> $pkg >> Installing with npm global (Windows) >> Skipped"
    else
      echo -n ">> $pkg >> Installing with npm global (Windows) >> "
      if cmd.exe /c "npm install -g $pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
  fi
}

# has_persistent_binary <name> - Returns 0 (true) when the binary is found in PATH and is NOT
# inside /tmp/. During run.sh, /tmp/synle/bashrc/node/bin is on PATH (bootstrap node fallback),
# so binaries installed there by a prior run appear installed but are ephemeral. Use this for
# install-skip checks; use plain `type -P` for dependency-available checks where /tmp is fine.
# On success, prints the resolved path to stdout (capture with $()).
function has_persistent_binary() {
  local bin
  bin=$(type -P "$1" 2> /dev/null) || return 1
  [[ "$bin" == /tmp/* ]] && return 1
  echo "$bin"
}

# sudo <args...> - Wrapper that logs the caller and command before executing sudo.
# Helps track which script/function is requesting elevated privileges.
function sudo() {
  echo "[sudo] ${FUNCNAME[1]:-shell}: sudo $*" >&2
  command sudo "$@"
}

# safe_touch <file...> - Creates the file only if it does not exist. Skips existing files to
# avoid updating mtime (which would reset staleness checks). For files inside $HOME,
# fixes ownership to current user if owned by root.
function safe_touch() {
  for f in "$@"; do
    if [ ! -e "$f" ]; then
      command touch "$f"
      echo ">> safe_touch >> $f >> Created"
    elif [[ "$f" == "$HOME"/* ]] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_touch >> $f >> Fixed ownership"
    else
      echo ">> safe_touch >> $f >> Skipped"
    fi
  done
}

# safe_mkdir <dir...> - Creates directories (-p by default), then fixes ownership to
# current user for any resulting dir inside $HOME that is owned by root.
function safe_mkdir() {
  command mkdir -p "$@"
  for f in "$@"; do
    [[ "$f" == -* ]] && continue
    if [[ "$f" == "$HOME"/* ]] && [ -d "$f" ] && [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" != "$(id -u)" ]; then
      sudo chown "$USER" "$f"
      echo ">> safe_mkdir >> $f >> Fixed ownership"
    else
      echo ">> safe_mkdir >> $f >> OK"
    fi
  done
}

# safe_chown [-R] [user] <path> - Runs sudo chown on a single path only if it exists
# and is not already owned by the target user. Defaults to $USER if no user given.
# Pass -R as the first argument to chown recursively. Always pass one path per call.
# Usage:
#   safe_chown "$HOME/.bashrc"              # chown to $USER
#   safe_chown -R "$HOME/.config"           # chown -R to $USER
#   safe_chown otheruser "$HOME/.bashrc"    # chown to otheruser
#   safe_chown -R otheruser "$HOME/.config" # chown -R to otheruser
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local target_user="$USER"
  if [ -n "$1" ] && [ ! -e "$1" ] && id "$1" &> /dev/null; then
    target_user="$1"
    shift
  fi
  local target_uid
  target_uid=$(id -u "$target_user")
  local f="$1"
  if [ ! -e "$f" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%u' "$f" 2> /dev/null || stat -f '%u' "$f" 2> /dev/null)" = "$target_uid" ]; then
    echo ">> safe_chown $flags $target_user >> $f >> Skipped (already correct)"
  else
    sudo chown $flags "$target_user" "$f"
    echo ">> safe_chown $flags $target_user >> $f >> Done"
  fi
}

# safe_chmod [-R] <mode> <path> - Runs chmod on a single path only if it exists
# and permissions differ from the target mode. Always pass one path per call.
# Pass -R as the first argument to chmod recursively.
# Usage:
#   safe_chmod 700 "$HOME/.ssh"
#   safe_chmod 600 "$HOME/.ssh/id_rsa"
function safe_chmod() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local mode="$1"
  local f="$2"
  if [ ! -e "$f" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (not found)"
  elif [ "$(stat -c '%a' "$f" 2> /dev/null || stat -f '%Lp' "$f" 2> /dev/null)" = "$mode" ]; then
    echo ">> safe_chmod $flags $mode >> $f >> Skipped (already correct)"
  else
    chmod $flags "$mode" "$f"
    echo ">> safe_chmod $flags $mode >> $f >> Done"
  fi
}

# get_github_raw_url <path> - Constructs a GitHub raw content URL for a file in this repo.
# Uses BASH_PROFILE_CODE_REPO_RAW_URL as the base and appends ?raw=1.
# Usage: curl -fsSL "$(get_github_raw_url software/bootstrap/setup.sh)" | bash
function get_github_raw_url() {
  echo "${BASH_PROFILE_CODE_REPO_RAW_URL}/${1}?raw=1"
}

# is_path_stale <path> [max_age_seconds] - Returns 0 (true) when the path is older than
# max_age_seconds or missing. Defaults to 2 weeks (1209600s) when no max age given.
function is_path_stale() {
  ((IS_REFRESH_MODE)) && return 0
  local target="$1"
  local max_age="${2:-1209600}"
  if [ -e "$target" ]; then
    local mtime
    mtime=$(stat -c '%Y' "$target" 2> /dev/null || stat -f '%m' "$target" 2> /dev/null || echo 0)
    [ $(($(date +%s) - mtime)) -gt "$max_age" ] && return 0
    return 1
  fi
  return 0
}

# is_force_refresh_stale [path] - Returns 0 (true) only when IS_FORCE_REFRESH=1 AND the path
# is stale. Defaults to BASH_SYLE_PATH when no path given.
# Used by medium/heavy scripts to avoid unnecessary re-downloads when the install is still fresh.
function is_force_refresh_stale() {
  ! ((IS_FORCE_REFRESH)) && return 1
  ((IS_REFRESH_MODE)) && return 0
  local target="${1:-$BASH_SYLE_PATH}"
  if is_path_stale "$target"; then return 0; fi
  echo ">> Force refresh skipped (not stale): $target"
  return 1
}

# is_bash_syle_stale - Returns 0 (true) when ~/.bash_syle is older than 2 weeks or missing.
# Used by dependency scripts to skip package index updates.
function is_bash_syle_stale() {
  is_path_stale "$BASH_SYLE_PATH"
}

# exit_if_limited_support_os - Exits the script if the current OS is a limited-support
# platform (LIMITED_SUPPORT_OSES) or if IS_LIGHT_WEIGHT_MODE is enabled.
function exit_if_limited_support_os() {
  ((IS_LIGHT_WEIGHT_MODE)) && {
    echo ">>> Skipped : Lightweight mode"
    exit 0
  }
  local IFS=','
  for os_flag in $LIMITED_SUPPORT_OSES; do
    ((${os_flag:-0})) && {
      echo ">>> Skipped : Not supported on $os_flag"
      exit 0
    }
  done
}
# SOURCE_END software/bootstrap/common-functions.bash
################################################################################
# ---- Command Wrappers ----
#
# --- SQLite ---
# sqlite        — Wrapper: prefers sqlite3, falls back to sqlite
#
# --- Python ---
# activate_py   — Activate Python venv if not already active
# python        — Lazy wrapper: activates venv on first use, then delegates
# pip           — Smart wrapper: uses uv pip in uv venvs, pip3 fallback
#
# --- Node / NPM ---
# activate_node — Activate node via fnm (default version) or system node
# node          — Lazy wrapper: activates fnm on first use, then delegates
# npm           — Smart wrapper: bare args run as "npm run <name>"
# yarn          — Smart wrapper: falls back to npm if yarn unavailable
# renpm         — Delete node_modules and reinstall (yarn/npm ci/npm install)
#
# Lazy-activation wrappers shadow the real binaries so the first invocation
# triggers setup (e.g. activating a venv or fnm), then delegates to the
# real command. Sourced AFTER spec-based autocomplete.
################################################################################

################################################################################
# ---- SQLite ----
################################################################################
function sqlite() {
  if type -P sqlite3 &> /dev/null; then
    command sqlite3 "$@"
  elif type -P sqlite &> /dev/null; then
    command sqlite "$@"
  else
    echo "sqlite: not installed"
  fi
}

################################################################################
# ---- Python ----
################################################################################
function activate_py() {
  type -P python &> /dev/null && return
  if [[ -z "$VIRTUAL_ENV" ]]; then
    local venv_candidates=(
      "./.venv/bin/activate"
      "./venv/bin/activate"
      "$HOME/.venv/bin/activate"
      "$HOME/venv/bin/activate"
    )
    local venv_activate
    venv_activate=$(find_path "${venv_candidates[@]}" --file) && safe_source "$venv_activate"
  fi
}

function python() {
  if ! type -P python &> /dev/null; then
    activate_py
  fi
  command python "$@"
}

function pip() {
  activate_py
  if [ -n "$VIRTUAL_ENV" ] && grep -q "^uv" "$VIRTUAL_ENV/pyvenv.cfg" 2> /dev/null && type -P uv &> /dev/null; then
    command uv pip "$@"
  elif type -P pip3 &> /dev/null; then
    command pip3 "$@"
  elif type -P pip &> /dev/null; then
    command pip "$@"
  else
    echo "pip: not installed"
  fi
}
alias pip3='pip'

################################################################################
# ---- Node / NPM ----
################################################################################
# activates node via fnm (Fast Node Manager) with its default version, or falls back to system node.
# usage:
#   activate_node        - use fnm's default node version (preferred)
#   activate_node 1      - skip fnm, use system-installed node directly
function activate_node() {
  local use_system="${1-}"
  if [ "$use_system" != "1" ] && [ "$use_system" != "true" ] && type -P fnm &> /dev/null; then
    eval "$(fnm env)" 2> /dev/null
    local default_version
    default_version=$(fnm ls 2> /dev/null | grep -i "default" | grep -o "v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*")
    if [ -n "$default_version" ]; then
      echo "activate_node: fnm node $default_version ($(fnm exec --using="$default_version" type -P node 2> /dev/null))"
      fnm use "$default_version" &> /dev/null
    fi
  else
    local node_path
    node_path=$(type -P node 2> /dev/null)
    if [ -n "$node_path" ]; then
      echo "activate_node: node found at $node_path"
      if [ -L "$node_path" ]; then
        echo "activate_node: symlink target $(readlink -f "$node_path")"
      fi
    fi
  fi
}

# lazy wrapper: activates node on first use if not already available, then delegates to the real binary.
function node() {
  if ! type -P node &> /dev/null; then
    activate_node
  fi
  command node "$@"
}

# checks if a script name exists in ./package.json (excludes built-in npm subcommands)
function _has_pkg_script() {
  case "$1" in
  access | adduser | audit | bugs | cache | ci | completion | config | dedupe | deprecate | diff | dist-tag | docs | doctor | edit | exec | explain | explore | find-dupes | fund | get | help | hook | init | install | install-ci-test | install-test | link | ll | login | logout | ls | org | outdated | owner | pack | ping | pkg | prefix | profile | prune | publish | query | rebuild | repo | restart | root | run | sbom | search | set | shrinkwrap | star | stars | start | stop | team | test | token | uninstall | unpublish | unstar | update | version | view | whoami) return 1 ;;
  esac
  [ -f package.json ] && node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)" 2> /dev/null
}

# wraps npm so bare subcommand names run as `npm run <name>`
function npm() {
  if [ -n "${1-}" ] && [[ "${1-}" != -* ]] && _has_pkg_script "$1"; then
    command npm run "$@"
  else
    command npm "$@"
  fi
}

# wraps yarn so bare subcommand names run as `yarn run <name>`, falls back to npm
function yarn() {
  if type -P yarn &> /dev/null && command yarn --version &> /dev/null; then
    if [ -n "${1-}" ] && [[ "${1-}" != -* ]] && _has_pkg_script "$1"; then
      command yarn run "$@"
    else
      command yarn "$@"
    fi
  else
    npm "$@"
  fi
}

function renpm() {
  rm -rf node_modules
  if [ -f yarn.lock ]; then
    yarn install
  elif [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
}
# SOURCE_END software/scripts/bash-command-wrappers-profile.bash
################################################################################
# ---- OS-specific Tweaks (registerPlatformTweaks) ----
################################################################################

# BEGIN Arch Linux OS-specific Tweaks
# Only Arch Linux alias

# set brightness via ddc/ci (for external monitor)
# more info here - https://moverest.xyz/blog/control-display-with-ddc-ci/
alias set-brightness='sudo modprobe i2c-dev; sudo ddcutil setvcp 10'
alias brightness='set-brightness'

# override steamos prompt and properly use PS1 prompt
PROMPT_COMMAND=""
# END Arch Linux OS-specific Tweaks

fi
################################################################################
# ---- end advanced profile ----
################################################################################