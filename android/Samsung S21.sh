curl -s https://raw.githubusercontent.com/synle/bashrc/master/android/core-android.sh | sh


## packages removed
pm uninstall -k --user 0 com.android.apps.tag
pm uninstall -k --user 0 com.android.bips
pm uninstall -k --user 0 com.android.cts.ctsshim
pm uninstall -k --user 0 com.android.cts.priv.ctsshim
pm uninstall -k --user 0 com.android.hotwordenrollment.okgoogle
pm uninstall -k --user 0 com.android.hotwordenrollment.xgoogle
pm uninstall -k --user 0 com.android.managedprovisioning
pm uninstall -k --user 0 com.android.printspooler
pm uninstall -k --user 0 com.android.providers.partnerbookmarks
pm uninstall -k --user 0 com.android.sharedstoragebackup
pm uninstall -k --user 0 com.android.stk
pm uninstall -k --user 0 com.android.wallpaper.livepicker
pm uninstall -k --user 0 com.diotek.sec.lookup.dictionary
pm uninstall -k --user 0 com.samsung.android.accessibility.talkback
pm uninstall -k --user 0 com.samsung.android.app.camera.sticker.facearavatar.preload
pm uninstall -k --user 0 com.samsung.android.app.contacts
pm uninstall -k --user 0 com.samsung.android.app.routines
pm uninstall -k --user 0 com.samsung.android.app.settings.bixby
pm uninstall -k --user 0 com.samsung.android.app.spage
pm uninstall -k --user 0 com.samsung.android.app.tips
pm uninstall -k --user 0 com.samsung.android.app.watchmanagerstub
pm uninstall -k --user 0 com.samsung.android.aremoji
pm uninstall -k --user 0 com.samsung.android.authfw
pm uninstall -k --user 0 com.samsung.android.bbc.bbcagent
pm uninstall -k --user 0 com.samsung.android.bixby.agent
pm uninstall -k --user 0 com.samsung.android.bixby.agent.dummy
pm uninstall -k --user 0 com.samsung.android.bixby.service
pm uninstall -k --user 0 com.samsung.android.bixby.wakeup
pm uninstall -k --user 0 com.samsung.android.bixbyvision.framework
pm uninstall -k --user 0 com.samsung.android.forest
pm uninstall -k --user 0 com.samsung.android.game.gamehome
pm uninstall -k --user 0 com.samsung.android.game.gametools
pm uninstall -k --user 0 com.samsung.android.game.gos
pm uninstall -k --user 0 com.samsung.android.kidsinstaller
pm uninstall -k --user 0 com.samsung.android.location
pm uninstall -k --user 0 com.samsung.android.lool
pm uninstall -k --user 0 com.samsung.android.mateagent
pm uninstall -k --user 0 com.samsung.android.messaging
pm uninstall -k --user 0 com.samsung.android.samsungpass
pm uninstall -k --user 0 com.samsung.android.samsungpassautofill
pm uninstall -k --user 0 com.samsung.android.video
pm uninstall -k --user 0 com.samsung.android.visionintelligence
pm uninstall -k --user 0 com.samsung.knox.securefolder
pm uninstall -k --user 0 com.samsung.systemui.bixby2
pm uninstall -k --user 0 com.sec.android.easyMover.Agent
pm uninstall -k --user 0 com.sec.android.easyonehand
pm uninstall -k --user 0 com.sec.android.emergencylauncher
# pm uninstall -k --user 0 com.sec.phone
pm uninstall -k --user 0 com.sec.spp.push
pm uninstall -k --user 0 com.wsomacp
pm uninstall -k --user 0 com.samsung.SMT
pm uninstall -k --user 0 com.sec.android.widgetapp.webmanual
pm uninstall -k --user 0 com.samsung.android.service.airviewdictionary
pm uninstall -k --user 0 com.sec.android.cover.ledcover
pm uninstall -k --user 0 com.samsung.android.livestickers
pm uninstall -k --user 0 com.samsung.android.ardrawing
pm uninstall -k --user 0 com.samsung.android.arzone
pm uninstall -k --user 0 com.samsung.android.aremojieditor
pm uninstall -k --user 0 com.sec.android.mimage.avatarstickers
pm uninstall -k --user 0 de.axelspringer.yana.zeropage
pm uninstall -k --user 0 com.sec.android.app.kidshome
pm uninstall -k --user 0 com.samsung.android.app.ledbackcover
pm uninstall -k --user 0 com.samsung.android.svoiceime

## super safe
pm uninstall -k --user 0 com.samsung.android.spay


### safe-ish
pm uninstall -k --user 0 com.samsung.android.spayfw


### safe - Pending 2
pm uninstall -k --user 0 com.justride.stbbuch
pm uninstall -k --user 0 com.plantronics.headsetservice
pm uninstall -k --user 0 com.swiftkey.swiftkeyconfigurator
pm uninstall -k --user 0 com.touchtype.swiftkey

## pending 3
pm uninstall -k --user 0 com.samsung.android.app.notes
pm uninstall -k --user 0 com.samsung.android.app.notes.addons
pm uninstall -k --user 0 com.samsung.android.app.readingglass
pm uninstall -k --user 0 com.samsung.android.knox.containeragent
pm uninstall -k --user 0 com.samsung.android.knox.containercore
pm uninstall -k --user 0 com.samsung.android.service.pentastic
pm uninstall -k --user 0 com.samsung.android.service.tagservice
pm uninstall -k --user 0 com.samsung.android.six.webtrans
pm uninstall -k --user 0 com.samsung.android.vtcamerasettings
pm uninstall -k --user 0 com.samsung.desktopsystemui
pm uninstall -k --user 0 com.sec.android.app.bluetoothtest
pm uninstall -k --user 0 com.sec.android.app.desktoplauncher
pm uninstall -k --user 0 com.sec.android.desktopmode.uiservice


###
# very dangerous
# pm uninstall -k --user 0 com.sec.android.app.dexonpc
# pm uninstall -k --user 0 com.sec.android.app.magnifier
#
# pm uninstall -k --user 0 com.android.server.telecom
# pm uninstall -k --user 0 com.android.simappdialog
# pm uninstall -k --user 0 com.android.phone
# pm uninstall -k --user 0 com.android.calllogbackup
# pm uninstall -k --user 0 com.android.carrierconfig
# pm uninstall -k --user 0 com.android.carrierdefaultapp
