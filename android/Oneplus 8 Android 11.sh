curl -s "https://raw.githubusercontent.com/synle/bashrc/master/android/Core Android.sh" | sh

function removeApp(){
  echo "> Remove:" $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

function restoreApp(){
  echo "> Restore:" $@
  cmd package install-existing $@
}

#
removeApp com.facebook.appmanager
removeApp com.facebook.services
removeApp com.facebook.system
removeApp com.google.android.apps.googleassistant
removeApp com.google.android.apps.magazines
removeApp com.google.android.apps.maps # Google Maps
removeApp com.google.android.apps.nbu.files
removeApp com.google.android.apps.photos # Google Photos
removeApp com.google.android.apps.podcasts
removeApp com.google.android.apps.subscriptions.red
removeApp com.google.android.apps.tachyon # Google Duo
removeApp com.google.android.apps.walletnfcrel # Google Wallet
removeApp com.google.android.apps.wellbeing # Digital Wellbeing
removeApp com.google.android.apps.youtube.music
removeApp com.google.android.calendar # Gooogle Calendar
removeApp com.google.android.documentsui # Files 9
removeApp com.google.android.feedback
removeApp com.google.android.gm # Gmail
removeApp com.google.android.googlequicksearchbox # Search Widget
removeApp com.google.android.marvin.talkback # Talkback
removeApp com.google.android.music # Google Play Music
removeApp com.google.android.onetimeinitializer
removeApp com.google.android.printservice.recommendation # Mobile printing service
removeApp com.google.android.projection.gearhead
removeApp com.google.android.videos # Google Play Movies & TV
removeApp com.google.android.youtube # YouTube
removeApp com.google.ar.core # AR Core
removeApp com.heytap.cloud
removeApp com.heytap.mcs
removeApp com.heytap.openid
removeApp com.instagram.android
removeApp com.netflix.mediaclient
removeApp com.netflix.partner.activation
removeApp com.oneplus.backuprestore
removeApp com.oneplus.calculator
removeApp com.oneplus.contacts # Oneplus Contact
removeApp com.oneplus.deskclock
removeApp com.oneplus.note
removeApp com.tmobile.m1
removeApp com.tmobile.pr.mytmobile # my tmobile
removeApp net.oneplus.forums


# default list
# android
# android.autoinstalls.config.oneplus
# android.framework.res.rro.oneplus
# android.frameworkres.overlay
# android.frameworkres.overlay.captions.product
# android.frameworkres.overlay.display.product
# android.frameworkres.overlay.Network
# android.overlay.common
# android.overlay.target
# com.amazon.appmanager
# com.android.apps.tag
# com.android.backupconfirm
# com.android.bluetooth
# com.android.bluetooth.oplus.overlay
# com.android.bluetoothmidiservice
# com.android.calllogbackup
# com.android.cameraextensions
# com.android.carrierconfig
# com.android.carrierconfig.oplus.overlay
# com.android.carrierconfig.overlay
# com.android.carrierconfig.overlay.common
# com.android.carrierdefaultapp
# com.android.cellbroadcastreceiver
# com.android.cellbroadcastreceiver.overlay.common
# com.android.certinstaller
# com.android.chrome
# com.android.companiondevicemanager
# com.android.contacts
# com.android.cts.ctsshim
# com.android.cts.priv.ctsshim
# com.android.dynsystem
# com.android.email.partnerprovider
# com.android.externalstorage
# com.android.hotspot2.osulogin
# com.android.hotwordenrollment.okgoogle
# com.android.hotwordenrollment.xgoogle
# com.android.htmlviewer
# com.android.incallui
# com.android.inputdevices
# com.android.internal.display.cutout.emulation.corner
# com.android.internal.display.cutout.emulation.double
# com.android.internal.display.cutout.emulation.hole
# com.android.internal.display.cutout.emulation.tall
# com.android.internal.display.cutout.emulation.waterfall
# com.android.internal.systemui.navbar.gestural
# com.android.internal.systemui.navbar.gestural_extra_wide_back
# com.android.internal.systemui.navbar.gestural_narrow_back
# com.android.internal.systemui.navbar.gestural_wide_back
# com.android.internal.systemui.navbar.threebutton
# com.android.internal.systemui.onehanded.gestural
# com.android.keychain
# com.android.launcher
# com.android.localtransport
# com.android.location.fused
# com.android.managedprovisioning
# com.android.mms
# com.android.mms.service
# com.android.mtp
# com.android.nfc
# com.android.ons
# com.android.pacprocessor
# com.android.phone
# com.android.phone.overlay.common
# com.android.phone.overlay.oplus
# com.android.printspooler
# com.android.providers.blockednumber
# com.android.providers.calendar
# com.android.providers.contacts
# com.android.providers.downloads
# com.android.providers.downloads.ui
# com.android.providers.media
# com.android.providers.partnerbookmarks
# com.android.providers.settings
# com.android.providers.telephony
# com.android.providers.userdictionary
# com.android.proxyhandler
# com.android.se
# com.android.server.telecom
# com.android.server.telecom.overlay.common
# com.android.settings
# com.android.settings.intelligence
# com.android.settings.overlay.common
# com.android.sharedstoragebackup
# com.android.shell
# com.android.simappdialog
# com.android.smspush
# com.android.statementservice
# com.android.stk
# com.android.storagemanager
# com.android.systemui
# com.android.systemui.overlay.charging.anim.wave_normal
# com.android.systemui.overlay.charging.anim.wave_supervooc
# com.android.systemui.overlay.charging.anim.wave_supervooc2
# com.android.systemui.overlay.charging.anim.wave_vooc
# com.android.systemui.overlay.charging.anim.wave_wireless
# com.android.systemui.overlay.common
# com.android.systemui.overlay.fingerprint.anim.energy
# com.android.systemui.overlay.fingerprint.anim.fireworks
# com.android.systemui.overlay.fingerprint.anim.magic
# com.android.systemui.overlay.fingerprint.anim.none
# com.android.systemui.overlay.fingerprint.anim.ripple
# com.android.systemui.overlay.fingerprint.anim.stripe
# com.android.systemui.overlay.fingerprint.anim.wormhole
# com.android.systemui.overlay.ust
# com.android.systemui.plugin.globalactions.wallet
# com.android.theme.font.notoserifsource
# com.android.traceur
# com.android.vending
# com.android.vpndialogs
# com.android.wallpaper.livepicker
# com.android.wallpaperbackup
# com.android.wifi.resources
# com.android.wifi.resources.overlay.common
# com.android.wifi.resources.overlay.oplus
# com.android.wifi.resources.overlay.target
# com.coloros.activation
# com.disney.disneyplus
# com.fido.asm
# com.fido.uafclient
# com.google.android.apps.docs
# com.google.android.apps.maps
# com.google.android.apps.messaging
# com.google.android.apps.nbu.files
# com.google.android.apps.restore
# com.google.android.apps.wellbeing
# com.google.android.as
# com.google.android.as.oss
# com.google.android.calendar
# com.google.android.captiveportallogin
# com.google.android.cellbroadcastreceiver
# com.google.android.cellbroadcastreceiver.overlay
# com.google.android.cellbroadcastreceiver.overlay.ust
# com.google.android.cellbroadcastservice
# com.google.android.cellbroadcastservice.overlay
# com.google.android.configupdater
# com.google.android.connectivity.resources
# com.google.android.documentsui
# com.google.android.ext.services
# com.google.android.ext.shared
# com.google.android.gm
# com.google.android.gms
# com.google.android.gms.location.history
# com.google.android.googlequicksearchbox
# com.google.android.gsf
# com.google.android.ims
# com.google.android.inputmethod.latin
# com.google.android.marvin.talkback
# com.google.android.modulemetadata
# com.google.android.networkstack
# com.google.android.networkstack.overlay
# com.google.android.networkstack.permissionconfig
# com.google.android.networkstack.tethering
# com.google.android.networkstack.tmo.overlay
# com.google.android.overlay.gmsconfig.common
# com.google.android.overlay.gmsconfig.comms
# com.google.android.overlay.gmsconfig.gsa
# com.google.android.overlay.modules.documentsui
# com.google.android.overlay.modules.ext.services
# com.google.android.overlay.modules.modulemetadata.forframework
# com.google.android.overlay.modules.permissioncontroller
# com.google.android.overlay.modules.permissioncontroller.forframework
# com.google.android.packageinstaller
# com.google.android.partnersetup
# com.google.android.permissioncontroller
# com.google.android.permissioncontroller.overlay.oplus
# com.google.android.providers.media.module
# com.google.android.setupwizard
# com.google.android.syncadapters.contacts
# com.google.android.tts
# com.google.android.webview
# com.google.mainline.telemetry
# com.gsma.rcs
# com.gsma.rcs.overlay
# com.heytap.accessory
# com.heytap.colorfulengine
# com.mediatek.omacp
# com.netflix.mediaclient
# com.oneplus.account
# com.oneplus.calculator
# com.oneplus.camera
# com.oneplus.camera.pictureprocessing
# com.oneplus.camera.service
# com.oneplus.canvasresources
# com.oneplus.faceunlock
# com.oneplus.filemanager
# com.oneplus.gallery
# com.oneplus.opscout
# com.oneplus.opshelf
# com.oneplus.opwlb
# com.oneplus.setupwizard
# com.oneplus.soundrecorder
# com.oneplus.wallpaper
# com.oplus.aod
# com.oplus.appplatform
# com.oplus.athena
# com.oplus.atlas
# com.oplus.audio.effectcenter
# com.oplus.battery
# com.oplus.blacklistapp
# com.oplus.bttestmode
# com.oplus.cast
# com.oplus.cosa
# com.oplus.crashbox
# com.oplus.deepthinker
# com.oplus.eid
# com.oplus.encryption
# com.oplus.engineercamera
# com.oplus.engineermode
# com.oplus.engineernetwork
# com.oplus.exserviceui
# com.oplus.exsystemservice
# com.oplus.eyeprotect
# com.oplus.framework.rro.oneplus
# com.oplus.framework.rro.tmo
# com.oplus.framework_bluetooth.overlay
# com.oplus.games
# com.oplus.gesture
# com.oplus.healthservice
# com.oplus.interconnectcollectkit
# com.oplus.launcherfacade.provider
# com.oplus.lfeh
# com.oplus.linker
# com.oplus.location
# com.oplus.location.overlay
# com.oplus.locationproxy
# com.oplus.logkit
# com.oplus.melody
# com.oplus.multiapp
# com.oplus.nhs
# com.oplus.notificationmanager
# com.oplus.nrMode
# com.oplus.ocs
# com.oplus.onet
# com.oplus.opusermanual
# com.oplus.ota
# com.oplus.phonenoareainquire
# com.oplus.postmanservice
# com.oplus.powermonitor
# com.oplus.qualityprotect
# com.oplus.romupdate
# com.oplus.safecenter
# com.oplus.sau
# com.oplus.screenrecorder
# com.oplus.screenshot
# com.oplus.securitykeyboard
# com.oplus.securitypermission
# com.oplus.smartengine
# com.oplus.sos
# com.oplus.sprint.message.overlay
# com.oplus.statistics.rom
# com.oplus.stdid
# com.oplus.subsys
# com.oplus.synergy
# com.oplus.tmo.wirelesssettings.overlay
# com.oplus.trafficmonitor
# com.oplus.uiengine
# com.oplus.unify.overlay
# com.oplus.uss.callingplus
# com.oplus.uss.chameleon
# com.oplus.uss.hiddenmenu
# com.oplus.uss.simota
# com.oplus.uxdesign
# com.oplus.wallpapers
# com.oplus.wifibackuprestore
# com.oplus.wifitest
# com.oplus.wirelesssettings
# com.qti.confuridialer
# com.qti.dpmserviceapp
# com.qti.ltebc
# com.qti.phone
# com.qti.qualcomm.datastatusnotification
# com.qti.qualcomm.deviceinfo
# com.qti.service.colorservice
# com.qti.snapdragon.qdcm_ff
# com.qti.xdivert
# com.qualcomm.atfwd
# com.qualcomm.embms
# com.qualcomm.location
# com.qualcomm.qcrilmsgtunnel
# com.qualcomm.qti.callfeaturessetting
# com.qualcomm.qti.cne
# com.qualcomm.qti.confdialer
# com.qualcomm.qti.devicestatisticsservice
# com.qualcomm.qti.dynamicddsservice
# com.qualcomm.qti.gpudrivers.kona.api30
# com.qualcomm.qti.ims
# com.qualcomm.qti.lpa
# com.qualcomm.qti.modemtestmode
# com.qualcomm.qti.performancemode
# com.qualcomm.qti.poweroffalarm
# com.qualcomm.qti.qcolor
# com.qualcomm.qti.remoteSimlockAuth
# com.qualcomm.qti.ridemodeaudio
# com.qualcomm.qti.seccamservice
# com.qualcomm.qti.simcontacts
# com.qualcomm.qti.smq
# com.qualcomm.qti.telephonyservice
# com.qualcomm.qti.uceShimService
# com.qualcomm.qti.uim
# com.qualcomm.qti.uimGbaApp
# com.qualcomm.qti.workloadclassifier
# com.qualcomm.qti.xrcb
# com.qualcomm.timeservice
# com.qualcomm.uimremoteclient
# com.qualcomm.uimremoteserver
# com.qualcomm.wfd.service
# com.redbend.app
# com.ses.entitlement.o2
# com.sprint.ce.updater
# com.sprint.ecid
# com.sprint.ms.cdm
# com.sprint.ms.smf.services
# com.sprint.w.installer
# com.tmobile.echolocate
# com.tmobile.pr.adapt
# com.tmobile.rsuadapter.qualcomm
# com.tmobile.rsuapp
# com.tmobile.rsusrv
# com.wapi.wapicertmanage
# net.oneplus.launcher
# net.oneplus.push
# net.oneplus.wallpaperresources
# net.oneplus.widget
# oplus
# oplus.frameworkres.overlay.camera.product
# oplus.frameworkres.overlay.display.product
# org.codeaurora.ims
# vendor.qti.hardware.cacert.server
# vendor.qti.imsrcs
# vendor.qti.iwlan
# vendor.qti.qesdk.sysservice
