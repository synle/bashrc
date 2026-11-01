#!/usr/bin/env bash
function _removeApp() {
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
function __restoreApp() {
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
function _changeSetting() {
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

function _install_latest_github_apk() {
  repo="$1"
  asset_pattern="$2"
  app_name="$3"
  release_api="https://api.github.com/repos/$repo/releases/latest"
  apk_url="$(
    curl -fsSL "$release_api" \
      | sed -n 's/.*"browser_download_url": "\([^\"]*\.apk\)".*/\1/p' \
      | command grep -m 1 -F "$asset_pattern"
  )"

  if [ -z "$apk_url" ]; then
    printf '%s\n' ">>> $app_name > APK not found in latest $repo release" >&2
    return 1
  fi

  temp_folder="$(mktemp -d "${TMPDIR:-/tmp}/firetv-apk.XXXXXX")" || return 1
  apk_file="$temp_folder/$app_name.apk"
  printf '%s\n' ">>> $app_name > Downloading $apk_url"
  if ! curl -fsSL "$apk_url" -o "$apk_file"; then
    rm -rf "$temp_folder"
    return 1
  fi

  printf '%s\n' ">>> $app_name > Installing"
  adb install -r "$apk_file"
  install_status=$?
  rm -rf "$temp_folder"
  if [ "$install_status" = "0" ]; then
    printf '%s\n' ">>> $app_name > Installed > Success"
  else
    printf '%s\n' ">>> $app_name > Installed > Error" >&2
  fi
  return "$install_status"
}

# --- Common Configs ---
# animation speed
_changeSetting global window_animation_scale 0
_changeSetting global transition_animation_scale 0
_changeSetting global animator_duration_scale 0

# private dns
_changeSetting global private_dns_mode hostname
_changeSetting global private_dns_specifier security.cloudflare-dns.com # _changeSetting global private_dns_specifier one.one.one.one

# enable auto time and timezone
_changeSetting global auto_time 1
_changeSetting global auto_time_zone 1

######################################################################################
###### clean up bloats
######################################################################################
######################################################################################
_removeApp air.com.vudu.air.DownloaderTablet
_removeApp android.autoinstalls.config.sony.bravia
_removeApp com.amazon.aiv.eu
_removeApp com.android.cts.ctsshim
_removeApp com.android.cts.priv.ctsshim
_removeApp com.android.htmlviewer
_removeApp com.android.printspooler
_removeApp com.android.providers.calendar
_removeApp com.android.providers.contacts
_removeApp com.android.providers.contactsSuccess
_removeApp com.android.providers.userdictionary
_removeApp com.google.android.apps.tv.dreamx
_removeApp com.google.android.feedback
_removeApp com.google.android.inputmethod.japanese
_removeApp com.google.android.katniss
_removeApp com.google.android.leanbacklauncher                 # be careful with this (TV Launcher) - do this after button mapper and launcher
_removeApp com.google.android.leanbacklauncher.recommendations # be careful with this (TV Launcher) - do this after button mapper and launcher
_removeApp com.google.android.marvin.talkback
_removeApp com.google.android.music
_removeApp com.google.android.musicSuccess
_removeApp com.google.android.partnersetup
_removeApp com.google.android.play.games
_removeApp com.google.android.speech.pumpkin
_removeApp com.google.android.syncadapters.calendar
_removeApp com.google.android.syncadapters.contacts
_removeApp com.google.android.tts
_removeApp com.google.android.tv.bugreportsender
_removeApp com.google.android.tvrecommendations
_removeApp com.google.android.tvtutorials
_removeApp com.google.android.videos
_removeApp com.google.android.youtube.tv
_removeApp com.google.android.youtube.tvkids
_removeApp com.google.android.youtube.tvmusic
_removeApp com.google.android.youtube.tvmusicSuccess
_removeApp com.google.android.youtube.tvSuccess
_removeApp com.opera.sdk.example
_removeApp com.pandora.android.atv
_removeApp com.seraphic.browser
_removeApp com.sony.dtv.youview
_removeApp com.youview.tv.servicehost
_removeApp tv.samba.ssm

# --- Other Bloats ----
# Common Android TV
_removeApp com.jamdeo.tv.mediacenter
_removeApp com.google.android.backdrop
_removeApp com.amazon.amazonvideo.livingroom
_removeApp com.android.dreams.basic
_removeApp com.google.android.apps.youtube.kids
_removeApp com.google.android.apps.youtube.music
_removeApp com.google.android.apps.youtube.unplugged
_removeApp com.google.android.videos
_removeApp com.google.android.youtube
_removeApp com.android.printspooler
_removeApp com.pandora.android.atv
# Group 1: telemetry, ACR and tracking
_removeApp android.autoinstalls.config.hisense.xiaoyushan   # silent partner-app auto-installs
_removeApp com.google.android.feedback                      # crash/feedback uploader
_removeApp com.google.android.partnersetup                  # partner referral tracking
_removeApp com.google.android.tv.bugreportsender
_removeApp com.hisense.evservice                            # codePath /system/app/acr: automatic content recognition
_removeApp com.hisense.service.message                      # /system/app/HiMsgService: Hisense push messages
# Group 2: promo content, retail and commercial modes, Hisense preloads
_removeApp com.google.android.tvrecommendations             # recommendation rows
_removeApp com.mstar.android.tv.disclaimercustomization     # /system/product/app/VendorDisclaimer: store disclaimer
_removeApp com.hisense.tv.b2b                               # /system/app/HisenseB2B: hotel/commercial mode
_removeApp net.vidaatv.hisense.android.tv                   # "Hisense Channels", VIDAA free ad-supported channels
_removeApp com.hisense.alexa                                # /system/app/HiAlexa
# Hisense ULED 4K Premium 75U6G (xiaoyushan)
# cautious
# _removeApp com.hisense.favkey
# _removeApp com.hisense.service.message
# _removeApp com.hisense.tv.protector
# experimental and cautious!
# _removeApp com.mstar.netflixobserver # can be replaced with button mapper
# _removeApp com.hisense.storemode
# _removeApp com.hisense.hitv.hicloud.account
# _removeApp com.jamdeo.tv.mediacenterapplication


# --- Install apps ---
_install_latest_github_apk "humblemuzzu/dumbtv" "dumbtv-home.apk" "DumbTV" || return 1

# remove the old home launcher
adb shell pm disable-user --user 0 com.google.android.tvlauncher
