#!/usr/bin/env bash


removeApp cci.usage
removeApp com.amazon.mShop.android.shopping
removeApp com.android.chrome
removeApp com.android.dialer
removeApp com.android.inputmethod.latin
removeApp com.att.iqi
removeApp com.cricketwireless.minus
removeApp com.cricketwireless.thescoop
removeApp com.google.android.apps.googleassistant
removeApp com.google.android.apps.subscriptions.red
removeApp com.google.android.apps.tachyon
removeApp com.google.android.apps.wallpaper
removeApp com.google.android.apps.youtube.music
removeApp com.google.android.contacts
removeApp com.google.android.videos
removeApp com.google.android.youtube
removeApp com.handmark.expressweather
removeApp com.motorola.actions
removeApp com.motorola.aiservices
removeApp com.motorola.android.launcher.overlay.amx
removeApp com.motorola.android.launcher.overlay.koodo
removeApp com.motorola.android.launcher.overlay.retail
removeApp com.motorola.android.launcher.overlay.telus
removeApp com.motorola.android.messaging.overlay.att.ambs
removeApp com.motorola.brapps
removeApp com.motorola.carrierconfig
removeApp com.motorola.ccc.notification
removeApp com.motorola.contacts.preloadcontacts.overlay.vzw
removeApp com.motorola.easyprefix
removeApp com.motorola.extensions.tracfone
removeApp com.motorola.fmplayer
removeApp com.motorola.gamemode
removeApp com.motorola.genie
removeApp com.motorola.help
removeApp com.motorola.iqimotmetrics
removeApp com.motorola.launcherconfig.overlay.amxla
removeApp com.motorola.launcherconfig.overlay.tracfone
removeApp com.motorola.livewallpaper3
removeApp com.motorola.messaging
removeApp com.motorola.moto
removeApp com.motorola.motodisplay
removeApp com.motorola.motofpstouch
removeApp com.motorola.motosignature.app
removeApp com.motorola.motosignature2.app
removeApp com.motorola.mototour
removeApp com.motorola.omadm.att
removeApp com.motorola.omadm.usc
removeApp com.motorola.omadm.vzw
removeApp com.motorola.settings
removeApp com.motorola.setup.overlay.amx
removeApp com.motorola.setup.overlay.pai
removeApp com.motorola.setup.overlay.tracfone
removeApp com.motorola.spectrum.setup.extensions
removeApp com.motorola.stylus
removeApp com.motorola.timeweatherwidget
removeApp com.motorola.ts43.serviceconfig
removeApp com.roaming.android.gsimbase
removeApp com.roaming.android.gsimcontentprovider
removeApp com.tracfone.generic.mysites
removeApp com.tracfone.preload.accountservices
removeApp com.uscc.ecid

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
