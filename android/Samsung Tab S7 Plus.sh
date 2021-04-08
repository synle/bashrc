curl -s https://raw.githubusercontent.com/synle/bashrc/master/android/core-android.sh | sh

## use the one from s21 as the base and add more stuffs on top
curl -s https://github.com/synle/bashrc/blob/master/android/Samsung%20S21.sh | sh

##
pm uninstall -k --user 0 com.samsung.android.app.social
pm uninstall -k --user 0 com.samsung.android.contacts
pm uninstall -k --user 0 com.samsung.android.email.provider
pm uninstall -k --user 0 com.enhance.gameservice
pm uninstall -k --user 0 com.samsung.android.gametuner.thin
pm uninstall -k --user 0 com.samsung.android.app.sbrowseredge
pm uninstall -k --user 0 com.samsung.android.hmt.vrsvc
pm uninstall -k --user 0 com.samsung.android.app.vrsetupwizardstub
pm uninstall -k --user 0 com.samsung.android.hmt.vrshell
pm uninstall -k --user 0 com.sec.android.widgetapp.samsungapps

## dangerous for phone, but not for tablet
pm uninstall -k --user 0 com.android.server.telecom
pm uninstall -k --user 0 com.android.simappdialog
pm uninstall -k --user 0 com.android.phone
pm uninstall -k --user 0 com.android.calllogbackup
pm uninstall -k --user 0 com.android.carrierconfig
pm uninstall -k --user 0 com.android.carrierdefaultapp

## 2 : Essential
# pm uninstall -k --user 0 com.sec.android.app.launcher
## Not try yet
pm uninstall -k --user 0 android.autoinstalls.config.samsung
pm uninstall -k --user 0 com.google.android.apps.maps
pm uninstall -k --user 0 com.google.android.apps.turbo
pm uninstall -k --user 0 com.google.android.gm
pm uninstall -k --user 0 com.google.android.setupwizard
pm uninstall -k --user 0 com.google.android.syncadapters.calendar
pm uninstall -k --user 0 com.google.android.syncadapters.contacts
pm uninstall -k --user 0 com.knox.vpn.proxyhandler
pm uninstall -k --user 0 com.monotype.android.font.foundation
pm uninstall -k --user 0 com.osp.app.signin
pm uninstall -k --user 0 com.qualcomm.qti.qms.service.connectionsecurity
pm uninstall -k --user 0 com.qualcomm.qti.qms.service.telemetry
pm uninstall -k --user 0 com.samsung.aasaservice
pm uninstall -k --user 0 com.samsung.advp.imssettings
pm uninstall -k --user 0 com.samsung.android.aircommandmanager
pm uninstall -k --user 0 com.samsung.android.allshare.service.fileshare
pm uninstall -k --user 0 com.samsung.android.allshare.service.mediashare
pm uninstall -k --user 0 com.samsung.android.app.camera.sticker.facear.preload
pm uninstall -k --user 0 com.samsung.android.app.camera.sticker.stamp.preload
pm uninstall -k --user 0 com.samsung.android.app.galaxyfinder
pm uninstall -k --user 0 com.samsung.android.app.reminder
pm uninstall -k --user 0 com.samsung.android.beaconmanager
pm uninstall -k --user 0 com.samsung.android.bio.face.service
pm uninstall -k --user 0 com.samsung.android.clipboarduiservice
pm uninstall -k --user 0 com.samsung.android.dialer
pm uninstall -k --user 0 com.samsung.android.dqagent
pm uninstall -k --user 0 com.samsung.android.easysetup
pm uninstall -k --user 0 com.samsung.android.emojiupdater
pm uninstall -k --user 0 com.samsung.android.fmm
pm uninstall -k --user 0 com.samsung.android.homemode
pm uninstall -k --user 0 com.samsung.android.incallui
pm uninstall -k --user 0 com.samsung.android.keyguardwallpaperupdator
pm uninstall -k --user 0 com.samsung.android.knox.analytics.uploader
pm uninstall -k --user 0 com.samsung.android.knox.containerdesktop
pm uninstall -k --user 0 com.samsung.android.mdecservice
pm uninstall -k --user 0 com.samsung.android.mdm
pm uninstall -k --user 0 com.samsung.android.mobileservice
pm uninstall -k --user 0 com.samsung.android.net.wifi.wifiguider
pm uninstall -k --user 0 com.samsung.android.provider.stickerprovider
pm uninstall -k --user 0 com.samsung.android.scloud
pm uninstall -k --user 0 com.samsung.android.securitylogagent
pm uninstall -k --user 0 com.samsung.android.smartface
pm uninstall -k --user 0 com.samsung.android.smartswitchassistant
pm uninstall -k --user 0 com.samsung.android.stickercenter
pm uninstall -k --user 0 com.samsung.android.tadownloader
pm uninstall -k --user 0 com.samsung.app.newtrim
pm uninstall -k --user 0 com.samsung.clipboardsaveservice
pm uninstall -k --user 0 com.samsung.cmh
pm uninstall -k --user 0 com.samsung.ims.smk
pm uninstall -k --user 0 com.samsung.knox.keychain
pm uninstall -k --user 0 com.samsung.mlp
pm uninstall -k --user 0 com.samsung.oh
pm uninstall -k --user 0 com.samsung.safetyinformation
pm uninstall -k --user 0 com.samsung.sec.android.application.csc
pm uninstall -k --user 0 com.samsung.storyservice
pm uninstall -k --user 0 com.samsung.systemui.hidenotch.withoutcornerround
pm uninstall -k --user 0 com.samsung.systemui.hidenotch
pm uninstall -k --user 0 com.sec.android.app.billing
pm uninstall -k --user 0 com.sec.android.app.chromecustomizations
pm uninstall -k --user 0 com.sec.android.app.samsungapps
pm uninstall -k --user 0 com.sec.android.app.SecSetupWizard
pm uninstall -k --user 0 com.sec.android.daemonapp
pm uninstall -k --user 0 com.sec.android.mimage.gear360editor
pm uninstall -k --user 0 com.sec.android.mimage.photoretouching
pm uninstall -k --user 0 com.sec.android.soagent
pm uninstall -k --user 0 com.sec.android.splitsound
pm uninstall -k --user 0 com.sec.android.uibcvirtualsoftkey
pm uninstall -k --user 0 com.sec.bcservice
pm uninstall -k --user 0 com.sec.enterprise.knox.cloudmdm.smdms
pm uninstall -k --user 0 com.sec.enterprise.mdm.services.simpin
pm uninstall -k --user 0 com.sec.factory
pm uninstall -k --user 0 com.wssyncmldm
