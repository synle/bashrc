#!/usr/bin/env bash

# Fire TV Stick - debloat and optimize.
# Shared functions and app lists. Not run directly - use with firetv.debloat.sh or firetv.restore.sh.
#
#   Removes 56 apps total:
#   Shopping & Store: windowshop, alexashopping, shoptv.client
#   Media Clutter: avod, bueller.photos, photos.importer, bueller.music, mp3, goodreads.kindle,
#                  kindle.cms, kindle.devicecontrols, ods.kindleconnect, logan
#   Services & Telemetry: ags.app, alta.h2clientservice, android.service.networkmonitor,
#                          connectivitydiag, device.crashmanager, device.messaging,
#                          messaging.sdk.internal.library, messaging.sdk.library, device.sync,
#                          device.sync.sdk.internal, firebat, ftv.screensaver, hedwig, jackson19,
#                          kso.blackbird, providers, providers.contentsupport, recess,
#                          securitysyncclient, sharingservice.android.client.proxy, sync.service,
#                          tahoe, tmm.tutorial, tv.csapp, tv.forcedotaupdater.v2, tv.fw.metrics,
#                          tv.legal.notices, tv.livetv, tv.nimh, tv.releasenotes, tv.support, webview
#   Alexa & Voice: bueller.notification, device.software.ota, device.software.ota.override,
  #                   imbd.tv.android.app, parentalcontrols, kindle.freetime
#   Non-Amazon: ivona.orchestrator, ivona.tts.oem, svox.pico, documentsui, wallpaperbackup
#   Disabled (not removed): device.software.ota, pai, zico.app, ism.recommendations,
#                            kindle.unifiedreader
#   Settings: animations off, telemetry off, Wi-Fi/BT scanning off, device provisioned
#
# Debloat:
#   curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/firetv.sh https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/firetv.debloat.sh | bash
#
# Restore:
#   curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/firetv.sh https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/firetv.restore.sh | bash

SETTINGS_APPLIED=""

# Run an Android command through the host's connected ADB device.
function adb_shell() {
  adb shell "$@"
}

function put_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  echo ">>> put_setting $@"
  adb_shell settings put "$@" >/dev/null 2>&1
}

function reset_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  echo ">>> reset_setting $@"
  adb_shell settings delete "$@" >/dev/null 2>&1
}

function reset_all_settings() {
  echo "$SETTINGS_APPLIED" | while read entry; do
    [ -z "$entry" ] && continue
    reset_setting $entry
  done
  echo ">>> all settings reset to defaults"
}

function disable_app() {
  ok=0
  adb_shell pm disable-user --user 0 "$@" >/dev/null 2>&1 && ok=1
  adb_shell pm disable-user -k --user 0 "$@" >/dev/null 2>&1 && ok=1
  if [ "$ok" = "1" ]; then
    echo ">>> $@ > Disabled > Success"
  else
    echo ">>> $@ > Disabled > Error"
  fi
}

function remove_app() {
  ok=0
  disable_app $@ >/dev/null 2>&1 && ok=1
  adb_shell pm uninstall "$@" >/dev/null 2>&1 && ok=1
  adb_shell pm uninstall -k --user 0 "$@" >/dev/null 2>&1 && ok=1
  adb_shell pm uninstall -k --user 10 "$@" >/dev/null 2>&1 && ok=1
  if [ "$ok" = "1" ]; then
    echo ">>> $@ > Removed > Success"
  else
    echo ">>> $@ > Removed > Error"
  fi
}

function restore_app() {
  ok=0
  adb_shell cmd package install-existing "$@" >/dev/null 2>&1 && ok=1
  adb_shell pm enable "$@" >/dev/null 2>&1 && ok=1
  if [ "$ok" = "1" ]; then
    echo ">>> $@ > Restored > Success"
  else
    echo ">>> $@ > Restored > Error"
  fi
}

function parse_app_name() {
  echo "$1" | sed 's/#.*//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//'
}

function remove_app_collection() {
  echo "$1" | while read line; do
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    app=$(parse_app_name "$line")
    [ -z "$app" ] && continue
    remove_app "$app"
  done
}

function restore_app_collection() {
  echo "$1" | while read line; do
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    app=$(parse_app_name "$line")
    [ -z "$app" ] && continue
    restore_app "$app"
  done
}


################################################################################
# --- Settings ---
################################################################################

debloat_settings() {
  # ---- Animations Off ----
  put_setting global window_animation_scale 0.0       # window open/close off. instant UI.
  put_setting global transition_animation_scale 0.0   # screen transitions off. instant UI.
  put_setting global animator_duration_scale 0.0      # in-app animations off. instant UI.

  # ---- Telemetry Off ----
  put_setting secure collection_info_enabled 0        # disable system info collection. no side effects.
  put_setting secure privacy_metrics_collection_enabled 0 # disable privacy metrics. no side effects.
  put_setting global analytics_enabled 0              # disable system analytics. no side effects.
  put_setting global usage_reporting_enabled 0        # disable usage reporting. no side effects.

  # ---- Connectivity ----
  put_setting global wifi_scan_always_enabled 0       # stop Wi-Fi scan when Wi-Fi is off. no side effects.
  put_setting global ble_scan_always_enabled 0        # stop Bluetooth scan when BT is off. no side effects.

  # ---- Privacy ----
  put_setting global device_provisioned 1             # mark device as provisioned. skip setup wizard.
  put_setting global send_action_app_error 0          # disable crash reports to Google. no side effects.
  put_setting global ad_id_opt_out 1                  # opt out of personalized ad tracking. no side effects.

  # ---- Other Settings ----
  # Make sure voice control is enabled
  put_setting secure voice_disabled 0
  put_setting secure alexa_wake_word_disabled 0

  # TODO: more settings
  # privacy settings
  # amz_limit_ad_tracking                          1
  # limit_ad_tracking                              1
  # non_amz_limit_ad_tracking                      1
  # advertisingIdApp:interestBasedAds:value        0
  # USAGE_METRICS_UPLOAD_ENABLED                   0
  # usage_metrics_marketing_enabled                0
  # settingsApp:appUsageData:value                 0
  # settingsApp:deviceUsageData:value              0
  # heads_up_notifications_enabled                 0
  # com.amazon.tv.settings.featured_item_video_enabled 0
  # com.amazon.tv.settings.featured_item_video_volume 0.0
}


################################################################################
# --- App Lists ---
################################################################################

# --- Safe to remove - Amazon bloatware and telemetry ---
FIRE_TV_DEBLOAT_SAFE="
# --- Amazon > Shopping & Store ---
com.amazon.windowshop                               # Amazon Shopping - lose Amazon store browsing
com.amazon.alexashopping                            # Alexa Shopping - lose voice shopping commands
com.amazon.shoptv.client                            # Shop TV - lose on-device Amazon shopping channel

# --- Amazon > Media Clutter ---
com.amazon.avod                                     # Freevee / Prime Video ads - lose ad-supported streaming
com.amazon.bueller.photos                           # Amazon Photos - lose photo backup/storage
com.amazon.photos.importer                          # Amazon Photos Importer - lose photo import service
com.amazon.bueller.music                            # Amazon Music - lose music streaming
com.amazon.mp3                                      # Amazon Music Core - lose music playback service
com.goodreads.kindle                                # Goodreads - lose book reviews/recommendations
com.amazon.kindle.cms                               # Kindle CMS - lose Kindle content management
com.amazon.kindle.devicecontrols                    # Kindle Controls - lose Kindle device control integration
com.amazon.ods.kindleconnect                        # Kindle Connect - lose Kindle cross-device sync
com.amazon.logan                                    # IMDb - lose movie/TV database app

# --- Amazon > Services & Telemetry ---
com.amazon.ags.app                                  # Amazon Games - lose game achievements/leaderboards
com.amazon.alta.h2clientservice                     # Amazon Alta - lose background telemetry client
com.amazon.android.service.networkmonitor           # Network Monitor - lose Amazon network monitoring
com.amazon.connectivitydiag                         # Connectivity Diagnostics - lose Amazon connectivity checker
com.amazon.device.crashmanager                      # Crash Manager - lose Amazon crash reporting
com.amazon.device.messaging                         # Amazon Messaging - lose Amazon push notifications
com.amazon.device.messaging.sdk.internal.library    # Messaging SDK Internal - lose messaging SDK internals
com.amazon.device.messaging.sdk.library             # Messaging SDK - lose messaging SDK
com.amazon.device.sync                              # Device Sync - lose Amazon device sync
com.amazon.device.sync.sdk.internal                 # Sync SDK Internal - lose sync SDK internals
com.amazon.firebat                                  # Firebat - lose Amazon performance telemetry
com.amazon.ftv.screensaver                          # Screensaver - lose Amazon screensaver/art channel
com.amazon.hedwig                                   # Hedwig - lose Amazon notification service
com.amazon.jackson19                                # Jackson JSON - lose Amazon internal JSON library
com.amazon.kso.blackbird                            # Blackbird - lose Amazon analytics/tracking
com.amazon.providers                                # Amazon Providers - lose Amazon content providers
com.amazon.providers.contentsupport                 # Content Support - lose Amazon content support
com.amazon.recess                                   # Recess - lose Amazon background scheduler
com.amazon.securitysyncclient                       # Security Sync - lose Amazon security sync service
com.amazon.sharingservice.android.client.proxy      # Sharing Proxy - lose Amazon sharing service
com.amazon.sync.service                             # Sync Service - lose Amazon background sync
com.amazon.tahoe                                    # Tahoe - lose Amazon device management
com.amazon.tmm.tutorial                             # Tutorial - lose Amazon tutorial overlays
com.amazon.tv.csapp                                 # TV CS App - lose Amazon customer service on device
com.amazon.tv.forcedotaupdater.v2                   # Force OTA Updater - lose Amazon forced update service
com.amazon.tv.fw.metrics                            # TV Metrics - lose Amazon TV firmware telemetry
com.amazon.tv.legal.notices                         # Legal Notices - lose Amazon legal notices app
com.amazon.tv.livetv                                # Live TV - lose Amazon live TV integration
com.amazon.tv.nimh                                  # NIMH - lose Amazon TV background service
com.amazon.tv.releasenotes                          # Release Notes - lose Amazon release notes app
com.amazon.tv.support                               # TV Support - lose Amazon on-device support
com.amazon.webview                                  # Amazon WebView - lose Amazon custom WebView

# --- Amazon > Alexa & Voice ---
com.amazon.bueller.notification                     # Alexa Notifications - lose Alexa notification cards
com.amazon.device.software.ota                      # OTA Updater - lose Amazon system updates
com.amazon.device.software.ota.override             # OTA Override - lose Amazon update override
com.amazon.imbd.tv.android.app                      # IMDb TV - lose IMDb ad-supported streaming
com.amazon.parentalcontrols                         # Parental Controls - lose Amazon parental controls
com.amazon.kindle.freetime                          # Kindle FreeTime - lose Amazon Kids mode

# --- Non-Amazon > Cleanup ---
com.amazon.ivona.orchestrator                       # IVONA TTS Orchestrator - lose Amazon TTS orchestration
com.amazon.ivona.tts.oem                            # IVONA TTS - lose Amazon text-to-speech engine
com.svox.pico                                       # Pico TTS - lose Android built-in TTS engine
com.android.documentsui                             # Documents UI - lose file manager (side-load via other means)
com.android.wallpaperbackup                         # Wallpaper Backup - lose wallpaper backup service

# --- Ads and Telemetry ---
com.amazon.bueller.music
com.amazon.bueller.photos
com.amazon.ceviche
com.amazon.cloud9
com.amazon.connectivitydiag
com.amazon.csm.htmlruntime
com.amazon.dp.logger
com.amazon.dummy.alarmclock
com.amazon.dummy.calendar
com.amazon.dummy.contacts
com.amazon.dummy.gallery
com.amazon.dummy.music
com.amazon.dummy.settings
com.amazon.firebat
com.amazon.ftv.screensaver
com.amazon.gamehub
com.amazon.hedwig
com.amazon.hybridadidservice
com.amazon.katoch
com.amazon.logan
com.amazon.minitv.android.app
com.amazon.perfcollection
com.amazon.privacypassservice
com.amazon.shoptv.client
com.amazon.sneakpeek
com.amazon.spiderpork
com.amazon.spotify.mediabrowserservice
com.amazon.storm.lightning.tutorial
com.amazon.systemnotices
com.amazon.tahoe
com.amazon.tigris
com.amazon.tmm.tutorial
com.amazon.tv.acr
com.amazon.tv.developer.dataservice
com.amazon.tv.easyupgrade
com.amazon.tv.forcedotaupdater.v2
com.amazon.tv.fw.metrics
com.amazon.tv.notificationcenter
com.amazon.tv.ottssocompanionapp
com.amazon.tv.releasenotes
com.amazon.tv.support
com.amazon.tv.website_launcher
com.amazon.uxnotification
com.amazon.wha.mediabrowserservice
com.amazon.wirelessmetrics.service
com.android.bips
com.android.printspooler
com.android.traceur
"


################################################################################
# --- Restore ---
################################################################################

function restore_all() {
  restore_app_collection "$FIRE_TV_DEBLOAT_SAFE"
  reset_all_settings
  echo ">>> All Fire TV apps and settings restored"
}

################################################################################
# --- Bootstrap and Install apps ---
################################################################################

# Download and install one APK from a repository's latest GitHub release.
function install_latest_github_apk() {
  repo="$1"
  asset_pattern="$2"
  app_name="$3"
  release_api="https://api.github.com/repos/$repo/releases/latest"
  apk_url="$(
    curl -fsSL "$release_api" |
      sed -n 's/.*"browser_download_url": "\([^\"]*\.apk\)".*/\1/p' |
      command grep -m 1 -F "$asset_pattern"
  )"

  if [ -z "$apk_url" ]; then
    echo ">>> $app_name > APK not found in latest $repo release" >&2
    return 1
  fi

  temp_folder="$(mktemp -d "${TMPDIR:-/tmp}/firetv-apk.XXXXXX")" || return 1
  apk_file="$temp_folder/$app_name.apk"
  echo ">>> $app_name > Downloading $apk_url"
  if ! curl -fsSL "$apk_url" -o "$apk_file"; then
    rm -rf "$temp_folder"
    return 1
  fi

  echo ">>> $app_name > Installing"
  adb install -r "$apk_file"
  install_status=$?
  rm -rf "$temp_folder"
  if [ "$install_status" = "0" ]; then
    echo ">>> $app_name > Installed > Success"
  else
    echo ">>> $app_name > Installed > Error" >&2
  fi
  return "$install_status"
}

function install_apps() {
  if ! adb get-state >/dev/null 2>&1; then
    echo ">>> No connected ADB device" >&2
    return 1
  fi

  # Re-enable Amazon services required for Fire TV voice control.
  adb_shell pm enable com.amazon.vizzini.ftvcds
  adb_shell pm enable com.amazon.ale
  adb_shell pm enable com.amazon.aca
  adb_shell settings put secure voice_disabled 0
  adb_shell settings put secure alexa_wake_word_disabled 0

  install_latest_github_apk "yuliskov/SmartTube" "_universal.apk" "SmartTube" || return 1
  install_latest_github_apk "humblemuzzu/dumbtv" "dumbtv-home.apk" "DumbTV" || return 1
  install_latest_github_apk "IngoZenz/personaldnsfilter" "DNSFilter_" "personalDNSFilter" || return 1
}

# TODO: follow up with https://github.com/humblemuzzu/dumbtv
# data/blocklists/extra-hosts.txt - Fetches HaGeZi's Amazon-focused tracking blocklist and combines it with local extra domains - Pushes the resulting blocklist.txt and custom dnsfilter.conf configuration file to the app's internal storage directory on the device using adb push. Starts the personalDNSfilter service, which utilizes Android's VpnService interface locally on the device to intercept and filter DNS requests on port 53/UDP locally without requiring root access.
