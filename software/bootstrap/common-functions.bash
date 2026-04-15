#!/usr/bin/env bash
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

# npm_install_global <pkg...> - Installs npm packages globally to $HOME/.local (current system)
# and to the Windows host via cmd.exe when running under WSL.
# Logs status (Success/Error) and appends stderr to fullsetup.log for debugging.
function npm_install_global() {
  # install for current system
  echo -n ">> $@ >> Installing with npm global >> "
  if npm install -g --prefix "$HOME/.local" "$@" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
    echo "Success"
  else
    echo "Error"
  fi

  # install for Windows host via WSL
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    echo -n ">> $@ >> Installing with npm global (Windows) >> "
    if cmd.exe /c "npm install -g $*" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
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
  bin=$(type -P "$1" 2>/dev/null) || return 1
  [[ "$bin" == /tmp/* ]] && return 1
  echo "$bin"
}

# touch <file> - Creates the file only if it does not exist. Skips existing files to
# avoid updating mtime (which would reset staleness checks).
function touch() {
  for f in "$@"; do
    [ -e "$f" ] || command touch "$f"
  done
}

# safe_chown [-R] <path...> - Runs sudo chown on each path only if it exists.
# Pass -R as the first argument to chown recursively.
function safe_chown() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  for f in "$@"; do
    [ -e "$f" ] && sudo chown $flags "$USER" "$f"
  done
}

# safe_chmod [-R] <mode> <path...> - Runs chmod on each path only if it exists.
# Pass -R as the first argument to chmod recursively.
function safe_chmod() {
  local flags=""
  if [ "$1" = "-R" ]; then
    flags="-R"
    shift
  fi
  local mode="$1"
  shift
  for f in "$@"; do
    [ -e "$f" ] && chmod $flags "$mode" "$f"
  done
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
