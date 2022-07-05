function removeApp(){
  echo 'pm uninstall -k --user 0' $@
  pm uninstall -k --user 0 $@
  pm disable-user $@
}


# Launcher Hijack
# https://www.androidpolice.com/2020/07/23/how-to-make-your-amazon-fire-tablet-feel-more-like-stock-android/
# install a launcher first
# removeApp com.amazon.firelauncher

## safe
removeApp amazon.alexa.tablet
removeApp com.amazon.alexa.modeswitch
removeApp com.amazon.alexa.multimodal.gemini
removeApp com.amazon.alexa.youtube.app
removeApp com.amazon.kor.demo
removeApp com.amazon.photos
removeApp com.android.email
removeApp com.android.calculator2
removeApp com.amazon.weather
removeApp jp.co.omronsoft.iwnnime.languagepack.kokr_az
removeApp jp.co.omronsoft.iwnnime.languagepack.zhcn_az
removeApp jp.co.omronsoft.iwnnime.languagepack.zhtw_az
removeApp jp.co.omronsoft.iwnnime.mlaz
removeApp jp.co.omronsoft.iwnnime.mlazPackage 

### Contacts
removeApp com.amazon.dp.contacts
removeApp com.amazon.dp.fbcontacts
removeApp com.android.contacts

### Calemndar
removeApp com.android.calendar
removeApp com.amazon.photos.importer

### Map
removeApp com.amazon.geo.mapsv3.services
removeApp com.amazon.geo.mapsv3.resources
removeApp com.amazon.geo.mapsv2
removeApp com.amazon.geo.client.maps

### Silk Browser
removeApp com.amazon.cloud9.systembrowserprovider
removeApp com.amazon.cloud9.contentservice
removeApp com.amazon.cloud9
removeApp com.amazon.cloud9.kids

### Kindle
removeApp com.goodreads.kindle
removeApp com.audible.application.kindle
removeApp com.amazon.kindle.otter.oobe.forced.ota
removeApp com.amazon.ods.kindleconnect
removeApp com.amazon.kindle.personal_video
removeApp com.amazon.kindle.kso
removeApp com.amazon.kindleautomatictimezone
removeApp com.amazon.kindle.starsight
removeApp com.amazon.kindle.otter.oobe
removeApp com.amazon.kindle.unifiedSearch
removeApp com.amazon.kindle.rdmdeviceadmin
removeApp com.amazon.kindle

### Misc
removeApp com.amazon.imdb.tv.mobile.app ### Freevee IMDB
removeApp com.android.documentsui # doc ui
removeApp com.amazon.tahoe # amazon kids
removeApp com.amazon.venezia # amazon store
removeApp com.android.calculator2 # calculator
removeApp com.android.calendar # calendar
removeApp com.android.email # email
removeApp com.amazon.geo.client.maps # maps
removeApp com.amazon.kindle.kso # amazon offers
removeApp com.amazon.zico # amazon docs
removeApp com.amazon.csapp# amazon offers

## packages removed
removeApp amazon.jackson19
removeApp amazon.speech.audiostreamproviderservice
removeApp amazon.speech.davs.davcservice
removeApp amazon.speech.sim
removeApp amazon.speech.wakewordservice
removeApp android.amazon.perm
removeApp com.amazon.aca
removeApp com.amazon.accessorynotifier
removeApp com.amazon.ags.app
removeApp com.amazon.alta.h2clientservice
removeApp com.amazon.android.marketplace
removeApp com.amazon.application.compatibility.enforcer
removeApp com.amazon.application.compatibility.enforcer.sdk.library
removeApp com.amazon.ava.shopping.android
removeApp com.amazon.avod
removeApp com.amazon.bioscope
removeApp com.amazon.cardinal
removeApp com.amazon.client.metrics
removeApp com.amazon.client.metrics.api
removeApp com.amazon.comms.kids
removeApp com.amazon.comms.knightcontacts
removeApp com.amazon.comms.knightmessaging
removeApp com.amazon.comms.multimodaltachyonarm
removeApp com.amazon.communication.discovery
removeApp com.amazon.connectivitydiag
removeApp com.amazon.csapp
removeApp com.amazon.dcp
removeApp com.amazon.dcp.contracts.framework.library
removeApp com.amazon.dcp.contracts.library
removeApp com.amazon.dee.app
removeApp com.amazon.device.backup
removeApp com.amazon.device.backup.sdk.internal.library
removeApp com.amazon.device.crashmanager
removeApp com.amazon.device.logmanager
removeApp com.amazon.device.messaging
removeApp com.amazon.device.messaging.sdk.internal.library
removeApp com.amazon.device.messaging.sdk.library
removeApp com.amazon.device.metrics
removeApp com.amazon.device.sale.service
removeApp com.amazon.device.settings
removeApp com.amazon.device.settings.sdk.internal.library
removeApp com.amazon.device.software.ota
removeApp com.amazon.device.software.ota.override
removeApp com.amazon.device.sync
removeApp com.amazon.device.sync.sdk.internal
removeApp com.amazon.diode
removeApp com.amazon.dp.logger
removeApp com.amazon.fireinputdevices
removeApp com.amazon.firelauncher
removeApp com.amazon.geo.kms.client
removeApp com.amazon.geo.mapsv2.services
removeApp com.amazon.glorialist
removeApp com.amazon.h2settingsfortablet
removeApp com.amazon.identity.auth.device.authorization
removeApp com.amazon.imdb.tv.mobile.app
removeApp com.amazon.imp
removeApp com.amazon.iris
removeApp com.amazon.kindle.cms
removeApp com.amazon.knight.blink
removeApp com.amazon.knight.calendar
removeApp com.amazon.knight.ecs
removeApp com.amazon.knight.hds
removeApp com.amazon.legalsettings
removeApp com.amazon.logan
removeApp com.amazon.mp3
removeApp com.amazon.nimh
removeApp com.amazon.paladin
removeApp com.amazon.parentalcontrols
removeApp com.amazon.platform
removeApp com.amazon.platform.fdrw
removeApp com.amazon.pm
removeApp com.amazon.providers.contentsupport
removeApp com.amazon.readynowcore
removeApp com.amazon.recess
removeApp com.amazon.redstone
removeApp com.amazon.securitysyncclient
removeApp com.amazon.settings.systemupdates
removeApp com.amazon.sharingservice.android.client.proxy
removeApp com.amazon.shpm
removeApp com.amazon.smartgenie
removeApp com.amazon.speechui
removeApp com.amazon.switchaccess.root
removeApp com.amazon.sync.provider.ipc
removeApp com.amazon.sync.service
removeApp com.amazon.tablet.dock.settings
removeApp com.amazon.tabletsubscriptions
removeApp com.amazon.tahoe
removeApp com.amazon.tcomm
removeApp com.amazon.tcomm.client
removeApp com.amazon.tv.launcher
removeApp com.amazon.tv.ottssocompanionapp
removeApp com.amazon.venezia
removeApp com.amazon.virtual.dash.knight.app
removeApp com.amazon.webapp
removeApp com.amazon.whisperlink.activityview.android
removeApp com.amazon.whisperlink.core.android
removeApp com.amazon.whisperplay.contracts
removeApp com.amazon.whisperplay.service.install
removeApp com.amazon.wifilocker
removeApp com.amazon.windowshop
removeApp com.amazon.wirelessmetrics.service
removeApp com.amazon.zico
removeApp com.amazon.zordon
removeApp com.android.deskclock
removeApp com.android.music
removeApp com.android.musicfx
removeApp com.android.onetimeinitializer
removeApp com.android.protips
removeApp com.android.providers.downloads.ui
removeApp com.android.quicksearchbox
removeApp com.android.sharedstoragebackup
removeApp com.fireos.arcus.proxy
removeApp com.here.odnp.service
removeApp com.ivona.orchestrator
removeApp com.ivona.tts.oem
removeApp com.kingsoft.office.amz
removeApp com.svox.pico
