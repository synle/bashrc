# https://www.getdroidtips.com/uninstall-bloatware-samsung-z-flip-4-z-fold-4/#Samsung-Galaxy-Z-Flip-4-Galaxy-Z-Fold-4-Device-Overview
curl -s "https://raw.githubusercontent.com/synle/bashrc/master/android/Core Android.sh" | sh

function removeApp(){
  echo "> Remove:" $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

##
removeApp com.microsoft.skydrive
removeApp com.samsung.android.peripheral.framework
removeApp com.samsung.android.bixby.agent
removeApp com.samsung.android.cmfa.framework
removeApp com.android.chrome
removeApp com.sec.android.emergencylauncher
removeApp com.samsung.android.six.webtrans # Translator for Samsung Internet
removeApp com.sec.android.app.sbrowser # Samsung Galaxy Browser
removeApp com.sec.android.app.chromecustomizations # Chrome browser customization
removeApp com.samsung.android.calendar # samsung calendar
removeApp com.samsung.android.ardrawing
removeApp com.samsung.android.aremoji
removeApp com.samsung.android.aremojieditor
removeApp com.samsung.android.spay # samsung pay
removeApp com.samsung.android.spayfw # samsung pay
removeApp com.samsung.android.samsungpass # samsung password and autofill
removeApp com.samsung.android.samsungpassautofill # samsung password and autofill
removeApp com.sec.android.inputmethod # samsung keyboard
removeApp com.samsung.android.honeyboard # samsung keyboard (main)
removeApp com.samsung.android.forest # samsung digital wellbeing

# Game-related #
removeApp com.enhance.gameservice
removeApp com.samsung.android.game.gamehome
removeApp com.samsung.android.game.gametools
removeApp com.samsung.android.game.gos # Samsung Game Optimizing Service

# Samsung SmartSwitch
removeApp com.samsung.android.smartswitchassistant # Samsung SmartSwitch
removeApp com.sec.android.easyMover # Related Smart Switch
removeApp com.sec.android.easyMover.Agent # Smart Switch Agent
removeApp com.samsung.android.shortcutbackupservice # ShortcutBNR, linked to SmartSwitch Samsung Cloud features

# Widgets
removeApp com.sec.android.widgetapp.easymodecontactswidget # Favorite Contacts, probably the favorite contacts when enabling the simple use senior mode
removeApp com.sec.android.widgetapp.samsungapps # Galaxy Essentials Widget
removeApp com.sec.android.widgetapp.webmanual # User manual
removeApp com.samsung.android.app.spage # Bixby Home - Samsung Free

# bixby remap
removeApp com.samsung.android.bixby.wakeup
removeApp com.samsung.android.app.spage
removeApp com.samsung.android.app.routines
removeApp com.samsung.android.bixby.agent
removeApp com.samsung.android.bixby.agent.dummy
removeApp com.samsung.android.bixby.service
removeApp com.samsung.android.visionintelligence # Bixby Vision

# gear vr
removeApp com.samsung.android.hmt.vrsvc
removeApp com.samsung.android.app.vrsetupwizardstub
removeApp com.samsung.android.hmt.vrshell
removeApp com.google.vr.vrcore

# samsung kids
removeApp com.samsung.android.kidsinstaller
removeApp com.samsung.android.app.camera.sticker.facearavatar.preload

# samsung emails
removeApp com.samsung.android.email.provider # samsung

# microsoft
removeApp com.skype.raider
removeApp com.microsoft.office.excel
removeApp com.microsoft.office.word
removeApp com.microsoft.office.powerpoint

# misc
removeApp com.samsung.android.widgetapp.yahooedge.finance
removeApp com.samsung.android.widgetapp.yahooedge.sport
removeApp com.samsung.android.app.reminder # samsung reminder https://galaxystore.samsung.com/prepost/000005309349?appId=com.samsung.android.app.reminder
removeApp com.samsung.android.app.news # samsung news today
removeApp com.samsung.android.app.news # Galaxy Essentials Widget
removeApp flipboard.boxer.app

# # Samsung Bixby #
# removeApp com.samsung.android.app.settings.bixby # SettingsBixby
# removeApp com.samsung.android.bixby.agent
# removeApp com.samsung.android.bixby.agent.dummy
# removeApp com.samsung.android.bixby.es.globalaction
# removeApp com.samsung.android.bixby.plmsync
# removeApp com.samsung.android.bixby.service
# removeApp com.samsung.android.bixby.voiceinput
# removeApp com.samsung.android.bixby.wakeup
# removeApp com.samsung.android.svoice # SVoice
# removeApp com.samsung.svoice.sync # Voice Service, S Voice is the ancestor of Bixby
# removeApp com.samsung.systemui.bixby
# removeApp com.samsung.systemui.bixby2
# removeApp com.samsung.android.visionintelligence # Bixby Vision
# removeApp com.samsung.visionprovider # VisionProvider, maybe linked to Bixby?

# # More bixby
# removeApp com.samsung.android.app.settings.bixby
# removeApp com.samsung.android.bixby.agent
# removeApp com.samsung.android.bixby.agent.dummy
# removeApp com.samsung.android.bixby.service
# removeApp com.samsung.android.bixby.wakeup
# removeApp com.samsung.android.bixbyvision.framework
# removeApp com.samsung.systemui.bixby2
