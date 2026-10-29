#!/usr/bin/env bash

# Browser flags come from browser-launch-options.common.js.
# This file selects the browser binary and launches it with the generated arrays.

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
    printf '%s\n' ' "# $name'

    if resolved=$(find_path "${!paths_var}" --exec 2> /dev/null) && [ -n "$resolved" ]; then
    printf '%s\n' ' "\\"$resolved\\"'

    else
    printf '%s\n' ' "(not found)'

    fi
    printf '%s\n' ' "'

  done
}

# Resolve browser binary from a list of candidate paths (delegates to find_path exec mode)
function find_browser() {
  local browser_name="$1"
  shift
  local result
  result=$(find_path "$@" --exec) && echo "$result" && return 0
  echo "Error: $browser_name browser not installed." >&2
  return 1
}

# Launch a browser fully detached from the terminal with shared options and user arguments.
# The caller sets `browser_args`; user arguments follow defaults so they can override them.
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

  # Select browser-specific options; user args come last so they can override defaults.
  local -a browser_launch_options
  case "$browser_name" in
  brave) browser_launch_options=("${_BRAVE_LAUNCH_OPTIONS[@]}") ;;
  chrome) browser_launch_options=("${_CHROME_LAUNCH_OPTIONS[@]}") ;;
  edge) browser_launch_options=("${_EDGE_LAUNCH_OPTIONS[@]}") ;;
  *) browser_launch_options=("${_CHROME_LAUNCH_OPTIONS[@]}") ;;
  esac
  local final_args=("${browser_launch_options[@]}" "${_BROWSER_PLATFORM_ARGS[@]}" "${browser_args[@]}")

  # Echo the exact command about to run so users can see / copy / re-run it.
  # Printed BEFORE the launch so the banner is visible even if the browser
  # crashes or the background subshell forks fail.
  printf '\n====================================\n"%s"' "$target_binary"
  printf ' %q' "${final_args[@]}"
  printf '\nPWD:           %s\n====================================\n\n' "$(pwd)"

  # Launch browser fully detached (same pattern on all platforms). run_native wraps
  # nohup (a real binary, not a shell function) so a browser launched from a Rosetta 2
  # translated shell on Apple Silicon starts its arm64 slice instead of inheriting the
  # translated arch and running as Intel.
  (run_native nohup "$target_binary" "${final_args[@]}" > /dev/null 2>&1 &)

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
