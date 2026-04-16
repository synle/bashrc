#!/bin/sh

# Samsung Z Fold5 - S24 Ultra - Tab S9 Ultra
# Shared functions and app lists. Not run directly - use with android.debloat.sh or android.restore.sh.
#
# Debloat:
# curl -fsSL https://github.com/synle/bashrc/blob/HEAD/docs/android/android.sh?raw=true https://github.com/synle/bashrc/blob/HEAD/docs/android/android.debloat.sh?raw=true | sh
#
# Restore:
# curl -fsSL https://github.com/synle/bashrc/blob/HEAD/docs/android/android.sh?raw=true https://github.com/synle/bashrc/blob/HEAD/docs/android/android.restore.sh?raw=true
#
# Settings
# Tracks applied settings for reset_all_settings. Example: "global window_animation_scale\nsecure long_press_timeout"
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

# App disable
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

# Collection functions - take a newline-delimited string of package names
# Supports inline comments (# ...) and section headers (lines starting with #)
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

restore_app_collection() {
  echo "$1" | while read line; do
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    app=$(parse_app_name "$line")
    [ -z "$app" ] && continue
    restore_app "$app"
  done
}


################################################################################
# ---- Setting tweaks ----
################################################################################

debloat_settings() {
  # ---- Animation Speed ----
  put_setting global window_animation_scale 0.05       # faster window open/close animations. No side effects.
  put_setting global transition_animation_scale 0.05   # faster screen transitions. No side effects.
  put_setting global animator_duration_scale 0.3      # faster in-app animations. Rare apps may mistime logic tied to animator duration.

  # ---- Performance & Hardware ----
  put_setting global ram_expand_size_list 0         # Disable RAM Plus (Virtual RAM). Apps killed sooner when RAM is full, but 12GB devices don't need swap.
  put_setting global force_gpu_rendering 1          # Force GPU for 2D drawing. Largely no-op on modern One UI. Can cause glitches in some banking/legacy apps.
  put_setting global disable_window_blurs 1         # Disable gaussian blur behind notifications/dialogs. Big performance win, slightly less polished look.
  put_setting global sem_enhanced_cpu_responsiveness 0 # Disable Samsung CPU boost on touch. Slightly less snappy, better battery life. No harm.

  # ---- Connectivity & Scanning ----
  put_setting global wifi_scan_always_enabled 0     # Disable Wi-Fi scanning when Wi-Fi is off. Degrades indoor/urban location accuracy (GPS still works).
  put_setting global ble_scan_always_enabled 0      # Disable Bluetooth scanning when BT is off. Breaks Find My Device, SmartTag tracking when BT is toggled off.
  put_setting global wifi_watchdog_on 0             # Disable auto Wi-Fi-to-mobile-data switching. May stay on bad Wi-Fi longer, manual switch needed.
  put_setting global private_dns_mode hostname       # Enable Private DNS (strict mode). All DNS queries encrypted via DNS-over-TLS. No side effects.
  put_setting global private_dns_specifier dns.adguard.com # AdGuard DNS. Blocks ads/trackers at DNS level. Some ad-supported apps/sites may break.

  # ---- Privacy & Logging ----
  put_setting global analytics_enabled 0            # Disable system analytics. No side effects.
  put_setting global usage_reporting_enabled 0      # Disable usage reporting. No side effects.

  # ---- Touch Responsiveness ----
  # Default: long_press_timeout=400, multi_press_timeout=300
  # 250 is too aggressive — causes accidental long presses when scrolling
  # and missed double taps. 325 is a good middle ground: noticeably snappier
  # than stock without the mis-trigger issues.
  put_setting secure long_press_timeout 300         # Faster long press (default 400). Below 300 causes accidental triggers when tap-and-scrolling.
  put_setting secure multi_press_timeout 275        # Tighter double/triple press window (default 300). Below 250 makes slow double-taps fail to register.

  # ---- Accessibility ----
  put_setting secure accessibility_reduce_transparency 1 # Remove translucent backgrounds. Better readability and performance, slightly less polished look.
  put_setting secure accessibility_reduce_motion 1       # Reduce parallax/zoom/motion effects. Some app entrance animations become simple fades.

  # ---- Battery & Power ----
  put_setting global mobile_data_always_on 0        # Turn off mobile radio when on Wi-Fi. Saves battery. Wi-Fi-to-mobile handoff takes 1-2s longer.
  put_setting secure screensaver_enabled 0           # Disable Daydream screensaver. Prevents OLED burn-in while charging/docked.
  put_setting secure wake_gesture_enabled 0          # Disable lift-to-wake gesture. Prevents pocket wake-ups, saves battery.

  # ---- Notifications & UX ----
  put_setting global wifi_networks_available_notification_on 0 # Disable "Wi-Fi networks available" notification. No side effects.
  put_setting system sound_effects_enabled 0         # Disable touch/tap sound effects. No side effects.
  put_setting system haptic_feedback_enabled 1       # Enable haptic feedback on taps. Default Samsung behavior. No side effects.

  # ---- Privacy: Lock Screen ----
  put_setting secure lock_screen_allow_private_notifications 0 # Hide notification content on lock screen. Must unlock to read messages. No side effects.

  # ---- Privacy: Network ----
  put_setting global network_recommendations_enabled 0 # Disable Google Wi-Fi network rating/suggestions. Wi-Fi works the same. No side effects.

  # ---- Safety ----
  put_setting global data_roaming 1                   # Enable cellular data roaming. Keeps data working when traveling abroad. May incur roaming charges.
  put_setting global package_verifier_enable 1       # Ensure Play Protect app scanning stays on. No side effects.

  # ---- Privacy & Telemetry: Google & Android ----
  put_setting global logcat_for_apps_enabled 0       # Block apps from reading system logs. Breaks debugging apps (Logcat Reader), normal apps unaffected.
  put_setting global usage_stats_enabled 0           # Disable app usage tracking. Digital Wellbeing shows no data, Adaptive Battery slightly less smart.
  put_setting global send_action_app_error 0         # Disable crash reports to Google. No side effects.
  put_setting global ad_id_opt_out 1                 # Opt out of personalized ad tracking. Still see ads, just not personalized. No side effects.

  # ---- Privacy & Telemetry: Samsung ----
  put_setting global multi_cb 0                      # Disable Samsung Customization Service data collection. Lose Samsung "personalized" suggestions.
  put_setting global rhythmic_logging_button_enabled 0 # Disable Samsung background behavior logging. No side effects.
  put_setting secure send_security_reports 0         # Stop sending security logs to Samsung. Device Care scans still work locally. No side effects.

  # ---- Privacy & Telemetry: Scanning ----
  put_setting global nearby_scanning_enabled 0       # Disable Nearby Device beaconing. Lose auto "device found" prompts (Galaxy Buds, SmartTags). Manual pairing still works.
  put_setting global adaptive_connectivity_enabled 0 # Stop Google from tracking Wi-Fi quality/location. Wi-Fi works the same. No side effects.

  # ---- Privacy & Telemetry: Additional ----
  put_setting global device_provisioned_time 0         # Hide device setup timestamp from telemetry. No side effects.
  put_setting global network_scoring_provisioned 1     # Suppress Wi-Fi scoring prompt. Wi-Fi works the same. No side effects.
  put_setting secure unknown_sources_default_reversed 1 # Disable Samsung marketing data tied to sideloaded apps. Does not affect APK installs. No side effects.
  reset_setting global euicc_provisioned               # Reset eSIM provisioning to default. Keeps eSIM functional for adding/switching profiles.

  # TO BE REVIEWED:
  # ---- Performance ----
  # put_setting global cached_apps_freezer enable       # Freeze cached apps (SIGSTOP). Apps take longer to resume, messaging apps may delay notifications by seconds.
  # put_setting global always_finish_activities 1        # Destroy activities on leave. Every app reloads from scratch on switch-back, sluggish multitasking.
  # ---- Battery ----
  # put_setting global low_power_back_data off           # Block background sync in battery saver. Email/chat won't sync until you open them.
  # put_setting global automatic_power_save_mode 1       # Auto-enable battery saver at low battery. May throttle performance unexpectedly.
  # ---- Display / UX ----
  # put_setting secure tap_duration_threshold 0.0        # Zero-delay tap registration. May register accidental touches, especially with screen protectors.
  # put_setting global heads_up_notifications_enabled 0  # Kill floating notification banners. Must check notification shade manually. Calls still ring.
  # put_setting system screen_off_timeout 60000          # Screen off after 60s (default 30s). Drains more battery if you forget to lock.
  # ---- Privacy ----
  # put_setting secure location_mode 3                   # GPS-only location (no Wi-Fi/cell assist). Most private but slower initial GPS fix.
  # put_setting global safe_boot_disallowed 1            # Disable safe boot access. Prevents bypassing your setup but harder to troubleshoot.
}


################################################################################
# ---- App Lists ----
################################################################################

# ---- Safe to remove - duplicate apps, adware, and unused features ----
DEBLOAT_SAFE="
# ---- Duplicate / Replaceable Apps ----
com.samsung.android.calendar                # Samsung Calendar - lose Samsung calendar app; [Not Needed] if using Google Calendar
com.samsung.android.calendar.sync          # Samsung Calendar Sync - lose Samsung Calendar cloud sync; [Not Needed] if using Google Calendar
com.samsung.android.email.provider          # Samsung Email - lose Samsung email client; [Not Needed] if using Gmail
com.samsung.android.messaging               # Samsung Messages - lose default SMS/MMS/RCS; [Not Needed] if using Google Messages
com.samsung.android.service.livedrawing     # Live Drawing - lose animated handwritten messages in Samsung Messages; [Not Needed] if using Google Messages
com.samsung.android.honeyboard              # Samsung Keyboard - lose Samsung keyboard; [Not Needed] if using Gboard
com.samsung.android.app.reminder            # Samsung Reminder - lose Samsung reminders; [Not Needed] if using Google Tasks
com.samsung.android.samsungpass             # Samsung Pass - lose Samsung biometric autofill; [Not Needed] if using Google Password Manager
com.samsung.android.spay                    # Samsung Wallet - lose Samsung Pay/NFC tap-to-pay; [Not Needed] if using Google Wallet
com.sec.android.app.popupcalculator         # Samsung Calculator - lose Samsung calculator app; [Not Needed] if using Google Calculator
com.sec.android.app.sbrowser                # Samsung Browser - lose Samsung Internet browser; [Not Needed] if using Firefox/Brave
com.sec.android.daemonapp                   # Samsung Weather - lose Samsung weather app/widget; [Not Needed] if using Google Weather
com.samsung.android.app.clockpack           # Samsung Clock - lose alarms, timers, stopwatch, world clock; [Not Needed] if using Google Clock
com.samsung.android.app.spage               # Samsung Free / TV Plus - lose left-swipe news/video feed; [Not Needed] with third-party launchers
com.samsung.android.da.daagent              # Samsung Daily Agent - lose Samsung Daily left-swipe feed; [Not Needed] with third-party launchers
com.samsung.android.themestore              # Samsung Theme Store - lose Samsung themes/wallpapers/icons; [Not Needed] with third-party launchers
com.samsung.android.smartsuggestions        # Smart Suggestions - lose Samsung app suggestions in share menu; [Not Needed] with third-party launchers
com.samsung.android.shortcutbackupservice   # Shortcut Backup Service - lose home screen layout backup; [Not Needed] with third-party launchers
com.microsoft.office.officehubrow           # Microsoft Office - lose Office hub; [Not Needed] if using Google Docs/Drive
com.microsoft.skydrive                      # Microsoft OneDrive - lose OneDrive cloud storage; [Not Needed] if using Google Drive
com.microsoft.copilot                       # Microsoft Copilot - lose Microsoft AI assistant; [Not Needed] if using Google Gemini
com.touchtype.swiftkey                      # Microsoft SwiftKey - lose SwiftKey keyboard; [Not Needed] if using Gboard
# ---- Not Needed After Initial Setup ----
com.samsung.android.easysetup               # Samsung Easy Setup - one-time setup wizard; [Not Needed] after initial setup
com.sec.android.easyMover                   # Smart Switch - lose phone-to-phone data migration; [Not Needed] after initial setup
com.google.android.apps.restore             # Google Restore - lose backup restore wizard; [Not Needed] after initial setup
# ---- Junks > Google ----
com.android.chrome                          # Chrome - lose Chrome browser; use Firefox/Brave
com.google.android.youtube                  # YouTube - lose YouTube app; use browser or NewPipe
com.google.android.apps.youtube.music       # YouTube Music - lose YouTube Music app; use Spotify or browser
com.google.android.apps.magazines           # Google News - lose Google News feed app
com.google.android.apps.subscriptions.red   # Google One - lose Google One storage management and upsell app
com.google.android.videos                   # Google TV - lose Google TV/Play Movies app for purchased/rented movies
com.google.android.feedback                 # Google Feedback - lose Send feedback bug report option inside Google apps
com.google.android.apps.googleassistant     # Google Assistant - replaced by Gemini; lose legacy Hey Google voice commands
com.google.android.printservice.recommendation # Google Print Service - lose wireless printer discovery and printing
# ---- Junks > Facebook ----
com.facebook.appmanager                     # Facebook App Manager - lose background Facebook app updates/installs
com.facebook.appmanager.intel               # Facebook App Manager Intel - lose Facebook background telemetry
com.facebook.services                       # Facebook Services - lose Facebook background services (login, analytics)
com.facebook.system                         # Facebook System Services - lose Facebook system-level integration
# ---- Samsung > Bixby ----
com.samsung.android.app.routines            # Bixby Routines - lose automated routines (if X then Y triggers)
com.samsung.android.bixby.agent             # Bixby Agent - lose Bixby voice assistant and voice commands
com.samsung.android.bixby.service           # Bixby Service - lose Bixby backend processing
com.samsung.android.bixby.wakeup            # Bixby Voice Wake-up - lose Hi Bixby hotword detection and voice wake
com.samsung.android.bixbyvision.framework   # Bixby Vision Framework - lose camera-based object/text recognition in Samsung Camera
# ---- Samsung > AR / Stickers ----
com.samsung.android.aremoji                 # AR Emoji - lose animated avatar creation from selfies
com.samsung.android.aremojieditor           # AR Emoji Editor - lose avatar customization (outfits, accessories)
com.samsung.android.ardrawing               # AR Doodle - lose drawing/doodling on faces in camera viewfinder
com.samsung.android.app.camera.sticker.facearavatar.preload # Stickers - lose preloaded face stickers in Samsung Camera
com.sec.android.mimage.avatarstickers       # AR Emoji Stickers - lose auto-generated emoji sticker packs in keyboard
com.samsung.android.arzone                  # AR Zone - lose AR hub (AR Emoji, Deco Pic, Quick Measure)
com.samsung.android.stickercenter           # Sticker Center - lose downloadable sticker packs for Samsung Keyboard
com.samsung.android.intelligenceservice     # Samsung AI Writing Assist - lose sparkle icon in text selection toolbar
com.samsung.android.app.storyline            # Samsung Storyline - lose auto-generated photo/video highlight reels
# ---- Bloat / Adware / Promos ----
com.mygalaxy.service                        # Samsung marketing layer - lose Samsung account promotional notifications
com.samsung.android.app.samsungmall         # Samsung Shop - lose in-device Samsung store/deals app
com.samsung.android.tvplus                  # Samsung TV Plus - lose free ad-supported streaming TV channels
com.samsung.android.voc                     # Samsung Members - lose Samsung support/community app and diagnostics
com.samsung.sree                            # Samsung Global Goals - lose lock screen charity ads and widget
com.samsung.android.app.social              # Samsung What's New - lose Samsung promotional/feature update notifications
com.samsung.android.app.tips                # Samsung Tips - lose tutorial pop-ups and feature discovery prompts
com.samsung.android.app.sharelive           # Share Live - lose Samsung-to-Samsung screen sharing during voice calls; not video calling
com.samsung.android.app.dressroom           # Samsung Dressing Room - lose AR virtual clothes try-on; Samsung shopping gimmick
com.samsung.android.app.parentalcare        # Samsung Parental Controls - lose Samsung built-in parental controls
com.google.android.gms.supervision          # Family Link - lose parental controls on this device; [Not Needed] if managing family access online
# ---- Samsung > Games ----
com.samsung.android.game.gamehome           # Game Launcher - lose game folder, performance stats, and Do Not Disturb during games
com.samsung.android.game.gametools          # Game Booster - lose in-game FPS counter, screenshot tools, and performance tuning overlay
# ---- Samsung > Misc ----
com.samsung.android.svoiceime               # Samsung Voice Input - lose Samsung voice-to-text; Google voice typing still works
com.samsung.android.app.ledcoverdream       # LED Cover Service - lose LED case notifications; useless without Samsung LED cover
# ---- Samsung > Edge Panels ----
com.samsung.android.app.cocktailbarservice  # Edge Panels service - lose all edge swipe panels (core service)
com.samsung.android.app.taskedge            # Tasks Edge panel - lose task/to-do list in Edge Panel sidebar
com.samsung.android.app.clipboardedge       # Clipboard Edge panel - lose clipboard history in Edge Panel sidebar
com.samsung.android.app.appsedge            # Apps Edge panel - lose app shortcuts in Edge Panel sidebar
# ---- Samsung > Kids ----
com.samsung.android.kidsinstaller           # Samsung Kids Installer - lose ability to set up Samsung Kids mode
com.sec.android.app.kidshome                # Samsung Kids Home - lose Kids Mode launcher and child-safe environment
# ---- Samsung / Google: Digital Wellbeing ----
com.samsung.android.forest                  # Samsung Focus Mode - lose Samsung focus/do-not-disturb scheduling
com.samsung.android.wellbeing               # Samsung Digital Wellbeing - lose screen time dashboard, app timers
com.google.android.apps.wellbeing           # Google Digital Wellbeing - lose screen time stats, Focus Mode tiles
"

# ---- Aggressive - may have system-level ties, review before running ----
DEBLOAT_AGGRESSIVE="
# ---- Aggressive > TO BE REVIEWED: Move to DEBLOAT_SAFE once verified safe ----
com.samsung.android.visionintelligence      # Bixby Vision - lose camera-based search, translate, and shopping lens
com.google.android.apps.tachyon             # Google Meet - lose Google Meet video calling app
# ---- Aggressive > Samsung: System Services / Frameworks ----
com.samsung.android.rubin.app               # Samsung Customization Service - lose personalized recommendations; [Not Needed] with third-party launchers
com.samsung.android.mobileservice           # Samsung Experience Service - lose Samsung account sync; [Not Needed] if using Google account/Play Store
com.samsung.android.smartcallprovider       # Hiya / Smart Call - lose caller ID spam detection and business name lookup
# ---- Aggressive > Samsung: Location / Beacon ----
com.samsung.android.beaconmanager           # Beacon Manager - lose automatic Bluetooth device discovery and nearby pairing prompts
com.samsung.android.ipsgeofence             # Samsung Location SDK - lose Samsung-specific geofencing (SmartThings automations)
# ---- Aggressive > Samsung: DeX ----
com.samsung.android.mdx                     # Samsung DeX - lose desktop mode when connecting to monitor/TV
com.samsung.android.mdx.kit                 # Samsung DeX Kit - lose DeX window management on external displays
com.samsung.android.mdx.quickpanel          # Samsung DeX Quick Panel - lose DeX taskbar quick settings
# ---- Aggressive > Duplicate / Replaceable Apps ----
com.samsung.android.dialer                  # Samsung Dialer - lose default phone app, call recording; install Google Phone first
# ---- Aggressive > Google: System-tied ----
com.google.android.projection.gearhead      # Android Auto - lose in-car projection (maps, calls, music on car display)
com.google.ar.core                          # Google AR Core - lose AR in apps (Maps Live View, Snapchat lenses)
# ---- Aggressive > TO BE REVIEWED: Additional apps ----
com.samsung.android.authfw                  # Samsung Auth Framework - lose Samsung biometric auth for Samsung apps
"

# [KEEP] com.google.android.apps.docs                # Google Docs actively used
# [KEEP] com.google.android.apps.docs.editors.sheets # Google Sheets actively used
# [KEEP] com.google.android.apps.docs.editors.slides # Google Slides actively used
# [KEEP] com.google.android.apps.nbu.files           # Google Files actively used
# [KEEP] com.samsung.android.app.galaxyfinder        # Galaxy Store Finder lose search within Galaxy Store; Not Needed if using Google Play Store
# [KEEP] com.samsung.android.app.notes               # Samsung Notes actively used for S Pen handwriting
# [KEEP] com.samsung.android.app.updatecenter        # Samsung App Update Manager lose auto updates for Samsung system apps
# [KEEP] com.samsung.android.app.watchmanagerstub    # Galaxy Watch Manager stub - lose Galaxy Watch pairing prompt; Not Needed if no Galaxy Watch
# [KEEP] com.samsung.android.scloud                  # Samsung Cloud - lose Samsung cloud backup/sync; backs up Samsung Notes (S Pen handwriting)


