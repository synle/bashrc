#!/usr/bin/env bash
# software/bootstrap/profile-core.sh

# --- Debug Tracing ---
# Enable:  echo 1 > $_BASHRC_DEBUG_DIR/debug
# Disable: rm $_BASHRC_DEBUG_DIR/debug
# Logs stacktrace to $_BASHRC_DEBUG_DIR/debug.log on ERR and EXIT.
_BASHRC_DEBUG_DIR="${BASHRC_TEMP_ROOT_DIR:-/tmp/synle/bashrc}"
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

# bashrc_debug <on|off|status> - Control debug tracing
function bashrc_debug() {
  if is_help_arg "${1:-}"; then
    echo "bashrc_debug: control debug tracing
  Usage: bashrc_debug on     enable debug tracing
         bashrc_debug off    disable debug tracing
         bashrc_debug status show current debug state"
    return 0
  fi
  local _debug_file="$_BASHRC_DEBUG_DIR/debug"
  case "${1:-}" in
  on)
    echo 1 > "$_debug_file"
    set -x
    echo ">> Debug tracing enabled"
    ;;
  off)
    rm -f "$_debug_file"
    set +x
    echo ">> Debug tracing disabled"
    ;;
  status)
    if [ -f "$_debug_file" ]; then
      echo ">> Debug tracing is ON"
    else
      echo ">> Debug tracing is OFF"
    fi
    ;;
  *)
    echo "bashrc_debug: unknown command '${1:-}' (expected: on, off, status)" >&2
    return 1
    ;;
  esac
}

# is_bash_ge <major> [minor] - Returns 0 if BASH_VERSINFO >= <major>[.<minor>]
function is_bash_ge() {
  local req_maj="$1" req_min="${2:-0}"
  [ "${BASH_VERSINFO[0]}" -gt "$req_maj" ] && return 0
  [ "${BASH_VERSINFO[0]}" -eq "$req_maj" ] && [ "${BASH_VERSINFO[1]}" -ge "$req_min" ] && return 0
  return 1
}

# _prompt_command_add <snippet> - Idempotently prepend to PROMPT_COMMAND with dedupe
function _prompt_command_add() {
  local snippet="$1"
  [[ "$PROMPT_COMMAND" == *"$snippet"* ]] && return 0
  PROMPT_COMMAND="${snippet}${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
}

# --- Pre-core Profile Blocks (registerWithBashSyleProfile) ---
# BEGIN/END | Profile Generated Timestamp
# BEGIN/END | fnm - fast node manager
# BEGIN/END | format script
# BEGIN/END | mac-system-setup
# BEGIN/END | temporal-cli
# SOURCE | PATH dedupe + prune | software/scripts/bash-path-candidate.profile.bash

export EDITOR='vim'
export VISUAL="$EDITOR"
export PAGER="less"
export GIT_EDITOR="$EDITOR"
export BASH_PATH=~/.bash_syle
export LINE_BREAK_COUNT=100
printf -v LINE_BREAK_HASH '%*s' "$LINE_BREAK_COUNT" ''
LINE_BREAK_HASH=${LINE_BREAK_HASH// /#}
export LINE_BREAK_HASH
printf -v LINE_BREAK_SLASH '%*s' "$LINE_BREAK_COUNT" ''
LINE_BREAK_SLASH=${LINE_BREAK_SLASH// /\//}
export LINE_BREAK_SLASH
printf -v LINE_BREAK_EQUAL '%*s' "$LINE_BREAK_COUNT" ''
LINE_BREAK_EQUAL=${LINE_BREAK_EQUAL// /=}
export LINE_BREAK_EQUAL

# --- Help-Trigger Helper ---
# Single source of truth for the "is this arg a --help request?" check used by
# every user-facing function across the profile. Defined in profile-core (not
# profile-advanced) so any partial sourced later can rely on it. Keep this
# function body byte-identical with the copy in common-functions.bash — the
# pair must accept the same trigger set.

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

# --- CPU Arch Helpers (Apple Silicon / Rosetta 2) ---

# get_native_arch - Prints the machine's real CPU architecture (arm64, x86_64, aarch64, ...).
# On Apple Silicon `uname -m` reports x86_64 whenever the calling process is translated
# by Rosetta 2, so hw.optional.arm64 is consulted first and wins. Everywhere else this
# is plain `uname -m`.
# Mirror of the same function in common-functions.bash — keep the body byte-identical.
function get_native_arch() {
  if [ "$(uname -s)" = "Darwin" ] && [ "$(sysctl -n hw.optional.arm64 2> /dev/null)" = "1" ]; then
    echo "arm64"
    return 0
  fi
  uname -m
}

# is_arch_translated - Returns 0 when the current process runs under Rosetta 2, i.e. an
# x86_64 process on Apple Silicon. Every child process inherits that translated arch, so
# Homebrew resolves x86_64 bottles/casks, npm resolves darwin-x64 optional dependencies,
# and GUI apps launch their Intel slice. Always 1 (false) off macOS.
# Mirror of the same function in common-functions.bash — keep the body byte-identical.
function is_arch_translated() {
  [ "$(uname -s)" = "Darwin" ] || return 1
  [ "$(sysctl -n sysctl.proc_translated 2> /dev/null)" = "1" ]
}

# run_native <cmd> [args...] - Runs a command on the machine's native CPU arch.
# Under Rosetta 2 the command is re-launched through `arch -<native arch>`; everywhere
# else it runs unchanged. Use it for installers and GUI launches so they do not inherit
# an Intel-translated environment on Apple Silicon. Only works with real binaries
# (`arch` execs its target), so pass `nohup`/`bash`/`npm`, never a shell function.
# Mirror of the same function in common-functions.bash — keep the body byte-identical.
function run_native() {
  if is_arch_translated && type -P arch > /dev/null 2>&1; then
    arch "-$(get_native_arch)" "$@"
    return $?
  fi
  "$@"
}

# --- Command Resolution Helpers ---

# is_runnable_command <name> - True when `"$name" args` is actually invokable from
# inside a function body (PATH binary, shell function, or builtin).
#
# Use this instead of `type -P` whenever the name may be a shell *function*.
# `type -P` only searches PATH, so it misses the GUI editor/browser wrappers that
# editor-launchers.js and browser-launchers.js define as bash functions (zed,
# code, subl, smerge, brave, ...). Plain binary detection should still use
# `type -P` per the repo convention.
#
# Aliases are deliberately rejected: bash performs no alias expansion on an
# expanded word (`"$cmd" "$file"`), so an alias-only name would pass the check
# and then die with "command not found".
function is_runnable_command() {
  if is_help_arg "${1:-}"; then
    echo "is_runnable_command: check whether a name can be invoked as \"\$name\" args
  Usage: is_runnable_command <name>
  True for PATH binaries, shell functions, and builtins. False for alias-only names."
    return 0
  fi
  local name="${1:-}"
  [ -n "$name" ] || return 1
  # `type -at` prints every resolution for the name, one per line, using the
  # fixed words alias/keyword/function/builtin/file. Split on whitespace with a
  # pinned IFS and match the words in pure bash — no external command — so the
  # check still works when PATH is broken or minimal (the exact situation where
  # an editor lookup is most likely to be asked).
  local _t
  local IFS=$' \t\n'
  for _t in $(type -at "$name" 2> /dev/null); do
    case "$_t" in
    file | function | builtin) return 0 ;;
    esac
  done
  return 1
}

# --- Path / Action Helpers ---

# to_windows_path <unix_path> - Convert a unix path to a Windows-style mixed-slash path
function to_windows_path() {
  if is_help_arg "${1:-}"; then
    echo "to_windows_path: convert unix path to Windows mixed-slash path
  Usage: to_windows_path <unix_path>
  No-op on non-WSL (echoes input unchanged)."
    return 0
  fi
  if type -P wslpath &> /dev/null; then
    wslpath -m "$1" 2> /dev/null || echo "$1"
  else
    echo "$1"
  fi
}

# print_action_summary <target_path> [<binary> [<extra_args>...]] - Render a copy-paste-
# runnable summary block for an "act on a path" operation.
function print_action_summary() {
  if is_help_arg "${1:-}"; then
    echo "print_action_summary: show copy-paste-runnable action summary
  Usage: print_action_summary <target_path> [<binary> [<extra_args>...]]
  Prints PWD, cd command, and optional binary invocation."
    return 0
  fi
  local target="$1"
  shift || return 1
  local binary="${1:-}"
  [ $# -gt 0 ] && shift
  local -a extra_args=("$@")

  # Resolve to absolute. Tolerate non-existent paths.
  local target_abs
  if type -P realpath &> /dev/null; then
    target_abs=$(realpath "$target" 2> /dev/null) || target_abs="$target"
  else
    local _dir
    _dir=$(dirname "$target" 2> /dev/null)
    _dir=$(cd -P "$_dir" 2> /dev/null && pwd -P)
    target_abs="${_dir:+$_dir/}$(basename "$target")"
    [ -z "$_dir" ] && target_abs="$target"
  fi

  # cd target = the folder. Parent for files, self for directories.
  local dir
  if [ -d "$target_abs" ]; then
    dir="$target_abs"
  else
    dir=$(dirname "$target_abs")
  fi

  # WSL conversion.
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

# --- Aliases: Coreutils Defaults ---
alias cp='cp -p'
alias ping='ping -c 5'
alias mkdir='mkdir -p' # silent on existing dirs (tradeoff: typo'd paths never surface)
alias df='df -h'
alias du='du -h'
alias free='free -h'

function less() {
  if is_help_arg "${1:-}"; then
    echo "less: open file in vim read-only mode (supports piping)
  Usage: less [file|-]
  Falls back to command less when vim is unavailable."
    return 0
  fi
  if ! type -P vim &> /dev/null; then
    command less "$@"
  else
    command vim -R "${@:--}"
  fi
}

function lsd() {
  if is_help_arg "${1:-}"; then
    echo "lsd: list directories only, sorted
  Usage: lsd [dir]"
    return 0
  fi
  find "${1:-.}" -mindepth 1 -maxdepth 1 -type d | sort
}

function lsda() {
  if is_help_arg "${1:-}"; then
    echo "lsda: list directories (absolute paths), sorted
  Usage: lsda [dir]"
    return 0
  fi
  find "${1:-$PWD}" -mindepth 1 -maxdepth 1 -type d -exec realpath {} \; | sort
}

function lsf() {
  if is_help_arg "${1:-}"; then
    echo "lsf: list files only, sorted
  Usage: lsf [dir]"
    return 0
  fi
  find "${1:-.}" -mindepth 1 -maxdepth 1 -type f | sort
}

function lsfa() {
  if is_help_arg "${1:-}"; then
    echo "lsfa: list files (absolute paths), sorted
  Usage: lsfa [dir]"
    return 0
  fi
  find "${1:-$PWD}" -mindepth 1 -maxdepth 1 -type f -exec realpath {} \; | sort
}

alias grep='command grep --color=auto'
if ls --version 2> /dev/null | command grep -q GNU; then
  # GNU ls uses --color=auto (requires =value)
  alias ls="ls -1 -F --color=auto"
else
  # BSD ls (macOS) — --color is a standalone flag (no =value)
  alias ls="ls -1 -F --color"
fi
alias ll="ls -lah"
if type -P colordiff &> /dev/null; then
  alias diff="colordiff"
elif diff --version 2> /dev/null | command grep -q GNU; then
  alias diff="command diff --color=auto"
fi
alias lc="wc -l"
alias tailf="tail -n 500 -f"
alias tailn="tail -n"
