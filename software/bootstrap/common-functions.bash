#!/usr/bin/env bash
# Shared shell functions for run.sh and SH scripts (via SOURCE markers).
# Source of truth — inlined into run.sh via BEGIN/END, included in .sh scripts at runtime.

# is_help_arg <arg> - returns 0 (success) if arg is a recognized --help trigger
# Recognizes (case-insensitive): help, --help, -help, /help, -h, ?, -?, /?
# Mirror of the same function in profile-core.sh — keep the body byte-identical.
function is_help_arg() {
  local arg
  arg=$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')
  case "$arg" in
  help | --help | -help | /help | -h | '?' | '-?' | '/?') return 0 ;;
  *) return 1 ;;
  esac
}

# has_a_gui [mode] - Returns 0 if a GUI display surface is available, else 1.
#   (no arg)  any GUI: mac and windows always true; linux true iff $DISPLAY or
#             $WAYLAND_DISPLAY is set. Use for "should we install/run GUI apps?"
#   wayland   linux Wayland session only — true iff $WAYLAND_DISPLAY is set.
#             Always false on mac/windows (no Wayland there).
#   x11       linux X11 session only — true iff $DISPLAY is set. Always false on
#             mac/windows. Note WSLg sets $DISPLAY on WSL — treat that as x11.
# Returns 1 (false) when SSH_CONNECTION or SSH_CLIENT is set (remote session
# has no GUI surface). Use the specific modes when picking server-specific
# tools (xclip vs wl-copy, wmctrl vs Wayland compositor calls). Return 2 on
# unknown mode.
# Mirror of the same function in profile-core.sh — keep byte-identical.
function has_a_gui() {
  if is_help_arg "${1:-}"; then
    echo "has_a_gui: returns 0 if a GUI display is available, else 1."
    echo "Usage:"
    echo "  has_a_gui           # any GUI (mac/windows always; linux needs \$DISPLAY or \$WAYLAND_DISPLAY)"
    echo "  has_a_gui wayland   # only true if \$WAYLAND_DISPLAY is set"
    echo "  has_a_gui x11       # only true if \$DISPLAY is set"
    return 0
  fi
  local mode="${1:-any}"
  case "$mode" in
  wayland) [ -n "${WAYLAND_DISPLAY:-}" ] ;;
  x11) [ -n "${DISPLAY:-}" ] ;;
  any)
    [ -n "${SSH_CONNECTION:-}" ] && return 1
    [ -n "${SSH_CLIENT:-}" ] && return 1
    ((${is_os_mac:-0})) && return 0
    ((${is_os_windows:-0})) && return 0
    [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]
    ;;
  *)
    echo "has_a_gui: unknown mode '$mode' (expected: wayland, x11, or omit)" >&2
    return 2
    ;;
  esac
}

# get_native_arch - Prints the machine's real CPU architecture (arm64, x86_64, aarch64, ...).
# On Apple Silicon `uname -m` reports x86_64 whenever the calling process is translated
# by Rosetta 2, so hw.optional.arm64 is consulted first and wins. Everywhere else this
# is plain `uname -m`.
# Mirror of the same function in profile-core.sh — keep the body byte-identical.
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
# Mirror of the same function in profile-core.sh — keep the body byte-identical.
function is_arch_translated() {
  [ "$(uname -s)" = "Darwin" ] || return 1
  [ "$(sysctl -n sysctl.proc_translated 2> /dev/null)" = "1" ]
}

# run_native <cmd> [args...] - Runs a command on the machine's native CPU arch.
# Under Rosetta 2 the command is re-launched through `arch -<native arch>`; everywhere
# else it runs unchanged. Use it for installers and GUI launches so they do not inherit
# an Intel-translated environment on Apple Silicon. Only works with real binaries
# (`arch` execs its target), so pass `nohup`/`bash`/`npm`, never a shell function.
# Mirror of the same function in profile-core.sh — keep the body byte-identical.
function run_native() {
  if is_arch_translated && type -P arch > /dev/null 2>&1; then
    arch "-$(get_native_arch)" "$@"
    return $?
  fi
  "$@"
}

# binary_arch_mismatch <binary> - Returns 0 when <binary> is a Mach-O executable with no
# slice for the machine's native CPU arch — e.g. an Intel-only build that npm or an
# installer picked while running under Rosetta 2 on Apple Silicon. Such binaries still
# run (translated), but bun-compiled CLIs then warn "CPU lacks AVX support, strange
# crashes may occur" because Rosetta 2 does not emulate AVX.
# Universal binaries list every slice, so they never mismatch. Shell/node launcher
# scripts are arch-independent and return 1 (no mismatch). macOS only: `file` spells ELF
# arches (x86-64, aarch64) differently than `uname -m`, which would misfire on Linux.
function binary_arch_mismatch() {
  [ "$(uname -s)" = "Darwin" ] || return 1
  [ -e "$1" ] || return 1
  local desc
  desc=$(file -L "$1" 2> /dev/null)
  case "$desc" in
  *Mach-O*) ;;
  *) return 1 ;;
  esac
  case "$desc" in
  *"$(get_native_arch)"*) return 1 ;;
  *) return 0 ;;
  esac
}

# find_native_node - Prints the path of a node binary built for the machine's native CPU
# arch, or returns 1 when none exists. Prefers the node already on PATH, then fnm's
# default alias, then any fnm / Volta node image, then Homebrew.
# Why: npm picks optional dependencies from the *installing* node's process.arch, so an
# Intel node on Apple Silicon installs darwin-x64 builds of bun-compiled CLIs (opencode,
# claude). `arch -arm64` alone cannot fix that — an x86_64-only node stays x86_64 — so
# the install has to run through a natively built node.
function find_native_node() {
  local _node
  _node=$(type -P node 2> /dev/null)
  if [ -n "$_node" ] && ! binary_arch_mismatch "$_node"; then
    echo "$_node"
    return 0
  fi
  local _candidate
  for _candidate in \
    "${FNM_DIR:-$HOME/.local/share/fnm}/aliases/default/bin/node" \
    "${FNM_DIR:-$HOME/.local/share/fnm}"/node-versions/*/installation/bin/node \
    "$HOME"/.volta/tools/image/node/*/bin/node \
    /opt/homebrew/bin/node \
    /usr/local/bin/node; do
    [ -x "$_candidate" ] || continue
    binary_arch_mismatch "$_candidate" && continue
    echo "$_candidate"
    return 0
  done
  return 1
}

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
  if ! bash -n "$target" 2> /dev/null; then
    echo "[Warning] source $target failed (syntax error)" >&2
    return 1
  fi
  . "$target"
}

# curl_bash_install <url> [script args...] - Runs a curl|bash installer with output
# suppressed. In verbose mode (set -x), stderr is kept visible for debugging.
# Extra args are passed to the install script via bash -s -- <args>.
# The installer runs through run_native so scripts that select a download by CPU arch
# (bun, fnm, rustup, ...) see the machine's real arch. Without it, a run started from a
# Rosetta 2-translated process on Apple Silicon fetches Intel builds.
function curl_bash_install() {
  local url="$1"
  shift
  if [[ $- == *x* ]]; then
    curl -fsSL "$url" | run_native bash -s -- "$@" > /dev/null
  else
    curl -fsSL "$url" | run_native bash -s -- "$@" &> /dev/null
  fi
}

# function used to ensure a binary is install
#
# sample uses:
#
# _ensure_npm_binary oxfmt || return
# command oxfmt "$@"
#
# _prettier
#     ↓
# _ensure_npm_binary
#     ↓
# returns 1
#     ↓
# return
function _ensure_npm_binary() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"

  # Already installed.
  if type -P "$bin" > /dev/null 2>&1; then
    return 0
  fi

  # npm is required for bootstrapping.
  if ! type -P npm > /dev/null 2>&1; then
    echo "$bin wrapper: npm not found on PATH; cannot bootstrap $bin" >&2
    return 127
  fi

  # Ask before installing.
  if ! prompt_yes_no "$bin not installed. Install via npm?"; then
    echo "$bin wrapper: install declined by user" >&2
    return 1
  fi

  npm_install_global "$pkg" "$bin"

  if ! type -P "$bin" > /dev/null 2>&1; then
    echo "$bin wrapper: install completed but '$bin' is still not on PATH" >&2
    return 1
  fi

  return 0
}

# npm_install_global <pkg> [binary] - Installs an npm package globally. Skips if already installed.
#   pkg:    npm package name (e.g. @google/gemini-cli, yarn). If no `@<version>`
#           suffix is present, `@latest` is auto-appended so we always re-fetch
#           the npm "latest" dist-tag on refresh runs (the leading `@` of scoped
#           packages is excluded from the suffix check).
#   binary: binary name to check (defaults to last segment of pkg, e.g. gemini-cli from @google/gemini-cli)
# Returns early (no removal, no npm call) when $HOME/.local/bin/<binary>,
# $HOME/.local/share/<binary>, and/or $HOME/.local/lib/node_modules/<pkg> exist and none of
# the present paths is stale per is_path_stale() (2 weeks, or always under IS_REFRESH_MODE) —
# reinstalling every CLI on every run is slow and pointless. The node_modules path is the
# only marker for packages whose launcher is renamed (typescript -> tsc) or that ship no bin
# at all (vscode-markdown-languageserver). An arch mismatch still forces the reinstall.
# Installs to $HOME/.local on the current system. On WSL, also installs to the Windows host
# via cmd.exe. Logs status (Skipped/Success/Error) for each target.
# On macOS the install runs through a natively built node (find_native_node) and run_native,
# and a binary whose CPU arch does not match the machine is always reinstalled — otherwise a
# run started under Rosetta 2 installs Intel builds of bun-compiled CLIs (opencode, claude).
# When IS_FORCE_REFRESH=1 (and target is stale on the unix side, or unconditionally on Windows),
# re-runs `npm install -g <pkg>` which re-fetches the npm "latest" dist-tag so callers like
# gemini / opencode / yarn / clasp pick up upstream releases.
# Core implementation function accepting 3 arguments: pkg, bin (optional), and always_latest (boolean: true/false)
# Core implementation function accepting 3 arguments: pkg, bin (optional), and always_latest (boolean)
function _npm_install_global() {
  local pkg="$1"
  local bin="${2:-${pkg##*/}}"
  local always_latest="${3:-false}"

  # Auto-tag with @latest when no version is pinned
  local _check_pkg="${pkg#@}"
  [[ "$_check_pkg" != *@* ]] && pkg="${pkg}@latest"

  # Freshness gate — bail out *before* the destructive removals below when the existing
  # install is still fresh. Three paths matter: npm drops the launcher in ~/.local/bin,
  # self-updating CLIs (opencode, claude) keep their payload in ~/.local/share, and the
  # package tree itself always lands in ~/.local/lib/node_modules/<pkg>.
  # The node_modules path is what makes the gate work for packages whose launcher is not
  # named after the package (typescript ships `tsc`) and for packages that ship no bin at
  # all (vscode-markdown-languageserver is loaded as a module by editors). Without it those
  # reinstall on every single run — a permanent ~4s tax with no upside.
  # is_path_stale() treats a missing path as stale, so only paths that actually exist are
  # considered; if every present path is fresh we skip the whole reinstall. An arch
  # mismatch (Rosetta-installed x64 slice on Apple Silicon) always overrides the gate.
  local _bin_path="$HOME/.local/bin/$bin"
  local _share_path="$HOME/.local/share/$bin"
  # Strip the trailing @version we just appended; keeps the leading @ of scoped packages
  # (@vue/language-server@latest -> @vue/language-server).
  local _lib_path="$HOME/.local/lib/node_modules/${pkg%@*}"
  local _present=0 _stale=0 _p _fresh_path=""
  for _p in "$_bin_path" "$_share_path" "$_lib_path"; do
    if [ -e "$_p" ] || [ -L "$_p" ]; then
      _present=1
      [ -z "$_fresh_path" ] && _fresh_path="$_p"
      is_path_stale "$_p" && _stale=1
    fi
  done
  if ((_present)) && ! ((_stale)) && ! binary_arch_mismatch "$_bin_path"; then
    echo ">> $pkg >> Installing with npm global >> Skipped (not stale: $_fresh_path)"
    return 0
  fi

  # Remove stale local binary before npm global install
  if [[ -e "$HOME/.local/bin/$bin" || -L "$HOME/.local/bin/$bin" ]]; then
    echo "  >> Removing existing binary: ~/.local/bin/$bin"
    rm -f "$HOME/.local/bin/$bin"
  fi

  # Remove standalone install data
  if [[ -d "$HOME/.local/share/$bin" ]]; then
    echo "  >> Removing standalone install data: ~/.local/share/$bin"
    rm -rf "$HOME/.local/share/$bin"
  fi

  echo "  >> npm install -g $pkg ($bin)"

  # 1. Current system install / check
  local _resolved
  _resolved=$(has_persistent_binary "$bin")

  # Reinstall when the installed binary has no slice for the native CPU arch. npm picks
  # optional dependencies from the installing node's process.arch, so an Intel node on
  # Apple Silicon lands darwin-x64 builds of bun-compiled CLIs (opencode, claude) that
  # warn "CPU lacks AVX support, strange crashes may occur" on every launch.
  local _arch_mismatch=0
  if [ -n "$_resolved" ] && binary_arch_mismatch "$_resolved"; then
    _arch_mismatch=1
    echo "  >> Reinstalling $bin: $_resolved is not built for $(get_native_arch)"
  fi

  # Resolve a natively built node for the install itself — `arch -<native>` cannot help
  # here because an x86_64-only node stays x86_64 under any arch preference.
  local _native_node _native_node_dir=""
  _native_node=$(find_native_node) && _native_node_dir=$(dirname "$_native_node")

  if ! is_truthy "$always_latest" && [ -n "$_resolved" ] && ! ((_arch_mismatch)) && ! is_force_refresh_stale "$_resolved"; then
    echo ">> $pkg >> Installing with npm global >> Skipped ($_resolved)"
  else
    local _action="Installing"
    [ -n "$_resolved" ] && _action="Refreshing"
    echo -n ">> $pkg >> ${_action} with npm global >> "
    if (
      [ -n "$_native_node_dir" ] && export PATH="$_native_node_dir:$PATH"
      run_native npm install -g --prefix "$HOME/.local" "$pkg"
    ) < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi

  # 2. Windows host via WSL install / check
  if ((is_os_wsl)) && type -P cmd.exe &> /dev/null; then
    local _win_present=0
    cmd.exe /c "where $bin" &> /dev/null && _win_present=1

    if ! is_truthy "$always_latest" && ((_win_present)) && ! ((IS_FORCE_REFRESH)); then
      echo ">> $pkg >> Installing with npm global (Windows) >> Skipped"
    else
      local _winaction="Installing"
      ((_win_present)) && _winaction="Refreshing"
      echo -n ">> $pkg >> ${_winaction} with npm global (Windows) >> "
      if cmd.exe /c "npm install -g $pkg" < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
        echo "Success"
      else
        echo "Error"
      fi
    fi
  fi
}

# Public wrapper preserving original name, defaulting always_latest to true
function npm_install_global() {
  _npm_install_global "$1" "$2" "true"
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

# prompt_yes_no <prompt> [default] - Asks the user a yes/no question.
# `default` is "Y" or "N" (case-insensitive); defaults to "N".
# Returns 0 on yes; 1 on no, empty input, or no /dev/tty available.
# Reads from /dev/tty so it works inside `bash <<'EOF'` heredocs and other
# piped contexts where stdin is already consumed.
# Mirror of the same function in profile-advanced.sh — keep in sync.
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

# backup_config_file <path> - Snapshots a user config file before it is overwritten.
# Bash mirror of the JS backupConfigFile() in software/index.js — same two-file model:
#   <path>.bak_original  first-ever snapshot, written once and never touched again
#   <path>.bak_latest    previous state, refreshed whenever the file differs from .bak_original
# No-op when the file does not exist yet. `cmp` lives in diffutils and is not
# guaranteed on minimal systems (Termux); a missing cmp exits non-zero, which
# falls through to writing .bak_latest — an extra backup, never a lost one.
function backup_config_file() {
  if is_help_arg "${1:-}"; then
    echo "
      backup_config_file: snapshot a config file before overwriting it
        Usage: backup_config_file <path>
        Creates <path>.bak_original once, and <path>.bak_latest on later changes.
        Example: backup_config_file \"\$HOME/.termux/termux.properties\"
    "
    return 0
  fi
  local target="$1"
  [ -f "$target" ] || return 0

  local original="${target}.bak_original"
  if [ ! -f "$original" ]; then
    cp "$target" "$original" && echo "<<< Backup Created (original) $original"
    return 0
  fi

  local latest="${target}.bak_latest"
  if command cmp -s "$target" "$original" 2> /dev/null; then
    echo "<<< Backup Skipped (latest same as original) $latest"
  else
    cp "$target" "$latest" && echo "<<< Backup Created (latest) $latest"
  fi
}

# ensure_binary_alias <canonical_name> - On distros where the package manager installs
# the binary under a non-canonical name (e.g. apt installs `bat` -> `/usr/bin/batcat`,
# `fd-find` -> `/usr/bin/fdfind`), create a $HOME/.local/bin/<canonical> symlink so
# the canonical name resolves on PATH. No-op when:
#   - there is no override for the current OS
#   - the canonical binary is already on PATH (already symlinked, or distro ships it directly)
#   - the override binary itself is not installed (nothing to link to)
# Refuses to overwrite a real file at the target path; replaces existing symlinks.
# Override table is intentionally inline (no JSON / no jq dependency at install time).
function ensure_binary_alias() {
  local canonical="$1"
  local installed=""

  # ---- Override table ----
  case "$canonical" in
  bat) ((is_os_ubuntu || is_os_chromeos)) && installed="batcat" ;;
  fd) ((is_os_ubuntu || is_os_chromeos)) && installed="fdfind" ;;
  esac

  # No override for this OS — done.
  [ -z "$installed" ] && return 0

  # Canonical already on PATH — done.
  if type -P "$canonical" &> /dev/null; then
    echo ">> ensure_binary_alias $canonical >> Skipped (already on PATH)"
    return 0
  fi

  local target
  target=$(type -P "$installed" 2> /dev/null) || true
  if [ -z "$target" ]; then
    echo ">> ensure_binary_alias $canonical >> Skipped (no $installed found)"
    return 0
  fi

  safe_mkdir "$HOME/.local/bin" > /dev/null
  local link="$HOME/.local/bin/$canonical"
  if [ -e "$link" ] && [ ! -L "$link" ]; then
    echo ">> ensure_binary_alias $canonical >> Skipped (real file at $link)"
    return 0
  fi
  ln -sf "$target" "$link"
  echo ">> ensure_binary_alias $canonical >> Linked $link -> $target"
}

# exit_if_limited_support_os - Exits the script if the current OS is a limited-support
# platform (any flag listed in LIMITED_SUPPORT_OSES is set).
function exit_if_limited_support_os() {
  local IFS=','
  for os_flag in $LIMITED_SUPPORT_OSES; do
    ((${os_flag:-0})) && {
      echo ">>> Skipped : Not supported on $os_flag"
      exit 0
    }
  done
}
