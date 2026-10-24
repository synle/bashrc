#!/usr/bin/env bash
# Capture Android inventory, then use its TSV to snapshot access for installed/disabled apps.
# Run from the repository root on the host computer, not inside adb shell:
#   bash docs/android/scripts/backup-all.sh --help
#   bash docs/android/scripts/backup-all.sh 0
# Choose the intended Android user and set ANDROID_SERIAL when multiple devices are connected.
# Keep android-access.sh beside this script. Both generated TSV paths print at completion.
set -euo pipefail
umask 077

if [ "${1:-}" = --help ] || [ "${1:-}" = -h ]; then
  printf '%s\n' 'backup-all.sh: inventory plus bulk permission/background snapshots' \
    'Usage (repository root): bash docs/android/scripts/backup-all.sh [USER_ID]' \
    'Run from host Bash with one authorized ADB device selected; defaults to user 0.'
  exit 0
fi
[ "$#" -le 1 ] || {
  printf 'Usage: backup-all.sh [USER_ID]\n' >&2
  exit 2
}
android_user=${1:-0}
[[ "$android_user" =~ ^[0-9]+$ ]] || {
  printf 'USER_ID must contain only decimal digits.\n' >&2
  exit 2
}
scripts_folder=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
inventory_tsv=""

# Report retained inventory on success/failure; no arguments, no device changes, preserves exit status.
function finish() {
  local result=$?
  if [ -n "$inventory_tsv" ]; then
    printf 'Inventory TSV: %s\n' "$inventory_tsv" >&2
  fi
  if [ "$result" -ne 0 ]; then
    printf 'Bundle incomplete; retained snapshots are not a complete backup.\n' >&2
  fi
}
trap finish EXIT

printf 'Starting inventory and access backup. No device changes.\n' >&2
inventory_tsv=$(bash "$scripts_folder/android-access.sh" inventory "$android_user")
access_tsv=$(bash "$scripts_folder/android-access.sh" get all "$inventory_tsv" "$android_user")
printf 'Access results TSV: %s\nBundle finished.\n' "$access_tsv" >&2
printf '%s\n%s\n' "$inventory_tsv" "$access_tsv"
