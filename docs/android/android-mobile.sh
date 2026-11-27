#!/bin/sh

# Samsung Z Fold5 - S24 Ultra - Tab S9 Ultra
# Shared settings and app lists. Not run directly - use with android-mobile.debloat.sh or android-mobile.restore.sh.
#
# Debloat:
# curl -fsSL https://github.com/synle/bashrc/blob/HEAD/docs/android/common-android.sh?raw=1 \
#   https://github.com/synle/bashrc/blob/HEAD/docs/android/android-mobile.sh?raw=1 \
#   https://github.com/synle/bashrc/blob/HEAD/docs/android/android-mobile.debloat.sh?raw=1 | sh
#
# Restore:
# curl -fsSL https://github.com/synle/bashrc/blob/HEAD/docs/android/common-android.sh?raw=1 \
#   https://github.com/synle/bashrc/blob/HEAD/docs/android/android-mobile.sh?raw=1 \
#   https://github.com/synle/bashrc/blob/HEAD/docs/android/android-mobile.restore.sh?raw=1 | sh

# SOURCE docs/android/common-android.sh

# Verified default apps for the Samsung phones covered by this list.
_DEFAULT_IME="com.akshaykadam.pixelboard/com.android.inputmethod.latin.LatinIME"
_DEFAULT_HOME_COMPONENT="com.teslacoilsw.launcher/.NovaLauncher"
_DEFAULT_SMS_PACKAGE="com.google.android.apps.messaging"
_DEFAULT_DIALER_PACKAGE="com.google.android.dialer"

################################################################################
# --- Setting tweaks ---
################################################################################

debloat_settings() {
  # ---- Animation Speed ----
  _put_setting global window_animation_scale 0.05     # faster window open/close animations. No side effects.
  _put_setting global transition_animation_scale 0.05 # faster screen transitions. No side effects.
  _put_setting global animator_duration_scale 0.3     # faster in-app animations. Rare apps may mistime logic tied to animator duration.

  # ---- Performance & Hardware ----
  _put_setting global ram_expand_size_list 0            # Disable RAM Plus (Virtual RAM). Apps killed sooner when RAM is full, but 12GB devices don't need swap.
  _restore_setting global force_gpu_rendering           # Use the Android default; forcing GPU can glitch banking and legacy apps.
  _put_setting global disable_window_blurs 1            # Disable gaussian blur behind notifications/dialogs. Big performance win, slightly less polished look.
  _put_setting global sem_enhanced_cpu_responsiveness 0 # Disable Samsung CPU boost on touch. Slightly less snappy, better battery life. No harm.

  # ---- Connectivity & Scanning ----
  # Delete these overrides instead of writing 0. A missing key leaves the policy
  # to firmware; a forced 0 slows Wi-Fi reconnection and blocks automatic
  # Wi-Fi/mobile-data switching. Verify with settings get after a run.
  _restore_setting global wifi_scan_always_enabled              # Restore default scanning. Forcing 0 slows Wi-Fi reconnection; it only matters when Wi-Fi stays off.
  _put_setting global ble_scan_always_enabled 1                 # 1 if using SmartTags; Nearby Bluetooth discovery and device finding.
  _restore_setting global wifi_wakeup_enabled                   # Restore default Wi-Fi wakeup. Forcing 0 slows reconnection near saved networks; it only matters when Wi-Fi stays off.
  _restore_setting global wifi_watchdog_on                      # Restore default watchdog. AOSP key is mostly legacy; One UI also has "Switch to mobile data" under Wi-Fi > Advanced, so check that toggle in the UI.
  _put_setting global private_dns_mode hostname                 # Enable Private DNS (strict mode). All DNS queries encrypted via DNS-over-TLS. No side effects.
  _put_setting global private_dns_specifier dns.adguard-dns.com # AdGuard's documented DNS-over-TLS hostname. Blocks ads/trackers at DNS level.

  # ---- Privacy & Logging ----
  _put_setting global analytics_enabled 0       # Disable system analytics. No side effects.
  _put_setting global usage_reporting_enabled 0 # Disable usage reporting. No side effects.

  # ---- Touch Responsiveness ----
  # Default: long_press_timeout=400, multi_press_timeout=300.
  # 300/275 trims delays without the accidental long presses or missed double taps seen below 250.
  _put_setting secure long_press_timeout 300  # Faster long press (default 400). Below 300 causes accidental triggers when tap-and-scrolling.
  _put_setting secure multi_press_timeout 275 # Tighter double/triple press window (default 300). Below 250 makes slow double-taps fail to register.

  # ---- Accessibility ----
  _put_setting secure accessibility_reduce_transparency 1 # Remove translucent backgrounds. Better readability and performance, slightly less polished look.
  _put_setting secure accessibility_reduce_motion 1       # Reduce parallax/zoom/motion effects. Some app entrance animations become simple fades.

  # ---- Battery & Power ----
  _put_setting global mobile_data_always_on 1         # Better network handoff; costs some standby power.
  _put_setting global stay_on_while_plugged_in 0      # Stop staying awake while charging. Screen follows the normal timeout.
  _put_setting global app_standby_enabled 1           # Keep App Standby active. Idle apps stay restricted in the background.
  _put_setting secure screensaver_enabled 0           # Disable Daydream screensaver. Prevents OLED burn-in while charging/docked.
  _put_setting secure screensaver_activate_on_dock 0  # Stop Daydream auto-start when docked.
  _put_setting secure screensaver_activate_on_sleep 0 # Stop Daydream auto-start when going to sleep.
  _put_setting secure wake_gesture_enabled 0          # Disable lift-to-wake gesture. Prevents pocket wake-ups, saves battery.
  _put_setting system screen_off_timeout 60000        # Screen off after 60s (stock 300s here). Saves battery; locks sooner.

  # ---- Notifications & UX ----
  _put_setting global wifi_networks_available_notification_on 0 # Disable "Wi-Fi networks available" notification. No side effects.
  _restore_setting global heads_up_notifications_enabled        # Use the system-defined banner policy; remove any explicit override.
  _put_setting system sound_effects_enabled 0                   # Disable touch/tap sound effects. No side effects.
  _put_setting system haptic_feedback_enabled 1                 # Enable haptic feedback on taps. Default Samsung behavior. No side effects.

  # ---- Privacy: Lock Screen ----
  _put_setting secure lock_screen_allow_private_notifications 0 # Hide notification content on lock screen. Must unlock to read messages. No side effects.

  # ---- Safety ----
  _put_setting global data_roaming 1            # Enable cellular data roaming. Keeps data working when traveling abroad. May incur roaming charges.
  _put_setting global package_verifier_enable 1 # Ensure Play Protect app scanning stays on. No side effects.

  # ---- Privacy & Telemetry: Google & Android ----
  _put_setting global logcat_for_apps_enabled 0 # Block apps from reading system logs. Breaks debugging apps (Logcat Reader), normal apps unaffected.
  _put_setting global usage_stats_enabled 0     # Disable app usage tracking. Digital Wellbeing shows no data, Adaptive Battery slightly less smart.
  _put_setting global send_action_app_error 0   # Disable crash reports to Google. No side effects.
  _put_setting global ad_id_opt_out 1           # Opt out of personalized ad tracking. Still see ads, just not personalized. No side effects.

  # ---- Privacy & Telemetry: Samsung ----
  _put_setting global multi_cb 0                        # Disable Samsung Customization Service data collection. Lose Samsung "personalized" suggestions.
  _put_setting global rhythmic_logging_button_enabled 0 # Disable Samsung background behavior logging. No side effects.
  _put_setting secure send_security_reports 0           # Stop sending security logs to Samsung. Device Care scans still work locally. No side effects.

  # ---- Privacy & Telemetry: Scanning ----
  _put_setting global nearby_scanning_enabled 0 # Disable Nearby Device beaconing. Lose auto "device found" prompts (Galaxy Buds, SmartTags). Manual pairing still works.
  # Adaptive connectivity manages Wi-Fi/mobile-data and 4G/5G switching. Do not
  # force it off; the change is not side-effect free. Delete the key from both
  # namespaces because some builds store it in secure instead of global, then
  # confirm with settings get on global and secure.
  _restore_setting global adaptive_connectivity_enabled # Restore firmware default for Wi-Fi/mobile and 4G/5G switching.
  _restore_setting secure adaptive_connectivity_enabled # Some builds keep the key in secure; delete that copy too.

  # ---- Privacy & Telemetry: Additional ----
  _put_setting global device_provisioned_time 0          # Hide device setup timestamp from telemetry. No side effects.
  _put_setting global network_scoring_provisioned 1      # Suppress Wi-Fi scoring prompt. Wi-Fi works the same. No side effects.
  _put_setting secure unknown_sources_default_reversed 1 # Disable Samsung marketing data tied to sideloaded apps. Does not affect APK installs. No side effects.
  _restore_setting global euicc_provisioned              # Restore eSIM provisioning to default. Keeps eSIM functional for adding/switching profiles.

  # TO BE REVIEWED:
  # ---- Performance ----
  # _put_setting global cached_apps_freezer enable       # Freeze cached apps (SIGSTOP). Apps take longer to resume, messaging apps may delay notifications by seconds.
  # _put_setting global always_finish_activities 1        # Destroy activities on leave. Every app reloads from scratch on switch-back, sluggish multitasking.
  # ---- Battery ----
  # _put_setting global low_power_back_data off           # Block background sync in battery saver. Email/chat won't sync until you open them.
  # _put_setting global automatic_power_save_mode 1       # Auto-enable battery saver at low battery. May throttle performance unexpectedly.
  # ---- Display / UX ----
  # _put_setting secure tap_duration_threshold 0.0        # Zero-delay tap registration. May register accidental touches, especially with screen protectors.
  # ---- Privacy ----
  # _put_setting secure location_mode 3                   # GPS-only location (no Wi-Fi/cell assist). Most private but slower initial GPS fix.
  # _put_setting global safe_boot_disallowed 1            # Disable safe boot access. Prevents bypassing your setup but harder to troubleshoot.
}

################################################################################
# --- App Lists ---
################################################################################

# Package roles follow the community UAD catalog and vendor app listings.
# Firmware dependencies vary; unverified identifiers stay commented out.
# WARNING marks lost features; CRITICAL marks lockout, calling, or system UI risks.

# --- Default removal - unused apps and optional features ---
# Configure and test Google replacements before cleanup; migrate Samsung alarms first.
DEBLOAT_SAFE="
# --- Replaceable Apps ---
com.samsung.android.calendar # Samsung Calendar | [WARNING] Removes Samsung calendar UI and widgets; verify Google Calendar sync first.
com.samsung.android.messaging # Samsung Messages | [WARNING] Set Google Messages as default and test SMS/MMS/RCS first.
com.sec.android.app.clockpackage # Samsung Clock | [WARNING] Recreate alarms in Google Clock and test after reboot first.
com.samsung.android.email.provider # Samsung Email client
com.samsung.android.service.livedrawing # Live Message animated handwriting
com.samsung.android.app.reminder # Samsung Reminder tasks and alerts
com.samsung.android.authfw # Samsung Pass authentication | [WARNING] Samsung Pass biometric sign-in may stop.
com.samsung.android.spay # Samsung Wallet | [WARNING] Removes Samsung payments and stored passes.
com.sec.android.app.popupcalculator # Samsung Calculator
com.sec.android.app.sbrowser # Samsung Internet browser
com.samsung.android.app.sbrowseredge # Samsung Internet Edge integration
com.samsung.android.app.spage # Samsung Free news and video feed
com.samsung.android.da.daagent # Dual Messenger | [WARNING] Removes cloned messaging accounts.
com.samsung.android.smartsuggestions # Samsung contextual suggestions
com.samsung.android.rubin.app # Customization Service | [WARNING] Disable if personalized Samsung suggestions aren't needed.
com.samsung.android.shortcutbackupservice # Shortcut backup | [WARNING] Removes Samsung shortcut backup support.
com.microsoft.office.officehubrow # Microsoft 365 document hub
com.microsoft.skydrive # OneDrive | [WARNING] Stops OneDrive and linked Gallery cloud sync.
# --- Migration and Restore ---
com.sec.android.easyMover # Smart Switch | [WARNING] Removes phone-to-phone data migration.
com.google.android.apps.restore # Google restore/setup migration helper | [WARNING] Keep if you anticipate restoring a device.
# --- Google Apps ---
com.google.android.youtube # YouTube video app
com.google.android.apps.youtube.music # YouTube Music player
com.google.android.apps.magazines # Google News reader
com.google.android.apps.subscriptions.red # Google One storage management
com.google.android.videos # Google TV movies and shows
com.google.android.feedback # Google feedback reporting
com.google.android.apps.aiwallpapers # AI wallpaper generation
com.google.android.adservices.api # Android advertising/privacy sandbox services
com.google.android.apps.googleassistant # Assistant shortcut | [WARNING] Removes the standalone Assistant entrypoint.
com.google.android.printservice.recommendation # Printer service recommendations; not the print spooler
com.google.android.apps.tachyon # Google Meet video calling
com.google.android.apps.dynamite # Google Chat messaging
# --- Keyboards and Browser ---
com.samsung.android.honeyboard # Samsung Keyboard | [WARNING] Removes Samsung Keyboard; Gboard remains as the working keyboard.
com.touchtype.swiftkey # SwiftKey | [WARNING] Removes SwiftKey; Gboard remains as the working keyboard.
com.android.chrome # Chrome | [WARNING] Removes Chrome; verify in-app browsers and passkeys if Chrome is the WebView provider.
# --- Facebook ---
com.facebook.appmanager # Meta app updates
com.facebook.services # Meta background service integration
com.facebook.system # Meta app installer
# --- Bixby ---
com.samsung.android.bixby.agent # Bixby Voice | [WARNING] Removes Bixby voice and side-button integration; safe when using Google Assistant or Gemini.
com.samsung.android.bixby.service # Bixby backend services | [WARNING] Remaining Bixby features stop working alongside the agent.
com.samsung.android.bixby.wakeup # Hi Bixby hotword | [WARNING] Removes always-listening Hi Bixby; safe when Bixby is unused.
com.samsung.android.app.settings.bixby # Bixby settings
com.samsung.android.bixbyvision.framework # Bixby Vision camera framework
com.samsung.android.visionintelligence # Bixby Vision | [WARNING] Removes camera visual search and translation.
# --- AR and Stickers ---
com.samsung.android.aremoji # AR Emoji | [WARNING] Disable if unused; removes Samsung AR Emoji avatars and camera avatar stickers.
com.samsung.android.aremojieditor # AR Emoji editor | [WARNING] Disable if unused; removes AR Emoji editing.
com.samsung.android.ardrawing # AR Doodle | [WARNING] Disable if unused; removes camera AR drawings.
com.samsung.android.app.camera.sticker.facearavatar.preload # Camera face AR sticker preload | [WARNING] Removes preloaded avatar stickers; safe when AR Emoji is unused.
com.sec.android.mimage.avatarstickers # Avatar stickers | [WARNING] Disable if unused; removes avatar sticker packs.
com.samsung.android.arzone # AR feature hub | [WARNING] Disable if unused; removes the AR camera feature hub.
com.samsung.android.stickercenter # Camera sticker downloads
com.samsung.android.livestickers # Camera stickers and filters | [WARNING] Disable if unused.
# --- Promotions and Optional Apps ---
com.aura.oobe.samsung # AppCloud recommended-app installer
com.aura.oobe.samsung.gl # AppCloud regional installer
com.samsung.android.app.social # Samsung Social
com.netflix.partner.activation # Netflix activation
com.mygalaxy.service # My Galaxy | [WARNING] Disable if installed and unused.
com.samsung.android.tvplus # Samsung TV Plus | [WARNING] Disable if unused.
com.samsung.android.voc # Samsung Members | [WARNING] Disable if you don't use support/diagnostics.
com.samsung.sree # Global Goals promotions
com.samsung.android.app.tips # Samsung tutorials | Disable.
# --- Games and Accessories ---
com.samsung.android.game.gamehome # Gaming Hub | [WARNING] Removes the game library hub.
com.samsung.android.game.gametools # Game Booster | [WARNING] Removes the in-game performance overlay, recording, and touch locks; safe unless you use Game Booster.
com.samsung.android.svoiceime # Samsung voice input | [WARNING] Removes Samsung voice typing.
com.samsung.android.app.ledcoverdream # LED cover effects | [WARNING] Removes compatible LED case features.
# --- Optional Edge Panels ---
com.samsung.android.app.taskedge # Apps/Tasks Edge | [WARNING] Removes app-pair shortcuts in the Edge panel.
com.samsung.android.app.clipboardedge # Clipboard Edge | [WARNING] Removes the clipboard panel.
# --- System Utilities and Samsung Info ---
com.samsung.android.warrantycare # Warranty and service information
com.android.egg # Android Easter egg
com.android.dreams.basic # Basic screensaver/Daydream functionality
com.android.dreams.phototable # Photo screensaver
com.android.traceur # Android System Tracing interface
# --- Samsung Kids ---
# Digital Wellbeing and parental controls are optional; keep only if you use screen-time limits.
com.samsung.android.wellbeing # Samsung Digital Wellbeing | [WARNING] Removes Samsung app timers and focus modes.
com.google.android.apps.wellbeing # Google Digital Wellbeing | [WARNING] Removes Google app timers and focus modes.
com.samsung.android.kidsinstaller # Samsung Kids installer | [WARNING] Blocks Samsung Kids setup; safe when Kids mode is unused.
com.sec.android.app.kidshome # Samsung Kids | [WARNING] Removes the child-safe launcher.
"

# --- Semi-aggressive - opt-in, reversible with android_restore.sh ---
# Use only when a replacement is already installed and tested.
DEBLOAT_SEMI_AGGRESSIVE="
# --- Conditional - TTS engine, unused locales, ambient features, and parental controls ---
com.samsung.SMT # Samsung Text-to-Speech engine, not the Samsung keyboard | [WARNING] Keep if Samsung TTS is used.
com.samsung.SMT.lang_es_mx_f00 # Mexican Spanish TTS language data | [WARNING] Removes Mexican Spanish TTS data; only when that locale is unused.
com.samsung.SMT.lang_es_us_l01 # US Spanish TTS language data | [WARNING] Removes US Spanish TTS data; only when that locale is unused.
com.samsung.SMT.lang_pt_br_l01 # Brazilian Portuguese TTS language data | [WARNING] Removes Brazilian Portuguese TTS data; only when that locale is unused.
com.samsung.android.nmt.apps.t2t.languagepack.kozh # Samsung ko-zh translation language pack (role inferred from package name) | [WARNING] Removes Korean-to-Chinese translation data; only when unused.
com.samsung.android.bixby.ondevice.enus # Bixby on-device English model | [WARNING] Removes on-device Bixby English processing; only when Bixby is unused.
com.samsung.android.bixby.ondevice.zhcn # Bixby on-device Chinese model | [WARNING] Removes on-device Bixby Chinese processing; only when Bixby is unused.
com.google.android.ambient.streaming # Ambient/display streaming functionality | [WARNING] Removes ambient streaming; safe when Ambient Display is unused.
com.samsung.android.app.parentalcare # Samsung parental controls | [WARNING] Removes on-device parental restrictions; safe when unused.
# --- Conditional Samsung Services ---
com.samsung.android.mapsagent # Samsung personalization agent | [WARNING] Disable if unused.
com.sec.android.diagmonagent # Samsung diagnostic reporting | [WARNING] Conditional; test Samsung Members support before disabling.
# --- Samsung Pass and Autofill ---
com.samsung.android.samsungpass # Samsung Pass | [WARNING] Removes Samsung Pass; only when a third-party password manager (Bitwarden, 1Password, or Google Password Manager) already stores your credentials and autofill.
com.samsung.android.samsungpassautofill # Samsung Pass autofill | [WARNING] Removes Samsung autofill; only when a third-party password manager is your autofill service.
# --- Phone, Dialer, and Calling - disable only with a working replacement dialer ---
com.samsung.android.dialer # Samsung Phone dialer | [CRITICAL] Outgoing calls, contacts integration, and emergency-call UI; disable only when another dialer handles calls.
com.samsung.android.incallui # Samsung InCall UI | [CRITICAL] In-call screen for answering and ending calls; disabling can leave calls unroutable without a replacement in-call UI.
com.samsung.android.smartcallprovider # Smart Call | [CRITICAL] Samsung/Hiya caller ID and spam screening; only when Google Phone caller ID replaces it.
"

# --- Cautious / aggressive - commented entries are opt-in only ---
# Protected entries also remain in DEBLOAT_IGNORED; do not enable their removal.
DEBLOAT_AGGRESSIVE="
# --- Replacement and System UI Risks ---
# com.samsung.android.contacts | [CRITICAL] Samsung Contacts; call/contact integration may break.
# com.samsung.android.app.clockpack | [WARNING] Clock style component; fullscreen video breakage reported.
# com.samsung.android.themestore | [WARNING] Galaxy Themes; theme and wallpaper selection may break.
# com.samsung.android.app.dressroom # Wallpaper/style functionality | [WARNING] Newer Fold references associate it with cover-screen wallpaper management; test first.
# com.samsung.android.app.routines | [WARNING] Modes and Routines; removes scheduled and contextual automations.
# com.samsung.android.app.cocktailbarservice | [WARNING] Edge Panels; removes every Edge panel.
# com.google.android.gms.supervision | [CRITICAL] Family Link; device supervision depends on this package.
# --- Shared Services and Connectivity ---
com.samsung.android.beaconmanager # Nearby device service | [WARNING] Nearby discovery integrations may stop.
# com.samsung.android.easysetup | [WARNING] Nearby Device Scanning; removes automatic nearby-device setup prompts.
com.samsung.android.ipsgeofence # Visit In geofencing | [WARNING] Location-triggered Samsung features may stop.
com.google.android.projection.gearhead # Android Auto | [WARNING] Removes in-car phone projection.
com.google.ar.core # Google Play Services for AR | [WARNING] AR-dependent apps lose AR features.
# --- Used Apps - Keep ---
# Samsung Quick Share and Link to Windows depend on the mdx and mobileservice entries below; keep them out of DEBLOAT_SAFE.
# com.sec.android.app.shealth | [WARNING] Samsung Health; keep workouts, sleep tracking, and health sync.
# com.sec.android.app.voicenote | [WARNING] Voice Recorder; keep recording and transcription.
# com.microsoft.appmanager | [WARNING] Link to Windows; keep PC calls, messages, and photo access.
# com.samsung.android.mdx | [WARNING] Core Link to Windows / Multi-Device Experience service; required for Samsung Quick Share and PC integration.
# com.samsung.android.mdx.kit | [WARNING] Multi-Device Experience framework required for Samsung Quick Share and file transfers.
# com.samsung.android.mdx.quickboard | [WARNING] Media output and device control bridge; used by Samsung Quick Share and multi-device controls.
# com.samsung.android.mobileservice | [WARNING] Samsung account sync, cloud connectivity, and group sharing; keep for Samsung Quick Share and account features.
# com.samsung.android.dynamiclock | [WARNING] Dynamic Lock Screen; removal also breaks LockStar customization.
# --- DeX and Multi-Window - Keep ---
# com.sec.android.app.desktoplauncher | [CRITICAL] DeX Home; removal breaks the desktop launcher.
# com.sec.android.desktopmode.uiservice | [CRITICAL] DeX system UI; removal breaks desktop mode.
# com.sec.android.app.dexonpc | [WARNING] DeX for PC; removal disables supported PC connections.
# com.samsung.android.forest | [CRITICAL] Legacy Digital Wellbeing; removal can crash DeX and its taskbar.
# com.samsung.android.app.appsedge | [WARNING] Apps Edge; multi-window breakage reported after removal.
# --- Unverified Identifiers or Roles - Keep Disabled ---
# com.samsung.android.calendar.sync | [WARNING] Calendar sync role and package identifier (unverified).
# com.facebook.appmanager.intel | [WARNING] Claimed Meta helper identifier and role (unverified).
# com.microsoft.copilot | [WARNING] Claimed Copilot identifier (unverified); app listing unavailable.
# com.samsung.android.intelligenceservice | [WARNING] Intelligence service; firmware-specific feature dependencies (unverified).
# com.samsung.android.app.storyline | [WARNING] Claimed photo-story package and role (unverified).
# com.samsung.android.app.samsungmall | [WARNING] Claimed shopping package identifier (unverified).
# com.samsung.android.app.social | [WARNING] Legacy Samsung social integration; affected features (unverified).
# com.samsung.android.mdx.quickpanel | [WARNING] Claimed quick-panel identifier (unverified); not confirmed as DeX.
"

# Never removed by any collection; the debloat entrypoint re-enables these apps.
DEBLOAT_IGNORED="
com.google.android.apps.docs # Google Drive
com.google.android.apps.docs.editors.sheets # Google Sheets
com.google.android.apps.docs.editors.slides # Google Slides
com.google.android.apps.nbu.files # Files by Google
com.samsung.android.app.galaxyfinder # Finder app-drawer search
com.samsung.android.app.notes # Samsung Notes and S Pen notes
com.samsung.android.app.updatecenter # Samsung app updates
com.samsung.android.app.watchmanagerstub # Galaxy Wearable setup stub
com.samsung.android.scloud # Samsung Cloud and Notes sync
com.samsung.android.app.sharelive # Quick Share tile
com.sec.android.app.shealth # Samsung Health
com.sec.android.app.voicenote # Samsung Voice Recorder
com.microsoft.appmanager # Link to Windows
com.samsung.android.mdx # Link to Windows service; Samsung Quick Share dependency
com.samsung.android.mdx.kit # Samsung Quick Share and MDE framework
com.samsung.android.mdx.quickboard # Media output and device controls; Samsung Quick Share dependency
com.samsung.android.mobileservice # Group Sharing and Samsung account features; Samsung Quick Share dependency
com.samsung.android.dynamiclock # Dynamic Lock Screen and LockStar
com.sec.android.app.desktoplauncher # DeX Home launcher
com.sec.android.desktopmode.uiservice # DeX system UI
com.sec.android.app.dexonpc # DeX for PC
com.samsung.android.forest # Legacy Digital Wellbeing; DeX dependency
com.samsung.android.app.appsedge # Apps Edge; preserve multi-window support
# --- eSIM management - keep enabled so Add eSIM and SIM manager can complete ---
com.sec.phone # Samsung core telephony | [CRITICAL] Baseband, SIM provisioning, and calling; disabling can break calls and SIM behavior. Needed for sim card
com.samsung.android.cidmanager # Samsung Carrier ID manager | [CRITICAL] Needed for eSIM management; disabled CID data can hang SIM manager and Add eSIM.
com.samsung.sdm # Samsung carrier/OMC config provider | [CRITICAL] Needed for eSIM management; disabled carrier config can block eSIM activation.
"

# --- App Links ---
# Patched apps keep upstream hosts but not upstream signing keys, so Android
# domain verification cannot pass. Debloat forces user selection on for these
# packages; restore returns every declared host to disabled.
APP_LINKS_PACKAGES="
# --- Patched Apps ---
com.reddit.frontpage # Reddit (Morphe patch)
app.morphe.android.youtube # YouTube (Morphe patch)
app.morphe.android.apps.youtube.music # YouTube Music (Morphe patch)
com.google.android.apps.photos # Google Photos
# --- Common Apps ---
com.discord # Discord
com.facebook.katana # Facebook
com.facebook.orca # Facebook Messenger | [WARNING] Also claims facebook.com hosts; shares them with Facebook.
com.google.android.calendar # Google Calendar
com.google.android.gm # Gmail
com.google.android.apps.maps # Google Maps
us.zoom.videomeetings # Zoom
"

# --- Background restriction ---
# Apps restricted from background execution and Doze-exempt behavior for battery optimization.
# Debloat applies restrictions; restore returns standard background behavior.
BACKGROUND_RESTRICTED_PACKAGES="
# --- Launchers ---
com.teslacoilsw.launcher # Nova Launcher
com.teslacoilsw.launcher.prime # Nova Launcher Prime
# --- Shopping and deals ---
net.slickdeals.android # Slickdeals
com.amazon.mShop.android.shopping # Amazon Shopping
com.ebay.mobile # eBay
com.costco.app.android # Costco
com.woot.android.main # Woot!
# --- Social, professional, and community ---
com.linkedin.android # LinkedIn
com.facebook.katana # Facebook
com.facebook.lite # Facebook Lite
com.teamblind.blind # Blind / TeamBlind
com.instagram.barcelona # Threads
com.zhiliaoapp.musically # TikTok
com.zhiliaoapp.musically.go # TikTok Lite
com.reddit.frontpage # Reddit
com.discord # Discord
# --- Work, home, and local services ---
com.appfolio.resident_portal # AppFolio
com.parentsquare.psapp # ParentSquare
com.zillow.android.zillowmap # Zillow
com.yelp.android # Yelp
com.opentable # OpenTable
# --- Meetings ---
us.zoom.videomeetings # Zoom
"

# Safe is the master collection. Later collections cannot repeat earlier ones.
DEBLOAT_SAFE=$(_normalize_app_collection "$DEBLOAT_SAFE" "$DEBLOAT_IGNORED")
DEBLOAT_SEMI_AGGRESSIVE=$(_normalize_app_collection "$DEBLOAT_SEMI_AGGRESSIVE" "$(printf '%s\n%s\n' "$DEBLOAT_IGNORED" "$DEBLOAT_SAFE")")
DEBLOAT_AGGRESSIVE=$(_normalize_app_collection "$DEBLOAT_AGGRESSIVE" "$(printf '%s\n%s\n%s\n' "$DEBLOAT_IGNORED" "$DEBLOAT_SAFE" "$DEBLOAT_SEMI_AGGRESSIVE")")
BACKGROUND_RESTRICTED_PACKAGES=$(_normalize_app_collection "$BACKGROUND_RESTRICTED_PACKAGES" "")

# Check host ADB and optionally connect to a user-provided Android device.
_greet_and_connect_adb() {
  _log_section ">>> Android ADB setup"
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
  _adb_users > /dev/null
}

# Keep the verified defaults after cleanup, restore, and debloat runs.
set_default_apps() {
  _log_section ">>> Android default apps"
  _adb_shell ime enable "$_DEFAULT_IME" > /dev/null 2>&1 || _log_error ">>> could not enable $_DEFAULT_IME"
  _adb_shell ime set "$_DEFAULT_IME" > /dev/null 2>&1 || _log_error ">>> could not set PixelBoard as the default keyboard"
  _adb_shell cmd package set-home-activity --user 0 "$_DEFAULT_HOME_COMPONENT" > /dev/null 2>&1 || _log_error ">>> could not set Nova Launcher as the default home app"
  _adb_shell cmd role add-role-holder --user 0 android.app.role.SMS "$_DEFAULT_SMS_PACKAGE" > /dev/null 2>&1 || _log_error ">>> could not set Google Messages as the default SMS app"
  _adb_shell cmd role add-role-holder --user 0 android.app.role.DIALER "$_DEFAULT_DIALER_PACKAGE" > /dev/null 2>&1 || _log_error ">>> could not set Google Dialer as the default dialer"
  _log_success ">>> defaults: Nova Launcher / PixelBoard / Google Messages / Google Dialer"
}

_greet_and_connect_adb
set_default_apps
