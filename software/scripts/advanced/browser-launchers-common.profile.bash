#!/usr/bin/env bash

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
