# Shared Android/Fire TV ADB helpers. Sourced/included by platform scripts.

SETTINGS_APPLIED=""

# --- Logging ---
_LOG_COLOR_RESET='\033[0m'
_LOG_COLOR_BLUE='\033[0;34m'
_LOG_COLOR_GREEN='\033[0;32m'
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

_put_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  _log_info ">>> setting put $*"
  _adb_shell settings put "$@" > /dev/null 2>&1
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

# True when the package is installed for user 0.
_package_installed_for_user() {
  _package_output=$(_adb_shell pm list packages --user 0 "$1" 2> /dev/null)
  case "$_package_output" in
  *"package:$1"*) return 0 ;;
  esac
  return 1
}

# Remove one package for user 0. Sets APP_ACTION_RESULT on success:
# Removed (uninstalled), Disabled (OEM blocks uninstall, disable worked),
# or Already removed (not installed for user 0).
_remove_app() {
  APP_ACTION_ERROR=""
  APP_ACTION_RESULT=""
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
  if ! _package_installed_for_user "$1"; then
    APP_ACTION_RESULT="Already removed"
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
  ok=0
  _attempt_app_command cmd package install-existing "$1" && ok=1
  _attempt_app_command pm enable "$1" && ok=1
  if [ "$ok" = "1" ]; then
    APP_ACTION_RESULT="Restored"
    APP_ACTION_ERROR=""
    return 0
  fi
  return 1
}

_log_app_action() {
  _app_action_app=$1
  _app_action_collection=$2
  _app_action_status=$3
  _app_action_name=$4
  _app_action_idx=$5
  _app_action_total=$6
  _app_action_percentage=$((_app_action_idx * 100 / _app_action_total))
  _app_action_line=$(printf '>>> %s > %s > %s > %s > [%s/%s - %s%%]' "$_app_action_app" "$_app_action_collection" "$_app_action_status" "$_app_action_name" "$_app_action_idx" "$_app_action_total" "$_app_action_percentage")
  if [ "$_app_action_status" = "Success" ]; then
    _log_success "$_app_action_line"
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
