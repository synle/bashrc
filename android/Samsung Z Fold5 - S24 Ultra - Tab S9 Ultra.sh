# Settings
function put_setting(){
  # echo "> settings put" $@
  settings put $@ >/dev/null 2>&1
}

# App disable
function disable_app(){
  # echo "> Disable:" $@
  pm disable-user --user 0 $@ >/dev/null 2>&1
  pm disable-user -k --user 0 $@ >/dev/null 2>&1
}

function remove_app(){
  # echo "> Remove:" $@
  pm uninstall $@ >/dev/null 2>&1
  pm uninstall -k --user 0 $@ >/dev/null 2>&1
  pm uninstall -k --user 10 $@ >/dev/null 2>&1
  disable_app $@ >/dev/null 2>&1

  # function restoreApp(){
  #   echo "> Restore:" $@
  #   cmd package install-existing $@
  # }
}


#################################################################
# --- Setting tweaks ---
# Animation Speed: 0.5 is the community standard for "snappy"
put_setting global window_animation_scale 0
put_setting global transition_animation_scale 0.4
put_setting global animator_duration_scale 0.4

# Performance & Hardware
put_setting global ram_expand_size_list 0         # Disable RAM Plus (Virtual RAM) to reduce lag
put_setting global force_gpu_rendering 1          # Legacy tweak for UI acceleration
put_setting global disable_window_blurs 1         # Disable blur effects (Huge for One UI speed)

# Connectivity & Scanning
put_setting global wifi_scan_always_enabled 0     # Disable background Wi-Fi scanning
put_setting global ble_scan_always_enabled 0      # Disable background Bluetooth scanning
put_setting global wifi_watchdog_on 0             # Prevent aggressive Wi-Fi/Data switching

# Privacy & Logging
put_setting global analytics_enabled 0            # Disable system analytics
put_setting global usage_reporting_enabled 0      # Disable usage reporting

# --- SECURE SETTINGS (User-specific behavior) ---
# Touch Responsiveness: 250ms is "Instant," 400ms is "Standard Short"
put_setting secure long_press_timeout 250
put_setting secure multi_press_timeout 250

# Accessibility Tweaks
put_setting secure accessibility_reduce_transparency 1
put_setting secure accessibility_reduce_motion 1

# SYSTEM SETTINGS (UI/Device specifics)
put_setting system haptic_feedback_enabled 1 # Optional: Speed up device haptics/feedback

# --- App removals ---
remove_app com.android.chrome
remove_app com.google.android.youtube # YouTube
remove_app com.microsoft.skydrive # OneDrive
remove_app com.mygalaxy.service # Samsung account marketing layer
remove_app com.samsung.android.app.routines # bixby
remove_app com.samsung.android.bixby.agent # bixby
remove_app com.samsung.android.bixby.service # bixby
remove_app com.samsung.android.bixbyvision.framework # bixby
remove_app com.samsung.android.honeyboard # samsung keyboard
remove_app com.samsung.android.themestore         # Samsung Theme Store
remove_app com.sec.android.app.sbrowser # samsung browser
remove_app com.sec.android.easyMover # Smart Switch
### ⚠️ warning, be careful
remove_app com.google.android.apps.youtube.music # YouTube Music
remove_app com.microsoft.office.officehubrow # Microsoft Office
remove_app com.samsung.android.app.camera.sticker.facearavatar.preload # Stickers
remove_app com.samsung.android.app.notes  # Samsung Notes (Safe to remove if you use Google Keep or Docs).
remove_app com.samsung.android.app.reminder  # Samsung Reminder (Safe if you use Google Tasks).
remove_app com.samsung.android.app.samsungmall # Samsung Shop
remove_app com.samsung.android.app.spage # Samsung Free / TV Plus
remove_app com.samsung.android.ardrawing # AR Doodle
remove_app com.samsung.android.calendar # Samsung Calendar
remove_app com.samsung.android.email.provider # Samsung Email
remove_app com.samsung.android.kidsinstaller # Samsung Kids - Safe to remove if you don't have children using your phone
remove_app com.samsung.android.samsungpass  # Samsung Pass (Safe if you use Google Password Manager or Bitwarden).
remove_app com.samsung.android.spay  # Samsung Wallet (Safe if you use Google Wallet)
remove_app com.samsung.android.tvplus # Samsung TV Plus
remove_app com.samsung.android.voc # Samsung Members - The community/support app
remove_app com.samsung.sree # Samsung Global Goals - The app that shows ads on your lock screen for charity
remove_app com.sec.android.app.popupcalculator # Samsung Calculator
remove_app com.sec.android.daemonapp  # Samsung Weather (Safe if you use the Google Weather widget).
remove_app com.samsung.android.aremoji # AR Emoji
remove_app com.samsung.android.aremojieditor # AR Emoji
remove_app com.sec.android.mimage.avatarstickers # AR Emoji
remove_app com.microsoft.skydrive # Microsoft OneDrive
remove_app com.touchtype.swiftkey # Microsoft SwiftKey
remove_app com.microsoft.copilot # Microsoft CoPilot
remove_app com.facebook.appmanager # Facebook Background Services & Update Managers
remove_app com.facebook.system # Facebook Background Services & Update Managers
remove_app com.facebook.services # Facebook Background Services & Update Managers
remove_app com.facebook.appmanager.intel
# disable_app com.google.android.gms.supervision # ⚠️ Family Link / parental controls
# remove_app com.samsung.android.app.updatecenter # ⚠️ Samsung app updates
# remove_app com.samsung.android.messaging # ⚠️ Samsung Messages (OK if using Google Messages)
