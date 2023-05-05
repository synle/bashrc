function removeApp(){
  echo 'pm uninstall -k --user 0' $@
  pm uninstall -k --user 0 $@
}

function changeSetting(){
  echo 'settings put' $@
  settings put $@
}

removeApp cci.usage
removeApp com.amazon.mShop.android.shopping
removeApp com.android.chrome
removeApp com.android.dialer
removeApp com.android.inputmethod.latin
removeApp com.att.iqi
removeApp com.cricketwireless.minus
removeApp com.cricketwireless.thescoop
removeApp com.google.android.apps.googleassistant
removeApp com.google.android.apps.subscriptions.red
removeApp com.google.android.apps.tachyon
removeApp com.google.android.apps.wallpaper
removeApp com.google.android.apps.youtube.music
removeApp com.google.android.contacts
removeApp com.google.android.videos
removeApp com.google.android.youtube
removeApp com.handmark.expressweather
removeApp com.motorola.actions
removeApp com.motorola.aiservices
removeApp com.motorola.android.launcher.overlay.amx
removeApp com.motorola.android.launcher.overlay.koodo
removeApp com.motorola.android.launcher.overlay.retail
removeApp com.motorola.android.launcher.overlay.telus
removeApp com.motorola.android.messaging.overlay.att.ambs
removeApp com.motorola.brapps
removeApp com.motorola.carrierconfig
removeApp com.motorola.ccc.notification
removeApp com.motorola.contacts.preloadcontacts.overlay.vzw
removeApp com.motorola.easyprefix
removeApp com.motorola.extensions.tracfone
removeApp com.motorola.fmplayer
removeApp com.motorola.gamemode
removeApp com.motorola.genie
removeApp com.motorola.help
removeApp com.motorola.iqimotmetrics
removeApp com.motorola.launcherconfig.overlay.amxla
removeApp com.motorola.launcherconfig.overlay.tracfone
removeApp com.motorola.livewallpaper3
removeApp com.motorola.messaging
removeApp com.motorola.moto
removeApp com.motorola.motodisplay
removeApp com.motorola.motofpstouch
removeApp com.motorola.motosignature.app
removeApp com.motorola.motosignature2.app
removeApp com.motorola.mototour
removeApp com.motorola.omadm.att
removeApp com.motorola.omadm.usc
removeApp com.motorola.omadm.vzw
removeApp com.motorola.settings
removeApp com.motorola.setup.overlay.amx
removeApp com.motorola.setup.overlay.pai
removeApp com.motorola.setup.overlay.tracfone
removeApp com.motorola.spectrum.setup.extensions
removeApp com.motorola.stylus
removeApp com.motorola.timeweatherwidget
removeApp com.motorola.ts43.serviceconfig
removeApp com.roaming.android.gsimbase
removeApp com.roaming.android.gsimcontentprovider
removeApp com.tracfone.generic.mysites
removeApp com.tracfone.preload.accountservices
removeApp com.uscc.ecid
