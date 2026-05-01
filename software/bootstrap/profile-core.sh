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
# BEGIN/END | Profile Generated Timestamp
#
################################################################################
# SOURCE | software/scripts/bash-history.profile.bash
# BEGIN/END | fnm - fast node manager
# BEGIN/END | format script
# BEGIN/END | mac-system-setup
# BEGIN/END | temporal-cli
# SOURCE | PATH dedupe + prune | software/scripts/bash-path-candidate.profile.bash

export EDITOR='vim'
export BASH_PATH=~/.bash_syle
export LINE_BREAK_COUNT=100
export LINE_BREAK_HASH=$(printf '#%.0s' $(seq 1 $LINE_BREAK_COUNT))

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
# the target. On WSL, appends a second `cd` line with the Windows-style path when it
# differs from the unix path.
#
# Output:
#   ====================================
#   PWD: "<pwd>"
#   cd "<dir>"                           # selection's folder (parent for files, self for folders)
#   <binary> [extra_args] "<target>"     # only when binary is passed
#   cd "<resolved_dir>"                  # only on WSL when the resolved path differs
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
  # so the trailing `cd "<resolved_dir>"` line never fires off-Windows.
  local resolved_dir resolved_target
  resolved_dir=$(to_windows_path "$dir")
  resolved_target=$(to_windows_path "$target_abs")

  # Binary line uses the WSL-resolved target on Windows so the printed command works
  # when pasted into a Windows-side shell. Off-WSL the two are identical.
  local binary_target="$target_abs"
  [ "$resolved_target" != "$target_abs" ] && binary_target="$resolved_target"

  echo "===================================="
  echo "PWD: \"$(pwd)\""
  echo "cd \"$dir\""
  if [ -n "$binary" ]; then
    if [ ${#extra_args[@]} -gt 0 ]; then
      echo "$binary ${extra_args[*]} \"$binary_target\""
    else
      echo "$binary \"$binary_target\""
    fi
  fi
  [ "$resolved_dir" != "$dir" ] && echo "cd \"$resolved_dir\""
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
