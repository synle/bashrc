# use the one from s21 as the base and add more stuffs on top
curl -s "https://github.com/synle/bashrc/blob/master/android/Samsung S21 Ultra.sh" | sh

function removeApp(){
  echo "> Remove: " $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

###
# removeApp com.samsung.android.app.social
# removeApp com.samsung.android.contacts
# removeApp com.samsung.android.email.provider
# removeApp com.enhance.gameservice
# removeApp com.samsung.android.gametuner.thin
# removeApp com.samsung.android.app.sbrowseredge
# removeApp com.samsung.android.hmt.vrsvc
# removeApp com.samsung.android.app.vrsetupwizardstub
# removeApp com.samsung.android.hmt.vrshell
# removeApp com.sec.android.widgetapp.samsungapps

### dangerous for phone, but not for tablet
# removeApp com.android.server.telecom
# removeApp com.android.simappdialog
# removeApp com.android.phone
# removeApp com.android.calllogbackup
# removeApp com.android.carrierconfig
# removeApp com.android.carrierdefaultapp

### 2 : Essential
# removeApp com.sec.android.app.launcher

### Not try yet

# removeApp android.autoinstalls.config.samsung
# removeApp com.google.android.apps.maps
# removeApp com.google.android.apps.turbo
# removeApp com.google.android.gm
# removeApp com.google.android.setupwizard
# removeApp com.google.android.syncadapters.calendar
# removeApp com.google.android.syncadapters.contacts
# removeApp com.knox.vpn.proxyhandler
# removeApp com.monotype.android.font.foundation
# removeApp com.osp.app.signin
# removeApp com.qualcomm.qti.qms.service.connectionsecurity
# removeApp com.qualcomm.qti.qms.service.telemetry
# removeApp com.samsung.aasaservice
# removeApp com.samsung.advp.imssettings
# removeApp com.samsung.android.aircommandmanager
# removeApp com.samsung.android.allshare.service.fileshare
# removeApp com.samsung.android.allshare.service.mediashare
# removeApp com.samsung.android.app.camera.sticker.facear.preload
# removeApp com.samsung.android.app.camera.sticker.stamp.preload
# removeApp com.samsung.android.app.galaxyfinder
# removeApp com.samsung.android.app.reminder
# removeApp com.samsung.android.beaconmanager
# removeApp com.samsung.android.bio.face.service
# removeApp com.samsung.android.clipboarduiservice
# removeApp com.samsung.android.dialer
# removeApp com.samsung.android.dqagent
# removeApp com.samsung.android.easysetup
# removeApp com.samsung.android.emojiupdater
# removeApp com.samsung.android.fmm
# removeApp com.samsung.android.homemode
# removeApp com.samsung.android.incallui
# removeApp com.samsung.android.keyguardwallpaperupdator
# removeApp com.samsung.android.knox.analytics.uploader
# removeApp com.samsung.android.knox.containerdesktop
# removeApp com.samsung.android.mdecservice
# removeApp com.samsung.android.mdm
# removeApp com.samsung.android.mobileservice
# removeApp com.samsung.android.net.wifi.wifiguider
# removeApp com.samsung.android.provider.stickerprovider
# removeApp com.samsung.android.scloud
# removeApp com.samsung.android.securitylogagent
# removeApp com.samsung.android.smartface
# removeApp com.samsung.android.smartswitchassistant
# removeApp com.samsung.android.stickercenter
# removeApp com.samsung.android.tadownloader
# removeApp com.samsung.app.newtrim
# removeApp com.samsung.clipboardsaveservice
# removeApp com.samsung.cmh
# removeApp com.samsung.ims.smk
# removeApp com.samsung.knox.keychain
# removeApp com.samsung.mlp
# removeApp com.samsung.oh
# removeApp com.samsung.safetyinformation
# removeApp com.samsung.sec.android.application.csc
# removeApp com.samsung.storyservice
# removeApp com.samsung.systemui.hidenotch.withoutcornerround
# removeApp com.samsung.systemui.hidenotch
# removeApp com.sec.android.app.billing
# removeApp com.sec.android.app.chromecustomizations
# removeApp com.sec.android.app.samsungapps
# removeApp com.sec.android.app.SecSetupWizard
# removeApp com.sec.android.daemonapp
# removeApp com.sec.android.mimage.gear360editor
# removeApp com.sec.android.mimage.photoretouching
# removeApp com.sec.android.soagent
# removeApp com.sec.android.splitsound
# removeApp com.sec.android.uibcvirtualsoftkey
# removeApp com.sec.bcservice
# removeApp com.sec.enterprise.knox.cloudmdm.smdms
# removeApp com.sec.enterprise.mdm.services.simpin
# removeApp com.sec.factory
# removeApp com.wssyncmldm

### other app
# removeApp com.samsung.android.messaging
