# Shared Android/Fire TV ADB helpers. Sourced/included by platform scripts.

SETTINGS_APPLIED=""

# Run an Android command through the host's connected ADB device.
# stdin is redirected so ADB never consumes app-collection loop input.
_adb_shell() {
  adb shell "$@" </dev/null
}

_put_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  printf '%s\n' ">>> setting put $*"
  _adb_shell settings put "$@" > /dev/null 2>&1
}

_restore_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  printf '%s\n' ">>> setting restore $*"
  _adb_shell settings delete "$@" > /dev/null 2>&1
}

restore_all_settings() {
  printf '%s\n' "$SETTINGS_APPLIED" | while IFS=' ' read -r setting_namespace setting_key; do
    [ -z "$setting_namespace" ] && continue
    _restore_setting "$setting_namespace" "$setting_key"
  done
  printf '%s\n' ">>> all settings restored to defaults"
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
  app=$1
  collection_name=$2
  status=$3
  action=$4
  idx=$5
  total=$6
  printf '>>> %s > %s > %s > %s > [%s/%s]\n' "$app" "$collection_name" "$status" "$action" "$idx" "$total"
}

_run_app_collection_action() {
  action=$1
  collection_name=$2
  apps=$3
  total=$(_count_app_collection "$apps")
  idx=0
  normalized_apps=$(_normalize_app_collection "$apps" "")

  printf '%s\n' ">> ${action}_app_collection > ${collection_name} (${total} apps)..."

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
  done <<EOF
$normalized_apps
EOF
}

remove_app_collection() {
  _run_app_collection_action "remove" "${2:-collection}" "$1"
}

restore_app_collection() {
  _run_app_collection_action "restore" "${2:-collection}" "$1"
}
