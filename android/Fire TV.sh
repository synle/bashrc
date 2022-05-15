function removeApp(){
  echo "> Remove: " $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

#https://www.techdoctoruk.com/firestick-debloat-tool/
removeApp com.amazon.ags.app
removeApp com.amazon.alexashopping
removeApp com.amazon.alta.h2clientservice
removeApp com.amazon.android.service.networkmonitor
removeApp com.amazon.awvflingreceiver
removeApp com.amazon.bueller.music
removeApp com.amazon.bueller.notification
removeApp com.amazon.bueller.photos
removeApp com.amazon.connectivitydiag
removeApp com.amazon.device.crashmanager
removeApp com.amazon.device.messaging
removeApp com.amazon.device.messaging.sdk.internal.library
removeApp com.amazon.device.messaging.sdk.library
removeApp com.amazon.device.software.ota
removeApp com.amazon.device.software.ota.override
removeApp com.amazon.device.sync
removeApp com.amazon.device.sync.sdk.internal
removeApp com.amazon.firebat
removeApp com.amazon.ftv.screensaver
removeApp com.amazon.hedwig
removeApp com.amazon.imbd.tv.android.app
removeApp com.amazon.jackson19
removeApp com.amazon.kindle.cms
removeApp com.amazon.kindle.devicecontrols
removeApp com.amazon.kindleautomatictimezone
removeApp com.amazon.kso.blackbird
removeApp com.amazon.logan
removeApp com.amazon.ods.kindleconnect
removeApp com.amazon.providers
removeApp com.amazon.providers.contentsupport
removeApp com.amazon.recess
removeApp com.amazon.securitysyncclient
removeApp com.amazon.sharingservice.android.client.proxy
removeApp com.amazon.shoptv.client
removeApp com.amazon.sync.service
removeApp com.amazon.tahoe
removeApp com.amazon.tmm.tutorial
removeApp com.amazon.tv.csapp
removeApp com.amazon.tv.forcedotaupdater.v2
removeApp com.amazon.tv.fw.metrics
removeApp com.amazon.tv.legal.notices
removeApp com.amazon.tv.livetv
removeApp com.amazon.tv.nimh
removeApp com.amazon.tv.releasenotes
removeApp com.amazon.tv.support
removeApp com.amazon.webview
removeApp com.android.documentsui
removeApp com.android.wallpaperbackup
removeApp com.ivona.orchestrator
removeApp com.ivona.tts.oem
removeApp com.svox.pico

