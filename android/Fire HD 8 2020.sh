# Launcher Hijack
# https://www.androidpolice.com/2020/07/23/how-to-make-your-amazon-fire-tablet-feel-more-like-stock-android/
# install a launcher first
# pm disable-user --user 0 com.amazon.firelauncher

## safe
pm disable-user amazon.alexa.tablet
pm disable-user com.amazon.alexa.modeswitch
pm disable-user com.amazon.alexa.multimodal.gemini
pm disable-user com.amazon.alexa.youtube.app
pm disable-user com.amazon.kor.demo
pm disable-user com.amazon.photos
pm disable-user com.android.email
pm disable-user com.android.calculator2
pm disable-user com.amazon.weather
pm disable-user jp.co.omronsoft.iwnnime.languagepack.kokr_az
pm disable-user jp.co.omronsoft.iwnnime.languagepack.zhcn_az
pm disable-user jp.co.omronsoft.iwnnime.languagepack.zhtw_az
pm disable-user jp.co.omronsoft.iwnnime.mlaz
pm disable-user jp.co.omronsoft.iwnnime.mlazPackage 

### Contacts
pm disable-user com.amazon.dp.contacts
pm disable-user com.amazon.dp.fbcontacts
pm disable-user com.android.contacts

### Calemndar
pm disable-user com.android.calendar
pm disable-user com.amazon.photos.importer

### Map
pm disable-user com.amazon.geo.mapsv3.services
pm disable-user com.amazon.geo.mapsv3.resources
pm disable-user com.amazon.geo.mapsv2
pm disable-user com.amazon.geo.client.maps

### Silk Browser
pm disable-user com.amazon.cloud9.systembrowserprovider
pm disable-user com.amazon.cloud9.contentservice
pm disable-user com.amazon.cloud9
pm disable-user com.amazon.cloud9.kids

### Kindle
pm disable-user com.goodreads.kindle
pm disable-user com.audible.application.kindle
pm disable-user com.amazon.kindle.otter.oobe.forced.ota
pm disable-user com.amazon.ods.kindleconnect
pm disable-user com.amazon.kindle.personal_video
pm disable-user com.amazon.kindle.kso
pm disable-user com.amazon.kindleautomatictimezone
pm disable-user com.amazon.kindle.starsight
pm disable-user com.amazon.kindle.otter.oobe
pm disable-user com.amazon.kindle.unifiedSearch
pm disable-user com.amazon.kindle.rdmdeviceadmin
pm disable-user com.amazon.kindle

### Misc
pm disable-user com.amazon.imdb.tv.mobile.app ### Freevee IMDB
pm disable-user com.android.documentsui # doc ui
pm disable-user com.amazon.tahoe # amazon kids
pm disable-user com.amazon.venezia # amazon store
pm disable-user com.android.calculator2 # calculator
pm disable-user com.android.calendar # calendar
pm disable-user com.android.email # email
pm disable-user com.amazon.geo.client.maps # maps
pm disable-user com.amazon.kindle.kso # amazon offers
pm disable-user com.amazon.zico # amazon docs
pm disable-user com.amazon.csapp# amazon offers

## packages removed
pm disable-user amazon.jackson19
pm disable-user amazon.speech.audiostreamproviderservice
pm disable-user amazon.speech.davs.davcservice
pm disable-user amazon.speech.sim
pm disable-user amazon.speech.wakewordservice
pm disable-user android.amazon.perm
pm disable-user com.amazon.aca
pm disable-user com.amazon.accessorynotifier
pm disable-user com.amazon.ags.app
pm disable-user com.amazon.alta.h2clientservice
pm disable-user com.amazon.android.marketplace
pm disable-user com.amazon.application.compatibility.enforcer
pm disable-user com.amazon.application.compatibility.enforcer.sdk.library
pm disable-user com.amazon.ava.shopping.android
pm disable-user com.amazon.avod
pm disable-user com.amazon.bioscope
pm disable-user com.amazon.cardinal
pm disable-user com.amazon.client.metrics
pm disable-user com.amazon.client.metrics.api
pm disable-user com.amazon.comms.kids
pm disable-user com.amazon.comms.knightcontacts
pm disable-user com.amazon.comms.knightmessaging
pm disable-user com.amazon.comms.multimodaltachyonarm
pm disable-user com.amazon.communication.discovery
pm disable-user com.amazon.connectivitydiag
pm disable-user com.amazon.csapp
pm disable-user com.amazon.dcp
pm disable-user com.amazon.dcp.contracts.framework.library
pm disable-user com.amazon.dcp.contracts.library
pm disable-user com.amazon.dee.app
pm disable-user com.amazon.device.backup
pm disable-user com.amazon.device.backup.sdk.internal.library
pm disable-user com.amazon.device.crashmanager
pm disable-user com.amazon.device.logmanager
pm disable-user com.amazon.device.messaging
pm disable-user com.amazon.device.messaging.sdk.internal.library
pm disable-user com.amazon.device.messaging.sdk.library
pm disable-user com.amazon.device.metrics
pm disable-user com.amazon.device.sale.service
pm disable-user com.amazon.device.settings
pm disable-user com.amazon.device.settings.sdk.internal.library
pm disable-user com.amazon.device.software.ota
pm disable-user com.amazon.device.software.ota.override
pm disable-user com.amazon.device.sync
pm disable-user com.amazon.device.sync.sdk.internal
pm disable-user com.amazon.diode
pm disable-user com.amazon.dp.logger
pm disable-user com.amazon.fireinputdevices
pm disable-user com.amazon.firelauncher
pm disable-user com.amazon.geo.kms.client
pm disable-user com.amazon.geo.mapsv2.services
pm disable-user com.amazon.glorialist
pm disable-user com.amazon.h2settingsfortablet
pm disable-user com.amazon.identity.auth.device.authorization
pm disable-user com.amazon.imdb.tv.mobile.app
pm disable-user com.amazon.imp
pm disable-user com.amazon.iris
pm disable-user com.amazon.kindle.cms
pm disable-user com.amazon.knight.blink
pm disable-user com.amazon.knight.calendar
pm disable-user com.amazon.knight.ecs
pm disable-user com.amazon.knight.hds
pm disable-user com.amazon.legalsettings
pm disable-user com.amazon.logan
pm disable-user com.amazon.mp3
pm disable-user com.amazon.nimh
pm disable-user com.amazon.paladin
pm disable-user com.amazon.parentalcontrols
pm disable-user com.amazon.platform
pm disable-user com.amazon.platform.fdrw
pm disable-user com.amazon.pm
pm disable-user com.amazon.providers.contentsupport
pm disable-user com.amazon.readynowcore
pm disable-user com.amazon.recess
pm disable-user com.amazon.redstone
pm disable-user com.amazon.securitysyncclient
pm disable-user com.amazon.settings.systemupdates
pm disable-user com.amazon.sharingservice.android.client.proxy
pm disable-user com.amazon.shpm
pm disable-user com.amazon.smartgenie
pm disable-user com.amazon.speechui
pm disable-user com.amazon.switchaccess.root
pm disable-user com.amazon.sync.provider.ipc
pm disable-user com.amazon.sync.service
pm disable-user com.amazon.tablet.dock.settings
pm disable-user com.amazon.tabletsubscriptions
pm disable-user com.amazon.tahoe
pm disable-user com.amazon.tcomm
pm disable-user com.amazon.tcomm.client
pm disable-user com.amazon.tv.launcher
pm disable-user com.amazon.tv.ottssocompanionapp
pm disable-user com.amazon.venezia
pm disable-user com.amazon.virtual.dash.knight.app
pm disable-user com.amazon.webapp
pm disable-user com.amazon.whisperlink.activityview.android
pm disable-user com.amazon.whisperlink.core.android
pm disable-user com.amazon.whisperplay.contracts
pm disable-user com.amazon.whisperplay.service.install
pm disable-user com.amazon.wifilocker
pm disable-user com.amazon.windowshop
pm disable-user com.amazon.wirelessmetrics.service
pm disable-user com.amazon.zico
pm disable-user com.amazon.zordon
pm disable-user com.android.deskclock
pm disable-user com.android.music
pm disable-user com.android.musicfx
pm disable-user com.android.onetimeinitializer
pm disable-user com.android.protips
pm disable-user com.android.providers.downloads.ui
pm disable-user com.android.quicksearchbox
pm disable-user com.android.sharedstoragebackup
pm disable-user com.fireos.arcus.proxy
pm disable-user com.here.odnp.service
pm disable-user com.ivona.orchestrator
pm disable-user com.ivona.tts.oem
pm disable-user com.kingsoft.office.amz
pm disable-user com.svox.pico
