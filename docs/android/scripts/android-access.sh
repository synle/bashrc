#!/usr/bin/env bash
# Inventory Android apps, capture access evidence, or preview/apply scoped access changes.
# Run from the repository root on the host computer, not inside adb shell:
#   bash docs/android/scripts/android-access.sh --help
#   bash docs/android/scripts/android-access.sh inventory 0
#   bash docs/android/scripts/android-access.sh get all /full/path/to/apps.tsv
#   bash docs/android/scripts/android-access.sh get camera 'com.example.first,com.example.second' 0
#   bash docs/android/scripts/android-access.sh set revoke camera /full/path/to/apps.tsv
# Replace sample packages/paths with actual selections. Set defaults to preview;
# append --apply only after review. Select a device with ANDROID_SERIAL if needed.
set -euo pipefail
umask 077

output_folder=""
final_tsv=""

# Print usage; no arguments or side effects. Returns 0.
function usage() {
  printf '%s\n' \
    'android-access.sh: Android inventory and bulk access tools (host Bash)' \
    'Run from the repository root, or use an absolute script path:' \
    '  bash docs/android/scripts/android-access.sh inventory [USER_ID]' \
    '  bash docs/android/scripts/android-access.sh get TYPE PACKAGE_CSV_OR_TSV [USER_ID]' \
    '  bash docs/android/scripts/android-access.sh set ACTION TYPE PACKAGE_CSV_OR_TSV [USER_ID] [--apply]' \
    'Types: all (get only), location/location-precise, location-approximate, location-background,' \
    '  camera, microphone, contacts, calendar, phone, sms, notifications,' \
    '  media, nearby, sensors, background-running, background-processing,' \
    '  or one android.permission.PERMISSION_NAME.' \
    'Actions: grant/revoke for permissions; allow/ignore/default for background AppOps.' \
    'Set defaults to preview. --apply saves before/after evidence and changes the device.' \
    'TSV input uses package/status headers; removed rows are skipped.' \
    'USER_ID defaults to the inventory metadata, otherwise 0. ANDROID_SERIAL selects a device.'
}

# Report an invalid condition ($1) on stderr and exit 2; never changes the device.
function fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 2
}

# Report exit status and retained output paths; trap preserves the original exit code.
function finish() {
  local result=$?
  if [ -n "$output_folder" ]; then
    printf '\nBackup folder: %s\n' "$output_folder" >&2
    if [ "$result" -eq 0 ]; then
      printf 'Finished. Review captured output before cleanup or recovery.\n' >&2
    else
      printf 'Incomplete (exit %s). Partial evidence retained; no automatic rollback.\n' "$result" >&2
    fi
    if [ -f "$final_tsv" ]; then
      printf 'Generated TSV: %s\n' "$final_tsv" >&2
    fi
  fi
}
trap finish EXIT

# Create a private unique folder under HOME using label $1; sets output_folder.
function new_folder() {
  output_folder=$(mktemp -d "$HOME/android-$1-$(date +%Y%m%d-%H%M%S)-XXXXXX")
  output_folder=$(cd "$output_folder" && pwd -P)
  printf 'Backup folder: %s\n' "$output_folder" >&2
}

# Resolve input $1 and optional user $2; pin one device and reject mismatched inventory metadata.
function connect_device() {
  local input=$1 requested_user=$2 metadata_user="" metadata_serial=""
  if [ -f "$input" ]; then
    local metadata_folder
    metadata_folder=$(cd "$(dirname "$input")" && pwd -P)
    if [ -f "$metadata_folder/android-user.txt" ]; then
      metadata_user=$(command cat "$metadata_folder/android-user.txt")
    fi
    if [ -f "$metadata_folder/device-serial.txt" ]; then
      metadata_serial=$(command cat "$metadata_folder/device-serial.txt")
    fi
  fi
  android_user=${requested_user:-${metadata_user:-0}}
  [[ "$android_user" =~ ^[0-9]+$ ]] || fail 'USER_ID must contain only decimal digits.'
  if [ -n "$metadata_user" ] && [ "$metadata_user" != "$android_user" ]; then
    fail 'USER_ID differs from the inventory metadata; use the original Android user.'
  fi
  type -P adb > /dev/null || fail 'adb is required on PATH.'
  ANDROID_SERIAL=$(adb get-serialno)
  [ -n "$ANDROID_SERIAL" ] && [ "$ANDROID_SERIAL" != unknown ] || fail 'Select one authorized, connected ADB device.'
  export ANDROID_SERIAL
  if [ -n "$metadata_serial" ] && [ "$metadata_serial" != "$ANDROID_SERIAL" ]; then
    fail 'The connected device differs from the inventory device.'
  fi
  printf '%s\n' "$android_user" > "$output_folder/android-user.txt"
  printf '%s\n' "$ANDROID_SERIAL" > "$output_folder/device-serial.txt"
}

# Capture read-only shell arguments $2.. into $1 plus stderr; return 1 on failure or diagnostic stderr.
function read_device() {
  local destination=$1
  shift
  if ! adb shell -n "$@" > "$destination" 2> "$destination.stderr.txt"; then
    printf 'Read failed; inspect %s and its stderr file.\n' "$destination" >&2
    return 1
  fi
  if [ -s "$destination.stderr.txt" ]; then
    printf 'Read produced diagnostics; inspect %s.stderr.txt.\n' "$destination" >&2
    return 1
  fi
}

# Normalize a pm list packages capture ($1) to a sorted package list ($2); reject unexpected output.
function normalize_packages() {
  tr -d '\r' < "$1" | awk '
    /^package:[A-Za-z_][A-Za-z0-9_.]*$/ { sub(/^package:/, ""); print; next }
    NF { print "Unexpected package-list output; inspect the raw capture." > "/dev/stderr"; exit 1 }
  ' | LC_ALL=C sort -u > "$2"
}

# Inventory the selected user into output_folder; sets final_tsv, preserving all raw evidence.
function inventory() {
  local name
  adb version > "$output_folder/adb-version.txt"
  read_device "$output_folder/users.txt" pm list users
  read_device "$output_folder/all.raw.txt" pm list packages --user "$android_user" -u
  read_device "$output_folder/system.raw.txt" pm list packages --user "$android_user" -u -s
  read_device "$output_folder/user.raw.txt" pm list packages --user "$android_user" -u -3
  read_device "$output_folder/installed.raw.txt" pm list packages --user "$android_user"
  read_device "$output_folder/enabled.raw.txt" pm list packages --user "$android_user" -e
  read_device "$output_folder/disabled.raw.txt" pm list packages --user "$android_user" -d
  for name in all system user installed enabled disabled; do
    normalize_packages "$output_folder/$name.raw.txt" "$output_folder/$name.txt"
  done
  [ -s "$output_folder/all.txt" ] || fail 'Inventory is empty; verify the Android user and raw captures.'
  awk '
    FILENAME == ARGV[1] { system_packages[$0] = 1; next }
    FILENAME == ARGV[2] { user_packages[$0] = 1; next }
    FILENAME == ARGV[3] { installed[$0] = 1; next }
    FILENAME == ARGV[4] { enabled[$0] = 1; next }
    FILENAME == ARGV[5] { disabled[$0] = 1; next }
    FILENAME == ARGV[6] {
      type = ($0 in system_packages) ? "system" : (($0 in user_packages) ? "user" : "unknown")
      rank = type == "system" ? 0 : (type == "user" ? 1 : 2)
      status = "unknown"
      if (!($0 in installed)) status = "removed"
      else if ($0 in disabled) status = "disabled"
      else if ($0 in enabled) status = "active"
      printf "%s\t%s\t%s\t%s\n", rank, $0, type, status
    }
  ' "$output_folder/system.txt" "$output_folder/user.txt" \
    "$output_folder/installed.txt" "$output_folder/enabled.txt" \
    "$output_folder/disabled.txt" "$output_folder/all.txt" \
    | LC_ALL=C sort -t $'\t' -k1,1n -k2,2 | cut -f2- > "$output_folder/apps.rows.tsv"
  final_tsv="$output_folder/apps.tsv"
  printf 'package\ttype\tstatus\n' > "$final_tsv"
  command cat "$output_folder/apps.rows.tsv" >> "$final_tsv"
  read_device "$output_folder/packages.txt" dumpsys package
  read_device "$output_folder/appops.txt" dumpsys appops
  for name in system secure global; do
    read_device "$output_folder/settings-$name.raw.txt" settings --user "$android_user" list "$name"
    tr -d '\r' < "$output_folder/settings-$name.raw.txt" | LC_ALL=C sort > "$output_folder/settings-$name.txt"
  done
  printf 'Capture commands completed; inspect raw evidence before use.\n' > "$output_folder/capture-finished.txt"
}

# Parse CSV or header-based TSV $1 into selected.txt; reject malformed/unknown rows and skip removed rows.
function select_packages() {
  local input=$1
  if [ -f "$input" ]; then
    awk -F '\t' '
      NR == 1 {
        sub(/\r$/, "")
        for (i = 1; i <= NF; i++) { if ($i == "package") p = i; if ($i == "status") s = i }
        if (!p || !s) { print "TSV requires package and status headers." > "/dev/stderr"; exit 1 }
        next
      }
      {
        sub(/\r$/, "")
        if ($s == "removed") next
        if ($s != "active" && $s != "disabled") { print "TSV has an unknown status." > "/dev/stderr"; exit 1 }
        print $p
      }
    ' "$input" > "$output_folder/selection.raw.txt"
  else
    printf '%s\n' "$input" | tr ',' '\n' | awk '{ sub(/^[[:space:]]+/, ""); sub(/[[:space:]]+$/, ""); print }' > "$output_folder/selection.raw.txt"
  fi
  awk '
    !/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/ {
      print "Invalid package selector; use package identifiers, CSV, or an existing TSV." > "/dev/stderr"; exit 1
    }
    !seen[$0]++ { print }
  ' "$output_folder/selection.raw.txt" > "$output_folder/selected.txt"
  [ -s "$output_folder/selected.txt" ] || fail 'No installed app rows selected.'
  read_device "$output_folder/installed.raw.txt" pm list packages --user "$android_user"
  normalize_packages "$output_folder/installed.raw.txt" "$output_folder/installed.txt"
  local package
  while IFS= read -r package; do
    grep -Fx "$package" "$output_folder/installed.txt" > /dev/null || fail 'A selected package is not installed for this user; no changes applied.'
  done < "$output_folder/selected.txt"
}

# Map access type $1 to shared permission/operation arrays; unknown categories exit 2 without device writes.
function access_type() {
  access=$1
  permissions=()
  operations=()
  case "$access" in
  all) operations=(RUN_IN_BACKGROUND RUN_ANY_IN_BACKGROUND) ;;
  location | location-precise) permissions=(ACCESS_COARSE_LOCATION ACCESS_FINE_LOCATION) ;;
  location-approximate) permissions=(ACCESS_COARSE_LOCATION) ;;
  location-background) permissions=(ACCESS_BACKGROUND_LOCATION) ;;
  camera) permissions=(CAMERA) ;;
  microphone) permissions=(RECORD_AUDIO) ;;
  contacts) permissions=(READ_CONTACTS WRITE_CONTACTS) ;;
  calendar) permissions=(READ_CALENDAR WRITE_CALENDAR) ;;
  phone) permissions=(READ_PHONE_STATE CALL_PHONE READ_CALL_LOG WRITE_CALL_LOG ANSWER_PHONE_CALLS) ;;
  sms) permissions=(SEND_SMS RECEIVE_SMS READ_SMS RECEIVE_MMS) ;;
  notifications) permissions=(POST_NOTIFICATIONS) ;;
  media) permissions=(READ_MEDIA_IMAGES READ_MEDIA_VIDEO READ_MEDIA_AUDIO) ;;
  nearby) permissions=(BLUETOOTH_CONNECT BLUETOOTH_SCAN NEARBY_WIFI_DEVICES) ;;
  sensors) permissions=(BODY_SENSORS) ;;
  background-running) operations=(RUN_IN_BACKGROUND) ;;
  background-processing) operations=(RUN_ANY_IN_BACKGROUND) ;;
  android.permission.*)
    [[ "$access" =~ ^android\.permission\.[A-Z_]+$ ]] || fail 'Malformed android.permission name.'
    permissions=("${access#android.permission.}")
    ;;
  *) fail 'Unknown access type; run --help for supported types.' ;;
  esac
}

# Capture package $1 in existing folder $2; return 1 on read/format failures, retaining raw multi-user evidence.
function capture_app() {
  local package=$1 folder=$2 permission operation value
  read_device "$folder/package.txt" dumpsys package "$package" || return 1
  read_device "$folder/appops.txt" cmd appops get --user "$android_user" "$package" || return 1
  tr -d '\r' < "$folder/package.txt" | awk -v target="$android_user" '
    /^[[:space:]]*User [0-9]+:/ { selected = ($2 == target ":"); runtime = 0; next }
    selected && /^[[:space:]]*runtime permissions:/ { runtime = 1; indent = match($0, /[^[:space:]]/); next }
    runtime && /[^[:space:]]/ {
      if (match($0, /[^[:space:]]/) <= indent) { runtime = 0; next }
      if ($0 ~ /: granted=(true|false)/) {
        permission = $1; sub(/:$/, "", permission)
        value = $0; sub(/^.*granted=/, "", value); sub(/[^a-z].*$/, "", value)
        printf "%s\t%s\n", permission, value
      }
    }
  ' > "$folder/runtime-permissions.tsv" || return 1
  printf 'package\taccess\tsetting\tvalue\n' > "$folder/access.tsv"
  if [ "$access" = all ]; then
    awk -F '\t' -v package="$package" '{ printf "%s\tall\t%s\t%s\n", package, $1, $2 }' "$folder/runtime-permissions.tsv" >> "$folder/access.tsv" || return 1
  else
    for permission in ${permissions[@]+"${permissions[@]}"}; do
      value=$(awk -F '\t' -v key="android.permission.$permission" '$1 == key { print $2 }' "$folder/runtime-permissions.tsv") || return 1
      if [ "$mode" = set ] && [ "$value" != true ] && [ "$value" != false ]; then
        printf 'Cannot read the requested runtime grant; inspect %s.\n' "$folder/package.txt" >&2
        return 1
      fi
      printf '%s\t%s\tandroid.permission.%s\t%s\n' "$package" "$access" "$permission" "${value:-unknown}" >> "$folder/access.tsv" || return 1
    done
  fi
  for operation in ${operations[@]+"${operations[@]}"}; do
    read_device "$folder/$operation.txt" cmd appops get --user "$android_user" "$package" "$operation" || return 1
    value=$(awk -v op="$operation" '
      $1 == "Uid" && $2 == "mode:" && $3 == op ":" { uid_mode = $4; sub(/;.*/, "", uid_mode) }
      $1 == op ":" { package_mode = $2; sub(/;.*/, "", package_mode) }
      /^Default mode:/ { default_mode = $3 }
      END {
        if (uid_mode != "") print uid_mode
        else if (package_mode != "") print package_mode
        else print default_mode
      }
    ' "$folder/$operation.txt") || return 1
    case "$value" in allow | ignore | deny | foreground | default) ;; *) return 1 ;; esac
    printf '%s\t%s\t%s\t%s\n' "$package" "$access" "$operation" "$value" >> "$folder/access.tsv"
  done
  if [ "$access" = all ] || [ "${#operations[@]}" -gt 0 ]; then
    read_device "$folder/inactive.txt" am get-inactive --user "$android_user" "$package" || return 1
    read_device "$folder/standby-bucket.txt" am get-standby-bucket --user "$android_user" "$package" || return 1
  fi
}

# Snapshot selected.txt under a private phase folder ($1); continue independent reads, return 1 if any fail.
function capture_selection() {
  local phase=$1 package folder failures=0
  printf 'package\tresult\tfolder\n' > "$phase/results.tsv" || return 1
  if [ "${#operations[@]}" -gt 0 ]; then
    read_device "$phase/deviceidle.txt" dumpsys deviceidle || return 1
  fi
  while IFS= read -r package; do
    folder=$(mktemp -d "$phase/$package-XXXXXX") || return 1
    if capture_app "$package" "$folder"; then
      printf '%s\tcaptured\t%s\n' "$package" "$folder" >> "$phase/results.tsv"
    else
      printf '%s\tfailed\t%s\n' "$package" "$folder" >> "$phase/results.tsv"
      failures=$((failures + 1))
    fi
  done < "$output_folder/selected.txt"
  [ "$failures" -eq 0 ]
}

# Apply one permission/AppOp to package $1, setting $2, action $3; log command status, not yet verified state.
function change_access() {
  local package=$1 setting=$2 change=$3 result=command-succeeded
  if [[ "$setting" == android.permission.* ]]; then
    if ! adb shell -n pm "$change" --user "$android_user" "$package" "$setting" >> "$output_folder/changes.log" 2>&1; then
      result=failed
    fi
  else
    if ! adb shell -n cmd appops set --user "$android_user" "$package" "$setting" "$change" >> "$output_folder/changes.log" 2>&1; then
      result=failed
    fi
  fi
  printf '%s\t%s\t%s\t%s\n' "$package" "$change" "$setting" "$result" >> "$final_tsv"
  [ "$result" = command-succeeded ]
}

# Compare after-capture phase $1 with action $2; append setting-level verification and return 1 on mismatches.
function verify_after() {
  local phase=$1 action=$2 package result folder setting expected actual failures=0
  printf 'package\tsetting\texpected\tactual\tresult\n' > "$output_folder/verification.tsv"
  while IFS=$'\t' read -r package result folder; do
    [ "$package" != package ] || continue
    [ "$result" = captured ] || {
      failures=$((failures + 1))
      continue
    }
    for setting in ${permissions[@]+"${permissions[@]}"} ${operations[@]+"${operations[@]}"}; do
      expected=$action
      if [ "${#permissions[@]}" -gt 0 ]; then
        setting="android.permission.$setting"
        if [ "$action" = grant ]; then expected=true; else expected=false; fi
      elif [ "$action" = default ]; then
        # Both supported background AppOps default to allow in AOSP; retain raw evidence for OEM differences.
        expected=allow
      fi
      actual=$(awk -F '\t' -v key="$setting" '$3 == key { print $4 }' "$folder/access.tsv")
      result=verified
      if [ "$actual" != "$expected" ] && ! { [ "$action" = default ] && [ "$actual" = default ]; }; then
        result=failed
        failures=$((failures + 1))
      fi
      printf '%s\t%s\t%s\t%s\t%s\n' "$package" "$setting" "$expected" "${actual:-unknown}" "$result" >> "$output_folder/verification.tsv"
    done
    if [ "$access" = location-approximate ] && [ "$action" = grant ]; then
      actual=$(awk -F '\t' '$1 == "android.permission.ACCESS_FINE_LOCATION" { print $2 }' "$folder/runtime-permissions.tsv")
      result=verified
      if [ "$actual" != false ]; then
        result=failed
        failures=$((failures + 1))
      fi
      printf '%s\tandroid.permission.ACCESS_FINE_LOCATION\tfalse\t%s\t%s\n' "$package" "${actual:-unknown}" "$result" >> "$output_folder/verification.tsv"
    fi
  done < "$phase/results.tsv"
  [ "$failures" -eq 0 ]
}

# Preview/apply validated action $1; all before-state reads must succeed before writes. Failed batches exit nonzero.
function set_access() {
  local action=$1 apply=$2 package setting before after failures=0
  [ "$access" != all ] || fail 'set all is not supported; choose a specific access type.'
  if [ "${#operations[@]}" -gt 0 ]; then
    case "$action" in allow | ignore | default) ;; *) fail 'Background actions must be allow, ignore, or default.' ;; esac
  else
    case "$action" in grant | revoke) ;; *) fail 'Permission actions must be grant or revoke.' ;; esac
  fi
  printf 'Action: %s; access: %s; Android user: %s\n' "$action" "$access" "$android_user" >&2
  if [ "$apply" -eq 0 ]; then
    printf 'Preview only; no device changes. Selected packages:\n' >&2
    command cat "$output_folder/selected.txt" >&2
    printf 'Rerun with --apply only after reviewing the category and package list.\n' >&2
    final_tsv="$output_folder/preview.tsv"
    printf 'package\taction\taccess\n' > "$final_tsv"
    awk -v action="$action" -v access="$access" '{ printf "%s\t%s\t%s\n", $0, action, access }' "$output_folder/selected.txt" >> "$final_tsv"
    return
  fi
  before=$(mktemp -d "$output_folder/before-XXXXXX")
  capture_selection "$before" || fail 'Before-state capture failed; no permission changes applied.'
  final_tsv="$output_folder/changes.tsv"
  printf 'package\taction\tsetting\tresult\n' > "$final_tsv"
  while IFS= read -r package; do
    # Recheck installed state at the write boundary; selections can become stale during capture.
    read_device "$output_folder/recheck.raw.txt" pm list packages --user "$android_user"
    normalize_packages "$output_folder/recheck.raw.txt" "$output_folder/recheck.txt"
    grep -Fx "$package" "$output_folder/recheck.txt" > /dev/null || fail 'A package disappeared before mutation; inspect partial changes.'
    if [ "$access" = location-approximate ] && [ "$action" = grant ]; then
      change_access "$package" android.permission.ACCESS_FINE_LOCATION revoke || {
        failures=$((failures + 1))
        continue
      }
    fi
    for setting in ${permissions[@]+"${permissions[@]}"}; do
      change_access "$package" "android.permission.$setting" "$action" || failures=$((failures + 1))
    done
    for setting in ${operations[@]+"${operations[@]}"}; do
      change_access "$package" "$setting" "$action" || failures=$((failures + 1))
    done
  done < "$output_folder/selected.txt"
  after=$(mktemp -d "$output_folder/after-XXXXXX")
  capture_selection "$after" || failures=$((failures + 1))
  verify_after "$after" "$action" || failures=$((failures + 1))
  printf 'Before-state: %s\nAfter-state: %s\n' "$before" "$after" >&2
  [ "$failures" -eq 0 ] || fail 'Some changes or verification failed; inspect changes.tsv, verification.tsv, and raw evidence.'
}

if [ "$#" -eq 0 ] || [ "${1:-}" = --help ] || [ "${1:-}" = -h ]; then
  usage
  exit 0
fi
mode=$1
shift
case "$mode" in
inventory)
  [ "$#" -le 1 ] || fail 'Usage: inventory [USER_ID]'
  new_folder backup
  connect_device "" "${1:-}"
  inventory
  ;;
get)
  [ "$#" -ge 2 ] && [ "$#" -le 3 ] || fail 'Usage: get TYPE PACKAGE_CSV_OR_TSV [USER_ID]'
  access_type "$1"
  new_folder permissions
  connect_device "$2" "${3:-}"
  select_packages "$2"
  final_tsv="$output_folder/results.tsv"
  capture_selection "$output_folder"
  ;;
set)
  [ "$#" -ge 3 ] && [ "$#" -le 5 ] || fail 'Usage: set ACTION TYPE PACKAGE_CSV_OR_TSV [USER_ID] [--apply]'
  action=$1
  access_type "$2"
  input=$3
  shift 3
  requested_user=""
  apply=0
  if [ "$#" -gt 0 ] && [ "$1" != --apply ]; then
    requested_user=$1
    shift
  fi
  if [ "$#" -gt 0 ] && [ "$1" = --apply ]; then
    apply=1
    shift
  fi
  [ "$#" -eq 0 ] || fail 'Unexpected set argument.'
  new_folder changes
  connect_device "$input" "$requested_user"
  select_packages "$input"
  set_access "$action" "$apply"
  ;;
*) fail 'Unknown operation; run --help.' ;;
esac
printf '%s\n' "$final_tsv"
