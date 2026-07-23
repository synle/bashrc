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

function put_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  echo ">>> put_setting $@"
  settings put $@ >/dev/null 2>&1
}

function reset_setting() {
  SETTINGS_APPLIED="$SETTINGS_APPLIED$1 $2
"
  echo ">>> reset_setting $@"
  settings delete $@ >/dev/null 2>&1
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
  pm disable-user --user 0 $@ >/dev/null 2>&1 && ok=1
  pm disable-user -k --user 0 $@ >/dev/null 2>&1 && ok=1
  if [ "$ok" = "1" ]; then
    echo ">>> $@ > Disabled > Success"
  else
    echo ">>> $@ > Disabled > Error"
  fi
}

function remove_app() {
  ok=0
  disable_app $@ >/dev/null 2>&1 && ok=1
  pm uninstall $@ >/dev/null 2>&1 && ok=1
  pm uninstall -k --user 0 $@ >/dev/null 2>&1 && ok=1
  pm uninstall -k --user 10 $@ >/dev/null 2>&1 && ok=1
  if [ "$ok" = "1" ]; then
    echo ">>> $@ > Removed > Success"
  else
    echo ">>> $@ > Removed > Error"
  fi
}

function restore_app() {
  ok=0
  cmd package install-existing $@ >/dev/null 2>&1 && ok=1
  pm enable $@ >/dev/null 2>&1 && ok=1
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
# ---- Settings ----
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
}


################################################################################
# ---- App Lists ----
################################################################################

# ---- Safe to remove - Amazon bloatware and telemetry ----
FIRE_TV_DEBLOAT_SAFE="
# ---- Amazon > Shopping & Store ----
com.amazon.windowshop                               # Amazon Shopping - lose Amazon store browsing
com.amazon.alexashopping                            # Alexa Shopping - lose voice shopping commands
com.amazon.shoptv.client                            # Shop TV - lose on-device Amazon shopping channel

# ---- Amazon > Media Clutter ----
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

# ---- Amazon > Services & Telemetry ----
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

# ---- Amazon > Alexa & Voice ----
com.amazon.bueller.notification                     # Alexa Notifications - lose Alexa notification cards
com.amazon.device.software.ota                      # OTA Updater - lose Amazon system updates
com.amazon.device.software.ota.override             # OTA Override - lose Amazon update override
com.amazon.imbd.tv.android.app                      # IMDb TV - lose IMDb ad-supported streaming
com.amazon.parentalcontrols                         # Parental Controls - lose Amazon parental controls
com.amazon.kindle.freetime                          # Kindle FreeTime - lose Amazon Kids mode

# ---- Non-Amazon > Cleanup ----
com.amazon.ivona.orchestrator                       # IVONA TTS Orchestrator - lose Amazon TTS orchestration
com.amazon.ivona.tts.oem                            # IVONA TTS - lose Amazon text-to-speech engine
com.svox.pico                                       # Pico TTS - lose Android built-in TTS engine
com.android.documentsui                             # Documents UI - lose file manager (side-load via other means)
com.android.wallpaperbackup                         # Wallpaper Backup - lose wallpaper backup service
"


################################################################################
# ---- Restore ----
################################################################################

function restore_all() {
  restore_app_collection "$FIRE_TV_DEBLOAT_SAFE"
  reset_all_settings
  echo ">>> All Fire TV apps and settings restored"
}
