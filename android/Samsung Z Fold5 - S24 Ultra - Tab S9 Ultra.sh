function put_setting(){
  echo "> Put Setting:" $@
  settings put global $@
}

function removeApp(){
  echo "> Remove:" $@
  pm uninstall $@
  pm uninstall -k --user 0 $@
  pm uninstall -k --user 10 $@
  pm disable-user --user 0 $@
  pm disable-user -k --user 0 $@


  # function restoreApp(){
  #   echo "> Restore:" $@
  #   cmd package install-existing $@
  # }
}


#################################################################

## global settings
put_setting global window_animation_scale 0 # animation speed
put_setting global transition_animation_scale 0.4 # animation speed
put_setting global animator_duration_scale 0.4 # animation speed
put_setting global force_gpu_rendering 1 # Force GPU rendering (can help older devices)
put_setting global wifi_scan_always_enabled 0 # Disable constant Wi-Fi scanning
put_setting global ble_scan_always_enabled 0 # Disable Bluetooth scanning
put_setting global disable_window_blurs 1 # Disable system-wide blur (huge on Samsung / Pixel)
put_setting global accessibility_reduce_transparency 1 #Reduce transparency & visual effects
put_setting global accessibility_reduce_motion 1 # Reduce transparency & visual effects
put_setting global analytics_enabled 0 # Disable system analytics / logging
put_setting global usage_reporting_enabled 0 # Disable system analytics / logging
put_setting global wifi_watchdog_on 0 # Prefer faster handoff to mobile data

## secure settings
put_setting secure long_press_timeout 400  # Improve touch responsiveness (default 500)

## remove app
removeApp com.android.chrome
removeApp com.samsung.android.honeyboard # samsung keyboard
removeApp com.sec.android.app.sbrowser # samsung browser
removeApp com.samsung.android.bixby.agent # bixby
removeApp com.samsung.android.bixby.service # bixby
removeApp com.samsung.android.bixbyvision.framework # bixby
removeApp com.samsung.android.app.routines # bixby
