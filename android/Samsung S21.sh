# Source: https://gist.githubusercontent.com/gsurrel/40cc506ac7e31134a87be4ba01a71103/raw/58fbcca4f05b3240fb045d671e82d3ded7d19f26/Galaxy_S8_Debloat.sh
#
curl -s https://raw.githubusercontent.com/synle/bashrc/master/android/core-android.sh | sh

function removeApp(){
  echo "> Remove:" $@
  pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

## Bloated apps
removeApp com.android.chrome
removeApp com.diotek.sec.lookup.dictionary
removeApp com.samsung.android.app.camera.sticker.facearavatar.preload
removeApp com.samsung.android.app.notes
removeApp com.samsung.android.app.notes.addons
removeApp com.samsung.android.app.routines
removeApp com.samsung.android.app.settings.bixby
removeApp com.samsung.android.app.spage
removeApp com.samsung.android.app.tips
removeApp com.samsung.android.ardrawing
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
removeApp com.samsung.android.mateagent # Samsung Galaxy Friends
removeApp com.samsung.android.samsungpass
removeApp com.samsung.android.samsungpassautofill
removeApp com.samsung.android.six.webtrans # Translator for Samsung Internet
removeApp com.samsung.android.spay
removeApp com.samsung.android.spayfw
removeApp com.samsung.android.svoiceime
removeApp com.samsung.systemui.bixby2
removeApp com.sec.android.easyMover.Agent # samsung smart switch (migration setup tool)
removeApp com.sec.android.emergencylauncher
removeApp com.sec.android.mimage.avatarstickers
removeApp com.sec.spp.push # samsung push
removeApp com.swiftkey.swiftkeyconfigurator
removeApp com.touchtype.swiftkey
removeApp com.android.cts.ctsshim # Part of the Android Compatibility Test Suite: https://source.android.com/compatibility/cts/setup
removeApp com.android.cts.priv.ctsshim ## Part of the Android Compatibility Test Suite: https://source.android.com/compatibility/cts/setup

# Samsing SmartSwitch
removeApp com.samsung.android.smartswitchassistant # Samsung SmartSwitch
removeApp com.sec.android.easyMover # Related Smart Switch
removeApp com.sec.android.easyMover.Agent # Smart Switch Agent
removeApp com.samsung.android.shortcutbackupservice # ShortcutBNR, linked to SmartSwitch Samsung Cloud features

# SmartThings
removeApp com.samsung.android.beaconmanager # SmartThings. It is required to enable the Settings -> Connections -> More connections settings -> Nearby device scanning. This *may* be required for detecting Chromecast and other smart TVs.
removeApp com.samsung.android.ststub # SmartThings
removeApp com.samsung.android.easysetup # SmartThings

# Samsung Health
removeApp com.sec.android.app.shealth # Samsung Health
removeApp com.sec.android.service.health # Health Service, from Samsung

# Widgets
removeApp com.sec.android.widgetapp.easymodecontactswidget # Favorite Contacts, probably the favorite contacts when enabling the simple use senior mode
removeApp com.sec.android.widgetapp.samsungapps # Galaxy Essentials Widget
removeApp com.sec.android.widgetapp.webmanual # User manual

# Game-related #
removeApp com.enhance.gameservice
removeApp com.samsung.android.game.gamehome
removeApp com.samsung.android.game.gametools
removeApp com.samsung.android.game.gos # Samsung Game Optimizing Service

# samsung stuffs
removeApp com.samsung.android.themecenter # Samsung Themes
removeApp com.samsung.android.themestore # Galaxy Themes
removeApp com.sec.android.app.samsungapps # Galaxy Store
removeApp com.sec.android.app.sbrowser # Samsung Galaxy Browser
removeApp com.samsung.android.rubin.app # Customization Service
removeApp com.sec.android.app.chromecustomizations # Chrome browser customization
removeApp com.samsung.android.scloud # Samsung Cloud
removeApp com.samsung.android.mateagent # Samsung Galaxy Friends
removeApp com.samsung.android.mobileservice # Samsung Experience Service, handling the Samsung account and experience, required for Samsung Pay
removeApp com.samsung.android.weather

# Samsung Bixby #
removeApp com.samsung.android.app.spage # Bixby Home
removeApp com.samsung.android.app.settings.bixby # SettingsBixby
removeApp com.samsung.android.bixby.agent
removeApp com.samsung.android.bixby.agent.dummy
removeApp com.samsung.android.bixby.es.globalaction
removeApp com.samsung.android.bixby.plmsync
removeApp com.samsung.android.bixby.service
removeApp com.samsung.android.bixby.voiceinput
removeApp com.samsung.android.bixby.wakeup
removeApp com.samsung.android.svoice # SVoice
removeApp com.samsung.svoice.sync # Voice Service, S Voice is the ancestor of Bixby
removeApp com.samsung.systemui.bixby
removeApp com.samsung.systemui.bixby2
removeApp com.samsung.android.visionintelligence # Bixby Vision
removeApp com.samsung.visionprovider # VisionProvider, maybe linked to Bixby?

## Proceed with caution (samsung stuffs)
removeApp com.samsung.android.messaging # samsung messaging app
removeApp com.sec.phone # samsung phone app
removeApp com.samsung.knox.securefolder # secure folder
removeApp com.samsung.android.ipsgeofence # samsung visit in
removeApp com.sec.android.inputmethod # samsung keyboard
removeApp com.samsung.android.app.contacts # samsung contact
removeApp com.samsung.android.app.watchmanagerstub # samsung watch
removeApp com.samsung.android.kidsinstaller # samsung kid mode
removeApp com.sec.android.app.kidshome
removeApp com.samsung.android.location # samsung find my device
# removeApp com.samsung.android.app.aodservice # Always-on-Display, handles most of the lockscreen
# removeApp com.samsung.android.lool # samsung device care
# removeApp com.samsung.android.visionintelligence # samsung bixby vision
# removeApp com.sec.android.widgetapp.webmanual
removeApp com.sec.android.cover.ledcover

## packages removed
# removeApp com.android.apps.tag
# removeApp com.android.bips
# removeApp com.android.hotwordenrollment.okgoogle
# removeApp com.android.hotwordenrollment.xgoogle
# removeApp com.android.managedprovisioning
# removeApp com.android.printspooler
# removeApp com.android.providers.partnerbookmarks
# removeApp com.android.sharedstoragebackup
# removeApp com.android.wallpaper.livepicker
# removeApp com.samsung.android.accessibility.talkback
# removeApp com.samsung.android.app.ledbackcover
# removeApp com.samsung.android.bbc.bbcagent
# removeApp com.samsung.android.service.airviewdictionary
# removeApp com.samsung.android.video
# removeApp com.sec.android.easyonehand
# removeApp com.sec.android.emergencylauncher
# removeApp com.wsomacp

# ## pending 3
# removeApp com.samsung.android.app.readingglass
# removeApp com.samsung.android.service.pentastic
# removeApp com.samsung.android.service.tagservice
# removeApp com.samsung.android.vtcamerasettings
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
