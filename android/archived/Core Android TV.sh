function removeApp(){
  echo "> Remove:" $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

function restoreApp(){
  echo "> Restore:" $@
  cmd package install-existing $@
}

function changeSetting(){
  echo 'settings put' $@
  settings put $@
}

# animation speed
changeSetting global window_animation_scale 0
changeSetting global transition_animation_scale 0
changeSetting global animator_duration_scale 0

# private dns
changeSetting global private_dns_mode hostname
changeSetting global private_dns_specifier security.cloudflare-dns.com # changeSetting global private_dns_specifier one.one.one.one

# enable auto time and timezone
changeSetting global auto_time 1
changeSetting global auto_time_zone 1


######################################################################################
###### clean up bloats
######################################################################################
######################################################################################
removeApp air.com.vudu.air.DownloaderTablet
removeApp android.autoinstalls.config.sony.bravia
removeApp com.amazon.aiv.eu
removeApp com.android.cts.ctsshim
removeApp com.android.cts.priv.ctsshim
removeApp com.android.htmlviewer
removeApp com.android.printspooler
removeApp com.android.providers.calendar
removeApp com.android.providers.contacts
removeApp com.android.providers.contactsSuccess
removeApp com.android.providers.userdictionary
removeApp com.google.android.apps.tv.dreamx
removeApp com.google.android.feedback
removeApp com.google.android.inputmethod.japanese
removeApp com.google.android.katniss
removeApp com.google.android.leanbacklauncher # be careful with this (TV Launcher) - do this after button mapper and launcher
removeApp com.google.android.leanbacklauncher.recommendations # be careful with this (TV Launcher) - do this after button mapper and launcher
removeApp com.google.android.marvin.talkback
removeApp com.google.android.music
removeApp com.google.android.musicSuccess
removeApp com.google.android.partnersetup
removeApp com.google.android.play.games
removeApp com.google.android.speech.pumpkin
removeApp com.google.android.syncadapters.calendar
removeApp com.google.android.syncadapters.contacts
removeApp com.google.android.tts
removeApp com.google.android.tv.bugreportsender
removeApp com.google.android.tvrecommendations
removeApp com.google.android.tvtutorials
removeApp com.google.android.videos
removeApp com.google.android.youtube.tv
removeApp com.google.android.youtube.tvkids
removeApp com.google.android.youtube.tvmusic
removeApp com.google.android.youtube.tvmusicSuccess
removeApp com.google.android.youtube.tvSuccess
removeApp com.opera.sdk.example
removeApp com.pandora.android.atv
removeApp com.seraphic.browser
removeApp com.sony.dtv.youview
removeApp com.youview.tv.servicehost
removeApp tv.samba.ssm
