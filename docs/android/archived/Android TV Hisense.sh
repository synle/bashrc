#!/usr/bin/env bash
curl -fsSL "https://github.com/synle/bashrc/blob/HEAD/android/Core Android TV.sh?raw=1" | bash

removeApp() {
  # Print action message without altering positional parameters
  (
    set -- "> Remove:" "$@"
    IFS=' '
    printf '%s\n' "$*"
  )

  # Check if 'pm' is available locally; otherwise use adb shell
  if command -v pm >/dev/null 2>&1; then
    pm uninstall "$@" || pm uninstall -k --user 0 "$@" || pm uninstall -k --user 10 "$@"
  else
    adb shell pm uninstall "$@" || adb shell pm uninstall -k --user 0 "$@" || adb shell pm uninstall -k --user 10 "$@"
  fi
}

function restoreApp() {
  (
    set -- "> Restore:" $@
    IFS=' '
    printf '%s\n' "$*"
  )
  cmd package install-existing $@
}

# Common Android TV
removeApp com.jamdeo.tv.mediacenter
removeApp com.google.android.backdrop
removeApp com.amazon.amazonvideo.livingroom
removeApp com.android.dreams.basic
removeApp com.google.android.apps.youtube.kids
removeApp com.google.android.apps.youtube.music
removeApp com.google.android.apps.youtube.unplugged
removeApp com.google.android.videos
removeApp com.google.android.youtube
removeApp com.android.printspooler
removeApp com.pandora.android.atv

# Group 1: telemetry, ACR and tracking
removeApp android.autoinstalls.config.hisense.xiaoyushan   # silent partner-app auto-installs
removeApp com.google.android.feedback                      # crash/feedback uploader
removeApp com.google.android.partnersetup                  # partner referral tracking
removeApp com.google.android.tv.bugreportsender
removeApp com.hisense.evservice                            # codePath /system/app/acr: automatic content recognition
removeApp com.hisense.service.message                      # /system/app/HiMsgService: Hisense push messages

# Group 2: promo content, retail and commercial modes, Hisense preloads
removeApp com.google.android.tvrecommendations             # recommendation rows
removeApp com.mstar.android.tv.disclaimercustomization     # /system/product/app/VendorDisclaimer: store disclaimer
removeApp com.hisense.tv.b2b                               # /system/app/HisenseB2B: hotel/commercial mode
removeApp net.vidaatv.hisense.android.tv                   # "Hisense Channels", VIDAA free ad-supported channels
removeApp com.hisense.alexa                                # /system/app/HiAlexa

# Hisense ULED 4K Premium 75U6G (xiaoyushan)
# cautious
# removeApp com.hisense.favkey
# removeApp com.hisense.service.message
# removeApp com.hisense.tv.protector

# experimental and cautious!
# removeApp com.mstar.netflixobserver # can be replaced with button mapper
# removeApp com.hisense.storemode
# removeApp com.hisense.hitv.hicloud.account
# removeApp com.jamdeo.tv.mediacenterapplication
