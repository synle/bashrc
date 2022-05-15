function removeApp(){
  echo "> Remove: " $@
  pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

# Common Android TV
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
removeApp com.jamdeo.tv.mediacenter
removeApp com.opera.sdk.example
removeApp com.pandora.android.atv
removeApp com.seraphic.browser
removeApp com.sony.dtv.youview
removeApp com.youview.tv.servicehost
removeApp tv.samba.ssm

# Hisense ULED 4K Premium 75U6G (xiaoyushan)
removeApp com.hisense.favkey
removeApp com.hisense.service.message
removeApp com.hisense.tv.protector

# cautious!
removeApp com.mstar.android.tv.disclaimercustomization
removeApp com.mstar.netflixobserver # can be replaced with button mapper
# experimental!
removeApp com.hisense.storemode
removeApp com.hisense.alexa
removeApp com.hisense.hitv.hicloud.account
# removeApp com.jamdeo.tv.mediacenterapplication
