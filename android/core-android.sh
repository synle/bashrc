do_uninstall(){
  echo 'pm uninstall -k --user 0' $@
  pm uninstall -k --user 0 $@
}

do_setting(){
  echo 'settings put' $@
  settings put $@
}

######################################################################################
###### prep work
######################################################################################
pm grant com.google.android.dialer android.permission.WRITE_SECURE_SETTINGS

# animation speed
do_setting global window_animation_scale 0.33
do_setting global transition_animation_scale 0.33
do_setting global animator_duration_scale 0.33

# private dns
do_setting global private_dns_mode hostname
do_setting global private_dns_specifier security.cloudflare-dns.com # do_setting global private_dns_specifier one.one.one.one

# tether dun fixed
do_setting global tether_dun_required 0

# enable adb flags
do_setting global adb_enabled 1
do_setting global adb_wifi_enabled 0

# enable auto time and tikmezone
do_setting global auto_time 1
do_setting global auto_time_zone 1

# enable data roaming
do_setting global data_roaming 1

# enable cellular on boot
do_setting global enable_cellular_on_boot 1

######################################################################################
###### clean up bloats
######################################################################################
######################################################################################
do_uninstall com.android.bips
do_uninstall com.android.bookmarkprovider
do_uninstall com.android.browser
do_uninstall com.android.browser.provider
do_uninstall com.android.chrome
do_uninstall com.android.dreams.basic
do_uninstall com.android.dreams.phototable
do_uninstall com.android.egg
do_uninstall com.android.galaxy4
do_uninstall com.android.magicsmoke
do_uninstall com.android.musicvis
do_uninstall com.android.noisefield
do_uninstall com.android.phasebeam
do_uninstall com.android.quicksearchbox
do_uninstall com.android.wallpapercropper
do_uninstall com.audible.application
do_uninstall com.example.android.notepad
do_uninstall com.facebook.appmanager
do_uninstall com.facebook.services
do_uninstall com.facebook.system
do_uninstall com.google.android.apps.tachyon
do_uninstall com.google.android.googlequicksearchbox
do_uninstall com.google.android.music
do_uninstall com.google.android.printservice.recommendation
do_uninstall com.google.android.projection.gearhead
do_uninstall com.google.android.trichromelibrary_410410683
do_uninstall com.google.android.trichromelibrary_438908634
do_uninstall com.google.android.trichromelibrary_438909034
do_uninstall com.google.android.trichromelibrary_438910534
do_uninstall com.google.android.tts
do_uninstall com.google.android.videos
do_uninstall com.google.android.youtube
do_uninstall com.google.ar.core
do_uninstall com.google.audio.hearing.visualization.accessibility.scribe
do_uninstall com.google.vr.vrcore
do_uninstall com.microsoft.skydrive
do_uninstall com.samsung.android.calendar
do_uninstall com.sec.android.app.clockpackage
do_uninstall com.sec.android.app.sbrowser
do_uninstall flipboard.boxer.app
do_uninstall com.dsi.ant.plugins.antplus
do_uninstall com.dsi.ant.sample.acquirechannels
do_uninstall com.dsi.ant.server
do_uninstall com.dsi.ant.service.socket
do_uninstall com.samsung.android.wellbeing


######################################################################################
###### Done
######################################################################################
echo '=== Done Prep work for android shell'
