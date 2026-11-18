#!/usr/bin/env bash

# Fire TV Stick - debloat and optimize.
# Shared settings and app lists. Not run directly - use with android-tv-fire.debloat.sh or android-tv-fire.restore.sh.
#
# Debloat:
#   curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/common-android.sh \
#     https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/android-tv-fire.sh \
#     https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/android-tv-fire.debloat.sh | bash
#
# Restore:
#   curl -fsSL https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/common-android.sh \
#     https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/android-tv-fire.sh \
#     https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/android-tv-fire.restore.sh | bash

# SOURCE docs/android/common-android.sh

################################################################################
# --- Settings ---
################################################################################

debloat_settings() {
  # ---- Animations Off ----
  _put_setting global window_animation_scale 0.0     # window open/close off. instant UI.
  _put_setting global transition_animation_scale 0.0 # screen transitions off. instant UI.
  _put_setting global animator_duration_scale 0.0    # in-app animations off. instant UI.

  # ---- Telemetry Off ----
  _put_setting secure collection_info_enabled 0            # disable system info collection. no side effects.
  _put_setting secure privacy_metrics_collection_enabled 0 # disable privacy metrics. no side effects.
  _put_setting global analytics_enabled 0                  # disable system analytics. no side effects.
  _put_setting global usage_reporting_enabled 0            # disable usage reporting. no side effects.

  # ---- Connectivity ----
  _put_setting global wifi_scan_always_enabled 0 # stop Wi-Fi scan when Wi-Fi is off. no side effects.
  _put_setting global ble_scan_always_enabled 0  # stop Bluetooth scan when BT is off. no side effects.

  # ---- Privacy ----
  _put_setting global device_provisioned 1    # mark device as provisioned. skip setup wizard.
  _put_setting global send_action_app_error 0 # disable crash reports to Google. no side effects.
  _put_setting global ad_id_opt_out 1         # opt out of personalized ad tracking. no side effects.

  # ---- Other Settings ----
  # Make sure voice control is enabled
  _put_setting secure voice_disabled 0
  _put_setting secure alexa_wake_word_disabled 0

  # --- Fire TV-specific settings ---
  _put_setting global amz_limit_ad_tracking 1
  _put_setting global limit_ad_tracking 1
  _put_setting global non_amz_limit_ad_tracking 1
  _put_setting global advertisingIdApp:interestBasedAds:value 0
  _put_setting global USAGE_METRICS_UPLOAD_ENABLED 0
  _put_setting global usage_metrics_marketing_enabled 0
  _put_setting global settingsApp:appUsageData:value 0
  _put_setting global settingsApp:deviceUsageData:value 0
  _put_setting global heads_up_notifications_enabled 0
  _put_setting global com.amazon.tv.settings.featured_item_video_enabled 0
  _put_setting global com.amazon.tv.settings.featured_item_video_volume 0.0
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
com.amazon.pai                                      # Amazon PAI - disable personalized ads
com.amazon.zico.app                                 # Zico - disable Amazon recommendation engine
com.amazon.ism.recommendations                       # ISM Recommendations - disable content suggestions
com.amazon.kindle.unifiedreader                      # Kindle Unified Reader - lose Kindle reader integration
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

function restore_all_apps() {
  restore_app_collection "$FIRE_TV_DEBLOAT_SAFE" "FIRE_TV_DEBLOAT_SAFE"
  restore_all_settings
  _log_success ">>> All Fire TV apps and settings restored"
}

################################################################################
# --- Bootstrap and Install apps ---
################################################################################

# Download and install one APK from a repository's latest GitHub release.
function _install_latest_github_apk() {
  repo="$1"
  asset_pattern="$2"
  app_name="$3"
  release_api="https://api.github.com/repos/$repo/releases/latest"
  apk_url="$(
    command curl -fsSL "$release_api" \
      | command sed -n 's/.*"browser_download_url": "\([^\"]*\.apk\)".*/\1/p' \
      | command grep -m 1 -F "$asset_pattern"
  )"

  if [ -z "$apk_url" ]; then
    _log_error ">>> $app_name > APK not found in latest $repo release"
    return 1
  fi

  temp_folder="$(command mktemp -d "${TMPDIR:-/tmp}/firetv-apk.XXXXXX")" || return 1
  apk_file="$temp_folder/$app_name.apk"
  _log_info ">>> $app_name > Downloading $apk_url"
  if ! command curl -fsSL "$apk_url" -o "$apk_file"; then
    command rm -rf "$temp_folder"
    return 1
  fi

  _log_info ">>> $app_name > Installing"
  adb install -r "$apk_file"
  install_status=$?
  command rm -rf "$temp_folder"
  if [ "$install_status" = "0" ]; then
    _log_success ">>> $app_name > Installed > Success"
  else
    _log_error ">>> $app_name > Installed > Error"
  fi
  return "$install_status"
}

# Push Amazon filtering rules and start personalDNSfilter's VPN activity.
function _configure_personal_dnsfilter() {
  blocklist_url="https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/native.amazon-onlydomains.txt"
  extra_hosts_url="https://raw.githubusercontent.com/synle/bashrc/HEAD/docs/android/data/blocklists/extra-hosts.txt"
  config_url="https://raw.githubusercontent.com/IngoZenz/personaldnsfilter/master/app/src/main/assets/dnsfilter.conf"
  remote_folder="/storage/emulated/0/Android/data/dnsfilter.android/files/PersonalDNSFilter"
  temp_folder="$(command mktemp -d "${TMPDIR:-/tmp}/firetv-dns.XXXXXX")" || return 1
  blocklist_file="$temp_folder/FILTERHOSTS.TXT"
  extra_hosts_file="$temp_folder/additionalHosts.txt"
  config_file="$temp_folder/dnsfilter.conf"

  _log_info ">>> personalDNSfilter > Downloading Amazon blocklist"
  if ! command curl -fsSL "$blocklist_url" -o "$blocklist_file" \
    || ! command curl -fsSL "$extra_hosts_url" -o "$extra_hosts_file" \
    || ! command curl -fsSL "$config_url" \
    | command sed \
      -e 's#^filterHostsFile = .*#filterHostsFile = FILTERHOSTS.TXT#' \
      -e 's#^filterAutoUpdateURL = .*#filterAutoUpdateURL = https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/native.amazon-onlydomains.txt#' \
      -e 's#^filterAutoUpdateURL_IDs = .*#filterAutoUpdateURL_IDs = HaGeZi Amazon#' \
      -e 's#^filterAutoUpdateURL_categories = .*#filterAutoUpdateURL_categories = Amazon#' \
      -e 's#^filterAutoUpdateURL_switchs = .*#filterAutoUpdateURL_switchs = true#' \
      > "$config_file"; then
    command rm -rf "$temp_folder"
    return 1
  fi

  _log_info ">>> personalDNSfilter > Pushing configuration"
  if ! _adb_shell mkdir -p "$remote_folder" \
    || ! adb push "$blocklist_file" "$remote_folder/FILTERHOSTS.TXT" \
    || ! adb push "$extra_hosts_file" "$remote_folder/additionalHosts.txt" \
    || ! adb push "$config_file" "$remote_folder/dnsfilter.conf"; then
    command rm -rf "$temp_folder"
    return 1
  fi
  command rm -rf "$temp_folder"

  _log_info ">>> personalDNSfilter > Starting VPN activity"
  _adb_shell am force-stop dnsfilter.android
  _adb_shell am start -n dnsfilter.android/.DNSProxyActivity
  _log_info ">>> personalDNSfilter > Approve VPN access on Fire TV if prompted"
}

function install_apps() {
  if ! adb get-state > /dev/null 2>&1; then
    _log_error ">>> No connected ADB device"
    return 1
  fi

  # Re-enable Amazon services required for Fire TV voice control.
  _adb_shell pm enable com.amazon.vizzini.ftvcds
  _adb_shell pm enable com.amazon.ale
  _adb_shell pm enable com.amazon.aca
  _adb_shell settings put secure voice_disabled 0
  _adb_shell settings put secure alexa_wake_word_disabled 0

  _install_latest_github_apk "yuliskov/SmartTube" "_universal.apk" "SmartTube" || return 1
  _install_latest_github_apk "humblemuzzu/dumbtv" "dumbtv-home.apk" "DumbTV" || return 1
  _install_latest_github_apk "IngoZenz/personaldnsfilter" "DNSFilter_" "personalDNSFilter" || return 1
  _configure_personal_dnsfilter || return 1
}

# personalDNSfilter needs user approval for its Android VPN service after launch.

# Check host ADB and optionally connect to a user-provided Fire TV device.
function _greet_and_connect_adb() {
  _log_section ">>> Fire TV ADB setup"
  if ! command -v adb > /dev/null 2>&1; then
    _log_error ">>> adb not found on host; install Android platform tools first"
    return 1
  fi

  adb_target=""
  if { [ -t 0 ] || [ -t 1 ] || [ -t 2 ]; } && [ -r /dev/tty ]; then
    printf "Enter ADB IP/host (leave empty to use current connection): " > /dev/tty
    IFS= read -r adb_target < /dev/tty || adb_target=""
  fi

  if [ -n "$adb_target" ]; then
    _log_info ">>> Reconnecting ADB to $adb_target"
    adb disconnect > /dev/null 2>&1 || true
    adb kill-server > /dev/null 2>&1 || true
    adb start-server || return 1
    adb connect "$adb_target" || return 1
  else
    _log_info ">>> Using current ADB connection"
    if ! adb get-state > /dev/null 2>&1; then
      _log_error ">>> No connected ADB device"
      return 1
    fi
  fi
}

_greet_and_connect_adb
