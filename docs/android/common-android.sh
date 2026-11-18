# Shared Android/Fire TV ADB helpers. Sourced/included by platform scripts.

SETTINGS_APPLIED=""
_APP_RESULT_NOT_FOUND='Skipped - package not found'

# --- Logging ---
_LOG_COLOR_RESET='\033[0m'
_LOG_COLOR_BLUE='\033[0;34m'
_LOG_COLOR_GREEN='\033[0;32m'
_LOG_COLOR_YELLOW='\033[0;33m'
_LOG_COLOR_RED='\033[0;31m'
_LOG_COLOR_GREY='\033[0;90m'

_log_color_enabled() {
  [ "${TERM:-}" != "dumb" ] && [ -t 1 ]
}

_log_error_color_enabled() {
  [ "${TERM:-}" != "dumb" ] && [ -t 2 ]
}

_log_color() {
  _log_color_code=$1
  _log_message=$2
  if _log_color_enabled; then
    printf '%b%s%b\n' "$_log_color_code" "$_log_message" "$_LOG_COLOR_RESET"
  else
    printf '%s\n' "$_log_message"
  fi
}

_log_failure() {
  _log_color "$_LOG_COLOR_RED" "$1"
}

_log_section() {
  _log_color "$_LOG_COLOR_BLUE" "$1"
}

_log_info() {
  _log_color "$_LOG_COLOR_GREY" "$1"
}

_log_success() {
  _log_color "$_LOG_COLOR_GREEN" "$1"
}

_log_warning() {
  _log_color "$_LOG_COLOR_YELLOW" "$1"
}

_log_error() {
  _log_message=$1
  if _log_error_color_enabled; then
    printf '%b%s%b\n' "$_LOG_COLOR_RED" "$_log_message" "$_LOG_COLOR_RESET" >&2
  else
    printf '%s\n' "$_log_message" >&2
  fi
}

# Run an Android command through the host's connected ADB device.
# stdin is redirected so ADB never consumes app-collection loop input.
_adb_shell() {
  adb shell "$@" < /dev/null
}

# Apply one setting and warn when the device does not keep the requested value.
_put_setting_checked() {
  _namespace=$1
  _key=$2
  _value=$3
  _adb_shell settings put "$_namespace" "$_key" "$_value" > /dev/null 2>&1
  _actual=$(_adb_shell settings get "$_namespace" "$_key" 2> /dev/null)
  _actual=${_actual%$'\r'}
  if [ "$_actual" != "$_value" ]; then
    _log_error "WARNING: $_key expected=$_value actual=$_actual"
  fi
}

_put_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  _log_info ">>> setting put $*"
  _put_setting_checked "$@"
}

_restore_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  _log_info ">>> setting restore $*"
  _adb_shell settings delete "$@" > /dev/null 2>&1
}

restore_all_settings() {
  printf '%s\n' "$SETTINGS_APPLIED" | while IFS=' ' read -r setting_namespace setting_key; do
    [ -z "$setting_namespace" ] && continue
    _restore_setting "$setting_namespace" "$setting_key"
  done
  _log_success ">>> all settings restored to defaults"
}

# Return unique package names, one per line, excluding supplied package names.
_normalize_app_collection() {
  apps=$1
  excluded=$(printf '%s' "$2" | command tr '\r\n' '  ')
  printf '%s\n' "$apps" | command awk -v excluded="$excluded" '
    function trim(value) {
      sub(/^[[:space:]]*/, "", value)
      sub(/[[:space:]]*$/, "", value)
      return value
    }
    BEGIN {
      count = split(excluded, excluded_apps, /[[:space:]]+/)
      for (position = 1; position <= count; position++) {
        excluded_app = trim(excluded_apps[position])
        if (excluded_app != "") excluded_map[excluded_app] = 1
      }
    }
    {
      gsub(/\r/, "")
      sub(/#.*/, "")
      count = split($0, line_apps, /[[:space:]]+/)
      for (position = 1; position <= count; position++) {
        app = trim(line_apps[position])
        if (app != "" && !(app in excluded_map) && !(app in seen)) {
          seen[app] = 1
          print app
        }
      }
    }
  '
}

_count_app_collection() {
  _normalize_app_collection "$1" "" | command awk 'NF { count++ } END { print count + 0 }'
}

_disable_app() {
  if ! package_exists "$1"; then
    return 0
  fi
  if ! package_enabled "$1"; then
    return 0
  fi
  ok=0
  _adb_shell pm disable-user --user 0 "$1" > /dev/null 2>&1 && ok=1
  _adb_shell pm disable-user -k --user 0 "$1" > /dev/null 2>&1 && ok=1
  [ "$ok" = "1" ]
}

# Run one package-manager command, storing combined output in APP_ACTION_OUTPUT.
# A zero exit status or a "Success" response counts as success.
_run_app_command() {
  APP_ACTION_OUTPUT=$(_adb_shell "$@" 2>&1)
  APP_ACTION_STATUS=$?
  if [ "$APP_ACTION_STATUS" -eq 0 ]; then
    return 0
  fi
  case "$APP_ACTION_OUTPUT" in
  *Success*) return 0 ;;
  esac
  return 1
}

# Run one package-manager command and append its output to APP_ACTION_ERROR on failure.
_attempt_app_command() {
  if _run_app_command "$@"; then
    return 0
  fi
  APP_ACTION_ERROR="$APP_ACTION_ERROR$APP_ACTION_OUTPUT
"
  return 1
}

# True when the package is installed for the current user.
package_exists() {
  _adb_shell pm list packages "$1" 2> /dev/null | command tr -d '\r' | command grep -Fxq "package:$1"
}

# True when the package is enabled for the current user.
package_enabled() {
  _adb_shell pm list packages -e "$1" 2> /dev/null | command tr -d '\r' | command grep -Fxq "package:$1"
}

# Remove one package for user 0. Sets APP_ACTION_RESULT on success:
# Removed (uninstalled), Disabled (OEM blocks uninstall, disable worked),
# or Already removed (not installed for user 0).
_remove_app() {
  APP_ACTION_ERROR=""
  APP_ACTION_RESULT=""
  if ! package_exists "$1"; then
    APP_ACTION_RESULT="$_APP_RESULT_NOT_FOUND"
    return 0
  fi
  disabled=0
  _disable_app "$1" > /dev/null 2>&1 && disabled=1
  ok=0
  _attempt_app_command pm uninstall "$1" && ok=1
  _attempt_app_command pm uninstall -k --user 0 "$1" && ok=1
  _attempt_app_command pm uninstall -k --user 10 "$1" && ok=1
  if [ "$ok" = "1" ]; then
    APP_ACTION_RESULT="Removed"
    APP_ACTION_ERROR=""
    return 0
  fi
  if ! package_exists "$1"; then
    APP_ACTION_RESULT="$_APP_RESULT_NOT_FOUND"
    APP_ACTION_ERROR=""
    return 0
  fi
  if [ "$disabled" = "1" ]; then
    APP_ACTION_RESULT="Disabled"
    APP_ACTION_ERROR=""
    return 0
  fi
  return 1
}

_restore_app() {
  APP_ACTION_ERROR=""
  APP_ACTION_RESULT=""
  any_success=0

  _attempt_app_command cmd package install-existing "$1" && any_success=1
  _attempt_app_command pm enable "$1" && any_success=1

  _restore_app_users=$(_adb_shell pm list users 2> /dev/null | command tr -d '\r' | command awk -F'[{:]' '/UserInfo\{/ { print $2 }')
  while IFS= read -r _restore_app_user; do
    [ -z "$_restore_app_user" ] && continue
    _attempt_app_command cmd package install-existing --user "$_restore_app_user" "$1" && any_success=1
    _attempt_app_command pm enable --user "$_restore_app_user" "$1" && any_success=1
  done << EOF
$_restore_app_users
EOF

  if [ -n "$_restore_app_users" ]; then
    _restore_app_verified=0
    while IFS= read -r _restore_app_user; do
      [ -z "$_restore_app_user" ] && continue
      if _adb_shell pm list packages --user "$_restore_app_user" -e "$1" 2> /dev/null | command tr -d '\r' | command grep -Fxq "package:$1"; then
        _restore_app_verified=1
      fi
    done << EOF
$_restore_app_users
EOF
    [ "$_restore_app_verified" = "1" ] || return 1
  elif [ "$any_success" != "1" ]; then
    return 1
  fi

  APP_ACTION_RESULT="Restored"
  APP_ACTION_ERROR=""
  return 0
}

_log_app_action() {
  _app_action_app=$1
  _app_action_collection=$2
  _app_action_status=$3
  _app_action_name=$4
  _app_action_idx=$5
  _app_action_total=$6
  if [ "$_app_action_status" = "Success" ] && [ "$_app_action_name" = "$_APP_RESULT_NOT_FOUND" ]; then
    _app_action_status="Warning"
  fi
  _app_action_percentage=$((_app_action_idx * 100 / _app_action_total))
  _app_action_line=$(printf '>>> %s > %s > %s > %s > [%s/%s - %s%%]' "$_app_action_app" "$_app_action_collection" "$_app_action_status" "$_app_action_name" "$_app_action_idx" "$_app_action_total" "$_app_action_percentage")
  if [ "$_app_action_status" = "Success" ]; then
    _log_success "$_app_action_line"
  elif [ "$_app_action_status" = "Warning" ]; then
    _log_warning "$_app_action_line"
  else
    _log_failure "$_app_action_line"
  fi
}

# Create a temp file that collects failed package-action output.
_create_app_action_error_log() {
  log_dir=${TMPDIR:-/tmp}
  log_dir=${log_dir%/}
  command mktemp "${log_dir}/android-${1}-app-errors.XXXXXX"
}

# Append one failed package action and its command output to the error log.
_append_app_action_error() {
  {
    printf '=== %s ===\n' "$2"
    printf '%s' "$3"
    printf '\n'
  } >> "$1"
}

_run_app_collection_action() {
  action=$1
  collection_name=$2
  apps=$3
  total=$(_count_app_collection "$apps")
  idx=0
  failures=0
  error_log=""
  normalized_apps=$(_normalize_app_collection "$apps" "")

  _log_section ">> ${action}_app_collection > ${collection_name} (${total} apps)..."

  if [ -z "$normalized_apps" ]; then
    return 0
  fi

  while IFS= read -r app; do
    [ -z "$app" ] && continue
    idx=$((idx + 1))
    if [ "$action" = "remove" ]; then
      if _remove_app "$app"; then
        _log_app_action "$app" "$collection_name" "Success" "$APP_ACTION_RESULT" "$idx" "$total"
        continue
      fi
      status_name="Not removed"
    else
      if _restore_app "$app"; then
        _log_app_action "$app" "$collection_name" "Success" "$APP_ACTION_RESULT" "$idx" "$total"
        continue
      fi
      status_name="Not restored"
    fi
    failures=$((failures + 1))
    if [ -z "$error_log" ]; then
      error_log=$(_create_app_action_error_log "$action")
    fi
    if [ -n "$error_log" ]; then
      _append_app_action_error "$error_log" "$app" "$APP_ACTION_ERROR"
    fi
    _log_app_action "$app" "$collection_name" "Error" "$status_name" "$idx" "$total"
  done << EOF
$normalized_apps
EOF

  if [ -n "$error_log" ]; then
    _log_error ">>> ${failures}/${total} failed; command output: ${error_log}"
  elif [ "$failures" -gt 0 ]; then
    _log_error ">>> ${failures}/${total} failed; could not create an error log"
  fi
}

remove_app_collection() {
  _run_app_collection_action "remove" "${2:-collection}" "$1"
}

restore_app_collection() {
  _run_app_collection_action "restore" "${2:-collection}" "$1"
}

# Print the host selection state for one package:
# "enabled", "disabled", "mixed", or "none".
_app_links_selection_state() {
  _adb_shell cmd package get-app-links --user 0 "$1" 2> /dev/null | command tr -d '\r' | command awk '
    /Selection state:/ { in_selection = 1; next }
    in_selection && /^[[:space:]]*Enabled:[[:space:]]*$/ { section = "enabled"; next }
    in_selection && /^[[:space:]]*Disabled:[[:space:]]*$/ { section = "disabled"; next }
    in_selection && /^[[:space:]]+[^[:space:]]/ {
      if (section == "enabled") enabled++
      else if (section == "disabled") disabled++
    }
    END {
      if (enabled > 0 && disabled > 0) print "mixed"
      else if (enabled > 0) print "enabled"
      else if (disabled > 0) print "disabled"
      else print "none"
    }
  '
}

# Enable or reset supported-link handling for every package in a collection.
# "enable" turns user selection on for all declared hosts; "reset" disables it.
# The set command does not report domains it could not apply, so verify the
# resulting selection state before counting a package as handled.
_run_app_links_action() {
  _links_action=$1
  _links_collection=$2
  _links_apps=$3
  _links_total=$(_count_app_collection "$_links_apps")
  _links_idx=0
  _links_failures=0
  _links_error_log=""
  _links_normalized=$(_normalize_app_collection "$_links_apps" "")

  _log_section ">> ${_links_action}_app_links > ${_links_collection} (${_links_total} apps)..."

  if [ -z "$_links_normalized" ]; then
    return 0
  fi

  if [ "$_links_action" = "reset" ]; then
    _links_selected=false
    _links_want=disabled
    _links_result="Reset"
  else
    _links_selected=true
    _links_want=enabled
    _links_result="Enabled"
  fi

  while IFS= read -r app; do
    [ -z "$app" ] && continue
    _links_idx=$((_links_idx + 1))
    if ! package_exists "$app"; then
      _log_app_action "$app" "$_links_collection" "Success" "$_APP_RESULT_NOT_FOUND" "$_links_idx" "$_links_total"
      continue
    fi
    APP_ACTION_ERROR=""
    _attempt_app_command cmd package set-app-links-user-selection --user 0 --package "$app" "$_links_selected" all
    _links_state=$(_app_links_selection_state "$app")
    if [ "$_links_state" = "$_links_want" ]; then
      _log_app_action "$app" "$_links_collection" "Success" "$_links_result" "$_links_idx" "$_links_total"
      continue
    fi
    if [ "$_links_state" = "none" ]; then
      _log_app_action "$app" "$_links_collection" "Warning" "No supported links" "$_links_idx" "$_links_total"
      continue
    fi
    _links_failures=$((_links_failures + 1))
    if [ -z "$_links_error_log" ]; then
      _links_error_log=$(_create_app_action_error_log "app-links")
    fi
    if [ -n "$_links_error_log" ]; then
      _append_app_action_error "$_links_error_log" "$app" "$APP_ACTION_ERROR selection=$_links_state"
    fi
    _log_app_action "$app" "$_links_collection" "Error" "Links $_links_state" "$_links_idx" "$_links_total"
  done << EOF
$_links_normalized
EOF

  if [ -n "$_links_error_log" ]; then
    _log_error ">>> ${_links_failures}/${_links_total} failed; command output: ${_links_error_log}"
  elif [ "$_links_failures" -gt 0 ]; then
    _log_error ">>> ${_links_failures}/${_links_total} failed; could not create an error log"
  fi
}

# Enable supported app links for the given package collection.
enable_app_links() {
  _run_app_links_action "enable" "${2:-collection}" "$1"
}

# Return supported app links for the given package collection to disabled.
reset_app_links() {
  _run_app_links_action "reset" "${2:-collection}" "$1"
}
