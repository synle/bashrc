#!/usr/bin/env bash

removeApp air.com.vudu.air.DownloaderTablet
removeApp air.ITVMobilePlayer
removeApp com.amazon.music.tv
removeApp com.google.android.play.games
removeApp com.google.android.videos
removeApp com.google.android.videos
removeApp com.google.android.youtube.tv
removeApp com.google.android.youtube.tvkids
removeApp com.google.android.youtube.tvmusic
removeApp com.imdbtv.livingroom
removeApp com.nvidia.bbciplayer
removeApp com.nvidia.bbciplayer.launch
removeApp com.nvidia.bbciplayer.launchsport
removeApp com.nvidia.benchmarkblocker
removeApp com.pandora.android.atv
removeApp com.seraphic.browser
removeApp com.zattoo.player

function removeApp() {
  # Print action message without altering positional parameters
  (
    set -- "> Remove:" "$@"
    IFS=' '
    printf '%s\n' "$*"
  )
  # Check if adb is installed and a device is authorized/connected
  if command -v adb >/dev/null 2>&1 && adb get-state 1>/dev/null 2>&1; then
    adb shell pm uninstall "$@" || adb shell pm uninstall -k --user 0 "$@" || adb shell pm uninstall -k --user 10 "$@"
  elif command -v pm >/dev/null 2>&1; then
    pm uninstall "$@" || pm uninstall -k --user 0 "$@" || pm uninstall -k --user 10 "$@"
  else
    echo "Error: Neither a connected adb session nor local pm command is available." >&2
    return 1
  fi
}
function restoreApp() {
  # Print action message without altering positional parameters
  (
    set -- "> Restore:" "$@"
    IFS=' '
    printf '%s\n' "$*"
  )
  # Check if adb is installed and a device is authorized/connected
  if command -v adb >/dev/null 2>&1 && adb get-state 1>/dev/null 2>&1; then
    adb shell cmd package install-existing "$@"
  elif command -v cmd >/dev/null 2>&1; then
    cmd package install-existing "$@"
  else
    echo "Error: Neither a connected adb session nor local cmd command is available." >&2
    return 1
  fi
}
function changeSetting() {
  # Print action message without altering positional parameters
  (
    set -- "settings put" "$@"
    IFS=' '
    printf '%s\n' "$*"
  )
  # Check if adb is installed and a device is authorized/connected
  if command -v adb >/dev/null 2>&1 && adb get-state 1>/dev/null 2>&1; then
    adb shell settings put "$@"
  elif command -v settings >/dev/null 2>&1; then
    settings put "$@"
  else
    echo "Error: Neither a connected adb session nor local settings command is available." >&2
    return 1
  fi
}
