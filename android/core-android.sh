removeApp(){
  echo 'pm uninstall -k --user 0' $@
  pm uninstall -k --user 0 $@
}

changeSetting(){
  echo 'settings put' $@
  settings put $@
}

######################################################################################
###### prep work
######################################################################################
pm grant com.google.android.dialer android.permission.WRITE_SECURE_SETTINGS

# animation speed
changeSetting global window_animation_scale 0.33
changeSetting global transition_animation_scale 0.33
changeSetting global animator_duration_scale 0.33

# private dns
changeSetting global private_dns_mode hostname
changeSetting global private_dns_specifier security.cloudflare-dns.com # changeSetting global private_dns_specifier one.one.one.one

# tether dun fixed
changeSetting global tether_dun_required 0

# enable adb flags
changeSetting global adb_enabled 1
changeSetting global adb_wifi_enabled 0

# enable auto time and tikmezone
changeSetting global auto_time 1
changeSetting global auto_time_zone 1

# enable data roaming
changeSetting global data_roaming 1

# enable cellular on boot
changeSetting global enable_cellular_on_boot 1

######################################################################################
###### clean up bloats
######################################################################################
######################################################################################
removeApp com.android.bips
removeApp com.android.bookmarkprovider
removeApp com.android.browser
removeApp com.android.browser.provider
removeApp com.android.chrome
removeApp com.android.dreams.basic
removeApp com.android.dreams.phototable
removeApp com.android.egg
removeApp com.android.galaxy4
removeApp com.android.magicsmoke
removeApp com.android.musicvis
removeApp com.android.noisefield
removeApp com.android.phasebeam
removeApp com.android.quicksearchbox
removeApp com.android.wallpapercropper
removeApp com.audible.application
removeApp com.dsi.ant.plugins.antplus
removeApp com.dsi.ant.sample.acquirechannels
removeApp com.dsi.ant.server
removeApp com.dsi.ant.service.socket
removeApp com.example.android.notepad
removeApp com.facebook.appmanager
removeApp com.facebook.services
removeApp com.facebook.system
removeApp com.google.android.apps.tachyon
removeApp com.google.android.googlequicksearchbox
removeApp com.google.android.music
removeApp com.google.android.printservice.recommendation
removeApp com.google.android.projection.gearhead
removeApp com.google.android.trichromelibrary_410410683
removeApp com.google.android.trichromelibrary_438908634
removeApp com.google.android.trichromelibrary_438909034
removeApp com.google.android.trichromelibrary_438910534
removeApp com.google.android.tts
removeApp com.google.android.videos
removeApp com.google.android.youtube
removeApp com.google.ar.core
removeApp com.google.audio.hearing.visualization.accessibility.scribe
removeApp com.google.vr.vrcore
removeApp com.microsoft.skydrive
removeApp com.samsung.android.calendar
removeApp com.samsung.android.wellbeing
removeApp com.sec.android.app.clockpackage
removeApp com.sec.android.app.sbrowser
removeApp flipboard.boxer.app


######################################################################################
###### Done
######################################################################################
echo '=== Done Prep work for android shell'
