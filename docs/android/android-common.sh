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

_remove_app() {
  _disable_app "$1" > /dev/null 2>&1 || true
  ok=0
  _adb_shell pm uninstall "$1" > /dev/null 2>&1 && ok=1
  _adb_shell pm uninstall -k --user 0 "$1" > /dev/null 2>&1 && ok=1
  _adb_shell pm uninstall -k --user 10 "$1" > /dev/null 2>&1 && ok=1
  [ "$ok" = "1" ]
}

_restore_app() {
  ok=0
  _adb_shell cmd package install-existing "$1" > /dev/null 2>&1 && ok=1
  _adb_shell pm enable "$1" > /dev/null 2>&1 && ok=1
  [ "$ok" = "1" ]
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

_run_app_collection_action() {
  action=$1
  collection_name=$2
  apps=$3
  total=$(_count_app_collection "$apps")
  idx=0
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
        _log_app_action "$app" "$collection_name" "Success" "Removed" "$idx" "$total"
      else
        _log_app_action "$app" "$collection_name" "Error" "Removed" "$idx" "$total"
      fi
    else
      if _restore_app "$app"; then
        _log_app_action "$app" "$collection_name" "Success" "Restored" "$idx" "$total"
      else
        _log_app_action "$app" "$collection_name" "Error" "Restored" "$idx" "$total"
      fi
    fi
  done << EOF
$normalized_apps
EOF
}

remove_app_collection() {
  _run_app_collection_action "remove" "${2:-collection}" "$1"
}

restore_app_collection() {
  _run_app_collection_action "restore" "${2:-collection}" "$1"
}
