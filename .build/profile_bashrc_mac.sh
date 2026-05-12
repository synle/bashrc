# NOTE: STOP - do not edit by hand - this file is auto-generated [2026-05-12]
# 
# Precompiled bash profile for mac
# ################################################################################

################################################################################
# ---- begin core profile ----
################################################################################

#!/usr/bin/env bash
# software/bootstrap/profile-core.sh

################################################################################
# ---- Debug Tracing ----
# Enable:  echo 1 > /tmp/synle/bashrc/debug
# Disable: rm /tmp/synle/bashrc/debug
# Logs stacktrace to /tmp/synle/bashrc/debug.log on ERR and EXIT.
################################################################################
_BASHRC_DEBUG_DIR="/tmp/synle/bashrc"
if [ -f "$_BASHRC_DEBUG_DIR/debug" ]; then
  _debug_val=$(command cat "$_BASHRC_DEBUG_DIR/debug" 2> /dev/null)
  case "$_debug_val" in
  1 | true | TRUE | True)
    set -x
    function _debug_stacktrace() {
      local exit_code=$?
      local log="$_BASHRC_DEBUG_DIR/debug.log"
      {
        echo "--- ${1:-ERROR} at $(date '+%Y-%m-%d %H:%M:%S') (exit code: $exit_code) ---"
        local i
        for ((i = 0; i < ${#FUNCNAME[@]}; i++)); do
          echo "  [$i] ${FUNCNAME[$i]}() at ${BASH_SOURCE[$i]:-profile}:${BASH_LINENO[$i]}"
        done
        echo ""
      } >> "$log"
      echo "[debug] $1: exit=$exit_code at ${BASH_SOURCE[1]:-profile}:${BASH_LINENO[0]} in ${FUNCNAME[1]:-main} (see $log)" >&2
    }
    trap '_debug_stacktrace ERR' ERR
    trap '_debug_stacktrace EXIT' EXIT
    ;;
  esac
  unset _debug_val
fi

################################################################################
# ---- Pre-core Profile Blocks (registerWithBashSyleProfile) ----
#
# BEGIN Profile Generated Timestamp
# Generated: 2026-05-12T02:47:40.123Z
# END Profile Generated Timestamp
#
################################################################################
# SOURCE_BEGIN software/scripts/bash-history.profile.bash
# software/scripts/bash-history.profile.bash | bd7778a6e0fadd5ed1b9d29f8363ebea | 10.2 KB | 2026-05-12
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

# rewrites a history file in place. Two passes:
#
# Quick pass (default — used by fuzzy_history on every Ctrl+R, must stay fast):
#   1. trim leading/trailing whitespace
#   2. strip leading wrapper prefixes (`br;`, `clear;` — user-defined no-op
#      wrappers that don't change the meaningful command). Looped so chains
#      like `br; clear; foo` collapse to `foo` before dedupe sees them, which
#      lets `foo` and `clear; foo` count as the same entry.
#   3. drop empty lines (post-trim — blank lines from pasted blocks)
#   4. drop bash HISTTIMEFORMAT timestamp markers — `#<unix_seconds>` lines
#      written by bash itself. Pattern is narrow (`^#[0-9]+$`) so user-typed
#      `# note` lines and `# TODO ...` reminders survive.
#   5. drop any line starting with `"` (JSON / PowerShell / config paste
#      fragments — `"model": "..."`, `"$edgeBase\Main" = @{...}`, etc. Legit
#      bash starting with `"` is rare in interactive history — usually you'd
#      type `$VAR arg` not `"$VAR" arg` — so the simpler blanket rule beats
#      narrower patterns)
#   5b. drop any line starting with `$` (PowerShell variable assignments and
#       references — `$var = "..."`, `$var.Method()`, etc. `bash -n` accepts
#       `$var = ...` because spaced `=` makes it three args, not assignment.
#       Legit bash starting with `$` like `$EDITOR file` is rare interactively
#       — same tradeoff as the `^"` rule)
#   6. drop lines ending in bare `{` (JS/TS/Go/Java block-opener paste — `try {`,
#      `function foo() {`, `if (x) {`. Real bash multi-line defs get joined by
#      `cmdhist` into a single entry, so a stored entry ending in `{` is paste
#      residue. Catches what `bash -n` misses since `{` in arg position parses fine)
#   7. drop lines starting with `}` (closing-brace paste residue: `}`, `});`,
#      `} catch`, `} else {`. Mostly redundant with `bash -n` but cheaper and
#      defends against future parser quirks)
#   7b. drop PowerShell verb-noun cmdlets — `Set-ItemProperty`, `Get-ChildItem`,
#       `New-Object`, etc. Pattern is `<Capital><lowercase>+-<Capital>`, which
#       virtually never matches a real bash command. `bash -n` accepts these
#       because the cmdlet name is a syntactically valid command word.
#   7c. drop JS-keyword-then-brace lines: `try { ... }`, `catch { ... }`,
#       `finally { ... }`. `try`/`catch`/`finally` aren't bash reserved words,
#       so `try { foo }` parses as a simple command with literal brace args
#       (caught nothing in earlier `[{]$` and bash -n filters when the closing
#       `}` is on the same line).
#   7d. drop hex-byte literal lines: `0x80, 0x99, 0x19, ...`. C/Go/Python
#       byte-array paste residue. `0x80,` is a syntactically valid bash command
#       word (digits, letters, comma all legal in token position).
#   8. dedupe
#
# Strict pass (`--strict` — used by _backup_history once a day):
#   9. drop anything that fails `bash -n` (unbalanced quotes, dangling pipes,
#      half-pasted commands). Forks bash once per unique line; only worth it
#      on the daily backup, not on every Ctrl+R.
#
# Atomic via tmp + mv.
# usage: _clean_history_file [path] [--strict]   (path default: ~/.bash_history)
function _clean_history_file() {
  local file="$HOME/.bash_history"
  local strict=0
  local arg
  for arg in "$@"; do
    case "$arg" in
    --strict) strict=1 ;;
    *) file="$arg" ;;
    esac
  done
  [ -f "$file" ] || return 0
  local tmp="$file.tmp.$$"
  sed 's/^[[:space:]]*//;s/[[:space:]]*$//' "$file" \
    | sed -E -e ':loop' -e 's/^(br|clear)[[:space:]]*;[[:space:]]*//' -e 't loop' \
    | command grep -v '^$' \
    | command grep -v '^#[0-9][0-9]*$' \
    | command grep -v '^"' \
    | command grep -v '^\$' \
    | command grep -v '[{]$' \
    | command grep -v '^}' \
    | command grep -v '^[A-Z][a-z][a-z]*-[A-Z]' \
    | command grep -v '^try[[:space:]]*{' \
    | command grep -v '^catch[[:space:]]*{' \
    | command grep -v '^finally[[:space:]]*{' \
    | command grep -v '^0x[0-9A-Fa-f]' \
    | awk '!seen[$0]++' \
    | {
      if ((strict)); then
        while IFS= read -r line; do bash -n <<< "$line" 2> /dev/null && printf '%s\n' "$line"; done
      else
        command cat
      fi
    } > "$tmp" && mv "$tmp" "$file"
}

# backs up ~/.bash_history daily (rotated, keeps HISTORY_BACKUP_MAX copies)
# runs automatically on shell startup. Cleans the live file first so the backup
# is the cleaned snapshot, not the raw stream.
function _backup_history() {
  local today
  today=$(command date +%Y-%m-%d)
  local backup_file="$HISTORY_BACKUP_DIR/bash_history_$today"

  # skip if already backed up today
  [ -f "$backup_file" ] && return

  _clean_history_file "$HOME/.bash_history" --strict

  mkdir -p "$HISTORY_BACKUP_DIR"
  cp "$HOME/.bash_history" "$backup_file" 2> /dev/null

  # rotate: keep only the most recent backups
  ls -1t "$HISTORY_BACKUP_DIR"/bash_history_* 2> /dev/null | tail -n +$((HISTORY_BACKUP_MAX + 1)) | xargs rm -f 2> /dev/null
}
_backup_history

# interactive fuzzy history search using fzf. Dual-mode based on call context:
#   - From Ctrl+R (bind -x sets READLINE_LINE in env): place selection on the
#     readline prompt for the user to edit before pressing Enter — matches the
#     standard Ctrl+R behavior, safer for destructive commands.
#   - From the prompt or a script (READLINE_LINE unset): eval the selection
#     immediately. Useful for `fuzzy_history docker` style "find-and-run" calls.
function fuzzy_history() {
  if is_help_arg "${1:-}"; then
    echo "fuzzy_history: interactive fzf search over bash history"
    echo "  fuzzy_history [query]    search with optional initial query"
    echo "  fuzzy_history help       show this help"
    echo "  (also bound to Ctrl+R — that variant places selection on prompt instead of running it)"
    return
  fi
  if ! type -P fzf &> /dev/null; then
    echo "fuzzy_history: fzf not installed, use Ctrl+R for built-in search"
    return 1
  fi

  # Detect bind -x context: bash sets READLINE_LINE in the function env when invoked
  # via "bind -x". Use "${var+x}" (set-but-empty-safe) instead of "[[ -v ]]" which
  # requires bash 4.2+ — macOS still ships /bin/bash 3.2.
  local from_bind=0
  [ -n "${READLINE_LINE+x}" ] && from_bind=1

  local header
  if ((from_bind)); then
    header="(Ctrl+R) - fzf history search; selection placed on prompt for edit"
  else
    header="fuzzy_history - fzf history search; selection runs on Enter"
  fi

  # Clean the live history file first (dedupe + bash -n), then fzf reads the cleaned
  # content. Mutating ~/.bash_history here means subsequent Ctrl+R calls are fast
  # (no-op on already-clean entries) and `history` reflects the cleaned dataset.
  _clean_history_file "$HOME/.bash_history"

  local selected
  selected=$(command cat "$HOME/.bash_history" | fzf \
    --no-sort --tac --layout=reverse --height=100% --query="${1:-}" \
    --prompt="history> " \
    --header="$header" \
    --preview='echo {} | bat --paging=never --style=plain --color=always --language=bash' \
    --preview-window=down:20%:wrap)

  if [ -n "$selected" ]; then
    if ((from_bind)); then
      READLINE_LINE="$selected"
      READLINE_POINT=${#selected}
    else
      echo "$selected"
      history -s "$selected"
      eval "$selected"
    fi
  fi
}

# lists all available history backups with date and line count
function history_list_backups() {
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
# SOURCE_END software/scripts/bash-history.profile.bash
# BEGIN fnm - fast node manager
# hookup binary - add default node version to PATH
export FNM_DIR="/Users/runner/.local/share/fnm"
export PATH="/Users/runner/.local/share/fnm:$PATH"
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
# BEGIN mac-system-setup
# homebrew paths
for brew_prefix in /opt/homebrew /usr/local; do
  if [ -d "$brew_prefix" ] && [ -x "$brew_prefix/bin/brew" ]; then
    export HOMEBREW_PREFIX="$brew_prefix"
    export HOMEBREW_CELLAR="$brew_prefix/Cellar"
    export HOMEBREW_REPOSITORY="$brew_prefix"
    export PATH="$brew_prefix/bin:$brew_prefix/sbin:$PATH"
    export MANPATH="$brew_prefix/share/man:$MANPATH"
    export INFOPATH="$brew_prefix/share/info:$INFOPATH"
    break
  fi
done
# END mac-system-setup
# BEGIN temporal-cli
export PATH="/Users/runner/.temporalio/bin:$PATH"
# END temporal-cli
# SOURCE_BEGIN software/scripts/bash-path-candidate.profile.bash
# software/scripts/bash-path-candidate.profile.bash | fa0d46adc25ecab07c6a151e92d4bb92 | 3.5 KB | 2026-05-12
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
# SOURCE_END software/scripts/bash-path-candidate.profile.bash
export EDITOR='vim'
export BASH_PATH=~/.bash_syle
export LINE_BREAK_COUNT=100
export LINE_BREAK_HASH=$(printf '#%.0s' $(seq 1 $LINE_BREAK_COUNT))

################################################################################
# ---- Help-Trigger Helper ----
# Single source of truth for the "is this arg a --help request?" check used by
# every user-facing function across the profile. Defined in profile-core (not
# profile-advanced) so any partial sourced later can rely on it. Keep this
# function body byte-identical with the copy in common-functions.bash — the
# pair must accept the same trigger set.
################################################################################

# is_help_arg <arg> - returns 0 (success) if arg is a recognized --help trigger
# Recognizes (case-insensitive):
#   help, --help, -help, /help    full word, every common prefix style
#   -h                            short
#   ?, -?, /?                     DOS / PowerShell short
# `tr` (not bash 4's ${var,,}) is used so this stays parseable on bash 3.2 —
# safe_source rejects any partial that fails `bash -n` on macOS's /bin/bash.
# Single-quote `?` patterns in the case so glob expansion does not match them
# against any single character.
function is_help_arg() {
  local arg
  arg=$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')
  case "$arg" in
  help | --help | -help | /help | -h | '?' | '-?' | '/?') return 0 ;;
  *) return 1 ;;
  esac
}

################################################################################
# ---- Path / Action Helpers ----
# Defined here in profile-core (not profile-advanced) so any partial sourced
# later — bash-fzf's view_file, editor-launchers' run_editor, etc. — can
# rely on these being defined when their function bodies execute.
################################################################################

# to_windows_path <unix_path> - Convert a unix path to a Windows-style mixed-slash path
# via `wslpath -m`. On non-WSL systems (or when wslpath is unavailable) echoes the input
# unchanged, so callers can use it unconditionally — safe no-op off WSL.
function to_windows_path() {
  if type -P wslpath &> /dev/null; then
    wslpath -m "$1" 2> /dev/null || echo "$1"
  else
    echo "$1"
  fi
}

# print_action_summary <target_path> [<binary> [<extra_args>...]] - Render a copy-paste-
# runnable summary block for an "act on a path" operation: PWD context, the cd you'd
# run to reach the target's folder, and (optionally) the binary invocation that opens
# the target. On WSL, mirrors each unix line with a Windows-style follow-up — the
# unix command is always printed first so the user can paste it into the current
# shell, and the resolved line only appears as a second hop when it differs.
#
# Output:
#   ====================================
#   PWD: "<pwd>"
#   cd "<dir>"                              # unix folder (parent for files, self for folders)
#   cd "<resolved_dir>"                     # only on WSL when the resolved path differs
#   <binary> [extra_args] "<target>"        # only when binary is passed; unix path
#   <binary> [extra_args] "<resolved_tgt>"  # only on WSL when the resolved path differs
#   ====================================
#
# Used by view_file, fuzzy_edit, fuzzy_cd, run_editor — single source
# of truth for the format. Always prefer this over hand-rolling echo blocks.
function print_action_summary() {
  local target="$1"
  shift || return 1
  local binary="${1:-}"
  [ $# -gt 0 ] && shift
  local -a extra_args=("$@")

  # Resolve to absolute. Tolerate non-existent paths (realpath returning non-zero).
  local target_abs
  target_abs=$(realpath "$target" 2> /dev/null) || target_abs="$target"

  # cd target = the folder. Parent for files, self for directories.
  local dir
  if [ -d "$target_abs" ]; then
    dir="$target_abs"
  else
    dir=$(dirname "$target_abs")
  fi

  # WSL conversion. On non-WSL these equal the originals (to_windows_path is a no-op),
  # so the resolved mirror lines never fire off-Windows.
  local resolved_dir resolved_target
  resolved_dir=$(to_windows_path "$dir")
  resolved_target=$(to_windows_path "$target_abs")

  echo "===================================="
  echo "PWD: \"$(pwd)\""
  echo "cd \"$dir\""
  [ "$resolved_dir" != "$dir" ] && echo "cd \"$resolved_dir\""
  if [ -n "$binary" ]; then
    local prefix="$binary"
    [ ${#extra_args[@]} -gt 0 ] && prefix="$binary ${extra_args[*]}"
    echo "$prefix \"$target_abs\""
    [ "$resolved_target" != "$target_abs" ] && echo "$prefix \"$resolved_target\""
  fi
  echo "===================================="
}

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
alias lc="wc -l"                      # line count
alias tailf="tail -n 500 -f"          # show last 500 lines then follow
alias tailn="tail -n"                 # show last N lines
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
#
# HISTCONTROL is intentionally NOT 'ignoreboth' (= ignorespace + ignoredups).
# 'ignoredups' silently drops a command when it's identical to the immediately
# previous in-history entry. In test/iteration workflows where the user reruns
# the same command minutes apart with nothing else between them in this shell
# (typing into a chat/IDE in between counts as nothing for bash), the rerun
# gets eaten — never appears in `history`, never written to ~/.bash_history,
# never visible in fuzzy_history (Ctrl+R). We use 'erasedups' instead: every
# run gets added; older identical entries are then erased, leaving exactly
# one entry at the most-recent run position. That's what Ctrl+R users expect.
# 'ignorespace' is kept so a leading space still suppresses sensitive commands.
# See docs/bash-common-knowledge.md → "Bash History" for the full write-up.
################################################################################
export HISTSIZE=80000
export HISTFILESIZE=80000
export HISTTIMEFORMAT="[%F %T] "
export HISTCONTROL=ignorespace:erasedups
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
  # Length-based filters: bare commands of 1-4 chars are nearly always navigation
  # or noise (ls/ll/cd/.. / vi/cat/git/exit/make/etc. with no args). The patterns
  # are anchored to the FULL command line, so 'vim a.txt' (12 chars) and any
  # command-with-args is unaffected — only standalone short commands are dropped.
  # See docs/bash-common-knowledge.md → "Bash History" for the full mechanics
  # and the reasoning behind these filters.
  "?"
  "??"
  "???"
  "????"
  "clear"
  "history"
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
  command cat - "$file" 2> /dev/null | awk '!seen[$0]++' | head -n "$max" > "$tmp"
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
  command cat "$_RECENT_FOLDERS_FILE"
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

# Ghostty's bash shell-integration script (loaded before this profile) appends
# `\[\e[5 q\]` (blinking bar) to PS1 inside its __ghostty_precmd hook whenever
# `$GHOSTTY_SHELL_FEATURES` contains the literal string "cursor". Even if
# `shell-integration-features` is updated in ~/.config/ghostty/config to drop
# "cursor", existing shells already have the old env var. Strip it here so the
# precmd hook's cursor branch becomes a no-op and our block-cursor sticks.
[ -n "${GHOSTTY_SHELL_FEATURES:-}" ] && export GHOSTTY_SHELL_FEATURES="${GHOSTTY_SHELL_FEATURES//cursor/}"

# append history to file after every command (but do NOT clear+reload with -c/-r,
# so Up arrow navigates current tab's session history instead of showing commands
# from other tabs. Ctrl+R / fuzzy_history search the shared file for cross-tab history)
# Also force the terminal cursor back to a steady (non-blinking) block via
# DECSCUSR `\e[2 q` on every prompt — defends against shell integrations,
# plugins, or stray escape sequences that flip the cursor to a bar/beam.
PROMPT_COMMAND="_track_folder; history -a; echo -ne '\033]0;'\"\$(shorter_pwd_path)\"'\007\033[2 q'${PROMPT_COMMAND:+;$PROMPT_COMMAND}"

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
  command cat "$_RECENT_FILES_FILE"
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
# ---- Shell Utilities ----
################################################################################
# find all existing paths from a list of candidates (supports wildcards)
function find_path_list() {
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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

# prompts the user with a yes/no question (default no)
# Mirror of the same function in software/bootstrap/common-functions.bash —
# keep in sync. Profile partials cannot SOURCE common-functions.bash because
# the profile is loaded on every interactive shell startup and we want to
# keep it lean, so the function is duplicated here.
function prompt_yes_no() {
  if is_help_arg "${1:-}"; then
    echo "
      prompt_yes_no: prompt the user with a yes/no question
        Usage: prompt_yes_no <prompt> [default]
        default: 'Y' or 'N' (case-insensitive); defaults to 'N'.
        Returns 0 on yes; 1 on no / empty / no-tty.
        Example: prompt_yes_no 'Continue?' && do_thing
        Example: prompt_yes_no 'Skip step?' Y && skip_step
    "
    return 0
  fi
  local prompt="$1"
  local default="${2:-N}"
  local hint="[y/N]"
  case "$default" in [Yy]*) hint="[Y/n]" ;; esac

  # Probe /dev/tty by actually opening it. `[ -r /dev/tty ]` lies — the
  # device node always exists, but open() returns ENXIO when the process has
  # no controlling terminal (CI, daemons, piped shells).
  (: < /dev/tty) 2> /dev/null || return 1

  local reply=""
  read -rp "$prompt $hint " reply < /dev/tty
  reply="$(echo "$reply" | tr '[:lower:]' '[:upper:]' | xargs)"

  if [ -z "$reply" ]; then
    case "$default" in [Yy]*) return 0 ;; esac
    return 1
  fi

  case "$reply" in Y | YES) return 0 ;; esac
  return 1
}

################################################################################
# ---- HTTP / Networking Utilities ----
################################################################################
# curl drop-in: pretty-prints JSON responses via jq when available
function curl() {
  if is_help_arg "${1:-}"; then
    echo "
      curl: drop-in curl wrapper that pretty-prints JSON responses via jq
        curl <url> [flags...]    standard curl; auto-formats JSON when applicable
        Falls back to plain \`command curl\` when:
          - jq is not installed
          - stdout is not a TTY (i.e. piped or redirected — preserves streaming)
          - any output-redirect / download flag is present
            (-o, -O, -J, --remote-name-all, -i, -I, -D, -T, -w, --output-dir)
          - the response is not JSON
    "
    return 0
  fi

  # No jq installed → straight pass-through.
  type -P jq &> /dev/null || {
    command curl "$@"
    return
  }

  # stdout is not a TTY (caller is piping or redirecting) → don't intercept.
  # Preserves streaming for `curl URL | tar xz`, `curl URL | bash`, `curl URL > file`, etc.
  [ -t 1 ] || {
    command curl "$@"
    return
  }

  # Caller manages output → don't intercept.
  local arg
  for arg in "$@"; do
    case "$arg" in
    -o | --output | -O | --remote-name | --remote-name-all | \
      -J | --remote-header-name | \
      -i | --include | -I | --head | \
      -D | --dump-header | -T | --upload-file | \
      -w | --write-out | --output-dir)
      command curl "$@"
      return
      ;;
    esac
  done

  local tmpdir
  tmpdir=$(mktemp -d) || {
    command curl "$@"
    return
  }
  trap 'rm -rf "$tmpdir"' RETURN

  command curl "$@" -D "$tmpdir/headers" -o "$tmpdir/body" || return

  # Use `tail -1` so the FINAL response's Content-Type wins after redirects
  # (-D dumps every hop's headers; the first hop is usually text/html for 30x).
  local content_type
  content_type=$(grep -i '^content-type:' "$tmpdir/headers" | tail -1 | tr -d '\r' | sed 's/.*://' | tr '[:upper:]' '[:lower:]')

  if [[ "$content_type" == *json* ]] && jq -e . "$tmpdir/body" &> /dev/null; then
    jq . "$tmpdir/body"
  else
    command cat "$tmpdir/body"
  fi
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
# `fd` is guaranteed on PATH by ensure_binary_alias (apt's fd-find installs as
# fdfind; we symlink $HOME/.local/bin/fd). Other distros ship `fd` directly.
type -P fd &> /dev/null && alias f='fd'

# ---- Aliases: Editors / Tools ----
alias bs="bash"
alias vi="vim"
alias v="vim"
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
alias cm='cl --model claude-opus-4-7[1m]'

# ---- Aliases: Gemini ----
alias gem="gemini"

# ---- Aliases: SSH ----
alias s="ssh"

################################################################################
# ---- Utility Functions ----
################################################################################
function pwd2() {
  print_action_summary "."
}

# to_windows_path / print_action_summary live in profile-core.sh so they are
# guaranteed available before any partial sourced via SOURCE markers tries to call
# them (view_file in bash-fzf, run_editor in editor-launchers).

################################################################################
# ---- Diff (file diff or git hash compare) ----
################################################################################
# smart diff for files or git commits
function diff() {
  if is_help_arg "${1:-}"; then
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

# list source repo names for a GitHub user (default: synle)
function repos() {
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
  if [ -z "$file_path" ] || is_help_arg "$file_path"; then
    echo "
      purge: remove a file or directory from entire git history
        Usage: purge [-r] <path-to-file-or-dir>
    "
    return 1
  fi

  if ! prompt_yes_no "Purge '$file_path' from entire git history?"; then
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
  local total_steps=8
  local current_step=0

  function _log_step() {
    current_step=$((current_step + 1))
    local remaining=$((total_steps - current_step))
    local percent=$((current_step * 100 / total_steps))
    echo "[Step $current_step/$total_steps - ${percent}% done, $remaining left] $1"
  }

  _log_step "Aborting any in-progress git operation..."
  git abort

  _log_step "Cleaning working tree and fetching latest from origin..."
  git clean-and-fetch

  _log_step "Resolving default branch..."
  local default_branch
  default_branch=$(_get_default_branch) || return 1
  echo "  -> default branch: $default_branch"

  local current_branch
  current_branch=$(git branch --show-current)
  echo "  -> current branch: $current_branch"

  # Back up current branch to a temp branch
  local temp_branch="temp/$(command date +%Y%m%d-%H%M%S)"
  _log_step "Backing up current branch to temp branch: $temp_branch ..."
  git checkout -b "$temp_branch" > /dev/null 2>&1

  _log_step "Deleting local '$default_branch' (will be re-fetched from origin)..."
  git del "$default_branch" > /dev/null 2>&1

  _log_step "Checking out '$default_branch'..."
  git checkout "$default_branch" > /dev/null 2>&1

  _log_step "Rebasing '$default_branch' onto 'origin/$default_branch'..."
  git rebase "origin/$default_branch" > /dev/null 2>&1

  _log_step "Cleaning up temp backup branch: $temp_branch ..."
  git del "$temp_branch" > /dev/null 2>&1

  echo "# ---- Reset to origin/$default_branch (100% done) ----"
  git lastd
}

# Creates an empty commit on a new branch and pushes it to trigger a deployment
function commit_empty_trigger_deploy() {
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
  if [ -z "${1:-}" ] || is_help_arg "${1:-}"; then
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

  local input="${1:-$(command cat -)}"
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

  [[ "$clear_flag" != "no-clear" ]] && printf "\033[H\033[2J"

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
export PS1="\[\e[2 q\]\[\e[1;92m\]\$(get_time) \
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
  # Single optional arg — defaults to "." (current directory). Always prints the
  # action summary so users see exactly what's being opened and where.
  local target="${1:-.}"
  print_action_summary "$target" open

  if ((is_os_mac)); then
    command open "$target"
  elif type -P explorer.exe &> /dev/null; then
    explorer.exe "$target"
  elif type -P dolphin &> /dev/null; then
    dolphin "$target" 1>&- 2>&- &
  elif type -P thunar &> /dev/null; then
    thunar "$target" 1>&- 2>&- &
  elif type -P xdg-open &> /dev/null; then
    xdg-open "$target" 1>&- 2>&- &
  else
    echo "No file manager found"
  fi

  # When the target is a folder, the OS file manager is the predictable receiver
  # (Finder on mac, Explorer on Windows/WSL). Bring it to the foreground and tile
  # via the same dispatcher run_editor / run_browser use. For files we skip —
  # the default-app handler is unknown (could be Preview, Sublime, anything).
  #
  # TODO: extend to native Linux file managers (Dolphin / Thunar / xdg-open).
  # Dispatcher branch is by `type -P` above; mirror that here with the right
  # app_name per tool ("Dolphin", "Thunar"). xdg-open is the tricky one — it
  # routes to whatever the user's default file manager is, so we'd either
  # query xdg-mime or accept the unknown and skip.
  if [ -d "$target" ]; then
    local app_name=""
    if ((is_os_mac)); then
      app_name="Finder"
    elif ((is_os_wsl)); then
      app_name="Windows Explorer"
    fi
    if [[ -n "$app_name" ]]; then
      (maximize_and_focus_window "$app_name" > /dev/null 2>&1 &)
    fi
  fi
}

################################################################################
# ---- Maximize & Focus Window (cross-platform dispatcher) ----
#
# Brings a GUI app's window to the foreground and maximizes its main window.
# Used by run_editor and run_browser after launching the app in the background.
#
# Platform detection order:
#   1. macOS              — JXA + osascript (maximize to visible frame of the
#                           display under the mouse, tile extras in a grid)
#   2. WSL (Windows host) — powershell.exe + user32 P/Invoke (matches window by
#                           MainWindowTitle, ShowWindow(SW_MAXIMIZE), SetForegroundWindow)
#   3. Wayland            — try sway first (swaymsg), then XWayland via wmctrl;
#                           noop on KDE/GNOME where no portable CLI exists
#   4. X11                — wmctrl (preferred), fallback xdotool
#
# All branches silently noop if the required tool is missing. Callers do not
# need to guard with `((is_os_*))`.
################################################################################
function maximize_and_focus_window() {
  local app_name="$1"
  # Optional 2nd arg: macOS System Events process name. Defaults to app_name.
  # Pass explicitly when bundle display name != executable name (e.g. VS Code:
  # bundle "Visual Studio Code" / process "Code").
  local process_name="${2:-$app_name}"
  [[ -z "$app_name" ]] && return 0

  if ((is_os_mac)); then
    _mac_activate_and_tile "$app_name" "$process_name" 2> /dev/null
  elif ((is_os_wsl)); then
    _wsl_activate_and_maximize "$app_name" 2> /dev/null
  elif [[ -n "$WAYLAND_DISPLAY" ]]; then
    _wayland_activate_and_maximize "$app_name" 2> /dev/null
  elif [[ -n "$DISPLAY" ]]; then
    _x11_activate_and_maximize "$app_name" 2> /dev/null
  fi
  # Best-effort: never signal failure to the caller. An app that is not running,
  # does not expose window-1, or a missing wmctrl/powershell.exe should not trip
  # `set -e` or leave a non-zero $? in the user's shell.
  return 0
}

# X11 implementation: prefer wmctrl, fall back to xdotool. Both match by window
# title substring. Silent noop if neither tool is installed.
function _x11_activate_and_maximize() {
  local app_name="$1"
  if type -P wmctrl &> /dev/null; then
    wmctrl -a "$app_name" 2> /dev/null || return 0
    wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz 2> /dev/null
  elif type -P xdotool &> /dev/null; then
    local wid
    wid=$(xdotool search --name "$app_name" 2> /dev/null | head -1)
    [[ -z "$wid" ]] && return 0
    xdotool windowactivate "$wid" 2> /dev/null
    xdotool key --window "$wid" super+Up 2> /dev/null
  fi
}

# Wayland implementation: no universal window-control protocol. Best effort:
# - sway             — swaymsg focus + fullscreen
# - XWayland apps    — wmctrl still works for X11 apps in Wayland sessions
# - KDE/GNOME native — noop (requires shell extensions / DBus plumbing per-app)
function _wayland_activate_and_maximize() {
  local app_name="$1"
  if type -P swaymsg &> /dev/null; then
    swaymsg "[title=\"$app_name\"] focus" 2> /dev/null
    swaymsg "[title=\"$app_name\"] fullscreen enable" 2> /dev/null
  elif type -P wmctrl &> /dev/null; then
    wmctrl -a "$app_name" 2> /dev/null || return 0
    wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz 2> /dev/null
  fi
}

# WSL implementation: drive the Windows side via powershell.exe. Matches a
# window by MainWindowTitle substring, then calls user32!ShowWindow(SW_MAXIMIZE)
# + SetForegroundWindow via a tiny P/Invoke type. Silent noop if powershell.exe
# is missing or no matching window is found.
function _wsl_activate_and_maximize() {
  local app_name="$1"
  type -P powershell.exe &> /dev/null || return 0
  powershell.exe -NoProfile -Command "
    Add-Type -Name Win32 -Namespace BashrcWin -MemberDefinition '
      [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);
      [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    ' 2>\$null;
    Get-Process | Where-Object { \$_.MainWindowTitle -like '*$app_name*' } | ForEach-Object {
      [BashrcWin.Win32]::ShowWindow(\$_.MainWindowHandle, 3) | Out-Null;
      [BashrcWin.Win32]::SetForegroundWindow(\$_.MainWindowHandle) | Out-Null;
    }
  " 2> /dev/null
}

# macOS implementation: resolve the visible frame of the display under the mouse
# cursor, set window 1 of $app_name to that rect, and tile extra windows in a
# 300x200 grid from the top-left so they are easy to reach.
function _mac_activate_and_tile() {
  local app_name="$1"
  # System Events uses the *process* (executable) name, not the bundle display
  # name. Fall back to app_name when the caller does not provide one. e.g. VS
  # Code: bundle "Visual Studio Code" / process "Code".
  local process_name="${2:-$app_name}"
  [[ -z "$app_name" ]] && return 0

  # Resolve visible frame (AppleScript coords: top-left origin) of the display containing the mouse cursor
  local _disp _mx _my _mw _mh
  _disp=$(
    osascript -l JavaScript << 'JXA' 2> /dev/null
ObjC.import('AppKit');
const m = $.NSEvent.mouseLocation;
const ss = $.NSScreen.screens;
let t = ss.objectAtIndex(0);
for (let i = 0; i < ss.count; i++) {
  const s = ss.objectAtIndex(i), f = s.frame;
  if (m.x >= f.origin.x && m.x < f.origin.x + f.size.width &&
      m.y >= f.origin.y && m.y < f.origin.y + f.size.height) {
    t = s;
    break;
  }
}
const vf = t.visibleFrame;
const ph = ss.objectAtIndex(0).frame.size.height;
[Math.round(vf.origin.x), Math.round(ph - (vf.origin.y + vf.size.height)), Math.round(vf.size.width), Math.round(vf.size.height)].join(' ');
JXA
  )
  read -r _mx _my _mw _mh <<< "$_disp"
  # Fallback to primary desktop bounds if JXA failed
  if [[ -z "$_mw" || -z "$_mh" ]]; then
    _mx=0
    _my=0
    read -r _mw _mh <<< "$(osascript -e 'tell application "Finder" to set {_, _, sw, sh} to bounds of window of desktop' -e 'return (sw as string) & " " & (sh as string)' 2> /dev/null)"
  fi
  # `activate` is non-blocking — Electron apps (VS Code) take a beat to spawn their
  # first window, so we poll up to ~10s for window 1 of the process to exist before
  # tiling. Without this, a cold `code .` no-ops because window 1 does not exist yet.
  osascript << APPLESCRIPT 2> /dev/null
tell application "$app_name" to activate
tell application "System Events"
  set deadline to (current date) + 10
  repeat while (current date) < deadline
    if exists process "$process_name" then
      tell process "$process_name"
        if (count of windows) > 0 then exit repeat
      end tell
    end if
    delay 0.2
  end repeat
end tell
tell application "System Events" to tell process "$process_name"
  if (count of windows) is 0 then return
  set position of window 1 to {$_mx, $_my}
  set size of window 1 to {$_mw, $_mh}
  set windowCount to count of windows
  if windowCount > 1 then
    set tileW to 300
    set tileH to 200
    set tileCols to $_mw div tileW
    repeat with i from 2 to windowCount
      set tileCol to ((i - 2) mod tileCols)
      set tileRow to ((i - 2) div tileCols)
      set position of window i to {$_mx + (tileCol * tileW), $_my + (tileRow * tileH)}
      set size of window i to {tileW, tileH}
    end repeat
  end if
end tell
APPLESCRIPT
}

################################################################################
# ---- Unwrap (paragraph-block line-rejoin) ----
# Rejoins terminal-wrapped paragraphs from stdin so copy/paste preserves
# logical lines instead of the visual wrap. Cross-platform — Claude Code,
# `less`, `man`, etc. all emit hard `\n`s at the terminal width on every OS,
# so this lives at the top level (not gated by is_os_*).
#
# Detection is shape-based: text is split into blocks separated by blank
# lines. A block is treated as "wrapped" only when ALL of these hold:
#   - all lines except the last are within HEAD_TOLERANCE chars of each other
#     (terminal wrap is uniform-width by definition)
#   - the widest "head" line is at least MIN_HEAD_WIDTH (filters short bullet
#     lists and labels — wrapped prose is always near terminal width)
#   - the last line is at least LAST_GAP chars shorter than the head
#     (wrapped paragraphs always end with a partial line)
# Everything else is preserved as-is — so unevenly-shaped lists, code,
# tables, ASCII art, and short paragraphs all keep their original line
# breaks. ``` fenced blocks are always preserved verbatim.
#
# Falls back to passthrough (`cat`) when node is unavailable, so callers
# (notably `copy()`) keep working on minimal systems.
################################################################################
function unwrap() {
  if is_help_arg "${1:-}"; then
    echo "
      unwrap: rejoin terminal-wrapped paragraphs from stdin
        echo \$'foo\\nbar' | unwrap     rejoin a single paragraph
        pbpaste | unwrap | pbcopy      fix the clipboard in place
        u                              short alias for unwrap
      Joins only when a block looks uniformly wrapped; preserves everything else.
    "
    return 0
  fi
  if ! type -P node &> /dev/null; then
    command cat
    return 0
  fi
  node -e "$(
    command cat << 'JS_EOF'
const text = require('fs').readFileSync(0, 'utf8');
const FENCE = '\x60\x60\x60';
const HEAD_TOLERANCE = 5;   // head-line widths must agree within this many chars
const MIN_HEAD_WIDTH = 50;  // ignore short blocks (bullet lists, labels)
const LAST_GAP = 10;        // last line must be this much shorter than the head

const lines = text.split('\n');
const out = [];
let block = [];
let inFence = false;

const flushBlock = () => {
  if (block.length === 0) return;
  if (block.length < 2) { out.push(block[0]); block = []; return; }
  const lens = block.map((l) => l.length);
  const headLens = lens.slice(0, -1);
  const lastLen = lens[lens.length - 1];
  const headMax = Math.max.apply(null, headLens);
  const headMin = Math.min.apply(null, headLens);
  const isWrapped =
    headMax - headMin <= HEAD_TOLERANCE &&
    headMax >= MIN_HEAD_WIDTH &&
    headMax - lastLen >= LAST_GAP;
  if (isWrapped) {
    out.push(block.map((l) => l.trim()).join(' '));
  } else {
    for (const l of block) out.push(l);
  }
  block = [];
};

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.slice(0, 3) === FENCE) {
    flushBlock();
    out.push(line);
    inFence = !inFence;
    continue;
  }
  if (inFence) { out.push(line); continue; }
  if (trimmed === '') { flushBlock(); out.push(''); continue; }
  block.push(line);
}
flushBlock();
let result = out.join('\n');
if (text.endsWith('\n') && !result.endsWith('\n')) result += '\n';
process.stdout.write(result);
JS_EOF
  )"
}
alias u=unwrap

################################################################################
# ---- Clipboard (copy / paste) ----
# universal clipboard with graceful fallbacks:
#   mac: native pbcopy/pbpaste
#   wsl: clip.exe / powershell.exe Get-Clipboard
#   wayland: wl-copy / wl-paste
#   x11: xclip -selection clipboard
#   fallback: folder-only (no native clipboard)
# all copies are saved to ~/.bash_syle_copies/ (last 10 entries)
# input is piped through unwrap() first so the clipboard never holds
# terminal-wrapped paragraphs.
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
  # unwrap rejoins terminal-wrapped paragraphs before anything reaches the
  # OS clipboard or the history file — the user's intent is to copy logical
  # lines, not the visual wrap that happened to fit the terminal width.
  if [ -n "$_COPY_CMD" ]; then
    unwrap | tee "$clip_file" | eval "$_COPY_CMD"
  else
    unwrap > "$clip_file"
  fi
  ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | tail -n +$((_CLIPBOARD_MAX + 1)) | while read -r f; do
    rm -f "$_CLIPBOARD_DIR/$f"
  done
}

# copy: stdin or files/strings into clipboard + history
function copy() {
  if [ $# -eq 0 ]; then
    # No args + stdin is a TTY (no pipe) → rewrap the existing clipboard in
    # place. `paste` is raw by default, so we pass --unwrap explicitly to pull
    # the clipboard through the unwrap filter, then pipe to copy which writes
    # it back. The recursive `copy` call hits the pipe branch (stdin not a
    # TTY) and bottoms out at _clipboard_save — no infinite loop.
    if [ -t 0 ]; then
      paste --unwrap | copy
    else
      _clipboard_save
    fi
  elif is_help_arg "$1"; then
    echo "
      copy: stdin or files/strings into clipboard + history
        copy                   rewrap the existing clipboard in place (no pipe, no args)
        echo foo | copy        pipe stdin into clipboard
        copy file.txt          copy file contents into clipboard
        copy a.txt b.txt       copy multiple files (concatenated) into clipboard
        copy \"hello world\"     copy a string into clipboard
        copy help              show this help
    "
  else
    for arg in "$@"; do
      if [ -f "$arg" ]; then
        command cat "$arg"
      else
        echo "$arg"
      fi
    done | _clipboard_save
  fi
}

# paste: print clipboard, recall from history, or forward to real paste(1)
# Default is RAW — clipboard contents are returned verbatim. Pass --unwrap
# (or pipe through `unwrap` manually) to rejoin terminal-wrapped paragraphs.
function paste() {
  if [ $# -eq 0 ]; then
    if [ -n "$_PASTE_CMD" ]; then
      eval "$_PASTE_CMD"
    else
      local latest
      latest=$(ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | head -1)
      [ -n "$latest" ] && command cat "$_CLIPBOARD_DIR/$latest"
    fi
  elif [ "$1" = "--unwrap" ]; then
    paste | unwrap
  elif is_help_arg "$1"; then
    echo "
      paste: print clipboard, recall from history, or forward to paste(1)
        paste                  print clipboard contents (raw) to stdout
        paste --unwrap         print clipboard rejoined via unwrap
        paste list             show clipboard history entries
        paste <entry>          recall a specific entry from history (raw)
        paste help             show this help
        paste file1 file2      forward to /usr/bin/paste (merge lines)
    "
  elif [ "$1" = "list" ]; then
    ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | head -n "$_CLIPBOARD_MAX"
  elif [ -f "$_CLIPBOARD_DIR/$1" ]; then
    command cat "$_CLIPBOARD_DIR/$1"
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
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
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
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
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
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
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

  if ! prompt_yes_no "Proceed with killing processes on these ports?"; then
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
  if [ -z "$port" ] || is_help_arg "$1"; then
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
    if [ $# -eq 0 ] || is_help_arg "$1"; then
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

  if [ -z "$count" ] || [ -z "$1" ] || is_help_arg "$count"; then
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
  if [ -z "$1" ] || is_help_arg "$1"; then
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
    command cat "$msg_file"
    rm -f "$msg_file"
  fi
}
PROMPT_COMMAND="_bashrc_update_check_show${PROMPT_COMMAND:+;$PROMPT_COMMAND}"

################################################################################
# ---- Deferred Profile Blocks (heavy or late-loading) ----
# ---- Post-profile Integrations (registerWithBashSyleProfile) ----
################################################################################
# SOURCE_BEGIN software/scripts/bash-keys.profile.bash
# software/scripts/bash-keys.profile.bash | 513a36d868164a899075f718508233bb | 5.2 KB | 2026-05-12
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
# Ctrl+L   — clear screen AND kill input line (unix-line-discard + clear)
# Ctrl+R   — fzf history search (places command on prompt)
# Ctrl+T   — fuzzy edit (default editor) — pick file under cwd, open with default editor
# Ctrl+Y   — fuzzy recent files (default editor)
# Ctrl+P   — fuzzy cd to directory
# Ctrl+B   — fuzzy favorite command picker
# Ctrl+G   — fuzzy git log browser
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
  bind '"\C-x": edit-and-execute-command'   # Ctrl+X — open command in $EDITOR
  bind '"\C-t": "fuzzy_edit\r"'             # Ctrl+T — fuzzy edit (default editor)
  bind '"\C-y": "fuzzy_recent_files\r"'     # Ctrl+Y — fuzzy recent files (default editor)
  bind '"\C-p": "fuzzy_cd\r"'               # Ctrl+P — fuzzy cd to directory
  bind '"\C-b": "fuzzy_favorite_command\r"' # Ctrl+B — fuzzy favorite command picker
  bind '"\C-g": "fuzzy_git_show\r"'         # Ctrl+G — fuzzy git log browser

  # Ctrl+L — kill input line first, then clear the screen. Readline can't chain native
  # commands in one bind, so use bind -x with a function. Order: discard first so the
  # prompt redraws empty after clear (no flash of typed text on a freshly-cleared screen).
  # Use ANSI escapes directly instead of the `clear` binary so this works in minimal
  # environments (devcontainers, busybox, mingw64) where /usr/bin/clear isn't installed.
  # \033[H = cursor home, \033[2J = clear visible screen. Intentionally omits \033[3J
  # so the terminal's scrollback buffer is preserved (matches `clear` / `br` behavior) —
  # users can still scroll up to see previous output after Ctrl+L.
  function _clear_and_discard_line() {
    READLINE_LINE=""
    READLINE_POINT=0
    printf '\033[H\033[2J'
  }
  bind -x '"\C-l": _clear_and_discard_line'

  # ---- bind -x here (requires bash 5+) ----
  # bind -x executes a shell function directly instead of injecting keystrokes via
  # readline macros. The function sets READLINE_LINE / READLINE_POINT to place the
  # result on the prompt — more reliable than the old macro approach.

  # Ctrl+R — fzf history search (places selected command on prompt for edit).
  # Delegates to fuzzy_history (defined in bash-history.profile.bash). bind -x sets
  # READLINE_LINE in the function env, which fuzzy_history detects and switches to
  # "place on prompt" mode instead of its default "eval immediately" behavior.
  type -P fzf &> /dev/null && bind -x '"\C-r": fuzzy_history'

fi # end interactive shell guard
# SOURCE_END software/scripts/bash-keys.profile.bash
# SOURCE_BEGIN software/scripts/bash-file-utils.profile.bash
# software/scripts/bash-file-utils.profile.bash | 220f3db358dacc8ad2c20f0ce7c8c3e5 | 74.2 KB | 2026-05-12
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
# --- Text Pack/Unpack (bulletproof) ---
# pack_text      — Bundle every file in a directory as gzip+base64 blocks with
#                  file-mode markers under PACK_BEGIN/PACK_END. Round-trips
#                  byte-exact regardless of file content (text or binary).
#                  Default mode is --raw (auto-saved to /tmp/<flat>.<ts>.pack.txt
#                  and streamed to stdout). --zip / --tar wrap the same blob.
#                  In a git repo, starts from `git ls-files` plus untracked
#                  extras (.env*, .bash*, .zsh*, .md, .xml, .src, .sh, .sql,
#                  .db, .sqlite*, .yml/.yaml, .json, .toml, .ini, .conf, .cfg).
#                  All paths flow through `filter_unwanted` so excluded folders
#                  (node_modules, .venv, __pycache__, .build, etc.) are pulled
#                  from the centralized EDITOR_CONFIGS.ignoredFoldersRegex set.
# unpack_text    — Extract files from a pack (file path, archive, '-' stdin
#                  marker, or piped stdin). Dispatches per-block on the
#                  encoding token: gzip+base64 → decode + write bytes; no
#                  encoding → write content verbatim. Restores file mode via
#                  fs.chmodSync (noop on Windows).
# view_pack_text — Re-emit a pack with text-content blocks decoded inline as
#                  raw text (binary blocks stay encoded). Output is itself a
#                  valid pack — greppable / diffable / re-feedable into
#                  unpack_text.
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

  if [ -z "$url" ] || is_help_arg "$1"; then
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
  if is_help_arg "${1:-}"; then
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

  if [ -z "$cmd" ] || is_help_arg "$1"; then
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
  command cat << '_HELPERS_EOF'
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
  if is_help_arg "${1:-}"; then
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
    command cat << 'CPSYNC_NODE'
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
    command cat << 'CPFILES_NODE'
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
  if is_help_arg "${1:-}"; then
    echo "cpenv: zip all .env* files and copy .zip to dest (timestamp on by default)
  Usage: cpenv <src_dir> <dest_dir> [should_add_time_stamp=true]
  Shorthand for: cpfiles <src> <dest> \".env*\" [should_add_time_stamp]"
    return
  fi
  cpfiles "$1" "$2" ".env*" "${3:-true}"
}

# cpdb: shorthand for cpfiles — zip all *.sqlite* files and copy .zip to dest
function cpdb() {
  if is_help_arg "${1:-}"; then
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
  if is_help_arg "${1:-}"; then
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
    command cat << 'DEDUP_NODE'
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

################################################################################
# ---- Text Pack/Unpack (bulletproof) ----
#
# pack_text / unpack_text / view_pack_text — bundle a directory into a single
# self-contained pack file (and back).
#
# Pack format (raw mode):
#   ===== PACK_BEGIN: <relative/path> [gzip+base64,mode=0NNN] =====
#   <base64 of gzipped file bytes>
#   ===== PACK_END: <relative/path> =====
#
# Every file (text or binary) is gzip+base64-encoded so the bundle round-trips
# byte-exact regardless of content. `mode=0NNN` records 0o777 chmod bits.
#
# Two bash entry points:
#   pack_text       — produce a pack from a directory.
#   unpack_text     — parse a pack and either extract files to disk (default)
#                     or re-emit it with text blocks decoded inline (--view).
#                     Accepts file path, '-' stdin marker, or piped stdin.
#                     Auto-detects .tar.gz/.zip/.tar archives in file mode.
#
# `view_pack_text` is just a thin alias around `unpack_text --view`. It exists
# so the user can grep/diff/edit a pack without unpacking files to disk —
# its output is itself a valid pack (text blocks lose the [gzip+base64] token
# and inline raw text; binary blocks pass through encoded). Re-feedable into
# unpack_text.
################################################################################

# _filter_pack_extras: stdin->stdout pipe filter that keeps only paths whose
# basename matches the pack_text "extras" set. These mirror the regex set
# documented in pack_text help: .env*, .bash*, .zsh*, .md, .xml, .src, .sh,
# .sql, .db, .sqlite*, .yml/.yaml, .json, .toml, .ini, .conf, .cfg. Used to
# narrow `git ls-files --others --exclude-standard` (untracked/gitignored)
# down to commonly-useful local files (.env.local, local rc files, sqlite
# DBs, config snippets) without sweeping in random untracked junk.
function _filter_pack_extras() {
  command awk -F/ '
    {
      base = tolower($NF)
      if (base ~ /^\.env($|\..+)|^\.bash|^\.zsh|\.(md|xml|src|sh|sql|db|ya?ml|json|toml|ini|conf|cfg)$|\.sqlite/) print
    }
  '
}

# _pack_filename_sanitize: stdin -> stdout pipe filter that makes a string
# filesystem-safe for use as a filename segment. Three steps, in order:
#   1. Every non-alphanumeric character (incl. dots, dashes, spaces) -> '_'
#   2. Runs of '__+' collapsed to a single '_'
#   3. Leading and trailing whitespace and '_' trimmed
# Used for the auto-generated filename's stem AND (with a pre-step lowercasing)
# for the host segment. Case is preserved here — callers that want lowercase
# pipe through `tr '[:upper:]' '[:lower:]'` first.
function _pack_filename_sanitize() {
  command sed 's/[^a-zA-Z0-9]/_/g; s/__*/_/g; s/^[ _]*//; s/[ _]*$//'
}

# pack_text: bundle every file in a directory as gzip+base64 blocks with file-mode
# markers. Default --raw mode auto-saves to /tmp/<flat>.<ts>.pack.txt AND streams
# the bundle to stdout (so `pack_text | unpack_text /tmp/copy` works without --raw).
# --zip and --tar wrap the same raw blob in compressed archives.
function pack_text() {
  if is_help_arg "${1:-}"; then
    echo "pack_text: bundle a directory (or a single file) into a self-contained pack
  Usage: pack_text [src=.] [output_file] [--raw|--zip|--tar] [--encode=<algo>] [--encode-level=N]
         src may be a directory (default behavior) OR a single file path
         (including hidden dotfiles) — in single-file mode the file is packed
         verbatim with no ignore filtering.
  Default mode: --raw with --encode=brotli (level 6)
                Output: /tmp/<host>.<flat>.<ts>.pack.txt (and streamed to stdout)
  Modes (outer container — orthogonal to --encode):
    --raw   [default] every file becomes a [<encoding>+base64,mode=0NNN] block between
                      ===== PACK_BEGIN: <path> ===== / ===== PACK_END: <path> =====
                      auto-named /tmp/<host>.<flat>.<ts>.pack.txt when no output_file
                      AND no explicit --raw flag. With explicit --raw and no
                      output_file, writes to stdout only (legacy pipe shortcut).
                      The saved file is always also cat'd to stdout, so
                      'pack_text | unpack_text /tmp/copy' works as a pipe.
    --zip             wraps the raw blob in a .zip archive
                      auto-named /tmp/<host>.<flat>.<ts>.pack.zip when output_file omitted
    --tar             wraps the raw blob in a .tar.gz archive
                      auto-named /tmp/<host>.<flat>.<ts>.pack.tar.gz when output_file omitted
  Encoding (inner per-block compression — orthogonal to --raw/--zip/--tar):
    --encode=<algo>          gzip | brotli (default: brotli — better ratio for text/configs)
    --encode-level=N         compression level / quality. Range depends on encoding:
                                gzip:   0-9   (default 6 = Z_DEFAULT_COMPRESSION)
                                brotli: 0-11  (default 6 = balanced)
                             Out-of-range or non-integer values error out.
                             unpack_text / view_pack_text auto-detect the encoding
                             from the per-block PACK_BEGIN token, so a single
                             pack may legally mix gzip and brotli blocks.
  Logging:
    --verbose, -v            Per-file PACK lines (raw->encoded byte counts) and
                             scan/walk markers showing which strategy was used
                             (git ls-files vs find walk) and which path is being
                             traversed. Quiet by default — only the summary line
                             is printed.
  File selection (directory mode):
    git repo  - git ls-files (tracked) + any untracked extras in the working
                tree (.env*, .bash*, .zsh*, .md, .xml, .src, .sh, .sql, .db,
                .sqlite*, .yml/.yaml, .json, .toml, .ini, .conf, .cfg).
    non-git   - recursive walk via find (node_modules / .git pruned for perf).
    Both modes are then piped through filter_unwanted, which applies the
    centralized EDITOR_CONFIGS.ignoredFoldersRegex set (node_modules, .venv,
    __pycache__, .build, .next, .nuxt, /dist/, /build/, /coverage/, etc.).
  File selection (single-file mode):
    The named file is packed unconditionally — ignore filters are bypassed
    so explicitly-named files (including hidden dotfiles) always pack.
  Encoding details:
    Every file (text or binary) is compressed (gzip or brotli) then base64-encoded
    so the bundle round-trips byte-exact regardless of file content. File mode
    bits (0o777, the chmod permissions) are recorded and restored by unpack_text.
  Timestamps:
    PACK_BEGIN bracket carries mtime= (last modification, ISO-8601 UTC) and
    btime= (creation / birthtime, when the OS exposes one). unpack_text restores
    mtime via utimesSync. btime is informational only — Linux has no syscall
    to set it, so we record but do not restore. Missing mtime (legacy packs)
    -> file gets the current time at extract.
  Provenance:
    Auto-generated output filenames lead with a sanitized hostname so $(ls)
    groups backups by machine: <host>.<stem>.pack.txt / .zip / .tar.gz where
    <stem> = <flat-source-path>.<timestamp>. The host is sourced
    from \$HOSTNAME (fallback: hostname -s, then hostname). Sanitization:
    lowercase, every non-alphanum -> '_', repeated '_' collapsed to one,
    edges trimmed. A single META_DATA banner is emitted at the top of every
    pack: '===== META_DATA: host=<raw> packed_utc=<iso> source=<abs> file_count=<N> encoding=<algo> ====='
    unpack_text strips it as noise; view_pack_text preserves it.
    Explicit output_file arguments are NOT renamed.
  Examples:
    pack_text                                       # cwd, brotli (default) -> /tmp/<host>.<flat>.<ts>.pack.txt
    pack_text ~/project                             # project, brotli -> /tmp/<host>.<flat>.<ts>.pack.txt
    pack_text ~/.bashrc                             # single hidden file
    pack_text . output.txt                          # explicit output
    pack_text . --encode=gzip                       # gzip blocks (e.g. broader-compat backups)
    pack_text . --encode=brotli --encode-level=11   # brotli max compression (slow)
    pack_text . --encode=gzip   --encode-level=9    # gzip   max compression
    pack_text . --encode=brotli --tar               # brotli blocks inside .tar.gz outer
    pack_text ~/project --verbose                   # show per-file PACK lines + scan info
    pack_text | unpack_text /tmp/copy               # full pipe: pack -> unpack
    pack_text | view_pack_text                      # human-readable view (text decoded inline)
    pack_text . --raw                               # explicit --raw, stdout only
    pack_text . --zip                               # -> /tmp/<host>.<flat>.<ts>.pack.zip
    pack_text . --tar                               # -> /tmp/<host>.<flat>.<ts>.pack.tar.gz"
    return
  fi

  # Default packaging mode. mode_explicit tracks whether a flag was passed so we
  # can preserve the legacy "--raw with no output_file -> stdout only" shortcut
  # while bare default-raw still writes a file (no accidental terminal spam).
  #
  # `mode` controls the OUTER container (raw text / zip / tar.gz).
  # `pack_encoding` controls the INNER per-block compression (gzip / brotli).
  # The two are orthogonal — every combination is valid (e.g. brotli blocks
  # inside a .tar.gz outer). brotli is the default since this tool is mainly
  # used for text-heavy config backups, where brotli's ratio wins clearly.
  local mode="raw"
  local mode_explicit=0
  local pack_encoding="brotli"
  local pack_encode_level="" # empty -> use per-encoding default (gzip 6, brotli 6)
  local pack_verbose=0       # --verbose / -v -> per-file PACK lines + scan info
  local positional=()
  for arg in "$@"; do
    case "$arg" in
    --raw | --plain)
      mode="raw"
      mode_explicit=1
      ;;
    --zip)
      mode="zip"
      mode_explicit=1
      ;;
    --tar)
      mode="tar"
      mode_explicit=1
      ;;
    --encode=*)
      pack_encoding="${arg#--encode=}"
      ;;
    --encode-level=*)
      pack_encode_level="${arg#--encode-level=}"
      ;;
    --verbose | -v)
      pack_verbose=1
      ;;
    *) positional+=("$arg") ;;
    esac
  done

  # Validate --encode= up-front. Only gzip / brotli supported today; reject
  # everything else with a clear list so typos surface fast.
  case "$pack_encoding" in
  gzip | brotli) ;;
  *)
    echo "pack_text: unknown encoding: $pack_encoding (allowed: gzip, brotli)" >&2
    return 1
    ;;
  esac

  # Validate --encode-level= against the active encoding's range.
  #   gzip:   0-9  (zlib levels; 6 is Z_DEFAULT_COMPRESSION)
  #   brotli: 0-11 (brotli quality; 6 is our balance default)
  # Empty string means "use the per-encoding default" — handled in node.
  if [ -n "$pack_encode_level" ]; then
    if ! [[ "$pack_encode_level" =~ ^[0-9]+$ ]]; then
      echo "pack_text: --encode-level must be an integer (got: $pack_encode_level)" >&2
      return 1
    fi
    local _max_level
    case "$pack_encoding" in
    gzip) _max_level=9 ;;
    brotli) _max_level=11 ;;
    esac
    if [ "$pack_encode_level" -gt "$_max_level" ]; then
      echo "pack_text: --encode-level=$pack_encode_level invalid for $pack_encoding (allowed: 0-$_max_level)" >&2
      return 1
    fi
  fi

  local src="${positional[0]:-.}"
  local output="${positional[1]:-}"

  # Single-file mode: when src is a regular file (e.g. a hidden dotfile), pack
  # just that file with no ignore filtering — the user named it explicitly so
  # any .git / node_modules / EDITOR_CONFIGS exclusions should NOT apply. The
  # directory-mode filters (filter_unwanted, _filter_pack_extras) still run
  # for the normal directory case below.
  local single_file=0
  local single_file_basename=""
  if [ -f "$src" ]; then
    single_file=1
  elif [ ! -d "$src" ]; then
    echo "pack_text: path not found: $src" >&2
    return 1
  fi

  local abs_src
  if ((single_file)); then
    local src_dir src_base
    src_dir=$(command dirname "$src")
    src_base=$(command basename "$src")
    abs_src=$(cd "$src_dir" && command pwd)
    single_file_basename="$src_base"
  else
    abs_src=$(cd "$src" && command pwd)
  fi
  # Build a flattened, unique output stem from the source path: strip leading
  # '/', swap path separators with '_', append YYYY_MM_DD_HH_MM_SS so two
  # consecutive packs of the same project never overwrite each other.
  # Example: /Users/syle/git/bashrc -> Users_syle_git_bashrc.2026_04_24_22_45_30
  # In single-file mode, include the basename so the stem identifies the file.
  local flat_path
  if ((single_file)); then
    flat_path="${abs_src#/}/${single_file_basename}"
  else
    flat_path="${abs_src#/}"
  fi
  [ -z "$flat_path" ] && flat_path="root"
  local pack_ts
  pack_ts=$(command date +%Y_%m_%d_%H_%M_%S)
  # Stem = "<flat-source-path>.<timestamp>" run through _pack_filename_sanitize
  # so dots / slashes / dashes / spaces all become '_' and runs collapse. Case
  # is preserved (a path component "MyProject" stays "MyProject"). End result:
  # filesystem-safe single segment with no '.' or '/' boundaries.
  local auto_stem
  auto_stem=$(printf '%s.%s' "$flat_path" "$pack_ts" | _pack_filename_sanitize)
  [ -z "$auto_stem" ] && auto_stem="root_${pack_ts}"

  # Hostname detection — prefer $HOSTNAME (bash builtin, set on macOS / Linux /
  # WSL / Termux without a syscall), fall back to `hostname -s` then `hostname`,
  # then "unknown". Two forms are kept:
  #   pack_host_raw       — readable form for the META_DATA banner ("MyMac.local")
  #   pack_host_sanitized — filename-safe ("mymac_local"): same _pack_filename_sanitize
  #                         pipeline as the stem, with an extra lowercase pre-step
  #                         since hostnames are conventionally case-insensitive.
  local pack_host_raw="${HOSTNAME:-}"
  [ -z "$pack_host_raw" ] && pack_host_raw=$(command hostname -s 2> /dev/null || true)
  [ -z "$pack_host_raw" ] && pack_host_raw=$(command hostname 2> /dev/null || true)
  [ -z "$pack_host_raw" ] && pack_host_raw="unknown"
  local pack_host_sanitized
  pack_host_sanitized=$(printf '%s' "$pack_host_raw" | command tr '[:upper:]' '[:lower:]' | _pack_filename_sanitize)
  [ -z "$pack_host_sanitized" ] && pack_host_sanitized="unknown"

  if [ -n "$output" ] && [[ "$output" != /* ]]; then
    output="$(command pwd)/$output"
  fi

  # Auto-generate output path if not specified.
  #   tar/zip   -> always auto-file
  #   raw       -> auto-file ONLY when --raw was not passed explicitly. Explicit
  #                --raw without output_file keeps the legacy stdout-only
  #                behavior so `pack_text ... --raw | unpack_text` still works.
  # Naming layout: <host>.<stem>.pack.<ext> — host first so `ls /tmp/*.pack.*`
  # groups all backups by machine, with stem (path + timestamp) ending in
  # ".pack.<ext>". Explicit output_file paths are NOT mutated.
  if [ -z "$output" ]; then
    case "$mode" in
    tar) output="/tmp/${pack_host_sanitized}.${auto_stem}.pack.tar.gz" ;;
    zip) output="/tmp/${pack_host_sanitized}.${auto_stem}.pack.zip" ;;
    raw) ((mode_explicit)) || output="/tmp/${pack_host_sanitized}.${auto_stem}.pack.txt" ;;
    esac
  fi

  local content_name="${auto_stem}.pack.txt"
  local tmp_packed="/tmp/${content_name}"
  rm -f "$tmp_packed"

  # Step 1: collect candidate file list in bash (relative paths, one per line).
  # Git mode emits tracked files plus the extras subset of untracked/gitignored
  # files (basename regex via _filter_pack_extras). Non-git mode walks via find,
  # pruning node_modules/.git for perf — filter_unwanted catches everything else.
  # The combined stream is piped through filter_unwanted to apply the central
  # EDITOR_CONFIGS.ignoredFoldersRegex set so excludes stay in one place.
  local file_list
  file_list="/tmp/_pack_text_files_${$}_${RANDOM}"
  rm -f "$file_list"
  local is_git=0
  local tracked_count=0 extras_count=0
  ((pack_verbose)) && echo "pack_text: scanning $abs_src" >&2
  if ((single_file)); then
    # Single-file mode: skip git scan and find walk entirely. The basename
    # is written verbatim — no filter_unwanted, so explicitly-named files
    # (e.g. hidden dotfiles like .env) always pack regardless of ignore patterns.
    printf '%s\n' "$single_file_basename" > "$file_list"
    echo "pack_text: single file — $abs_src/$single_file_basename" >&2
  elif git -C "$abs_src" rev-parse --is-inside-work-tree &> /dev/null; then
    is_git=1
    ((pack_verbose)) && echo "pack_text: git repo detected — using git ls-files" >&2
    local tracked_tmp extras_tmp
    tracked_tmp="${file_list}.tracked"
    extras_tmp="${file_list}.extras"
    (cd "$abs_src" && git ls-files) | filter_unwanted > "$tracked_tmp"
    # `git ls-files --others` (no --exclude-standard) lists ALL untracked
    # files including gitignored ones — important so a gitignored .env or
    # local .sqlite gets packed when its basename matches the extras set.
    (cd "$abs_src" && git ls-files --others) | _filter_pack_extras | filter_unwanted > "$extras_tmp"
    tracked_count=$(command wc -l < "$tracked_tmp" | command tr -d ' ')
    extras_count=$(command wc -l < "$extras_tmp" | command tr -d ' ')
    command cat "$tracked_tmp" "$extras_tmp" | command sort -u > "$file_list"
    rm -f "$tracked_tmp" "$extras_tmp"
    echo "pack_text: git repo — $tracked_count tracked + $extras_count extra (.env*/.bash*/.zsh*/.md/.xml/.src/.sh/.sql/.db/.sqlite*/.yml/.json/.toml/.ini/.conf/.cfg)" >&2
  else
    ((pack_verbose)) && echo "pack_text: non-git tree — walking $abs_src via find (node_modules / .git pruned)" >&2
    (cd "$abs_src" && command find . \( -name node_modules -o -name .git \) -prune -o -type f -print | command sed 's|^\./||') | filter_unwanted | command sort -u > "$file_list"
  fi
  if ((pack_verbose)); then
    local _candidate_count
    _candidate_count=$(command wc -l < "$file_list" | command tr -d ' ')
    echo "pack_text: $_candidate_count file(s) selected; encoding with $pack_encoding..." >&2
  fi

  if [ ! -s "$file_list" ]; then
    echo "pack_text: no files found in $abs_src" >&2
    rm -f "$file_list"
    return 1
  fi

  # Step 2: node reads the pre-filtered list and encodes each file. Node does
  # only the encoding; all file selection / exclusion lives in bash above.
  {
    command cat << 'PACK_TEXT_NODE'
/** Encodes each file in PACK_LIST as a [<encoding>+base64,mode=0NNN] block. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const srcDir = fs.realpathSync(process.env.PACK_SRC);
const listFile = process.env.PACK_LIST;
const outputFile = process.env.PACK_OUTPUT;
const metaHost = process.env.PACK_META_HOST || 'unknown';
const encoding = process.env.PACK_ENCODING || 'brotli';
// Per-encoding defaults: 6 is Z_DEFAULT_COMPRESSION for gzip, and brotli's
// "balanced" quality (a good speed/ratio knee — q11 is ~10x slower for ~3% gain).
const DEFAULT_LEVEL = { gzip: 6, brotli: 6 };
const encodeLevel = process.env.PACK_ENCODE_LEVEL
  ? parseInt(process.env.PACK_ENCODE_LEVEL, 10)
  : DEFAULT_LEVEL[encoding];

// Brotli was added in Node 11.7. If the user explicitly opts into it on an
// older runtime we fail fast with an actionable error rather than silently
// falling back — surprise-fallback would mask the version skew.
if (encoding === 'brotli' && typeof zlib.brotliCompressSync !== 'function') {
  console.error('pack_text: brotli requires Node >= 11.7; pass --encode=gzip');
  process.exit(1);
}

/** Compress a buffer using the active encoding + level. The compressed bytes
 *  are then base64-encoded line-wrapped at 76 chars (diff-friendly; whitespace
 *  is stripped at decode time). The emitted token in PACK_BEGIN tells the
 *  unpacker which decompressor to use, so per-block dispatch works even when
 *  a pack mixes encodings (e.g. legacy gzip blocks alongside fresh brotli). */
function compress(buf) {
  if (encoding === 'gzip') return zlib.gzipSync(buf, { level: encodeLevel });
  return zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: encodeLevel },
  });
}

function encodeFileBody(buf) {
  const b64 = compress(buf).toString('base64');
  return b64.replace(/(.{76})/g, '$1\n') + (b64.length % 76 === 0 ? '' : '\n');
}

/** Format a Date as ISO-8601 UTC with seconds precision (drops sub-second
 *  fractions for readability — file mtimes from most filesystems are integer
 *  seconds anyway). Returns '' when the date is missing or epoch zero (which
 *  Node returns on platforms where birthtime isn't natively supported). */
function fmtIsoUtc(d) {
  if (!d || d.getTime() === 0) return '';
  return d.toISOString().replace(/\.\d+Z$/, 'Z');
}

const verbose = process.env.PACK_VERBOSE === '1';
const rels = fs.readFileSync(listFile, 'utf8').split('\n').filter(Boolean);

// STREAMING WRITE — blocks go directly to a temp file via fs.writeSync as we
// encode them. We never accumulate the full pack as a single in-memory string,
// which used to crash with "RangeError: Invalid string length" on V8 once the
// cumulative output crossed the ~512 MB string limit (e.g. trees with many
// large text files). Per-file string size is still bounded by encodeFileBody
// for that one file — that limit only kicks in for individual files >~256 MB
// (binary, after gzip+base64 inflation), which is a separate concern.
const tmpBlocks = outputFile + '.blocks.tmp';
const fdTmp = fs.openSync(tmpBlocks, 'w');
let count = 0;
try {
  for (const rel of rels) {
    const file = path.join(srcDir, rel);
    try {
      const buf = fs.readFileSync(file);
      const stat = fs.statSync(file);
      if (!stat.isFile()) continue;
      const mode = (stat.mode & 0o777).toString(8).padStart(4, '0');  // padStart supplies the leading 0
      // Timestamps appended to the bracket: mtime always (every fs supports it),
      // btime only when the OS reports a real value (Linux ext4/btrfs do, older
      // Linux fs and some networked mounts return epoch 0 — fmtIsoUtc skips those).
      // unpack_text restores mtime via fs.utimesSync; btime is informational only
      // (no portable syscall to set it on Linux), but is preserved through
      // view_pack_text so the original creation time stays visible.
      const mtimeStr = fmtIsoUtc(stat.mtime);
      const btimeStr = fmtIsoUtc(stat.birthtime);
      const parts = [encoding + '+base64', 'mode=' + mode];
      if (mtimeStr) parts.push('mtime=' + mtimeStr);
      if (btimeStr) parts.push('btime=' + btimeStr);
      const encoded = encodeFileBody(buf);
      fs.writeSync(fdTmp, '===== PACK_BEGIN: ' + rel + ' [' + parts.join(',') + '] =====\n');
      fs.writeSync(fdTmp, encoded);
      fs.writeSync(fdTmp, '===== PACK_END: ' + rel + ' =====\n');
      count++;
      if (verbose) {
        console.error('  PACK: ' + rel + ' (' + buf.length + ' B raw -> ' + encoded.length + ' B encoded)');
      }
    } catch (e) {
      console.error('  SKIP: ' + rel + ' (' + (e.message || 'unreadable') + ')');
    }
  }
} finally {
  fs.closeSync(fdTmp);
}

if (count === 0) {
  console.error('pack_text: no files found in ' + srcDir);
  try { fs.unlinkSync(tmpBlocks); } catch {}
  process.exit(1);
}

/** META_DATA banner — single line at the very top of the pack stream. unpack_text
 *  strips it as noise (extended STATUS_LINE filter); view_pack_text preserves it
 *  inline so the provenance stays visible in human-readable view output. UTC
 *  timestamp keeps backups directly comparable across machines/timezones. */
const metaUtc = new Date().toISOString().replace(/\.\d+Z$/, 'Z');  // strip ms for readability
const metaLine = '===== META_DATA: host=' + metaHost
  + ' packed_utc=' + metaUtc
  + ' source=' + srcDir
  + ' file_count=' + count
  + ' encoding=' + encoding
  + ' =====\n';

// Final assembly: write META_DATA, then chunked-copy the temp blocks file
// into the output. 64 KB chunk size keeps memory flat regardless of pack
// size. fs.openSync + writeSync stays synchronous so the bash caller sees
// the final file when this script exits.
const fdOut = fs.openSync(outputFile, 'w');
const fdTmpRead = fs.openSync(tmpBlocks, 'r');
try {
  fs.writeSync(fdOut, metaLine);
  const chunk = Buffer.allocUnsafe(64 * 1024);
  let n;
  while ((n = fs.readSync(fdTmpRead, chunk, 0, chunk.length, null)) > 0) {
    fs.writeSync(fdOut, chunk, 0, n);
  }
} finally {
  fs.closeSync(fdTmpRead);
  fs.closeSync(fdOut);
  try { fs.unlinkSync(tmpBlocks); } catch {}
}
console.error('pack_text: packed ' + count + ' files from ' + srcDir);
PACK_TEXT_NODE
  } | PACK_SRC="$abs_src" PACK_LIST="$file_list" PACK_OUTPUT="$tmp_packed" PACK_META_HOST="$pack_host_raw" PACK_ENCODING="$pack_encoding" PACK_ENCODE_LEVEL="$pack_encode_level" PACK_VERBOSE="$pack_verbose" node
  rm -f "$file_list"

  if [ ! -f "$tmp_packed" ]; then
    echo "pack_text: failed to generate packed content"
    return 1
  fi

  case "$mode" in
  tar)
    tar -czf "$output" -C /tmp "$content_name"
    rm -f "$tmp_packed"
    echo "pack_text: $output"
    ;;
  zip)
    command zip -qj "$output" "$tmp_packed"
    rm -f "$tmp_packed"
    echo "pack_text: $output"
    ;;
  raw)
    if [ -n "$output" ]; then
      mv "$tmp_packed" "$output"
      echo "pack_text: $output"
      # Always stream the saved file's contents to stdout at the end of raw
      # mode so `pack_text | unpack_text /tmp/copy` works without --raw.
      # The "pack_text: <path>" status line above is harmless on the receiving
      # end because unpack_text's noise filter strips status-line patterns
      # outside any pack block.
      command cat "$output"
    else
      command cat "$tmp_packed"
      rm -f "$tmp_packed"
    fi
    ;;
  esac
}

# unpack_text: parse a bulletproof pack and either extract files to disk
# (default) or re-emit it with text blocks decoded inline (--view mode).
# Input may be a file path, an explicit '-' stdin marker, or piped stdin.
# .tar.gz/.tgz/.tar/.zip archives are auto-extracted to a temp dir first.
function unpack_text() {
  if is_help_arg "${1:-}"; then
    echo "unpack_text: parse a bulletproof pack and extract files (or re-emit as text view)
  Usage: unpack_text [input_file|-] [dest_dir=.] [--verbose]
         unpack_text --view [input_file|-]               # re-emit, no disk writes
         <some command> | unpack_text [dest_dir=.]
  Modes:
    extract [default] — write each block's bytes to <dest_dir>/<path>, restore chmod
    --view            — re-emit the pack with text blocks decoded inline (no disk writes).
                        Output is itself a valid pack (text blocks have no encoding token,
                        binary blocks keep [gzip+base64,mode=0NNN]).
                        view_pack_text is just an alias for 'unpack_text --view'.
  Logging:
    --verbose, -v     — Per-file EXTRACT lines showing 'EXTRACT: <path> (<bytes> -> <full_dest_path>)'
                        for every file written. Quiet by default — only the final
                        'extracted N files to <dest>' summary is printed.
  Input sources (first match wins):
    1. explicit file path (\$1 is an existing file)     — archives auto-detected
    2. explicit stdin marker (\$1 == '-')                — reads pack text from stdin
    3. piped stdin (\$1 missing AND stdin is not a tty) — reads pack text from stdin
  Pack format:
    Each block is delimited by ===== PACK_BEGIN: <path> [<encoding>,mode=0NNN] =====
    and ===== PACK_END: <path> =====. unpack_text dispatches on the encoding token:
      gzip+base64 → base64-decode + gunzip → write bytes (extract) or decode+inline (view).
      no encoding → write the body verbatim (extract) or pass through (view).
    The mode field is applied via fs.chmodSync (a noop on Windows).
  Archives:
    .tar.gz, .tgz, .tar, .zip via the file-path form are extracted to a temp dir
    first; the inner pack file is located by searching for PACK_BEGIN. Stdin is
    always treated as plain pack text (no archive sniffing).
  Status noise filter:
    Lines outside any pack block matching /^(?:pack_text|unpack_text|view_pack_text):/
    are stripped before parsing, so 'pack_text 2>&1 | unpack_text' works even
    when stderr was merged into the stream. Lines INSIDE pack blocks are
    preserved verbatim — file content is never corrupted.
  Examples:
    unpack_text packed.txt ./output             # file -> extract
    unpack_text packed.tar.gz                   # archive -> extract to current dir
    cat packed.txt | unpack_text                # stdin -> extract to current dir
    pack_text ~/project | unpack_text /tmp/copy # round-trip via pipe
    unpack_text --view packed.txt               # human-readable view to stdout
    pack_text ~/project | unpack_text --view    # build + view in one go
    unpack_text - ./output                      # explicit stdin marker
    unpack_text packed.txt ./out --verbose      # per-file EXTRACT lines + byte counts"
    return
  fi

  # Detect --view / --to-text and --verbose / -v flags; strip from positional args.
  local view_mode=0
  local unpack_verbose=0
  local positional=()
  for arg in "$@"; do
    case "$arg" in
    --view | --to-text) view_mode=1 ;;
    --verbose | -v) unpack_verbose=1 ;;
    *) positional+=("$arg") ;;
    esac
  done
  set -- "${positional[@]}"

  # Decide input source. Same precedence used by the legacy stdin-aware version:
  #   1. \$1 == '-'                                  -> stdin
  #   2. no args AND stdin is piped                  -> stdin
  #   3. empty \$1 AND stdin is piped                -> stdin, optional \$2 dest
  #   4. \$1 looks like a file but doesn't exist AND stdin is piped -> stdin, \$1 is dest
  #   5. otherwise                                   -> \$1 is file path, \$2 is dest
  local input="" dest="." stdin_tmp=""
  if [ "${1:-}" = "-" ]; then
    stdin_tmp="/tmp/_unpack_text_stdin_${$}_${RANDOM}"
    command cat > "$stdin_tmp"
    input="$stdin_tmp"
    dest="${2:-.}"
  elif [ $# -eq 0 ] && [ ! -t 0 ]; then
    stdin_tmp="/tmp/_unpack_text_stdin_${$}_${RANDOM}"
    command cat > "$stdin_tmp"
    input="$stdin_tmp"
    dest="."
  elif [ -z "${1:-}" ] && [ ! -t 0 ]; then
    stdin_tmp="/tmp/_unpack_text_stdin_${$}_${RANDOM}"
    command cat > "$stdin_tmp"
    input="$stdin_tmp"
    dest="${2:-.}"
  elif [ $# -ge 1 ] && [ ! -t 0 ] && [ ! -f "$1" ]; then
    stdin_tmp="/tmp/_unpack_text_stdin_${$}_${RANDOM}"
    command cat > "$stdin_tmp"
    input="$stdin_tmp"
    dest="${1:-.}"
  else
    if [ -z "${1:-}" ]; then
      echo "unpack_text: no input file and stdin is not piped" >&2
      return 1
    fi
    input="$1"
    dest="${2:-.}"
    if [ ! -f "$input" ]; then
      echo "unpack_text: file not found: $input" >&2
      return 1
    fi
  fi

  if [ -n "$stdin_tmp" ] && [ ! -s "$stdin_tmp" ]; then
    echo "unpack_text: no data on stdin" >&2
    rm -f "$stdin_tmp"
    return 1
  fi

  # Resolve to absolute path.
  input=$(cd "$(dirname "$input")" && echo "$(command pwd)/$(basename "$input")")

  # Auto-extract tar/zip archives (file-mode only — stdin is always plain text).
  local tmp_extract=""
  if [ -z "$stdin_tmp" ]; then
    case "$input" in
    *.tar.gz | *.tgz | *.tar | *.zip)
      tmp_extract="/tmp/_unpack_text_$(command date +%s)_$$"
      mkdir -p "$tmp_extract"
      case "$input" in
      *.tar.gz | *.tgz) tar -xzf "$input" -C "$tmp_extract" ;;
      *.tar) tar -xf "$input" -C "$tmp_extract" ;;
      *.zip) command unzip -qo "$input" -d "$tmp_extract" ;;
      esac
      local inner
      inner=$(command grep -rl "===== PACK_BEGIN:" "$tmp_extract" 2> /dev/null | head -1)
      if [ -z "$inner" ]; then
        echo "unpack_text: no pack file found inside archive" >&2
        rm -rf "$tmp_extract"
        [ -n "$stdin_tmp" ] && rm -f "$stdin_tmp"
        return 1
      fi
      input="$inner"
      ;;
    esac
  fi

  # Resolve dest (only meaningful in extract mode, but harmless in --view).
  mkdir -p "$dest" 2> /dev/null
  local abs_dest
  abs_dest=$(cd "$dest" 2> /dev/null && command pwd)

  # Single node script handles BOTH extract and view modes — dispatched by
  # UNPACK_MODE. Parser, status-noise filter, and per-block decoder are inlined
  # here so this is the only Node.js source for the unpack/view side.
  {
    command cat << 'UNPACK_TEXT_NODE'
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const inputFile = process.env.UNPACK_INPUT;
const destDir = process.env.UNPACK_DEST;
const viewMode = process.env.UNPACK_MODE === 'view';
const verbose = process.env.UNPACK_VERBOSE === '1';

/** Pack marker grammar:
 *    ===== PACK_BEGIN: <relative/path> [<key=val>,...] =====
 *    ===== PACK_END:   <relative/path> =====
 * Bracket is optional; absent means raw text content. */
const BEGIN_PREFIX = '===== PACK_BEGIN: ';
const END_PREFIX = '===== PACK_END: ';
const SUFFIX = ' =====';

/** Lines outside a block matching this regex are status noise leaked into the
 *  stream (e.g. `pack_text 2>&1 | unpack_text`); filtered before parsing. */
const STATUS_LINE = /^(?:pack_text|unpack_text|view_pack_text):/;

/** META_DATA banner emitted by pack_text at the top of the stream. Extract mode
 *  treats it as noise (file selection happens entirely via PACK_BEGIN markers).
 *  View mode preserves it (see captureMetaLine) so provenance stays visible. */
const META_DATA_LINE = /^===== META_DATA: .* =====$/;

/** Parse the metadata bracket on a BEGIN line into
 *  { path, encoding, mode, mtime, btime }.
 *  Encoding is the only "bare" token (no '='); everything else is key=val.
 *  - mode  : octal int   (existing — file permissions)
 *  - mtime : Date | null (ISO-8601 — last modification time, restored on extract)
 *  - btime : Date | null (ISO-8601 — creation time / birthtime; informational
 *                         only since no portable syscall to set it on Linux,
 *                         but preserved through view_pack_text re-emission)
 *
 *  PARSING IS DELIBERATELY FORGIVING — every field is optional and every
 *  field is independently validated. A malformed value for one key never
 *  blocks parsing of the others, never poisons the meta object, and never
 *  prevents extraction of the file. Specifically:
 *    - missing bracket entirely        -> all fields stay null, raw-text decode
 *    - missing key                     -> field stays null
 *    - unknown key                     -> silently ignored (forward compat)
 *    - bad mode value (e.g. 'abc')     -> NaN rejected, mode stays null
 *    - bad mtime/btime (e.g. 'foo')    -> Date is NaN, field stays null
 *    - empty value (key= )             -> rejected, field stays null
 *  All "stays null" outcomes mean the corresponding restore step is simply
 *  skipped at extract time — no chmodSync(NaN), no utimesSync(InvalidDate). */
function parseBeginMarker(line) {
  if (!line.startsWith(BEGIN_PREFIX) || !line.endsWith(SUFFIX)) return null;
  const inner = line.slice(BEGIN_PREFIX.length, line.length - SUFFIX.length);
  const m = inner.match(/^(.*?)(?:\s+\[([^\]]*)\])?$/);
  if (!m) return null;
  const meta = { path: m[1], encoding: null, mode: null, mtime: null, btime: null };
  if (m[2]) {
    for (const part of m[2].split(',')) {
      const eq = part.indexOf('=');
      if (eq === -1) {
        if (part.trim()) meta.encoding = part.trim();
      } else {
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (!v) continue;  // empty value -> skip; never assign garbage
        if (k === 'mode') {
          const n = parseInt(v, 8);
          // parseInt returns NaN for non-numeric strings. Without this guard
          // we'd later call fs.chmodSync(path, NaN), which throws — survivable
          // via try/catch but noisy. Skipping here keeps the log clean.
          if (!isNaN(n) && n >= 0) meta.mode = n;
        } else if (k === 'mtime' || k === 'btime') {
          const d = new Date(v);
          // Reject NaN dates — corrupt timestamp shouldn't poison the extract.
          if (!isNaN(d.getTime())) meta[k] = d;
        }
      }
    }
  }
  return meta;
}

/** Drop pack_text:/unpack_text:/view_pack_text: lines outside pack blocks.
 *  Lines inside blocks are preserved verbatim — file content is never corrupted. */
function stripStatusNoise(raw) {
  const lines = raw.split('\n');
  const out = [];
  let inBlock = false;
  let currentEndMarker = '';
  for (const line of lines) {
    if (!inBlock && line.startsWith(BEGIN_PREFIX) && line.endsWith(SUFFIX)) {
      const meta = parseBeginMarker(line);
      if (meta) {
        currentEndMarker = END_PREFIX + meta.path + SUFFIX;
        inBlock = true;
      }
      out.push(line);
      continue;
    }
    if (inBlock && line === currentEndMarker) {
      inBlock = false;
      currentEndMarker = '';
      out.push(line);
      continue;
    }
    if (!inBlock && STATUS_LINE.test(line)) continue;
    if (!inBlock && META_DATA_LINE.test(line)) continue;
    out.push(line);
  }
  return out.join('\n');
}

/** Scan the raw stream for the first META_DATA line and return it (or null).
 *  Used by view mode to re-emit the banner at the top of the view output so
 *  provenance stays visible AND view output is re-feedable into unpack_text. */
function captureMetaLine(raw) {
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.startsWith(BEGIN_PREFIX)) break;  // metadata only valid before any PACK_BEGIN
    if (META_DATA_LINE.test(line)) return line;
  }
  return null;
}

/** Generator yielding each block as { path, encoding, mode, body }. */
function* parseBlocks(packed) {
  let pos = 0;
  while (pos < packed.length) {
    const bIdx = packed.indexOf(BEGIN_PREFIX, pos);
    if (bIdx === -1) break;
    const bLineEnd = packed.indexOf('\n', bIdx);
    if (bLineEnd === -1) break;
    const meta = parseBeginMarker(packed.slice(bIdx, bLineEnd));
    if (!meta) { pos = bLineEnd + 1; continue; }
    const contentStart = bLineEnd + 1;
    const endMarker = END_PREFIX + meta.path + SUFFIX;
    const eIdx = packed.indexOf('\n' + endMarker, contentStart);
    if (eIdx === -1) {
      console.error('  WARN: no PACK_END for ' + meta.path + ', skipping');
      pos = contentStart;
      continue;
    }
    yield Object.assign({}, meta, { body: packed.slice(contentStart, eIdx + 1) });
    pos = eIdx + 1 + endMarker.length + 1;
  }
}

/** Decode a block's body to a Buffer based on its encoding token. Per-block
 *  dispatch means a single pack can legally mix encodings — e.g. an old gzip
 *  pack appended to a fresh brotli pack still extracts cleanly.
 *
 *  Three paths, in priority order:
 *    1. Known encoding token  -> decompress with the matching codec.
 *    2. NO encoding token     -> raw text path. Used by view_pack_text when
 *                                re-emitting decoded text blocks (the bracket
 *                                contains only [mode=...,mtime=...] with no
 *                                bare encoding token), so this is a legitimate
 *                                input shape, not an error.
 *    3. Unknown encoding token -> throw. The extract loop catches and emits
 *                                 'FAIL: <path>: unknown encoding ...' for
 *                                 that one file but continues with the rest.
 *                                 Better than silently writing corrupted data. */
function decodeBlock(block) {
  if (block.encoding === 'gzip+base64') {
    return zlib.gunzipSync(Buffer.from(block.body.replace(/\s/g, ''), 'base64'));
  }
  if (block.encoding === 'brotli+base64') {
    if (typeof zlib.brotliDecompressSync !== 'function') {
      throw new Error('brotli requires Node >= 11.7');
    }
    return zlib.brotliDecompressSync(Buffer.from(block.body.replace(/\s/g, ''), 'base64'));
  }
  if (block.encoding === null) {
    // No encoding token — raw text. Strip the trailing newline emitted between
    // the body and the END marker so round-trip is byte-exact for raw blocks.
    const text = block.body.endsWith('\n') ? block.body.slice(0, -1) : block.body;
    return Buffer.from(text, 'utf8');
  }
  // Unknown encoding token — fail this one block loudly with an actionable
  // message instead of silently writing the un-decoded bytes (which would
  // produce a corrupt file with no warning). Caught by the extract loop.
  throw new Error('unknown encoding token: ' + block.encoding);
}

/** Heuristic: a buffer is "text" if no NUL byte in the first 8 KB. */
function looksLikeText(buf) {
  return !buf.subarray(0, 8000).includes(0x00);
}

/** Build the [<encoding>,mode=0NNN,mtime=...,btime=...] bracket suffix for
 *  re-emitted blocks (view mode). Timestamps are preserved when present so
 *  view output stays re-feedable AND keeps the provenance visible. */
function fmtMeta(meta) {
  const parts = [];
  if (meta.encoding) parts.push(meta.encoding);
  if (meta.mode != null) parts.push('mode=' + meta.mode.toString(8).padStart(4, '0'));
  if (meta.mtime) parts.push('mtime=' + meta.mtime.toISOString().replace(/\.\d+Z$/, 'Z'));
  if (meta.btime) parts.push('btime=' + meta.btime.toISOString().replace(/\.\d+Z$/, 'Z'));
  return parts.length ? ' [' + parts.join(',') + ']' : '';
}

const rawInput = fs.readFileSync(inputFile, 'utf8');
const metaLine = captureMetaLine(rawInput);  // null if pack predates META_DATA support
const packed = stripStatusNoise(rawInput);

if (viewMode) {
  // VIEW mode — re-emit the pack with text blocks decoded inline. Binary blocks
  // (decoded buffer has a NUL byte in first 8 KB) pass through unchanged. The
  // META_DATA banner (if present) is re-emitted at the top so the view output
  // keeps its provenance AND remains a valid pack re-feedable into unpack_text.
  if (metaLine) process.stdout.write(metaLine + '\n');
  for (const block of parseBlocks(packed)) {
    let decoded;
    try { decoded = decodeBlock(block); }
    catch {
      // Could not decode (corrupt block) — pass through untouched.
      process.stdout.write(BEGIN_PREFIX + block.path + fmtMeta(block) + SUFFIX + '\n');
      process.stdout.write(block.body);
      process.stdout.write(END_PREFIX + block.path + SUFFIX + '\n');
      continue;
    }
    if (looksLikeText(decoded)) {
      // Always emit a separator newline between content and END marker. The
      // unpack-side decoder for raw blocks strips the trailing '\n' from the
      // body, so this guarantees byte-exact round-trip whether or not the
      // original file ended with a newline. mtime/btime are carried through
      // so the view stays re-feedable into unpack_text with full fidelity.
      process.stdout.write(BEGIN_PREFIX + block.path + fmtMeta({ encoding: null, mode: block.mode, mtime: block.mtime, btime: block.btime }) + SUFFIX + '\n');
      process.stdout.write(decoded.toString('utf8'));
      process.stdout.write('\n');
      process.stdout.write(END_PREFIX + block.path + SUFFIX + '\n');
    } else {
      process.stdout.write(BEGIN_PREFIX + block.path + fmtMeta(block) + SUFFIX + '\n');
      process.stdout.write(block.body);
      process.stdout.write(END_PREFIX + block.path + SUFFIX + '\n');
    }
  }
} else {
  // EXTRACT mode — write each block's bytes to disk and restore mode.
  let count = 0;
  for (const block of parseBlocks(packed)) {
    const destPath = path.join(destDir, block.path);
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const decoded = decodeBlock(block);
      fs.writeFileSync(destPath, decoded);
      if (block.mode != null) {
        try { fs.chmodSync(destPath, block.mode); } catch {}
      }
      // Restore mtime via utimesSync. atime is set to mtime as well — preserving
      // the original atime is meaningless (every read changes it) and using
      // mtime gives the most coherent "this file looks frozen at <time>" view.
      // btime is intentionally NOT restored: no portable syscall on Linux to
      // set birthtime, and shelling out per-file (SetFile on macOS) would slow
      // unpack to a crawl. The btime value remains visible via view_pack_text.
      // Missing mtime in marker (legacy packs / future formats) -> skip silently
      // and let the OS use the current time, matching the user-stated default.
      if (block.mtime) {
        try { fs.utimesSync(destPath, block.mtime, block.mtime); } catch {}
      }
      // Per-file EXTRACT lines are verbose-only. Default mode prints just the
      // summary at the end (mirrors pack_text's quiet-by-default behavior).
      // Verbose form includes raw byte count so users can spot oversized
      // restores quickly. FAIL lines below stay always-on — errors must be
      // visible regardless of verbose level.
      if (verbose) {
        console.error('  EXTRACT: ' + block.path + ' (' + decoded.length + ' B -> ' + destPath + ')');
      }
      count++;
    } catch (e) {
      console.error('  FAIL: ' + block.path + ': ' + e.message);
    }
  }
  console.error('unpack_text: extracted ' + count + ' files to ' + destDir);
}
UNPACK_TEXT_NODE
  } | UNPACK_INPUT="$input" UNPACK_DEST="$abs_dest" UNPACK_MODE="$( ((view_mode)) && echo view || echo extract)" UNPACK_VERBOSE="$unpack_verbose" node

  # Cleanup tmp files.
  if [ -n "$tmp_extract" ]; then
    rm -rf "$tmp_extract"
  fi
  if [ -n "$stdin_tmp" ]; then
    rm -f "$stdin_tmp"
  fi
}

# view_pack_text: thin alias for `unpack_text --view`. Re-emits a pack with text
# blocks decoded inline; binary blocks stay [gzip+base64,mode=0NNN]. Output is a
# valid pack — re-feedable into unpack_text. Useful for grep/diff/edit on a
# bundle without unpacking files to disk.
function view_pack_text() {
  if is_help_arg "${1:-}"; then
    echo "view_pack_text: alias for 'unpack_text --view' — re-emit a pack with text decoded inline
  Usage: view_pack_text [input_file|-]
         <some command> | view_pack_text
  Examples:
    view_pack_text packed.txt | grep 'function foo'
    view_pack_text packed.txt > readable.pack.txt
    pack_text ~/project | view_pack_text
    pack_text ~/project | view_pack_text | unpack_text /tmp/copy"
    return
  fi
  unpack_text --view "$@"
}
# SOURCE_END software/scripts/bash-file-utils.profile.bash
# BEGIN Fuzzy Filter Patterns
# Folder + file regex patterns — used by filter_unwanted
# (joined with | for grep -v -E). filter_unwanted concatenates both
# arrays so excluding by extension (e.g. \.swp$, \.exe$) works
# alongside folder excludes (node_modules, .venv, etc.).
_IGNORED_FOLDER_PATTERNS=(
  "\.DS_Store"
"\.angular/"
"\.cache/"
"\.git/"
"\.gradle/"
"\.hg/"
"\.idea/"
"\.ipynb_checkpoints/"
"\.mypy_cache/"
"\.next/"
"\.nuxt/"
"\.parcel-cache/"
"\.pyc"
"\.pytest_cache/"
"\.ruff_"
"\.sass-cache/"
"\.svelte-kit/"
"\.svn/"
"\.terraform/"
"\.tox/"
"\.turbo/"
"\.uv/"
"\.venv/"
"\.yarn/"
"__pycache"
"bower_components"
"node_modules"
"/build/"
"/coverage/"
"/cov/"
"/DerivedData/"
"/dist/"
"/htmlcov/"
"/out/"
"/Pods/"
"/target/"
"/vendor/"
)
_IGNORED_FILE_PATTERNS=(
  "\.DS_Store$"
"Thumbs\.db$"
"desktop\.ini$"
"\.Spotlight-"
"\.Trashes$"
"\.fseventsd$"
"\.com\.apple\."
"\.localized$"
"\.a$"
"\.class$"
"\.dll$"
"\.dylib$"
"\.exe$"
"\.lib$"
"\.o$"
"\.obj$"
"\.pyc$"
"\.pyo$"
"\.so$"
"\.swo$"
"\.swp$"
"\.wasm$"
)
# JSON-encoded regex arrays — general-purpose (consumed by _fuzzy_list_all,
# pack_text, and any other pipeline that needs the centralized exclusions)
_IGNORED_FOLDERS_JSON='["\\.DS_Store","\\.angular/","\\.cache/","\\.git/","\\.gradle/","\\.hg/","\\.idea/","\\.ipynb_checkpoints/","\\.mypy_cache/","\\.next/","\\.nuxt/","\\.parcel-cache/","\\.pyc","\\.pytest_cache/","\\.ruff_","\\.sass-cache/","\\.svelte-kit/","\\.svn/","\\.terraform/","\\.tox/","\\.turbo/","\\.uv/","\\.venv/","\\.yarn/","__pycache","bower_components","node_modules","/build/","/coverage/","/cov/","/DerivedData/","/dist/","/htmlcov/","/out/","/Pods/","/target/","/vendor/"]'
_IGNORED_FILES_JSON='["\\.DS_Store$","Thumbs\\.db$","desktop\\.ini$","\\.Spotlight-","\\.Trashes$","\\.fseventsd$","\\.com\\.apple\\.","\\.localized$","\\.a$","\\.class$","\\.dll$","\\.dylib$","\\.exe$","\\.lib$","\\.o$","\\.obj$","\\.pyc$","\\.pyo$","\\.so$","\\.swo$","\\.swp$","\\.wasm$"]'
# Text-file allowlist — fuzzy-picker-specific (text_files mode in _fuzzy_list_all)
_FUZZY_TEXT_FILES_JSON='["\\.bash$","\\.c$","\\.cfg$","\\.clj$","\\.cmake$","\\.coffee$","\\.conf$","\\.cpp$","\\.cs$","\\.css$","\\.csv$","\\.dart$","\\.diff$","\\.dockerfile$","\\.el$","\\.elm$","\\.env$","\\.erl$","\\.ex$","\\.fish$","\\.go$","\\.graphql$","\\.groovy$","\\.h$","\\.hpp$","\\.hs$","\\.html$","\\.ini$","\\.java$","\\.js$","\\.json$","\\.jsonc$","\\.jsx$","\\.kt$","\\.less$","\\.lisp$","\\.log$","\\.lua$","\\.m$","\\.md$","\\.mk$","\\.ml$","\\.nim$","\\.nix$","\\.php$","\\.pl$","\\.proto$","\\.ps1$","\\.py$","\\.r$","\\.rb$","\\.rs$","\\.rst$","\\.sass$","\\.scala$","\\.scss$","\\.sh$","\\.sql$","\\.svelte$","\\.swift$","\\.tcl$","\\.tex$","\\.tf$","\\.toml$","\\.ts$","\\.tsx$","\\.txt$","\\.v$","\\.vim$","\\.vue$","\\.xml$","\\.yaml$","\\.yml$","\\.zig$","\\.zsh$","Dockerfile$","Makefile$","Rakefile$","Gemfile$","Vagrantfile$","\\.gitignore$","\\.gitattributes$","\\.editorconfig$","\\.eslintrc$","\\.prettierrc$","\\.babelrc$"]'
# END Fuzzy Filter Patterns
# SOURCE_BEGIN software/scripts/bash-fzf.profile.bash
# software/scripts/bash-fzf.profile.bash | 46ed46baad340d9259753240a051df2a | 20.8 KB | 2026-05-12
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
# Single source of truth for fzf defaults. All flags here apply to every fzf
# invocation (functions, command-line, completion) without relying on alias
# expansion — which is fragile inside function bodies sourced from a profile.
# --ansi is required for colored input (e.g. git log --color=always); harmless
# on plain text. --no-sort + --tiebreak=index preserve input order so picker
# functions can rely on the order they emit. --layout=reverse puts input at
# top. --cycle wraps list navigation.
export FZF_DEFAULT_OPTS="
  --ansi
  --no-sort
  --cycle
  --layout=reverse
  --tiebreak=index
  --info-command='_fzf_info_line'
  --bind 'shift-left:preview-page-up'
  --bind 'shift-right:preview-page-down'
  --bind 'ctrl-left:preview-page-up'
  --bind 'ctrl-right:preview-page-down'
  --bind 'ctrl-up:preview-up'
  --bind 'ctrl-down:preview-down'
  --bind 'ctrl-f:page-down'
  --bind 'ctrl-b:page-up'
  --bind 'ctrl-\\:toggle-preview'
"

# ---- Aliases: Git (fzf) ----
alias glog='fuzzy_git_show'
alias fvim='fuzzy_edit vim'

################################################################################
# ---- Filter Functions ----
# Shared by fuzzy_edit, autocomplete nested tokens, and fzf-tab-completion.
# Single source of truth — sourced into profile-advanced.sh and autocomplete tests.
################################################################################
function filter_unwanted() {
  # _IGNORED_FOLDER_PATTERNS / _IGNORED_FILE_PATTERNS are bootstrapped from
  # EDITOR_CONFIGS.{ignoredFoldersRegex,ignoredFilesRegex} by
  # software/scripts/advanced/fuzzy-patterns.js. Both arrays feed into a
  # single grep -v -E so callers (pack_text, cprepo, fuzzy_edit, autocomplete)
  # share a single source of truth for both folder excludes
  # (node_modules, .venv, .git/, etc.) and file-extension excludes
  # (.swp, .exe, .pyc, etc.). Fallback list below covers minimal shell
  # environments (e.g. tests sourcing this file standalone) where the
  # bootstrap hasn't run yet.
  local patterns=()
  if declare -p _IGNORED_FOLDER_PATTERNS &> /dev/null; then
    patterns+=("${_IGNORED_FOLDER_PATTERNS[@]}")
  fi
  if declare -p _IGNORED_FILE_PATTERNS &> /dev/null; then
    patterns+=("${_IGNORED_FILE_PATTERNS[@]}")
  fi
  if [ ${#patterns[@]} -eq 0 ]; then
    patterns=(
      # folder regex
      '\.DS_Store'
      '\.angular/'
      '\.cache/'
      '\.git/'
      '\.gradle/'
      '\.hg/'
      '\.idea/'
      '\.ipynb_checkpoints/'
      '\.mypy_cache/'
      '\.next/'
      '\.nuxt/'
      '\.parcel-cache/'
      '\.pyc'
      '\.pytest_cache/'
      '\.ruff_'
      '\.sass-cache/'
      '\.svelte-kit/'
      '\.svn/'
      '\.terraform/'
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
      '/DerivedData/'
      '/dist/'
      '/htmlcov/'
      '/out/'
      '/Pods/'
      '/target/'
      '/vendor/'
      # file regex (anchored to end of basename / line)
      '\.DS_Store$'
      'Thumbs\.db$'
      'desktop\.ini$'
      '\.Spotlight-'
      '\.Trashes$'
      '\.fseventsd$'
      '\.com\.apple\.'
      '\.localized$'
      '\.a$'
      '\.class$'
      '\.dll$'
      '\.dylib$'
      '\.exe$'
      '\.lib$'
      '\.o$'
      '\.obj$'
      '\.pyc$'
      '\.pyo$'
      '\.so$'
      '\.swo$'
      '\.swp$'
      '\.wasm$'
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
# _IGNORED_*_JSON / _FUZZY_TEXT_FILES_JSON variables are bootstrapped from
# EDITOR_CONFIGS by software/scripts/advanced/fuzzy-patterns.js (registered as
# the "Fuzzy Filter Patterns" profile block sourced before this file). The
# hardcoded fallbacks below cover minimal shell environments (e.g. tests
# sourcing this file standalone) where the bootstrap hasn't run yet — they
# intentionally mirror EDITOR_CONFIGS.{ignoredFoldersRegex,ignoredFilesRegex,
# textFilesRegex}. The _IGNORED_*_JSON pair is general-purpose (consumed by
# pack_text and other pipelines too); _FUZZY_TEXT_FILES_JSON is fuzzy-picker
# specific.
# JSON pattern arrays — passed directly to node as process.argv (proper JS regex strings)
# folder patterns — skip ignored dirs during traversal
[ -z "${_IGNORED_FOLDERS_JSON+x}" ] && _IGNORED_FOLDERS_JSON='["\\.DS_Store","\\.angular/","\\.cache/","\\.git/","\\.gradle/","\\.hg/","\\.idea/","\\.ipynb_checkpoints/","\\.mypy_cache/","\\.next/","\\.nuxt/","\\.parcel-cache/","\\.pyc","\\.pytest_cache/","\\.ruff_","\\.sass-cache/","\\.svelte-kit/","\\.svn/","\\.terraform/","\\.tox/","\\.turbo/","\\.uv/","\\.venv/","\\.yarn/","__pycache","bower_components","node_modules","/build/","/coverage/","/cov/","/DerivedData/","/dist/","/htmlcov/","/out/","/Pods/","/target/","/vendor/"]'
# ignored file patterns — exclude binary files, system junk, and non-text files
[ -z "${_IGNORED_FILES_JSON+x}" ] && _IGNORED_FILES_JSON='["\\.DS_Store$","Thumbs\\.db$","desktop\\.ini$","\\.Spotlight-","\\.Trashes$","\\.fseventsd$","\\.com\\.apple\\.","\\.localized$","\\.a$","\\.class$","\\.dll$","\\.dylib$","\\.exe$","\\.lib$","\\.o$","\\.obj$","\\.pyc$","\\.pyo$","\\.so$","\\.swo$","\\.swp$","\\.wasm$"]'
# text file extension allowlist — used by text_files mode
[ -z "${_FUZZY_TEXT_FILES_JSON+x}" ] && _FUZZY_TEXT_FILES_JSON='["\\.bash$","\\.c$","\\.cfg$","\\.clj$","\\.cmake$","\\.coffee$","\\.conf$","\\.cpp$","\\.cs$","\\.css$","\\.csv$","\\.dart$","\\.diff$","\\.dockerfile$","\\.el$","\\.elm$","\\.env$","\\.erl$","\\.ex$","\\.fish$","\\.go$","\\.graphql$","\\.groovy$","\\.h$","\\.hpp$","\\.hs$","\\.html$","\\.ini$","\\.java$","\\.js$","\\.json$","\\.jsonc$","\\.jsx$","\\.kt$","\\.less$","\\.lisp$","\\.log$","\\.lua$","\\.m$","\\.md$","\\.mk$","\\.ml$","\\.nim$","\\.nix$","\\.php$","\\.pl$","\\.proto$","\\.ps1$","\\.py$","\\.r$","\\.rb$","\\.rs$","\\.rst$","\\.sass$","\\.scala$","\\.scss$","\\.sh$","\\.sql$","\\.svelte$","\\.swift$","\\.tcl$","\\.tex$","\\.tf$","\\.toml$","\\.ts$","\\.tsx$","\\.txt$","\\.v$","\\.vim$","\\.vue$","\\.xml$","\\.yaml$","\\.yml$","\\.zig$","\\.zsh$","Dockerfile$","Makefile$","Rakefile$","Gemfile$","Vagrantfile$","\\.gitignore$","\\.gitattributes$","\\.editorconfig$","\\.eslintrc$","\\.prettierrc$","\\.babelrc$"]'

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
  " "$dir" "$mode" "$max_depth" "$_IGNORED_FOLDERS_JSON" "$_IGNORED_FILES_JSON" "$_FUZZY_TEXT_FILES_JSON" "$max_timeout" "$filter"
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
  local OUT=$(echo "$(_recent_files)" | fzf +m --prompt="recent files> " \
    --header="(Ctrl+Y) - recently opened files" \
    --preview="bat --paging=never --style=plain --color=always {}" \
    --preview-window=down:50%:wrap)
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
  if [[ $# -eq 0 ]]; then
    return 1 # silent exit
  fi
  local editorCmd=subl
  print_action_summary "$1" "$editorCmd"
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
    command cat "$BOOKMARK_PATH" 2> /dev/null
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
  cmd=$(command cat "$BOOKMARK_PATH" 2> /dev/null | sort -u | fzf --prompt="bookmark> " \
    --header="(Ctrl+B) - bookmarked commands" \
    --preview='source "$HOME/.bashrc" &>/dev/null; cmd={};word=$(echo "$cmd" | awk "{print \$1}"); { type "$word" 2>&1; echo ""; echo "---"; echo "$cmd"; } | bat --paging=never --style=plain --color=always --language=bash' \
    --preview-window=down:50%:wrap \
    --bind 'f5:reload(command cat "$BOOKMARK_PATH" 2>/dev/null | sort -u)')

  if [ -n "$cmd" ]; then
    echo "### Command Selected from Bookmarks ###"
    echo "$cmd"
    eval "$cmd"
    history -s "$cmd"
  fi
}

# ---- File related Fzf Helper Functions ----
# Ctrl+P — fzf cd picker (PWD subfolders first, then recent folders marked with ★)
# Each line is "<marker>\t<path>"; fzf shows both columns but searches only the path
# (--nth=2). Selection extracts the path via "${OUT##*$'\t'}".
function _fuzzy_cd_list() {
  local dir="${1:-.}"
  _fuzzy_list_all "$dir" "folders" "" 10 | awk '{print "  \t" $0}'
  _recent_folders 2> /dev/null | awk '{print "★ \t" $0}'
}
function fuzzy_cd() {
  local dir="${1:-.}"
  local abs_dir
  abs_dir=$(cd "$dir" 2> /dev/null && command pwd || echo "$dir")
  local OUT=$(_fuzzy_cd_list "$dir" | awk -F'\t' '!seen[$2]++' | fzf +m \
    --delimiter=$'\t' --with-nth=1,2 --nth=2 \
    --prompt="cd> " \
    --header="(Ctrl+P) - cd; ★ recent folders, plain = subfolders under ${abs_dir}" \
    --preview='ls -Cp --color=always {2} 2>/dev/null' \
    --preview-window=down:50%:wrap \
    --bind "f5:reload(_fuzzy_cd_list '$dir' | awk -F'\t' '!seen[\$2]++')")
  if [ -n "$OUT" ]; then
    OUT="${OUT##*$'\t'}"
    if [ -d "$OUT" ]; then
      print_action_summary "$OUT"
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
  local abs_dir
  abs_dir=$(cd "$dir" 2> /dev/null && command pwd || echo "$dir")
  local OUT=$(_fuzzy_list_all "$dir" "paths" "" 10 | fzf --prompt="edit> " \
    --header="(Ctrl+T) - edit files under ${abs_dir}" \
    --preview="[ -d {} ] && ls -Cp --color=always {} 2>/dev/null || (bat --paging=never --style=plain --color=always {})" \
    --preview-window=down:50%:wrap \
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

  # Folder selections: just print PWD + cd. File selections: also print the editor line
  # (mirrors what we're about to invoke). print_action_summary handles the format.
  if [ "$IS_DIR" = true ]; then
    print_action_summary "$FULL_PATH"
    cd "$FULL_PATH"
  else
    local EDIT_CMD
    if [ -n "$VIEW_COMMAND" ] && type -P "$VIEW_COMMAND" &> /dev/null; then
      EDIT_CMD="$VIEW_COMMAND"
    else
      EDIT_CMD="view_file"
    fi
    print_action_summary "$FULL_PATH" "$EDIT_CMD"
    if [ -n "$VIEW_COMMAND" ] && type -P "$VIEW_COMMAND" &> /dev/null; then
      "$VIEW_COMMAND" "$OUT"
    else
      view_file "$OUT"
    fi
  fi
}

# Ctrl+G — interactive git log browser with commit preview
function fuzzy_git_show() {
  git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always \
    | fzf --prompt="commits> " \
      --header="(Ctrl+G) - git log; Enter shows full commit in pager, F5 reloads" \
      --preview-window=down:50%:wrap \
      --preview='hash=$(echo {} | grep -o "[a-f0-9]\{7\}" | head -1);
      git log --color=always --format="%C(yellow)%H%n%C(cyan)Author: %an <%ae>%n%C(green)Date:   %ad%n%n%C(bold white)%s%C(reset)%n%n%b" -1 $hash;
      echo "$LINE_BREAK_HASH";
      git diff-tree --no-commit-id --stat --color=always $hash;
      echo "";
      git diff-tree --no-commit-id -p --color=always $hash' \
      --bind "ctrl-m:execute:(echo {} | grep -o '[a-f0-9]\{7\}' | head -1 | xargs -I % sh -c 'git show --color=always % | (bat --paging=always --style=plain 2>/dev/null || batcat --paging=always --style=plain 2>/dev/null || less -R)')" \
      --bind "f5:reload(git log --pretty=format:'%Cred%h%Creset %s %C(bold blue)%an%Creset %Cgreen(%ar)%Creset' --abbrev-commit --color=always)"
}
# SOURCE_END software/scripts/bash-fzf.profile.bash
# SOURCE_BEGIN software/scripts/advanced/editor-launchers-common.profile.bash
# software/scripts/advanced/editor-launchers-common.profile.bash | 5cac2d6a7ddd2c843ee0ed6996efde70 | 5.6 KB | 2026-05-12
# Parallel-array registry populated by `_register_editor` calls in each
# editor-launchers.js block. Used by `list_editors` for binary-availability triage.
_REGISTERED_EDITORS=()
_REGISTERED_EDITORS_PATHS_VARS=()

# Register an editor wrapper (name + paths-array variable name) for the
# `list_editors` triage helper. Each editor block in editor-launchers.js
# self-registers via this so the listing stays inline with its component.
function _register_editor() {
  _REGISTERED_EDITORS+=("$1")
  _REGISTERED_EDITORS_PATHS_VARS+=("$2")
}

# Print every registered editor wrapper and the resolved binary path, or
# "(not found)" if none of its candidate paths exist. Useful for triaging
# which editors are actually available on the current system.
function list_editors() {
  if is_help_arg "${1:-}"; then
    echo "
      list_editors: print every editor wrapper and the binary it would launch (or '(not found)')
        list_editors          show resolved path for subl, smerge, code, zed, vim, ...
    "
    return 0
  fi

  local i name paths_var resolved
  for ((i = 0; i < ${#_REGISTERED_EDITORS[@]}; i++)); do
    name="${_REGISTERED_EDITORS[$i]}"
    paths_var="${_REGISTERED_EDITORS_PATHS_VARS[$i]}[@]"
    echo "# $name"
    if resolved=$(find_path "${!paths_var}" --exec 2> /dev/null) && [ -n "$resolved" ]; then
      echo "\"$resolved\""
    else
      echo "(not found)"
    fi
    echo ""
  done
}

# Resolve editor binary from a list of candidate paths (delegates to find_path exec mode)
function find_editor() {
  local editor_name="$1"
  shift
  local result
  result=$(find_path "$@" --exec) && echo "$result" && return 0
  echo "Error: $editor_name not found in search paths." >&2
  return 1
}

# If "-" appears in the passed args (e.g. `cmd | subl -`), slurp stdin into a temp
# file and replace each "-" with that path. Result is written to the global
# `_STDIN_RESOLVED_ARGS` array (callers reassign their own argv from it).
# GUI editors are launched via `nohup ... &` which closes stdin, so a literal
# `-` would never deliver piped content; this normalizes the input to a file path.
function _resolve_stdin_arg() {
  local editor_name="$1"
  shift
  _STDIN_RESOLVED_ARGS=()
  local stdin_file=""
  local arg
  for arg in "$@"; do
    if [[ "$arg" == "-" ]]; then
      if [ -z "$stdin_file" ]; then
        stdin_file=$(mktemp "${TMPDIR:-/tmp}/${editor_name}-stdin.XXXXXX") || return 1
        command cat > "$stdin_file"
      fi
      _STDIN_RESOLVED_ARGS+=("$stdin_file")
    else
      _STDIN_RESOLVED_ARGS+=("$arg")
    fi
  done
}

# Launch an editor in the background (GUI mode)
function run_editor() {
  local editor_name="$1"
  shift
  local target_binary
  target_binary=$(find_editor "$editor_name" "$@") || return 1

  # Substitute any literal "-" arg with a temp file populated from stdin so piped
  # input survives the nohup-backgrounded launch below.
  _resolve_stdin_arg "$editor_name" "${editor_args[@]}"
  editor_args=("${_STDIN_RESOLVED_ARGS[@]}")

  # track opened files for recent file history
  type _track_file &> /dev/null && _track_file "${editor_args[@]}"

  # Split editor_args into the first path-like arg (the display target) and the
  # remaining flags. Convert any path-like arg through to_windows_path so the actual
  # invocation works on WSL where the editor binary is the Windows-side process.
  local converted_args=()
  local first_path=""
  local -a flag_args=()
  for arg in "${editor_args[@]}"; do
    if [[ "$arg" == /* ]] || [[ "$arg" == .* ]]; then
      [ -z "$first_path" ] && first_path=$(realpath "$arg")
      converted_args+=("$(to_windows_path "$arg")")
    else
      converted_args+=("$arg")
      flag_args+=("$arg")
    fi
  done

  if ((is_os_windows)); then
    (nohup "$target_binary" "${converted_args[@]}" > /dev/null 2>&1 &)
  else
    (nohup "$target_binary" "${editor_args[@]}" > /dev/null 2>&1 &)
    # bring the editor window to the foreground on macOS (async, never blocks the shell)
    if ((is_os_mac)); then
      # app_name = bundle display name (used by `tell application X to activate`)
      # process_name = executable name shown in System Events (used by `tell process X`).
      # These differ for VS Code: bundle is "Visual Studio Code" but the running process is "Code",
      # so System Events errors with -1728 unless we pass the process name explicitly. Sublime
      # Text and Zed happen to match (or AppleScript resolves them), so process_name is optional.
      local app_name="" process_name=""
      case "$editor_name" in
      subl) app_name="Sublime Text" ;;
      smerge) app_name="Sublime Merge" ;;
      code)
        app_name="Visual Studio Code"
        process_name="Code"
        ;;
      zed) app_name="Zed" ;;
      esac
      if [[ -n "$app_name" ]]; then
        (maximize_and_focus_window "$app_name" "$process_name" > /dev/null 2>&1 &)
      fi
    fi
  fi

  if [ -n "$first_path" ]; then
    print_action_summary "$first_path" "$target_binary" "${flag_args[@]}"
  fi
}

# Run an editor command in the foreground (CLI mode, stdout preserved)
function run_editor_cli() {
  local editor_name="$1"
  shift
  local target_binary
  target_binary=$(find_editor "$editor_name" "${editor_paths[@]}") || return 1

  # Substitute any literal "-" arg with a temp file populated from stdin (e.g.
  # `cmd | vim -`). vim natively reads "-" foreground, but normalizing to a
  # real path keeps behavior consistent across editors and gives the buffer a
  # saveable path.
  _resolve_stdin_arg "$editor_name" "$@"
  set -- "${_STDIN_RESOLVED_ARGS[@]}"

  # track opened files for recent file history
  type _track_file &> /dev/null && _track_file "$@"

  "$target_binary" "$@"
}
# SOURCE_END software/scripts/advanced/editor-launchers-common.profile.bash
# BEGIN Editor Launchers - Vim
_VIM_PATHS=(
  /usr/bin/vim
  /usr/local/bin/vim
  /opt/homebrew/bin/vim
)
_register_editor "vim" "_VIM_PATHS"

function vim() {
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
_register_editor "subl" "_SUBL_PATHS"

function subl() {
  local editor_args
  # editor_args=("-n" "$@") # -n: always open a new window
  # editor_args=("-a" "$@") # -a: add to last active window (merges into existing project)
  editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

  run_editor "subl" "${_SUBL_PATHS[@]}"
}
# END Editor Launchers - Sublime Text
# BEGIN Editor Launchers - Sublime Merge
_SMERGE_PATHS=(
  "/Applications/Sublime*Merge.app/Contents/SharedSupport/bin/smerge"
"/mnt/c/Program*Files/Sublime*Merge*/smerge.exe"
"/mnt/c/Program*Files/Sublime*Merge*/sublime_merge.exe"
"/mnt/c/Users/*/AppData/Local/Programs/Sublime*Merge/smerge.exe"
"/opt/sublime_merge/smerge"
"/usr/bin/smerge"
"/usr/local/bin/smerge"
)
_register_editor "smerge" "_SMERGE_PATHS"

function smerge() {
  local editor_args
  editor_args=("$@")

  run_editor "smerge" "${_SMERGE_PATHS[@]}"
}
# END Editor Launchers - Sublime Merge
# BEGIN Editor Launchers - VS Code
_CODE_PATHS=(
  "/Applications/Visual*Studio*Code.app/Contents/Resources/app/bin/code"
"/Applications/Visual*Studio*Code*Insiders.app/Contents/Resources/app/bin/code"
"/opt/homebrew/bin/code"
"/usr/local/bin/code"
"/mnt/c/Users/*/AppData/Local/Programs/Microsoft*Code/Code.exe"
"/mnt/c/Users/*/AppData/Local/Programs/Microsoft*Code*Insiders/Code*.exe"
"/mnt/c/Program*Files/Microsoft*VS*Code/Code.exe"
"/usr/bin/code"
"/usr/local/bin/code"
"/snap/bin/code"
)
_register_editor "code" "_CODE_PATHS"

function code() {
  local editor_args
  # editor_args=("-n" "$@") # -n: always open a new window
  # editor_args=("-r" "$@") # -r: reuse last active window (replaces current project)
  editor_args=("$@") # no flag: reuses window if path is already open, otherwise new window

  run_editor "code" "${_CODE_PATHS[@]}"
}

function code_list_extensions() {
  local editor_paths=("${_CODE_PATHS[@]}")
  run_editor_cli "code" --list-extensions
}
# END Editor Launchers - VS Code
# BEGIN Editor Launchers - Zed
_ZED_PATHS=(
  "/Applications/Zed.app/Contents/MacOS/cli"
"/usr/local/bin/zed"
"/opt/homebrew/bin/zed"
"/mnt/c/Program*Files/[Zz]ed*/[Zz]ed.exe"
"/mnt/c/Users/*/AppData/Local/Programs/[Zz]ed*/[Zz]ed.exe"
"/mnt/c/Users/*/AppData/Local/[Zz]ed*/[Zz]ed.exe"
"/usr/bin/zed"
"/usr/local/bin/zed"
"~/.local/bin/zed"
)
_register_editor "zed" "_ZED_PATHS"

function zed() {
  local editor_args
  editor_args=("$@")

  run_editor "zed" "${_ZED_PATHS[@]}"
}
# END Editor Launchers - Zed
# SOURCE_BEGIN software/scripts/advanced/browser-launchers-common.profile.bash
# software/scripts/advanced/browser-launchers-common.profile.bash | 8b5e81f1e38a65b965828d9054d15f31 | 5.8 KB | 2026-05-12
# Common Chromium flags applied by run_browser on every launch.
# Kept to safe, non-destructive tweaks (no sync/security changes).
#
# Two groups:
#   - Common Params: also written to the browser's Preferences file by
#     browser-config.js. Duplicated here as launch flags so the
#     behavior applies even before Prefs are written, and in case a profile's
#     Prefs file gets reset.
#   - CLI Only: no Preferences equivalent — must be passed at launch.
_BROWSER_COMMON_ARGS=(
  # ─── Common Params (mirrored in browser-config.js Preferences) ───
  "--no-pings" # blocks <a ping=""> hyperlink-auditing beacons (mirrors enable_hyperlink_auditing)

  # ─── CLI Only (no Preferences equivalent) ───
  "--disable-smooth-scrolling"            # kills scroll-animation tween; snappier wheel/trackpad response (big win on macOS)
  "--no-default-browser-check"            # suppresses the "Make me the default browser?" info bar
  "--no-first-run"                        # skips the welcome wizard on fresh profiles
  "--disable-search-engine-choice-screen" # skips the EU search-engine picker dialog (no-op outside EEA)
  "--disable-breakpad"                    # no crash reports uploaded to Google; crashes still visible in chrome://crashes

  # ─── Feature Toggles (Chromium only honors the LAST --disable-features= on the CLI, so these must be merged into one flag) ───
  #   Translate                      — suppresses "Translate this page?" infobar (also mirrored as translate.enabled)
  #   InterestFeedContentSuggestions — removes content-suggestion tiles on the new-tab page (CLI only)
  #   OptimizationHints              — stops Google page-optimization telemetry (also mirrored as optimization_guide.fetching_hints_enabled)
  "--disable-features=Translate,InterestFeedContentSuggestions,OptimizationHints"
)

# Parallel-array registry populated by `_register_browser` calls in each
# browser-launchers.js block. Used by `list_browsers` for binary-availability triage.
_REGISTERED_BROWSERS=()
_REGISTERED_BROWSERS_PATHS_VARS=()

# Register a browser wrapper (name + paths-array variable name) for the
# `list_browsers` triage helper. Each browser block in browser-launchers.js
# self-registers via this so the listing stays inline with its component.
function _register_browser() {
  _REGISTERED_BROWSERS+=("$1")
  _REGISTERED_BROWSERS_PATHS_VARS+=("$2")
}

# Print every registered browser wrapper and the resolved binary path, or
# "(not found)" if none of its candidate paths exist. Useful for triaging
# which browsers are actually available on the current system.
function list_browsers() {
  if is_help_arg "${1:-}"; then
    echo "
      list_browsers: print every browser wrapper and the binary it would launch (or '(not found)')
        list_browsers         show resolved path for brave, chrome, edge, chromium, vivaldi, opera, arc
    "
    return 0
  fi

  local i name paths_var resolved
  for ((i = 0; i < ${#_REGISTERED_BROWSERS[@]}; i++)); do
    name="${_REGISTERED_BROWSERS[$i]}"
    paths_var="${_REGISTERED_BROWSERS_PATHS_VARS[$i]}[@]"
    echo "# $name"
    if resolved=$(find_path "${!paths_var}" --exec 2> /dev/null) && [ -n "$resolved" ]; then
      echo "\"$resolved\""
    else
      echo "(not found)"
    fi
    echo ""
  done
}

# Resolve browser binary from a list of candidate paths (delegates to find_path exec mode)
function find_browser() {
  local browser_name="$1"
  shift
  local result
  result=$(find_path "$@" --exec) && echo "$result" && return 0
  echo "Error: $browser_name not found in search paths." >&2
  return 1
}

# Launch a browser fully detached from the terminal with URLs/args.
# Always prepends _BROWSER_COMMON_ARGS (e.g. --disable-smooth-scrolling) to the
# user-supplied args. Caller sets `browser_args` array before invoking.
#
# Background launch pattern: `(nohup CMD > /dev/null 2>&1 &)`
#   - outer `( ... )`      — subshell that exits immediately, reparenting the
#                            child to init/launchd so closing the terminal does
#                            not kill the browser (safer than `disown`, which
#                            CLAUDE.md forbids)
#   - `nohup`              — detaches from the controlling tty's HUP signal
#   - `> /dev/null 2>&1`   — silences stdout/stderr so nothing bleeds into the
#                            user's next prompt
#   - trailing `&`         — runs inside the subshell in the background
function run_browser() {
  local browser_name="$1"
  shift
  local target_binary
  target_binary=$(find_browser "$browser_name" "$@") || return 1

  # Prepend common flags; user args come after so they can override.
  local final_args=("${_BROWSER_COMMON_ARGS[@]}" "${browser_args[@]}")

  # Echo the exact command about to run so users can see / copy / re-run it.
  # Printed BEFORE the launch so the banner is visible even if the browser
  # crashes or the background subshell forks fail.
  echo "
====================================
\"$target_binary\" ${final_args[@]}
PWD:           $(pwd)
====================================
  "

  # Launch browser fully detached (same pattern on all platforms).
  (nohup "$target_binary" "${final_args[@]}" > /dev/null 2>&1 &)

  # On macOS, maximize the browser window on the active display and tile any
  # extras, same as run_editor. `maximize_and_focus_window` is a generic
  # dispatcher defined in profile-advanced.sh; on non-mac it's a no-op.
  # Backgrounded so it never blocks the shell.
  if ((is_os_mac)); then
    local app_name=""
    case "$browser_name" in
    brave) app_name="Brave Browser" ;;
    chrome) app_name="Google Chrome" ;;
    edge) app_name="Microsoft Edge" ;;
    chromium) app_name="Chromium" ;;
    vivaldi) app_name="Vivaldi" ;;
    opera) app_name="Opera" ;;
    arc) app_name="Arc" ;;
    esac
    if [[ -n "$app_name" ]]; then
      (maximize_and_focus_window "$app_name" > /dev/null 2>&1 &)
    fi
  fi
}
# SOURCE_END software/scripts/advanced/browser-launchers-common.profile.bash
# BEGIN Browser Launchers - Brave
_BRAVE_PATHS=(
  "/Applications/Brave*Browser.app/Contents/MacOS/Brave*Browser"
"/mnt/c/Program*Files/BraveSoftware/Brave-Browser/Application/brave.exe"
"/mnt/c/Program*Files*86*/BraveSoftware/Brave-Browser/Application/brave.exe"
"/mnt/c/Users/*/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe"
"/usr/bin/brave-browser"
"/usr/bin/brave-browser-stable"
"/usr/bin/brave"
"/opt/brave.com/brave/brave-browser"
"/opt/brave.com/brave/brave"
"/snap/bin/brave"
"/var/lib/flatpak/exports/bin/com.brave.Browser"
)
_register_browser "brave" "_BRAVE_PATHS"

function brave() {
  local browser_args
  browser_args=("$@")

  run_browser "brave" "${_BRAVE_PATHS[@]}"
}
# END Browser Launchers - Brave
# BEGIN Browser Launchers - Chrome
_CHROME_PATHS=(
  "/Applications/Google*Chrome.app/Contents/MacOS/Google*Chrome"
"/mnt/c/Program*Files/Google/Chrome/Application/chrome.exe"
"/mnt/c/Program*Files*86*/Google/Chrome/Application/chrome.exe"
"/mnt/c/Users/*/AppData/Local/Google/Chrome/Application/chrome.exe"
"/usr/bin/google-chrome"
"/usr/bin/google-chrome-stable"
"/opt/google/chrome/google-chrome"
"/opt/google/chrome/chrome"
"/snap/bin/google-chrome"
"/var/lib/flatpak/exports/bin/com.google.Chrome"
)
_register_browser "chrome" "_CHROME_PATHS"

function chrome() {
  local browser_args
  browser_args=("$@")

  run_browser "chrome" "${_CHROME_PATHS[@]}"
}
# END Browser Launchers - Chrome
# BEGIN Browser Launchers - Edge
_EDGE_PATHS=(
  "/Applications/Microsoft*Edge.app/Contents/MacOS/Microsoft*Edge"
"/mnt/c/Program*Files/Microsoft/Edge/Application/msedge.exe"
"/mnt/c/Program*Files*86*/Microsoft/Edge/Application/msedge.exe"
"/usr/bin/microsoft-edge"
"/usr/bin/microsoft-edge-stable"
"/opt/microsoft/msedge/microsoft-edge"
"/opt/microsoft/msedge/msedge"
)
_register_browser "edge" "_EDGE_PATHS"

function edge() {
  local browser_args
  browser_args=("$@")

  run_browser "edge" "${_EDGE_PATHS[@]}"
}
# END Browser Launchers - Edge
# BEGIN Browser Launchers - Chromium
_CHROMIUM_PATHS=(
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
"/mnt/c/Program*Files/Chromium/Application/chrome.exe"
"/mnt/c/Users/*/AppData/Local/Chromium/Application/chrome.exe"
"/usr/bin/chromium"
"/usr/bin/chromium-browser"
"/snap/bin/chromium"
"/var/lib/flatpak/exports/bin/org.chromium.Chromium"
)
_register_browser "chromium" "_CHROMIUM_PATHS"

function chromium() {
  local browser_args
  browser_args=("$@")

  run_browser "chromium" "${_CHROMIUM_PATHS[@]}"
}
# END Browser Launchers - Chromium
# BEGIN Browser Launchers - Vivaldi
_VIVALDI_PATHS=(
  "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi"
"/mnt/c/Program*Files/Vivaldi/Application/vivaldi.exe"
"/mnt/c/Users/*/AppData/Local/Vivaldi/Application/vivaldi.exe"
"/usr/bin/vivaldi"
"/usr/bin/vivaldi-stable"
"/opt/vivaldi/vivaldi"
)
_register_browser "vivaldi" "_VIVALDI_PATHS"

function vivaldi() {
  local browser_args
  browser_args=("$@")

  run_browser "vivaldi" "${_VIVALDI_PATHS[@]}"
}
# END Browser Launchers - Vivaldi
# BEGIN Browser Launchers - Opera
_OPERA_PATHS=(
  "/Applications/Opera.app/Contents/MacOS/Opera"
"/mnt/c/Program*Files/Opera/opera.exe"
"/mnt/c/Users/*/AppData/Local/Programs/Opera/opera.exe"
"/usr/bin/opera"
"/snap/bin/opera"
)
_register_browser "opera" "_OPERA_PATHS"

function opera() {
  local browser_args
  browser_args=("$@")

  run_browser "opera" "${_OPERA_PATHS[@]}"
}
# END Browser Launchers - Opera
# BEGIN Browser Launchers - Arc
_ARC_PATHS=(
  "/Applications/Arc.app/Contents/MacOS/Arc"
)
_register_browser "arc" "_ARC_PATHS"

function arc() {
  local browser_args
  browser_args=("$@")

  run_browser "arc" "${_ARC_PATHS[@]}"
}
# END Browser Launchers - Arc
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

  # Portable equivalent of `mapfile -t COMPREPLY` for bash 3.2 compat (mapfile is bash 4+).
  COMPREPLY=()
  while IFS= read -r line; do COMPREPLY+=("$line"); done < <(compgen -W "$opts" -- "$expanded_cur")

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

# BEGIN brew Spec Autocomplete
################################################################################
# brew (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_brew() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
install|--cask,--formula,--force,-f,--verbose,-v,--debug,-d,--quiet,-q,--overwrite,--dry-run,--HEAD,--fetch-HEAD,--keep-tmp,--build-from-source,-s,--force-bottle,--include-test,--build-bottle,--bottle-arch,--ignore-dependencies,--only-dependencies,--cc,--appdir,--no-binaries,--language,--no-quarantine,--adopt,--require-sha,--audio-unit-plugin-dir,--vst-plugin-dir,--vst3-plugin-dir,--screen-saver-dir
uninstall|--cask,--formula,--force,-f,--zap,--ignore-dependencies
reinstall|--cask,--formula,--force,-f,--verbose,-v,--debug,-d,--no-quarantine,--adopt,--require-sha
upgrade|--cask,--formula,--force,-f,--verbose,-v,--debug,-d,--dry-run,--greedy,--greedy-latest,--greedy-auto-updates,--no-quarantine,--fetch-HEAD
update|--merge,--auto-update,--force,-f,--verbose,-v,--debug,-d,--quiet,-q
search|--cask,--formula,--desc,--eval-all,--pull-request,--open,--closed
info|--cask,--formula,--json,--installed,--eval-all,--all,--verbose,-v,--analytics,--days,--category
list|--cask,--formula,--full-name,--versions,--multiple,--pinned,-1,-l,-r,-t
services|list,start,stop,restart,run,cleanup,info
services start|--all,--file
services stop|--all
services restart|--all
tap|--force-auto-update,--custom-remote,--repair,--eval-all,--force
untap|--force
cleanup|--prune,--dry-run,-n,-s,--scrub
doctor|--list-checks,--audit-debug,--verbose,-v,--debug,-d
deps|--tree,--all,--installed,--eval-all,--for-each,--include-build,--include-optional,--include-test,--skip-recommended,--union,--cask,--formula,-n,-1
uses|--installed,--eval-all,--include-build,--include-optional,--include-test,--skip-recommended,--cask,--formula,--recursive
outdated|--cask,--formula,--json,--fetch-HEAD,--greedy,--greedy-latest,--greedy-auto-updates,--verbose,-v,--quiet,-q
pin|--formula
unpin|--formula
link|--overwrite,--dry-run,-n,--force,-f,--HEAD
unlink|--dry-run,-n
autoremove|--dry-run,-n
leaves|--installed-on-request,--installed-as-dependency
log|--max-count,-n,--oneline,-1
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_brew brew 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_brew brew
fi
# END brew Spec Autocomplete

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

# BEGIN fnm Spec Autocomplete
################################################################################
# fnm (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_fnm() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
install|--lts,--latest,--progress,--arch,--log-level
use|--install-if-missing,--silent-if-current,--log-level
list
list-remote|--lts,--sort,--filter,--log-level
ls
ls-remote|--lts,--sort,--filter,--log-level
default|--log-level
alias|--log-level
unalias|--log-level
current|--log-level
env|--shell,--use-on-cd,--log-level,--corepack-enabled,--resolve-engines,--version-file-strategy,--multi
exec|--using,--using-file,--log-level
uninstall|--log-level
completions|--shell,--log-level
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_fnm fnm 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_fnm fnm
fi
# END fnm Spec Autocomplete

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

# BEGIN uv Spec Autocomplete
################################################################################
# uv (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_uv() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
add|--dev,--optional,--group,--requirements,--editable,--raw-sources,--rev,--tag,--branch,--no-sync,--frozen,--locked,--extra,--all-extras,--no-extra,--python,-p,--config-file,--no-config,--cache-dir,--no-cache,--quiet,-q,--verbose,-v
build|--sdist,--wheel,--out-dir,-o,--python,-p,--config-setting,-C,--no-build-isolation,--no-config,--cache-dir,--no-cache,--quiet,-q,--verbose,-v
cache|clean,dir,prune
export|--format,--output-file,-o,--all-extras,--extra,--no-extra,--frozen,--locked,--no-dev,--no-emit-project,--no-emit-workspace,--quiet,-q,--verbose,-v
help
init|--app,--lib,--script,--package,--no-package,--name,--python,-p,--no-readme,--no-pin-python,--vcs,--build-backend,--author-from,--no-workspace,--quiet,-q,--verbose,-v
lock|--frozen,--locked,--python,-p,--config-file,--no-config,--cache-dir,--no-cache,--quiet,-q,--verbose,-v
pip|compile,install,list,show,freeze,check,uninstall,sync,tree
publish|--token,-t,--username,-u,--password,-p,--publish-url,--trusted-publishing,--keyring-provider,--check-url,--quiet,-q,--verbose,-v
python|find,install,list,pin,uninstall
remove|--dev,--optional,--group,--no-sync,--frozen,--locked,--python,-p,--config-file,--no-config,--cache-dir,--no-cache,--quiet,-q,--verbose,-v
run|--extra,--all-extras,--no-extra,--with,--with-editable,--with-requirements,--isolated,--no-project,--module,-m,--script,--python,-p,--frozen,--locked,--no-sync,--env-file,--no-env-file,--config-file,--no-config,--cache-dir,--no-cache,--quiet,-q,--verbose,-v,__python_scripts__
self|update
sync|--extra,--all-extras,--no-extra,--group,--all-groups,--no-group,--no-dev,--no-install-project,--no-install-workspace,--frozen,--locked,--inexact,--python,-p,--config-file,--no-config,--cache-dir,--no-cache,--quiet,-q,--verbose,-v
tool|install,list,run,uninstall,update-shell,dir
tree|--depth,-d,--prune,--package,--no-dedupe,--invert,--frozen,--locked,--python,-p,--config-file,--no-config,--cache-dir,--no-cache,--quiet,-q,--verbose,-v
upgrade|--all
venv|--python,-p,--prompt,--system-site-packages,--relocatable,--seed,--allow-existing,--exclude-newer,--config-file,--no-config,--cache-dir,--no-cache,--quiet,-q,--verbose,-v
version|--output-format
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_uv uv 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_uv uv
fi
# END uv Spec Autocomplete

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

# BEGIN yarn Spec Autocomplete
################################################################################
# yarn (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_yarn() {
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
if complete -o nosort -o filenames -F __spec_complete_yarn yarn 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_yarn yarn
fi
# END yarn Spec Autocomplete

# BEGIN gmake Spec Autocomplete
################################################################################
# gmake (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_gmake() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__makefile_targets__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_gmake gmake 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_gmake gmake
fi
# END gmake Spec Autocomplete

# BEGIN gradle Spec Autocomplete
################################################################################
# gradle (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_gradle() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__gradle_tasks__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_gradle gradle 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_gradle gradle
fi
# END gradle Spec Autocomplete

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

# BEGIN kubectl Spec Autocomplete
################################################################################
# kubectl (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_kubectl() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
get|pods,pod,po,services,svc,deployments,deploy,nodes,node,namespaces,ns,configmaps,cm,secrets,ingress,ing,persistentvolumeclaims,pvc,persistentvolumes,pv,statefulsets,sts,daemonsets,ds,replicasets,rs,jobs,cronjobs,cj,events,ev,endpoints,ep,serviceaccounts,sa,roles,rolebindings,clusterroles,clusterrolebindings,networkpolicies,netpol,storageclasses,sc,all,-o,--output,-w,--watch,-A,--all-namespaces,-l,--selector,--field-selector,--show-labels,--sort-by,--no-headers,-n,--namespace
describe|pods,pod,po,services,svc,deployments,deploy,nodes,node,namespaces,ns,configmaps,cm,secrets,ingress,ing,persistentvolumeclaims,pvc,statefulsets,sts,daemonsets,ds,replicasets,rs,jobs,cronjobs,cj,-n,--namespace,-l,--selector
create|deployment,service,configmap,secret,namespace,job,cronjob,role,rolebinding,clusterrole,clusterrolebinding,serviceaccount,quota,ingress,priorityclass,-f,--filename,--dry-run,-o,--output,-n,--namespace
apply|-f,--filename,-k,--kustomize,-R,--recursive,--dry-run,--force,--prune,-l,--selector,-n,--namespace,--server-side,--field-manager
delete|pods,pod,po,services,svc,deployments,deploy,namespaces,ns,configmaps,cm,secrets,ingress,ing,persistentvolumeclaims,pvc,statefulsets,sts,daemonsets,ds,replicasets,rs,jobs,cronjobs,cj,-f,--filename,-l,--selector,--all,--force,--grace-period,--cascade,-n,--namespace,--now
edit|pods,pod,po,services,svc,deployments,deploy,configmaps,cm,secrets,ingress,ing,statefulsets,sts,daemonsets,ds,-n,--namespace,-o,--output
logs|-f,--follow,-p,--previous,-c,--container,--all-containers,--since,--since-time,--tail,--timestamps,-l,--selector,-n,--namespace,--max-log-requests,--prefix
exec|-it,-c,--container,-n,--namespace,--stdin,-i,--tty,-t
port-forward|--address,-n,--namespace
run|--image,--port,--env,--labels,-l,--command,--restart,--rm,-it,--dry-run,-o,--output,-n,--namespace,--overrides
expose|deployment,service,replicaset,pod,--port,--target-port,--protocol,--type,--name,-l,--selector,--external-ip,--dry-run,-o,--output,-n,--namespace
scale|deployment,replicaset,statefulset,--replicas,--current-replicas,--resource-version,-n,--namespace
rollout|status,history,undo,restart,pause,resume
rollout status|deployment,statefulset,daemonset,-w,--watch,-n,--namespace
rollout history|deployment,statefulset,daemonset,--revision,-n,--namespace
rollout undo|deployment,statefulset,daemonset,--to-revision,-n,--namespace
rollout restart|deployment,statefulset,daemonset,-n,--namespace
set|image,resources,env,serviceaccount,selector,subject
set image|deployment,statefulset,daemonset,-n,--namespace,--all
top|nodes,node,pods,pod,--containers,--sort-by,-n,--namespace,-l,--selector,-A,--all-namespaces
config|view,current-context,use-context,set-context,get-contexts,delete-context,set-cluster,get-clusters,delete-cluster,set-credentials,rename-context
config view|--minify,--flatten,-o,--output,--raw
config use-context|--namespace
auth|can-i,whoami,reconcile
label|pods,nodes,namespaces,deployments,services,--overwrite,--all,-n,--namespace,-l,--selector
annotate|pods,nodes,namespaces,deployments,services,--overwrite,--all,-n,--namespace,-l,--selector
taint|nodes,--overwrite,--all
drain|--force,--grace-period,--ignore-daemonsets,--delete-emptydir-data,--timeout,-l,--selector,--dry-run
debug|-it,--image,--copy-to,--container,-c,--target,--share-processes,-n,--namespace
cp|-c,--container,-n,--namespace,--retries
diff|-f,--filename,-k,--kustomize,-R,--recursive,-n,--namespace
patch|pods,deployments,services,configmaps,nodes,--type,--patch,-p,-n,--namespace,--dry-run
replace|-f,--filename,--force,--cascade,--grace-period,-n,--namespace
wait|-f,--filename,--for,--timeout,-l,--selector,-n,--namespace,-A,--all-namespaces
cluster-info|dump
explain|--recursive,--api-version
api-resources|--namespaced,--verbs,-o,--output,--api-group,--sort-by
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_kubectl kubectl 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_kubectl kubectl
fi
# END kubectl Spec Autocomplete

# BEGIN aws Spec Autocomplete
################################################################################
# aws (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_aws() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
accessanalyzer|create-analyzer,delete-analyzer,get-analyzer,list-analyzers,list-findings,start-resource-scan,update-findings
acm|add-tags-to-certificate,delete-certificate,describe-certificate,export-certificate,get-certificate,import-certificate,list-certificates,list-tags-for-certificate,remove-tags-from-certificate,renew-certificate,request-certificate,resend-validation-email,update-certificate-options
apigateway|create-api-key,create-deployment,create-domain-name,create-rest-api,create-stage,delete-rest-api,deploy,get-api-keys,get-deployments,get-rest-api,get-rest-apis,get-stages,update-rest-api
apigatewayv2|create-api,create-deployment,create-route,create-stage,delete-api,get-api,get-apis,get-deployments,get-routes,get-stages,update-api
appconfig|create-application,create-configuration-profile,create-deployment,create-environment,delete-application,get-application,get-configuration,list-applications,list-configuration-profiles
applicationautoscaling|delete-scaling-policy,deregister-scalable-target,describe-scalable-targets,describe-scaling-activities,describe-scaling-policies,put-scaling-policy,register-scalable-target
athena|batch-get-named-query,batch-get-query-execution,create-named-query,create-work-group,delete-named-query,delete-work-group,get-database,get-named-query,get-query-execution,get-query-results,list-databases,list-named-queries,list-query-executions,start-query-execution,stop-query-execution
autoscaling|attach-instances,create-auto-scaling-group,create-launch-configuration,delete-auto-scaling-group,delete-launch-configuration,describe-auto-scaling-groups,describe-launch-configurations,describe-scaling-activities,detach-instances,set-desired-capacity,update-auto-scaling-group
backup|create-backup-plan,create-backup-vault,delete-backup-plan,delete-backup-vault,describe-backup-job,describe-backup-vault,list-backup-jobs,list-backup-plans,list-backup-vaults,start-backup-job,stop-backup-job
batch|cancel-job,create-compute-environment,create-job-queue,delete-compute-environment,delete-job-queue,deregister-job-definition,describe-compute-environments,describe-job-definitions,describe-job-queues,describe-jobs,list-jobs,register-job-definition,submit-job,terminate-job
cloud9|create-environment-ec2,delete-environment,describe-environment-status,describe-environments,list-environments,update-environment
cloudformation|cancel-update-stack,continue-update-rollback,create-change-set,create-stack,delete-change-set,delete-stack,describe-change-set,describe-stack-events,describe-stack-resource,describe-stack-resources,describe-stacks,detect-stack-drift,execute-change-set,get-template,get-template-summary,list-change-sets,list-stack-resources,list-stacks,update-stack,update-termination-protection,validate-template,wait
cloudfront|create-distribution,create-invalidation,delete-distribution,get-distribution,get-distribution-config,get-invalidation,list-distributions,list-invalidations,update-distribution
cloudtrail|create-trail,delete-trail,describe-trails,get-event-selectors,get-insight-selectors,get-trail-status,list-public-keys,list-tags,list-trails,lookup-events,put-event-selectors,start-logging,stop-logging,update-trail
cloudwatch|delete-alarms,delete-dashboards,describe-alarm-history,describe-alarms,describe-alarms-for-metric,disable-alarm-actions,enable-alarm-actions,get-dashboard,get-metric-data,get-metric-statistics,list-dashboards,list-metrics,put-dashboard,put-metric-alarm,put-metric-data,set-alarm-state
codebuild|batch-delete-builds,batch-get-builds,batch-get-projects,create-project,delete-project,delete-source-credentials,import-source-credentials,list-builds,list-builds-for-project,list-projects,list-source-credentials,start-build,stop-build,update-project
codecommit|create-branch,create-pull-request,create-repository,delete-branch,delete-repository,get-branch,get-commit,get-pull-request,get-repository,list-branches,list-pull-requests,list-repositories,merge-pull-request-by-fast-forward,update-pull-request-status
codedeploy|batch-get-deployments,create-application,create-deployment,create-deployment-group,delete-application,delete-deployment-group,get-application,get-deployment,get-deployment-group,list-applications,list-deployment-groups,list-deployments,stop-deployment
codepipeline|create-pipeline,delete-pipeline,disable-stage-transition,enable-stage-transition,get-pipeline,get-pipeline-execution,get-pipeline-state,list-action-types,list-pipeline-executions,list-pipelines,start-pipeline-execution,stop-pipeline-execution,update-pipeline
cognito-idp|admin-create-user,admin-delete-user,admin-disable-user,admin-enable-user,admin-get-user,admin-reset-user-password,admin-set-user-password,create-user-pool,create-user-pool-client,delete-user-pool,delete-user-pool-client,describe-user-pool,describe-user-pool-client,get-user,list-user-pool-clients,list-user-pools,list-users,sign-up,update-user-pool
configservice|delete-config-rule,deliver-config-snapshot,describe-compliance-by-config-rule,describe-compliance-by-resource,describe-config-rules,describe-configuration-recorder-status,describe-configuration-recorders,describe-delivery-channels,get-resource-config-history,list-discovered-resources,put-config-rule,put-configuration-recorder,put-delivery-channel,start-configuration-recorder,stop-configuration-recorder
configure|export-credentials,get,import,list,list-profiles,set,set-value,sso,sso-login,sso-logout
dms|create-endpoint,create-replication-instance,create-replication-task,delete-endpoint,delete-replication-instance,delete-replication-task,describe-endpoints,describe-replication-instances,describe-replication-tasks,start-replication-task,stop-replication-task,test-connection
docdb|create-db-cluster,create-db-instance,delete-db-cluster,delete-db-instance,describe-db-cluster-snapshots,describe-db-clusters,describe-db-instances,modify-db-cluster,modify-db-instance,start-db-cluster,stop-db-cluster
dynamodb|batch-get-item,batch-write-item,create-backup,create-table,delete-backup,delete-item,delete-table,describe-backup,describe-table,get-item,list-backups,list-tables,put-item,query,restore-table-from-backup,scan,update-item,update-table,wait
ec2|allocate-address,associate-address,attach-volume,authorize-security-group-ingress,create-image,create-key-pair,create-security-group,create-snapshot,create-tags,create-volume,create-vpc,delete-key-pair,delete-security-group,delete-snapshot,delete-tags,delete-volume,delete-vpc,describe-addresses,describe-availability-zones,describe-images,describe-instance-status,describe-instance-types,describe-instances,describe-key-pairs,describe-regions,describe-security-groups,describe-snapshots,describe-subnets,describe-tags,describe-volumes,describe-vpcs,detach-volume,disassociate-address,get-console-output,get-password-data,modify-instance-attribute,reboot-instances,release-address,run-instances,start-instances,stop-instances,terminate-instances,wait
ecr|batch-delete-image,batch-get-image,create-repository,delete-repository,describe-images,describe-repositories,get-authorization-token,get-download-url-for-layer,get-login-password,initiate-layer-upload,list-images,put-image,start-image-scan
ecs|create-cluster,create-service,delete-cluster,delete-service,delete-task-definitions,deregister-task-definition,describe-clusters,describe-services,describe-task-definition,describe-tasks,list-clusters,list-services,list-task-definitions,list-tasks,register-task-definition,run-task,start-task,stop-task,update-cluster,update-service,update-task-protection
eks|associate-identity-provider-config,create-cluster,create-fargate-profile,create-nodegroup,delete-cluster,delete-fargate-profile,delete-nodegroup,describe-cluster,describe-fargate-profile,describe-nodegroup,describe-update,list-clusters,list-fargate-profiles,list-nodegroups,list-updates,update-cluster-config,update-cluster-version,update-kubeconfig,update-nodegroup-config,update-nodegroup-version,wait
elasticache|create-cache-cluster,create-replication-group,delete-cache-cluster,delete-replication-group,describe-cache-clusters,describe-replication-groups,modify-cache-cluster,reboot-cache-cluster
elasticbeanstalk|create-application,create-application-version,create-environment,delete-application,delete-application-version,delete-environment-configuration,describe-applications,describe-environments,describe-events,terminate-environment,update-application,update-environment
elb|configure-health-check,create-load-balancer,delete-load-balancer,deregister-instances-from-load-balancer,describe-instance-health,describe-load-balancers,register-instances-with-load-balancer
elbv2|add-listener-certificates,create-listener,create-load-balancer,create-rule,create-target-group,delete-listener,delete-load-balancer,delete-rule,delete-target-group,deregister-targets,describe-listeners,describe-load-balancers,describe-rules,describe-target-groups,describe-target-health,modify-listener,modify-load-balancer-attributes,modify-rule,modify-target-group,register-targets
emr|add-instance-fleet,add-instance-groups,add-job-flow-steps,create-cluster,describe-cluster,describe-step,list-clusters,list-instance-fleets,list-instance-groups,list-instances,list-steps,modify-cluster,terminate-clusters
events|delete-rule,describe-event-bus,describe-rule,disable-rule,enable-rule,list-rules,list-targets-by-rule,put-events,put-rule,put-targets,remove-targets
firehose|create-delivery-stream,delete-delivery-stream,describe-delivery-stream,list-delivery-streams,put-record,put-record-batch,update-destination
glacier|abort-multipart-upload,complete-multipart-upload,create-vault,delete-archive,delete-vault,describe-job,describe-vault,initiate-job,initiate-multipart-upload,list-jobs,list-vaults,upload-archive
glue|create-crawler,create-database,create-job,delete-crawler,delete-database,delete-job,get-crawler,get-database,get-databases,get-job,get-jobs,start-crawler,start-job-run,stop-crawler
guardduty|create-detector,delete-detector,get-detector,get-findings,list-detectors,list-findings,update-detector
iam|add-role-to-instance-profile,add-user-to-group,attach-group-policy,attach-role-policy,attach-user-policy,change-password,create-access-key,create-group,create-instance-profile,create-login-profile,create-policy,create-policy-version,create-role,create-user,delete-access-key,delete-group,delete-policy,delete-policy-version,delete-role,delete-user,detach-group-policy,detach-role-policy,detach-user-policy,get-account-summary,get-group,get-group-policy,get-instance-profile,get-policy,get-policy-version,get-role,get-role-policy,get-user,get-user-policy,list-access-keys,list-account-aliases,list-attached-group-policies,list-attached-role-policies,list-attached-user-policies,list-groups,list-groups-for-user,list-instance-profiles,list-policies,list-policy-versions,list-roles,list-user-policies,list-users,put-group-policy,put-role-policy,put-user-policy,update-access-key,update-assume-role-policy,update-group,update-login-profile,update-role,update-user
import-export|cancel-job,create-job,get-shipping-label,get-status,list-jobs,update-job
inspector|add-attributes-to-findings,create-assessment-target,create-assessment-template,delete-assessment-run,delete-assessment-target,delete-assessment-template,describe-assessment-runs,describe-assessment-targets,describe-assessment-templates,describe-findings,list-assessment-runs,list-assessment-targets,list-assessment-templates,list-findings,start-assessment-run,stop-assessment-run
kinesis|add-tags-to-stream,create-stream,decrease-stream-retention-period,delete-stream,describe-stream,enable-enhanced-monitoring,get-records,get-shard-iterator,increase-stream-retention-period,list-streams,merge-shards,put-record,put-records,split-shard,update-shard-count
kms|cancel-key-deletion,create-alias,create-grant,create-key,decrypt,delete-alias,describe-key,disable-key,enable-key,encrypt,generate-data-key,get-key-policy,list-aliases,list-grants,list-key-policies,list-keys,re-encrypt,revoke-grant,schedule-key-deletion,update-alias,update-key-description
lambda|add-permission,create-alias,create-event-source-mapping,create-function,delete-alias,delete-event-source-mapping,delete-function,delete-function-concurrency,get-account-settings,get-alias,get-event-source-mapping,get-function,get-function-concurrency,get-function-configuration,get-policy,invoke,list-aliases,list-event-source-mappings,list-functions,list-tags,publish-version,put-function-concurrency,remove-permission,update-alias,update-event-source-mapping,update-function-code,update-function-configuration
logs|create-export-task,create-log-group,create-log-stream,delete-log-group,delete-log-stream,delete-metric-filter,delete-retention-policy,describe-destinations,describe-export-tasks,describe-log-groups,describe-log-streams,describe-metric-filters,filter-log-events,get-log-events,put-destination,put-log-events,put-metric-filter,put-retention-policy,start-query,stop-query,tail
opsworks|create-app,create-instance,create-layer,create-stack,delete-app,delete-instance,delete-layer,delete-stack,describe-apps,describe-instances,describe-layers,describe-stacks,start-instance,stop-instance,update-app,update-instance,update-layer,update-stack
organizations|accept-handshake,attach-policy,cancel-handshake,create-account,create-organization,create-organizational-unit,create-policy,decline-handshake,delete-organization,delete-organizational-unit,delete-policy,describe-account,describe-handshake,describe-organization,describe-organizational-unit,describe-policy,detach-policy,disable-policy-type,enable-aws-service-access,enable-policy-type,invite-account-to-organization,leave-organization,list-accounts,list-children,list-handshakes-for-account,list-handshakes-for-organization,list-organizational-units-for-parent,list-parents,list-policies,list-policies-for-target,list-roots,list-tags-for-resource,list-targets-for-policy,move-account,remove-account-from-organization,update-organizational-unit,update-policy
pricing|describe-services,get-attribute-values,get-products
quicksight|create-account-customization,create-dashboard,create-data-set,create-data-source,create-iam-policy-assignment,delete-dashboard,delete-data-set,delete-data-source,describe-account-customization,describe-dashboard,describe-data-set,describe-data-source,list-dashboards,list-data-sets,list-data-sources,update-dashboard,update-data-set,update-data-source
rds|add-tags-to-resource,apply-pending-maintenance-action,authorize-db-security-group-ingress,backup-db-cluster-to-s3,copy-db-cluster-snapshot,copy-db-snapshot,create-db-cluster,create-db-cluster-parameter-group,create-db-cluster-snapshot,create-db-instance,create-db-instance-read-replica,create-db-parameter-group,create-db-security-group,create-db-snapshot,create-db-subnet-group,create-event-subscription,create-option-group,delete-db-cluster,delete-db-cluster-parameter-group,delete-db-cluster-snapshot,delete-db-instance,delete-db-parameter-group,delete-db-security-group,delete-db-snapshot,delete-db-subnet-group,delete-event-subscription,delete-option-group,describe-db-cluster-parameter-groups,describe-db-cluster-parameters,describe-db-cluster-snapshots,describe-db-clusters,describe-db-engine-versions,describe-db-instances,describe-db-log-files,describe-db-parameter-groups,describe-db-parameters,describe-db-security-groups,describe-db-snapshots,describe-db-subnet-groups,describe-engine-default-cluster-parameters,describe-engine-default-parameters,describe-event-categories,describe-event-subscriptions,describe-events,describe-option-group-options,describe-option-groups,describe-orderable-db-instance-options,describe-pending-maintenance-actions,describe-reserved-db-instances,describe-reserved-db-instances-offerings,download-db-log-file-portion,failover-db-cluster,list-tags-for-resource,modify-db-cluster,modify-db-cluster-parameter-group,modify-db-cluster-snapshot-attribute,modify-db-instance,modify-db-parameter-group,modify-db-snapshot-attribute,modify-db-subnet-group,modify-event-subscription,modify-option-group,promote-read-replica,promote-read-replica-db-cluster,reboot-db-instance,remove-from-global-cluster,remove-role-from-db-cluster,remove-role-from-db-instance,remove-source-identifier-from-subscription,remove-tags-from-resource,reset-db-cluster-parameter-group,reset-db-parameter-group,restore-db-cluster-from-s3,restore-db-cluster-from-snapshot,restore-db-cluster-to-point-in-time,restore-db-instance-from-db-snapshot,restore-db-instance-from-s3,restore-db-instance-to-point-in-time,revoke-db-security-group-ingress,start-activity-stream,start-db-cluster,start-db-instance,stop-activity-stream,stop-db-cluster,stop-db-instance,wait
redshift|authorize-cluster-security-group-ingress,authorize-snapshot-access,copy-cluster-snapshot,create-cluster,create-cluster-parameter-group,create-cluster-security-group,create-cluster-snapshot,create-cluster-subnet-group,delete-cluster,delete-cluster-parameter-group,delete-cluster-security-group,delete-cluster-snapshot,delete-cluster-subnet-group,describe-cluster-parameters,describe-cluster-security-groups,describe-cluster-snapshots,describe-cluster-subnet-groups,describe-clusters,modify-cluster,reboot-cluster,resize-cluster,restore-from-cluster-snapshot
rekognition|compare-faces,create-collection,create-stream-processor,delete-collection,delete-faces,delete-stream-processor,detect-faces,detect-labels,detect-moderation-labels,detect-text,get-celebrity-info,index-faces,list-collections,list-faces,list-stream-processors,recognize-celebrities,search-faces,search-faces-by-image,start-content-moderation,start-face-detection,start-face-search,start-label-detection,start-person-tracking,start-stream-processor,stop-stream-processor
route53|change-resource-record-sets,create-health-check,create-hosted-zone,delete-health-check,delete-hosted-zone,get-change,get-health-check,get-hosted-zone,list-health-checks,list-hosted-zones,list-resource-record-sets,update-health-check,update-hosted-zone-comment
route53domains|check-domain-availability,disable-domain-auto-renew,disable-domain-transfer-lock,enable-domain-auto-renew,enable-domain-transfer-lock,get-domain-detail,get-operation-detail,list-domains,list-operations,register-domain,renew-domain,transfer-domain,update-domain-contact,update-domain-nameservers
s3|cp,ls,mb,mv,presign,rb,rm,sync,website
s3api|abort-multipart-upload,complete-multipart-upload,copy-object,create-bucket,create-multipart-upload,delete-bucket,delete-bucket-policy,delete-object,delete-objects,get-bucket-acl,get-bucket-cors,get-bucket-lifecycle,get-bucket-location,get-bucket-policy,get-bucket-tagging,get-bucket-versioning,get-object,get-object-acl,head-bucket,head-object,list-buckets,list-multipart-uploads,list-object-versions,list-objects,list-objects-v2,list-parts,put-bucket-acl,put-bucket-cors,put-bucket-lifecycle,put-bucket-policy,put-bucket-tagging,put-bucket-versioning,put-object,put-object-acl,upload-part,upload-part-copy
sagemaker|add-tags,create-endpoint,create-endpoint-config,create-model,create-notebook-instance,create-training-job,create-transform-job,delete-endpoint,delete-endpoint-config,delete-model,delete-notebook-instance,describe-endpoint,describe-endpoint-config,describe-model,describe-notebook-instance,describe-training-job,describe-transform-job,list-endpoint-configs,list-endpoints,list-models,list-notebook-instances,list-tags,list-training-jobs,list-transform-jobs,start-notebook-instance,stop-notebook-instance,stop-training-job,stop-transform-job,update-endpoint,update-endpoint-weights-and-capacities
secretsmanager|cancel-rotate-secret,create-secret,delete-resource-policy,delete-secret,describe-secret,get-random-password,get-resource-policy,get-secret-value,list-secret-version-ids,list-secrets,put-resource-policy,put-secret-value,restore-secret,rotate-secret,tag-resource,untag-resource,update-secret,update-secret-version-stage
ses|clone-receipt-rule-set,create-receipt-filter,create-receipt-rule,create-receipt-rule-set,delete-identity,delete-receipt-filter,delete-receipt-rule,delete-receipt-rule-set,describe-active-receipt-rule-set,describe-configuration-set,describe-receipt-rule,describe-receipt-rule-set,get-account-sending-enabled,get-identity-verification-attributes,get-send-quota,get-send-statistics,list-configuration-sets,list-identities,list-receipt-filters,list-receipt-rule-sets,list-templates,send-bounce,send-bulk-templated-email,send-email,send-raw-email,send-templated-email,update-account-sending-enabled,update-receipt-rule,update-template,verify-domain-identity,verify-email-identity
sns|add-permission,confirm-subscription,create-platform-application,create-platform-endpoint,create-topic,delete-endpoint,delete-platform-application,delete-topic,get-endpoint-attributes,get-platform-application-attributes,get-subscription-attributes,get-topic-attributes,list-endpoints-by-platform-application,list-platform-applications,list-subscriptions,list-subscriptions-by-topic,list-topics,publish,remove-permission,set-endpoint-attributes,set-platform-application-attributes,set-subscription-attributes,set-topic-attributes,subscribe,unsubscribe
sqs|add-permission,change-message-visibility,change-message-visibility-batch,create-queue,delete-message,delete-message-batch,delete-queue,get-queue-attributes,get-queue-url,list-dead-letter-source-queues,list-queues,purge-queue,receive-message,remove-permission,send-message,send-message-batch,set-queue-attributes
ssm|add-tags-to-resource,cancel-command,create-association,create-document,create-maintenance-window,create-patch-baseline,delete-association,delete-document,delete-maintenance-window,delete-parameter,delete-parameters,delete-patch-baseline,describe-activations,describe-association,describe-document,describe-instance-information,describe-maintenance-windows,describe-parameters,describe-patch-baselines,get-document,get-maintenance-window,get-parameter,get-parameter-history,get-parameters,get-parameters-by-path,get-patch-baseline,list-associations,list-command-invocations,list-commands,list-documents,list-tags-for-resource,put-parameter,remove-tags-from-resource,send-command,start-automation-execution,start-session,update-association,update-document,update-instance-association-status,update-maintenance-window,update-managed-instance-role,update-patch-baseline
stepfunctions|create-activity,create-state-machine,delete-activity,delete-state-machine,describe-activity,describe-execution,describe-state-machine,describe-state-machine-for-execution,get-activity-task,get-execution-history,list-activities,list-executions,list-state-machines,start-execution,stop-execution,update-state-machine
sts|assume-role,assume-role-with-saml,assume-role-with-web-identity,decode-authorization-message,get-access-key-info,get-caller-identity,get-federation-token,get-session-token
support|add-attachments-to-set,add-communication-to-case,create-case,describe-attachment,describe-cases,describe-communications,describe-services,describe-severity-levels,describe-trusted-advisor-check-refresh-statuses,describe-trusted-advisor-check-result,describe-trusted-advisor-check-summaries,describe-trusted-advisor-checks,refresh-trusted-advisor-check,resolve-case
swf|count-closed-workflow-executions,count-open-workflow-executions,count-pending-activity-tasks,count-pending-decision-tasks,deprecate-activity-type,deprecate-domain,deprecate-workflow-type,describe-activity-type,describe-domain,describe-workflow-execution,describe-workflow-type,get-workflow-execution-history,list-activity-types,list-closed-workflow-executions,list-domains,list-open-workflow-executions,list-workflow-types,poll-for-activity-task,poll-for-decision-task,record-activity-task-heartbeat,register-activity-type,register-domain,register-workflow-type,respond-activity-task-canceled,respond-activity-task-completed,respond-activity-task-failed,respond-decision-task-completed,signal-workflow-execution,start-workflow-execution,terminate-workflow-execution,undeprecate-activity-type,undeprecate-domain,undeprecate-workflow-type
transcribe|create-vocabulary,delete-transcription-job,delete-vocabulary,get-transcription-job,get-vocabulary,list-transcription-jobs,list-vocabularies,start-transcription-job,update-vocabulary
translate|delete-terminology,get-terminology,import-terminology,list-terminologies,translate-text
waf|create-byte-match-set,create-ip-set,create-rule,create-size-constraint-set,create-sql-injection-match-set,create-web-acl,create-xss-match-set,delete-byte-match-set,delete-ip-set,delete-rule,delete-size-constraint-set,delete-sql-injection-match-set,delete-web-acl,delete-xss-match-set,get-byte-match-set,get-change-token,get-change-token-status,get-ip-set,get-rule,get-sampled-requests,get-size-constraint-set,get-sql-injection-match-set,get-web-acl,get-xss-match-set,list-byte-match-sets,list-ip-sets,list-rules,list-size-constraint-sets,list-sql-injection-match-sets,list-web-acls,list-xss-match-sets,update-byte-match-set,update-ip-set,update-rule,update-size-constraint-set,update-sql-injection-match-set,update-web-acl,update-xss-match-set
workspaces|create-tags,create-workspaces,delete-tags,describe-tags,describe-workspace-bundles,describe-workspace-directories,describe-workspaces,modify-workspace-properties,reboot-workspaces,rebuild-workspaces,start-workspaces,stop-workspaces,terminate-workspaces
help|--help
configure list|--profile
configure set|aws_access_key_id,aws_secret_access_key,region,output
s3 cp|--recursive,--exclude,--include,--acl,--content-type,--storage-class,--quiet,--dryrun,--profile,--region
s3 ls|--recursive,--human-readable,--summarize,--profile,--region
s3 sync|--delete,--exclude,--include,--acl,--storage-class,--quiet,--dryrun,--profile,--region
s3 rm|--recursive,--exclude,--include,--quiet,--dryrun,--profile,--region
ec2 describe-instances|--instance-ids,--filters,--max-results,--query,--profile,--region,--output
ec2 start-instances|--instance-ids,--profile,--region
ec2 stop-instances|--instance-ids,--force,--profile,--region
ec2 terminate-instances|--instance-ids,--profile,--region
|--profile,--region,--output,--query,--debug,--no-verify-ssl,--no-paginate,--cli-input-json,--cli-input-yaml,--generate-cli-skeleton,--endpoint-url,--no-cli-pager,--cli-auto-prompt,--no-cli-auto-prompt,--help
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_aws aws 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_aws aws
fi
# END aws Spec Autocomplete

# BEGIN az Spec Autocomplete
################################################################################
# az (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_az() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
account|list,show,set,clear,get-access-token,list-locations,management-group,subscription,tenant,--help,-h,--output,-o,--query,--verbose
account show|--subscription,--name,--output,-o,--query
account set|--subscription,--name
acr|build,create,delete,list,login,repository,run,show,update,task,--help,-h,--output,-o,--query
ad|app,group,signed-in-user,sp,user,--help,-h,--output,-o,--query
aks|create,delete,get-credentials,list,show,start,stop,upgrade,update,scale,nodepool,--help,-h,--output,-o,--query,--name,-n,--resource-group,-g
appservice|plan,list-locations,--help,-h,--output,-o,--query
batch|account,application,job,pool,task,--help,-h,--output,-o,--query
billing|account,invoice,profile,subscription,--help,-h,--output,-o,--query
cache|delete,list,purge,show,--help,-h,--output,-o,--query
cdn|endpoint,profile,custom-domain,--help,-h,--output,-o,--query
cognitiveservices|account,--help,-h,--output,-o,--query
config|get,set,unset,param-persist,--help,-h
configure|--defaults,--list-defaults,--scope,--help,-h
containerapp|create,delete,list,show,update,env,--help,-h,--output,-o,--query
cosmosdb|create,delete,list,show,update,sql,mongodb,cassandra,gremlin,table,--help,-h,--output,-o,--query
deployment|create,delete,list,show,validate,group,sub,mg,tenant,--help,-h,--output,-o,--query
disk|create,delete,grant-access,list,revoke-access,show,update,--help,-h,--output,-o,--query
dns|record-set,zone,--help,-h,--output,-o,--query
eventgrid|domain,event-subscription,topic,--help,-h,--output,-o,--query
eventhubs|eventhub,namespace,--help,-h,--output,-o,--query
extension|add,list,list-available,remove,show,update,--help,-h,--output,-o,--query
feedback|--help,-h
find|--help,-h
functionapp|create,delete,list,show,start,stop,restart,update,deployment,config,--help,-h,--output,-o,--query
group|create,delete,exists,list,show,update,wait,lock,--help,-h,--output,-o,--query,--name,-n,--location,-l
group create|--name,-n,--location,-l,--tags,--subscription
group delete|--name,-n,--yes,-y,--no-wait,--subscription
identity|create,delete,list,show,--help,-h,--output,-o,--query
interactive|--help,-h
iot|hub,device,dps,--help,-h,--output,-o,--query
keyvault|create,delete,list,show,update,key,secret,certificate,--help,-h,--output,-o,--query,--name,-n,--resource-group,-g
lock|create,delete,list,show,update,--help,-h,--output,-o,--query
login|--username,-u,--password,-p,--service-principal,--tenant,-t,--use-device-code,--allow-no-subscriptions,--help,-h
logout|--username,--help,-h
managedapp|create,delete,list,show,definition,--help,-h,--output,-o,--query
maps|account,creator,--help,-h,--output,-o,--query
mariadb|server,db,configuration,firewall-rule,--help,-h,--output,-o,--query
ml|workspace,compute,model,job,--help,-h,--output,-o,--query
monitor|alert,activity-log,diagnostic-settings,log-analytics,metrics,action-group,autoscale,--help,-h,--output,-o,--query
mysql|server,db,configuration,firewall-rule,flexible-server,--help,-h,--output,-o,--query
network|vnet,nsg,public-ip,nic,lb,application-gateway,dns,private-endpoint,vpn-gateway,route-table,traffic-manager,--help,-h,--output,-o,--query
policy|assignment,definition,exemption,set-definition,--help,-h,--output,-o,--query
postgres|server,db,configuration,firewall-rule,flexible-server,--help,-h,--output,-o,--query
provider|list,register,unregister,show,operation,--help,-h,--output,-o,--query
redis|create,delete,list,show,update,firewall-rules,patch-schedule,--help,-h,--output,-o,--query
resource|create,delete,list,show,update,move,tag,wait,invoke-action,lock,link,--help,-h,--output,-o,--query
rest|--method,-m,--uri,-u,--headers,--body,-b,--query,--help,-h
role|assignment,definition,--help,-h,--output,-o,--query
search|service,admin-key,query-key,--help,-h,--output,-o,--query
self-test|--help,-h
servicebus|namespace,queue,topic,--help,-h,--output,-o,--query
signalr|create,delete,list,show,update,--help,-h,--output,-o,--query
snapshot|create,delete,grant-access,list,revoke-access,show,update,--help,-h,--output,-o,--query
sql|server,db,elastic-pool,failover-group,managed-instance,vm,virtual-network-rule,firewall-rule,--help,-h,--output,-o,--query
ssh|vm,arc,config,--help,-h
staticwebapp|create,delete,list,show,update,environment,functions,hostname,identity,secrets,--help,-h,--output,-o,--query
storage|account,blob,container,file,share,queue,table,fs,directory,copy,--help,-h,--output,-o,--query,--account-name,--account-key
storage account|create,delete,list,show,update,keys,sas,--help,-h,--output,-o,--query
storage blob|copy,delete,download,exists,list,show,upload,upload-batch,download-batch,delete-batch,--help,-h,--output,-o,--query
storage container|create,delete,exists,list,show,--help,-h,--output,-o,--query
synapse|workspace,sql,spark,role,--help,-h,--output,-o,--query
tag|add-value,create,delete,list,remove-value,update,--help,-h,--output,-o,--query
tenant|list,--help,-h,--output,-o,--query
upgrade|--all,--yes,-y,--help,-h
version|--help,-h
vm|create,delete,deallocate,generalize,list,list-ip-addresses,list-sizes,list-skus,list-vm-resize-options,open-port,redeploy,resize,restart,run-command,show,start,stop,update,wait,extension,disk,nic,boot-diagnostics,--help,-h,--output,-o,--query,--name,-n,--resource-group,-g
vmss|create,delete,deallocate,list,list-instances,list-sizes,reimage,restart,scale,show,start,stop,update,update-instances,extension,nic,--help,-h,--output,-o,--query
webapp|create,delete,list,show,start,stop,restart,update,deployment,config,log,ssh,deleted,identity,--help,-h,--output,-o,--query
|--help,-h,--output,-o,--query,--verbose,--debug,--subscription
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_az az 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_az az
fi
# END az Spec Autocomplete

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

# BEGIN rsync Spec Autocomplete
################################################################################
# rsync (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_rsync() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|-a,--archive,-v,--verbose,-z,--compress,-r,--recursive,-h,--human-readable,-P,--progress,--partial,-n,--dry-run,-e,--rsh,--delete,--delete-before,--delete-during,--delete-after,--delete-excluded,--exclude,--exclude-from,--include,--include-from,--filter,-f,-F,--files-from,-u,--update,-c,--checksum,-l,--links,-L,--copy-links,-H,--hard-links,-p,--perms,-t,--times,-g,--group,-o,--owner,-D,--devices,--specials,-S,--sparse,--preallocate,-W,--whole-file,-x,--one-file-system,-b,--backup,--backup-dir,--suffix,-q,--quiet,--no-motd,-I,--ignore-times,--size-only,--modify-window,-C,--cvs-exclude,--existing,--ignore-existing,--remove-source-files,--max-delete,--max-size,--min-size,--timeout,--contimeout,--list-only,--bwlimit,--info,--debug,--stats,--itemize-changes,-i,--log-file,--log-file-format,--compress-level,--skip-compress,--numeric-ids,--usermap,--groupmap,--chown,--rsync-path,--ssh-args,--temp-dir,-T,--compare-dest,--copy-dest,--link-dest,--chmod,-4,--ipv4,-6,--ipv6,--address,--port,--sockopts,--blocking-io,--outbuf,--8-bit-output,--mkpath,__paths__
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_rsync rsync 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_rsync rsync
fi
# END rsync Spec Autocomplete

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

# BEGIN ssh Spec Autocomplete
################################################################################
# ssh (spec-based autocomplete)
################################################################################
# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_ssh() {
local spec_data
read -r -d '' spec_data << '__SPEC_EOF__'
|__ssh_hosts__,-i,-p,-l,-o,-F,-J,-N,-T,-v,-vv,-vvv,-L,-R,-D,-W,-A,-X,-Y,-C,-q,-f,-4,-6
__SPEC_EOF__
__spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-3}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_ssh ssh 2> /dev/null; then
: # registered with nosort
else
complete -o filenames -F __spec_complete_ssh ssh
fi
# END ssh Spec Autocomplete

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
# SOURCE_BEGIN software/scripts/bash-command-wrappers.profile.bash
# software/scripts/bash-command-wrappers.profile.bash | 88c3ee78a126c916a370bc65122a1b10 | 23.8 KB | 2026-05-12
################################################################################
# ---- Command Wrappers ----
#
# --- su ---
# su            — Wrapper: no args opens root shell preserving $PATH (sudo -E bash),
#                 with args falls back to regular su
#
# --- SQLite ---
# sqlite        — Wrapper: prefers sqlite3, falls back to sqlite
#
# --- bat ---
# bat           — Wrapper: chains bat -> batcat -> cat so callers can always
#                 use the canonical `bat` name. Pins --theme=ansi so highlighting
#                 uses the terminal's 16-color ANSI palette (legible on any
#                 background, especially inside fzf preview panes).
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
# --- Language package upgrades ---
# update_lang   — Upgrade global packages from each language pkg manager on PATH
#                 (rustup, cargo-update, npm, pnpm, yarn, bun, deno, uv, pip).
#                 Companion to the `update` alias which only handles OS pkg managers.
#
# --- Git ---
# blame         — git blame alternative: per-line "<line>  <cmt> <date> <sha>
#                 <author>: <summary>" for each input file, with a
#                 "<cmt> file: <abs-path>" comment-style header on top
#                 (absolute path of the input, resolved via realpath).
#                 <cmt> is "//" for C-family extensions
#                 (js/ts/jsx/tsx/c/cc/cpp/h/hpp/java/cs/go/rs/swift/kt/scala/
#                 m/mm/dart/php/proto/gradle/groovy/sass/scss/less) and "#"
#                 otherwise — keeps each row paste-safe as a comment in the
#                 host language.
# blame_view    — runs `blame` and opens it in the editor: writes the blame
#                 output to /tmp/<YYYYMMDD-HHMMSS>-<flattened-abs-path>
#                 (input's absolute path with "/" and "\" flattened to "_",
#                 e.g. "home_syle_git_bashrc_run.sh", extension preserved so
#                 the editor picks the right syntax), then opens the temp
#                 file with subl (the default editor).
#
# --- Markdown ---
# marked        — render markdown -> HTML via `npx -y marked@latest` (auto-yes,
#                 stdin closed). With no args, reads piped stdin or falls back
#                 to the clipboard (via paste()), writing to
#                 /tmp/marked-<YYYY-MM-DD>-XXXXXX-clipboard.html. With one arg,
#                 writes to /tmp/marked-<YYYY-MM-DD>-XXXXXX-<basename>.html.
#                 With two args, the second arg is the output path. The date
#                 prefix sorts renders chronologically in /tmp; the 6-char
#                 mktemp suffix keeps same-day runs unique. Aliased as `md`.
# html          — reverse of marked: HTML -> Markdown via `pandoc -f html -t
#                 gfm-raw_html` (GitHub-flavored markdown, drops raw HTML
#                 fragments that have no markdown equivalent). Same arg shape
#                 as marked but prefix is `html-` and extension is `.md`.
#                 Requires pandoc on PATH (brew install pandoc / apt install
#                 pandoc). Round trip is lossy — list markers, link styles,
#                 and any markdown-incompatible HTML get normalized.
#
# Lazy-activation wrappers shadow the real binaries so the first invocation
# triggers setup (e.g. activating a venv or fnm), then delegates to the
# real command. Sourced AFTER spec-based autocomplete.
################################################################################

################################################################################
# ---- su ----
################################################################################
# su: root shell preserving PATH and env
function su() {
  if is_help_arg "${1:-}"; then
    echo "su: root shell preserving \$PATH (sudo -E bash)"
    echo "  su          open root shell with your env/PATH preserved"
    echo "  su <args>   fall back to regular su with args"
    return
  fi
  if [ $# -eq 0 ]; then
    sudo -E bash
  else
    command su "$@"
  fi
}

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
# ---- bat ----
################################################################################
# bat: canonical entry point for syntax-highlighted file/stdin viewing. Chains
# bat -> batcat -> cat so callers (interactive shells, fzf previews, scripts)
# can always invoke `bat` regardless of which binary is actually installed.
# Pins --theme=ansi for the bat/batcat path so highlighting uses the terminal's
# 16-color ANSI palette (legible on any background, especially inside fzf
# preview panes); user-supplied --theme=... still wins because bat applies the
# last occurrence of repeated flags. Exported so fzf preview subshells (which
# don't source ~/.bashrc) inherit the wrapper too.
function bat() {
  if type -P bat &> /dev/null; then
    command bat --theme=ansi "$@"
  elif type -P batcat &> /dev/null; then
    command batcat --theme=ansi "$@"
  else
    command cat "$@"
  fi
}
export -f bat

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

################################################################################
# ---- Language package upgrades ----
################################################################################
# update_lang: upgrade globally-installed packages from each language pkg manager
function update_lang() {
  if is_help_arg "${1:-}"; then
    echo "update_lang: upgrade globally-installed language packages
  Skips any tool not on PATH. Companion to the OS-level \`update\` alias.
  Covers: rustup, cargo-update, npm, pnpm, yarn (v1), bun, deno, uv, pip (--user)."
    return 0
  fi

  echo ">>> Upgrading global language packages"

  # rust toolchain (rustc/cargo themselves)
  if type -P rustup &> /dev/null; then
    echo ">> rustup update"
    rustup update
  fi

  # cargo install-update (requires `cargo install cargo-update` first; skipped if absent)
  if type -P cargo &> /dev/null && cargo install --list 2> /dev/null | grep -q '^cargo-update '; then
    echo ">> cargo install-update -a"
    cargo install-update -a
  fi

  # npm globals
  if type -P npm &> /dev/null; then
    echo ">> npm update -g"
    npm update -g
  fi

  # pnpm globals
  if type -P pnpm &> /dev/null; then
    echo ">> pnpm update -g"
    pnpm update -g
  fi

  # yarn v1 globals (yarn berry/v2+ has no `global upgrade`)
  if type -P yarn &> /dev/null && yarn --version 2> /dev/null | grep -q '^1\.'; then
    echo ">> yarn global upgrade"
    yarn global upgrade
  fi

  # bun runtime + globals
  if type -P bun &> /dev/null; then
    echo ">> bun upgrade"
    bun upgrade
  fi

  # deno runtime
  if type -P deno &> /dev/null; then
    echo ">> deno upgrade"
    deno upgrade
  fi

  # uv tool installs
  if type -P uv &> /dev/null; then
    echo ">> uv tool upgrade --all"
    uv tool upgrade --all
  fi

  # pip --user packages (skip system site-packages)
  if type -P pip &> /dev/null; then
    echo ">> pip user packages"
    local outdated
    outdated=$(pip list --outdated --user 2> /dev/null | awk 'NR>2 {print $1}')
    if [ -n "$outdated" ]; then
      echo "$outdated" | xargs pip install --user --upgrade
    else
      echo "   (nothing to upgrade)"
    fi
  fi

  echo ">>> update_lang done"
}

################################################################################
# ---- Git ----
################################################################################
# blame: git blame alternative — print per-line "<line>  <cmt> <date> <sha> <author>: <summary>"; <cmt> is "//" for C-family extensions and "#" otherwise so the row is paste-safe as a comment in the host language
function blame() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "blame: git blame alternative — per-line history for each input file
  Usage: blame <file> [<file> ...]
  Output: prints a '<cmt> file: <abs-path>' comment-style header (absolute path of the input), then one row per line as
          <line content>  <cmt> <YYYY-MM-DD> <short sha> <author>: <commit summary>
          <cmt> is '//' for C-family extensions (js/ts/jsx/tsx/c/cc/cpp/h/hpp/java/cs/go/rs/swift/kt/scala/m/mm/dart/php/proto/gradle/groovy/sass/scss/less) and '#' otherwise.
  See also: blame_view — runs blame, writes to /tmp/<timestamp>-<flattened-abs-path>, and opens with subl."
    return
  fi

  if ! type -P git &> /dev/null; then
    echo "blame: git is not installed" >&2
    return 1
  fi

  local file dir base ext cmt abs
  for file in "$@"; do
    if [ ! -f "$file" ]; then
      echo "blame: not a file: $file" >&2
      continue
    fi
    dir=$(dirname -- "$file")
    if ! git -C "$dir" rev-parse --git-dir &> /dev/null; then
      echo "blame: $file is not in a git repo" >&2
      continue
    fi
    # resolve to an absolute path so the header always shows where the file lives,
    # regardless of the cwd the user ran blame from. fall back to "$file" if realpath fails.
    abs=$(realpath -- "$file" 2> /dev/null) || abs="$file"
    # pick the comment marker by file extension: "//" for C-family, "#" otherwise.
    # extension is taken from the basename's last "."; files without a "." fall through to "#".
    base=${file##*/}
    ext=${base##*.}
    [ "$ext" = "$base" ] && ext=""
    # lowercase via tr (bash 3.2 has no ${var,,})
    ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
    case "$ext" in
    js | jsx | mjs | cjs | ts | tsx | c | cc | cpp | cxx | h | hpp | hh | hxx | java | cs | go | rs | swift | kt | kts | scala | m | mm | dart | php | proto | gradle | groovy | sass | scss | less)
      cmt="//"
      ;;
    *)
      cmt="#"
      ;;
    esac
    echo "$cmt file: $abs"
    git blame --line-porcelain -- "$file" 2> /dev/null | command awk -v cmt="$cmt" '
      # SHA header line: "<40+ hex sha> <orig-line> <final-line> [num-lines]" — only first token of a per-line block
      /^[0-9a-f]{40,} / && header == 0 {
        sha = substr($1, 1, 7)
        header = 1
        next
      }
      # author <name> (note: author-mail / author-time / author-tz have a hyphen, so they will not match)
      /^author / {
        sub(/^author /, "")
        author = $0
        next
      }
      /^author-time / {
        atime = $2
        next
      }
      /^summary / {
        sub(/^summary /, "")
        summary = $0
        next
      }
      # the actual source line is prefixed by a single TAB
      /^\t/ {
        line = substr($0, 2)
        # cache date per sha — BSD (date -r) and GNU (date -d @) both covered by the || fallback
        if (sha in date_cache) {
          date = date_cache[sha]
        } else {
          cmd = "date -r " atime " +%Y-%m-%d 2>/dev/null || date -d @" atime " +%Y-%m-%d"
          cmd | getline date
          close(cmd)
          date_cache[sha] = date
        }
        printf "%s      %s %s %s %s: %s\n", line, cmt, date, sha, author, summary
        header = 0
      }
    '
  done
}

# blame_view: run blame on each file, write the output to /tmp/<timestamp>-<basename> (extension preserved so the editor picks the right syntax from the filename), then open with subl (the default editor)
function blame_view() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "blame_view: run blame and open it in the editor
  Usage: blame_view <file> [<file> ...]
  Behavior: for each input file, runs 'blame <file>' and writes the output to
            /tmp/<YYYYMMDD-HHMMSS>-<flattened-abs-path>, where the flattened
            path is the input's absolute path with leading '/' stripped and
            remaining '/' or '\\' replaced by '_' (so the temp filename encodes
            where the original came from, e.g. 'home_syle_git_bashrc_run.sh').
            The original extension stays at the end so the editor picks the
            right syntax. Then opens the temp file with subl (the default
            editor). Prints the temp-file path before opening."
    return
  fi

  local file abs flat ts out outs
  ts=$(date +%Y%m%d-%H%M%S)
  outs=()
  for file in "$@"; do
    if [ ! -f "$file" ]; then
      echo "blame_view: not a file: $file" >&2
      continue
    fi
    # resolve to an absolute path, then flatten so the temp filename encodes the
    # original location: "/home/syle/git/bashrc/run.sh" -> "home_syle_git_bashrc_run.sh".
    # strip the leading "/" first to avoid a leading "_"; replace both "/" and "\"
    # so WSL/Windows paths flatten too. extension stays at the end so the editor
    # picks the right syntax from the filename.
    abs=$(realpath -- "$file" 2> /dev/null) || abs="$file"
    flat=${abs#/}
    flat=${flat//\//_}
    flat=${flat//\\/_}
    out="/tmp/${ts}-${flat}"
    blame "$file" > "$out"
    echo "blame_view: wrote $out"
    outs+=("$out")
  done
  if [ "${#outs[@]}" -gt 0 ]; then
    subl "${outs[@]}"
  fi
}

################################################################################
# ---- Markdown ----
################################################################################
# marked: render markdown to HTML via `npx -y marked@latest`.
# Behavior:
#   - No args + piped stdin     → render the pipe content
#   - No args + interactive TTY → render the system clipboard (via paste())
#   - One arg                   → render the input file
#   - Two args                  → render the first arg, write to the second
# Output paths (<rand> = YYYY-MM-DD-<6-char mktemp>):
#   - No-arg / pipe / clipboard → /tmp/marked-<rand>-clipboard.html
#   - One arg                   → /tmp/marked-<rand>-<basename>.html
#   - Two args                  → second arg verbatim
# Notes:
#   - Uses `npx -y` so the install prompt is auto-confirmed, and `< /dev/null`
#     so marked never blocks reading from a tty.
#   - The random suffix comes from `mktemp -u` so the path is unique per run
#     and avoids clobbering older renders in /tmp.
function marked() {
  if is_help_arg "${1:-}"; then
    echo "marked: render markdown to HTML using \`npx -y marked@latest\`
  Usage:
    marked                        render piped stdin or clipboard → /tmp/marked-<YYYY-MM-DD>-<rand>-clipboard.html
    cat foo.md | marked           render piped stdin → /tmp/marked-<YYYY-MM-DD>-<rand>-clipboard.html
    marked input.md               render input.md → /tmp/marked-<YYYY-MM-DD>-<rand>-input.md.html
    marked input.md output.html   render input.md → output.html
  Aliases: md
  Notes:
    - <rand> is the 6-char suffix from mktemp; the date prefix sorts renders chronologically in /tmp.
    - npx is invoked with -y so the install prompt is auto-confirmed.
    - Stdin is closed via </dev/null so marked never tries to read from a tty."
    return
  fi

  local input output rand input_is_temp=0
  # date prefix (YYYY-MM-DD) + 6-char mktemp random suffix so renders sort
  # chronologically in /tmp and remain unique within the same day.
  rand="$(date +%Y-%m-%d)-$(mktemp -u "/tmp/marked-XXXXXX" | sed 's|^/tmp/marked-||')"

  if [ $# -eq 0 ]; then
    # No args — pipe content if stdin is not a TTY, else fall back to clipboard.
    input=$(mktemp "/tmp/marked-input-XXXXXX") || return 1
    input_is_temp=1
    if [ -t 0 ]; then
      # interactive: pull from clipboard via the universal paste() wrapper
      paste > "$input"
    else
      # piped: capture stdin
      command cat - > "$input"
    fi
    if [ ! -s "$input" ]; then
      echo "marked: no input (clipboard/stdin was empty)" >&2
      rm -f "$input"
      return 1
    fi
    output="/tmp/marked-${rand}-clipboard.html"
  elif [ $# -eq 1 ]; then
    input="$1"
    if [ ! -f "$input" ]; then
      echo "marked: not a file: $input" >&2
      return 1
    fi
    output="/tmp/marked-${rand}-$(basename -- "$input").html"
  else
    input="$1"
    output="$2"
    if [ ! -f "$input" ]; then
      echo "marked: not a file: $input" >&2
      return 1
    fi
  fi

  npx -y marked@latest -i "$input" -o "$output" < /dev/null
  local rc=$?
  ((input_is_temp)) && rm -f "$input"
  if [ "$rc" -ne 0 ]; then
    echo "marked: npx exited with $rc" >&2
    return "$rc"
  fi
  echo "marked: wrote $output"
}
alias md=marked

# html: reverse of marked — convert HTML to Markdown via pandoc.
# Behavior mirrors marked() exactly:
#   - No args + piped stdin     → render the pipe content
#   - No args + interactive TTY → render the system clipboard (via paste())
#   - One arg                   → render the input file
#   - Two args                  → render the first arg, write to the second
# Output paths (<rand> = YYYY-MM-DD-<6-char mktemp>):
#   - No-arg / pipe / clipboard → /tmp/html-<rand>-clipboard.md
#   - One arg                   → /tmp/html-<rand>-<basename>.md
#   - Two args                  → second arg verbatim
# Requires pandoc — there is no equally-good pure-npx HTML→MD tool, and pandoc
# is the gold standard for this direction. We use `gfm-raw_html` so any HTML
# that has no markdown equivalent is dropped instead of leaking into the
# output as inline tags.
function html() {
  if is_help_arg "${1:-}"; then
    echo "html: convert HTML to Markdown using \`pandoc -f html -t gfm-raw_html\`
  Usage:
    html                          render piped stdin or clipboard → /tmp/html-<YYYY-MM-DD>-<rand>-clipboard.md
    cat foo.html | html           render piped stdin → /tmp/html-<YYYY-MM-DD>-<rand>-clipboard.md
    html input.html               render input.html → /tmp/html-<YYYY-MM-DD>-<rand>-input.html.md
    html input.html output.md     render input.html → output.md
  Notes:
    - Requires pandoc on PATH (brew install pandoc / apt install pandoc).
    - Reverse of \`marked\`; round trip is lossy — list/link styles get normalized.
    - <rand> is the 6-char suffix from mktemp; the date prefix sorts renders chronologically in /tmp."
    return
  fi

  if ! type -P pandoc &> /dev/null; then
    echo "html: pandoc is required (brew install pandoc / apt install pandoc / dnf install pandoc)" >&2
    return 1
  fi

  local input output rand input_is_temp=0
  # date prefix (YYYY-MM-DD) + 6-char mktemp random suffix so renders sort
  # chronologically in /tmp and remain unique within the same day.
  rand="$(date +%Y-%m-%d)-$(mktemp -u "/tmp/html-XXXXXX" | sed 's|^/tmp/html-||')"

  if [ $# -eq 0 ]; then
    # No args — pipe content if stdin is not a TTY, else fall back to clipboard.
    input=$(mktemp "/tmp/html-input-XXXXXX") || return 1
    input_is_temp=1
    if [ -t 0 ]; then
      # interactive: pull from clipboard via the universal paste() wrapper
      paste > "$input"
    else
      # piped: capture stdin
      command cat - > "$input"
    fi
    if [ ! -s "$input" ]; then
      echo "html: no input (clipboard/stdin was empty)" >&2
      rm -f "$input"
      return 1
    fi
    output="/tmp/html-${rand}-clipboard.md"
  elif [ $# -eq 1 ]; then
    input="$1"
    if [ ! -f "$input" ]; then
      echo "html: not a file: $input" >&2
      return 1
    fi
    output="/tmp/html-${rand}-$(basename -- "$input").md"
  else
    input="$1"
    output="$2"
    if [ ! -f "$input" ]; then
      echo "html: not a file: $input" >&2
      return 1
    fi
  fi

  pandoc -f html -t gfm-raw_html -o "$output" "$input"
  local rc=$?
  ((input_is_temp)) && rm -f "$input"
  if [ "$rc" -ne 0 ]; then
    echo "html: pandoc exited with $rc" >&2
    return "$rc"
  fi
  echo "html: wrote $output"
}
# SOURCE_END software/scripts/bash-command-wrappers.profile.bash
################################################################################
# ---- OS-specific Tweaks (registerPlatformTweaks) ----
################################################################################

# BEGIN Mac OS-specific Tweaks
# Suppress bash legacy warning in Catalina+
export BASH_SILENCE_DEPRECATION_WARNING=1

##########################################################
# Mac-Only Aliases
##########################################################

alias find2='fd'
alias brave='open "/Applications/Brave\ Browser.app" --args --disable-smooth-scrolling'
alias chrome='open "/Applications/Google\ Chrome.app" --args --disable-smooth-scrolling'
alias sqluinative='open "/Applications/sqlui-native.app" --args --disable-smooth-scrolling'
alias sql="sqluinative"
alias displaydj='open "/Applications/Display DJ.app"'
alias skiff='open "/Applications/Skiff Files.app"'

# accessibility: jump straight to System Settings > Privacy & Security > Accessibility
# (where you grant input-event permission to apps like Display DJ, Ghostty, etc.)
alias accessibility='open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"'

# make: use GNU Make (gmake) for .ONESHELL support (macOS ships Make 3.81)
if type -P gmake &> /dev/null; then alias make='gmake'; fi

# update: OS package manager update/upgrade only
alias update='brew update && brew upgrade && brew cleanup'

# clear macOS Gatekeeper quarantine on sideloaded apps
if type -P xattr &> /dev/null; then
  _xattr_app_list=(
    "/Applications/sqlui-native.app"
    "/Applications/Display DJ.app"
    "/Applications/Skiff Files.app"
  )
  _xattr_app=""
  for _xattr_app in "${_xattr_app_list[@]}"; do
    [ -d "${_xattr_app}" ] && xattr -cr "${_xattr_app}"
  done
  unset _xattr_app_list _xattr_app
fi
# END Mac OS-specific Tweaks

fi
################################################################################
# ---- end advanced profile ----
################################################################################