function removeApp(){
  echo "> Remove: " $@
  removeApp $@ || pm uninstall -k --user 10 $@
}

removeApp air.com.vudu.air.DownloaderTablet
removeApp android.autoinstalls.config.sony.bravia
removeApp com.amazon.aiv.eu
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
removeApp com.google.android.leanbacklauncher
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
removeApp com.hisense.favkey
removeApp com.hisense.tv.protector
removeApp com.jamdeo.tv.mediacenter
removeApp com.opera.sdk.example
removeApp com.pandora.android.atv
removeApp com.seraphic.browser
removeApp com.sony.dtv.youview
removeApp com.youview.tv.servicehost
removeApp tv.samba.ssm

# cautious!
removeApp com.mstar.android.tv.disclaimercustomization
removeApp com.mstar.netflixobserver # can be replaced with button mapper
# removeApp com.jamdeo.tv.mediacenterapplication
