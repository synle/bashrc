curl -s https://raw.githubusercontent.com/synle/bashrc/master/android/core-android.sh | sh

# run pm list users to find out what is the user for work profile
function removeApp(){
  echo "> Remove: " $@
  pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

## Bloated apps
removeApp com.android.chrome
removeApp com.diotek.sec.lookup.dictionary
removeApp com.samsung.android.app.camera.sticker.facearavatar.preload
removeApp com.samsung.android.app.notes
removeApp com.samsung.android.app.notes.addons
removeApp com.samsung.android.app.settings.bixby
removeApp com.samsung.android.app.spage
removeApp com.samsung.android.ardrawing
removeApp com.samsung.android.aremoji
removeApp com.samsung.android.aremojieditor
removeApp com.samsung.android.arzone
removeApp com.samsung.android.authfw
removeApp com.samsung.android.bixby.agent
removeApp com.samsung.android.bixby.agent.dummy
removeApp com.samsung.android.bixby.service
removeApp com.samsung.android.bixby.wakeup
removeApp com.samsung.android.bixbyvision.framework
removeApp com.samsung.android.forest
removeApp com.samsung.android.game.gamehome
removeApp com.samsung.android.game.gametools
removeApp com.samsung.android.game.gos
removeApp com.samsung.android.livestickers
removeApp com.samsung.android.samsungpass
removeApp com.samsung.android.samsungpassautofill
removeApp com.samsung.android.spay
removeApp com.samsung.android.spayfw
removeApp com.samsung.android.svoiceime
removeApp com.samsung.systemui.bixby2
removeApp com.sec.android.emergencylauncher
removeApp com.sec.android.mimage.avatarstickers
removeApp com.sec.spp.push # samsung push
removeApp com.swiftkey.swiftkeyconfigurator
removeApp com.touchtype.swiftkey

## Proceed with caution
removeApp com.samsung.android.messaging # samsung messaging app
removeApp com.sec.phone # samsung phone app
removeApp com.samsung.knox.securefolder # secure folder
removeApp com.samsung.android.ipsgeofence # samsung visit in
removeApp com.sec.android.inputmethod # samsung keyboard

## packages removed
# removeApp com.samsung.android.messaging
# removeApp com.sec.phone
# removeApp com.android.apps.tag
# removeApp com.android.bips
# removeApp com.android.cts.ctsshim
# removeApp com.android.cts.priv.ctsshim
# removeApp com.android.hotwordenrollment.okgoogle
# removeApp com.android.hotwordenrollment.xgoogle
# removeApp com.android.managedprovisioning
# removeApp com.android.printspooler
# removeApp com.android.providers.partnerbookmarks
# removeApp com.android.sharedstoragebackup
# removeApp com.android.wallpaper.livepicker
# removeApp com.samsung.android.accessibility.talkback
# removeApp com.samsung.android.app.contacts
# removeApp com.samsung.android.app.ledbackcover
# removeApp com.samsung.android.app.routines
# removeApp com.samsung.android.app.tips
# removeApp com.samsung.android.app.watchmanagerstub
# removeApp com.samsung.android.ardrawing
# removeApp com.samsung.android.bbc.bbcagent
# removeApp com.samsung.android.kidsinstaller
# removeApp com.samsung.android.livestickers
# removeApp com.samsung.android.location
# removeApp com.samsung.android.lool
# removeApp com.samsung.android.mateagent
# removeApp com.samsung.android.service.airviewdictionary
# removeApp com.samsung.android.video
# removeApp com.samsung.android.visionintelligence
# removeApp com.samsung.knox.securefolder
# removeApp com.samsung.SMT
# removeApp com.sec.android.app.kidshome
# removeApp com.sec.android.cover.ledcover
# removeApp com.sec.android.easyMover.Agent
# removeApp com.sec.android.easyonehand
# removeApp com.sec.android.emergencylauncher
# removeApp com.sec.android.widgetapp.webmanual
# removeApp com.wsomacp

# ### safe - Pending 2
# removeApp com.justride.stbbuch
# removeApp com.plantronics.headsetservice

# ## pending 3
# removeApp com.samsung.android.app.readingglass
# removeApp com.samsung.android.knox.containeragent
# removeApp com.samsung.android.knox.containercore
# removeApp com.samsung.android.service.pentastic
# removeApp com.samsung.android.service.tagservice
# removeApp com.samsung.android.six.webtrans
# removeApp com.samsung.android.vtcamerasettings
# removeApp com.samsung.desktopsystemui
# removeApp com.sec.android.app.bluetoothtest
# removeApp com.sec.android.app.desktoplauncher
# removeApp com.sec.android.desktopmode.uiservice

# ###
# # very dangerous
# # removeApp com.sec.android.app.dexonpc
# # removeApp com.sec.android.app.magnifier
# #
# # removeApp com.android.server.telecom
# # removeApp com.android.simappdialog
# # removeApp com.android.phone
# # removeApp com.android.calllogbackup
# # removeApp com.android.carrierconfig
# # removeApp com.android.carrierdefaultapp
