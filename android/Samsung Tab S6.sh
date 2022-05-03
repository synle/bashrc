curl -s https://raw.githubusercontent.com/synle/bashrc/master/android/core-android.sh | sh

function removeApp(){
  echo "> Remove: " $@
  pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

## https://forum.xda-developers.com/galaxy-s10/how-to/galaxy-s10-s10-debloat-bloatware-t3912073
removeApp com.android.bips
removeApp com.android.bookmarkprovider
removeApp com.android.calllogbackup
removeApp com.android.carrierconfig
removeApp com.android.carrierdefaultapp
removeApp com.android.chrome
removeApp com.android.cts.ctsshim
removeApp com.android.cts.priv.ctsshim
removeApp com.android.dreams.basic
removeApp com.android.dreams.phototable
removeApp com.android.egg
removeApp com.android.hotwordenrollment.okgoogle
removeApp com.android.hotwordenrollment.xgoogle
removeApp com.android.phone
removeApp com.android.printspooler
removeApp com.android.server.telecom
removeApp com.android.sharedstoragebackup
removeApp com.android.simappdialog
removeApp com.android.stk
removeApp com.android.wallpaper.livepicker
removeApp com.android.wallpapercropper
removeApp com.audible.application
removeApp com.diotek.sec.lookup.dictionary
removeApp com.dsi.ant.plugins.antplus
removeApp com.dsi.ant.sample.acquirechannels
removeApp com.dsi.ant.server
removeApp com.dsi.ant.service.socket
removeApp com.enhance.gameservice
removeApp com.google.android.apps.tachyon
removeApp com.google.android.printservice.recommendation
removeApp com.google.android.youtube
removeApp com.google.vr.vrcore
removeApp com.microsoft.skydrive
removeApp com.samsung.android.app.camera.sticker.facearavatar.preload
removeApp com.samsung.android.app.contacts
removeApp com.samsung.android.app.sbrowseredge
removeApp com.samsung.android.app.social
removeApp com.samsung.android.app.spage
removeApp com.samsung.android.app.tips
removeApp com.samsung.android.app.vrsetupwizardstub
removeApp com.samsung.android.app.watchmanagerstub
removeApp com.samsung.android.aremoji
removeApp com.samsung.android.authfw
removeApp com.samsung.android.bbc.bbcagent
removeApp com.samsung.android.calendar
removeApp com.samsung.android.contacts
removeApp com.samsung.android.email.provider
removeApp com.samsung.android.game.gamehome
removeApp com.samsung.android.game.gametools
removeApp com.samsung.android.game.gos
removeApp com.samsung.android.gametuner.thin
removeApp com.samsung.android.hmt.vrshell
removeApp com.samsung.android.hmt.vrsvc
removeApp com.samsung.android.kidsinstaller
removeApp com.samsung.android.location
removeApp com.samsung.android.lool
removeApp com.samsung.android.mateagent
removeApp com.samsung.android.messaging
removeApp com.samsung.android.samsungpass
removeApp com.samsung.android.samsungpassautofill
removeApp com.samsung.android.spay
removeApp com.samsung.android.spayfw
removeApp com.samsung.android.video
removeApp com.samsung.android.wellbeing
removeApp com.sec.android.app.clockpackage
removeApp com.sec.android.app.sbrowser
removeApp com.sec.android.easyMover.Agent
removeApp com.sec.android.easyonehand
removeApp com.sec.android.emergencylauncher
removeApp com.sec.android.widgetapp.samsungapps
removeApp com.sec.phone
removeApp com.wsomacp
removeApp flipboard.boxer.app

## digital wellbeing
removeApp com.samsung.android.forest

## bixby
removeApp com.samsung.systemui.bixby2
removeApp com.samsung.android.app.settings.bixby
removeApp com.samsung.android.bixby.service
removeApp com.samsung.android.bixby.wakeup
removeApp com.samsung.android.app.routines
removeApp com.samsung.android.visionintelligence
removeApp com.samsung.android.bixby.agent
removeApp com.samsung.android.bixby.agent.dummy
removeApp com.samsung.android.bixbyvision.framework

## 2 : Essential
removeApp com.sec.android.app.launcher

## Not try yet
removeApp android.autoinstalls.config.samsung
removeApp com.android.managedprovisioning
removeApp com.android.providers.partnerbookmarks
removeApp com.google.android.apps.maps
removeApp com.google.android.apps.turbo
removeApp com.google.android.gm
removeApp com.google.android.googlequicksearchbox
removeApp com.google.android.setupwizard
removeApp com.google.android.syncadapters.calendar
removeApp com.google.android.syncadapters.contacts
removeApp com.google.android.tts
removeApp com.knox.vpn.proxyhandler
removeApp com.monotype.android.font.foundation
removeApp com.osp.app.signin
removeApp com.qualcomm.qti.qms.service.connectionsecurity
removeApp com.qualcomm.qti.qms.service.telemetry
removeApp com.samsung.aasaservice
removeApp com.samsung.advp.imssettings
removeApp com.samsung.android.aircommandmanager
removeApp com.samsung.android.allshare.service.fileshare
removeApp com.samsung.android.allshare.service.mediashare
removeApp com.samsung.android.app.camera.sticker.facear.preload
removeApp com.samsung.android.app.camera.sticker.stamp.preload
removeApp com.samsung.android.app.galaxyfinder
removeApp com.samsung.android.app.reminder
removeApp com.samsung.android.beaconmanager
removeApp com.samsung.android.bio.face.service
removeApp com.samsung.android.clipboarduiservice
removeApp com.samsung.android.dialer
removeApp com.samsung.android.dqagent
removeApp com.samsung.android.easysetup
removeApp com.samsung.android.emojiupdater
removeApp com.samsung.android.fmm
removeApp com.samsung.android.homemode
removeApp com.samsung.android.incallui
removeApp com.samsung.android.keyguardwallpaperupdator
removeApp com.samsung.android.knox.analytics.uploader
removeApp com.samsung.android.knox.containeragent
removeApp com.samsung.android.knox.containercore
removeApp com.samsung.android.knox.containerdesktop
removeApp com.samsung.android.mdecservice
removeApp com.samsung.android.mdm
removeApp com.samsung.android.mobileservice
removeApp com.samsung.android.net.wifi.wifiguider
removeApp com.samsung.android.provider.stickerprovider
removeApp com.samsung.android.scloud
removeApp com.samsung.android.securitylogagent
removeApp com.samsung.android.smartface
removeApp com.samsung.android.smartswitchassistant
removeApp com.samsung.android.stickercenter
removeApp com.samsung.android.tadownloader
removeApp com.samsung.app.newtrim
removeApp com.samsung.clipboardsaveservice
removeApp com.samsung.cmh
removeApp com.samsung.ims.smk
removeApp com.samsung.knox.keychain
removeApp com.samsung.knox.securefolder
removeApp com.samsung.mlp
removeApp com.samsung.oh
removeApp com.samsung.safetyinformation
removeApp com.samsung.sec.android.application.csc
removeApp com.samsung.SMT
removeApp com.samsung.storyservice
removeApp com.samsung.systemui.hidenotch.withoutcornerround
removeApp com.samsung.systemui.hidenotch
removeApp com.sec.android.app.billing
removeApp com.sec.android.app.chromecustomizations
removeApp com.sec.android.app.samsungapps
removeApp com.sec.android.app.SecSetupWizard
removeApp com.sec.android.daemonapp
removeApp com.sec.android.mimage.gear360editor
removeApp com.sec.android.mimage.photoretouching
removeApp com.sec.android.soagent
removeApp com.sec.android.splitsound
removeApp com.sec.android.uibcvirtualsoftkey
removeApp com.sec.bcservice
removeApp com.sec.enterprise.knox.cloudmdm.smdms
removeApp com.sec.enterprise.mdm.services.simpin
removeApp com.sec.factory
removeApp com.sec.spp.push
removeApp com.wssyncmldm
