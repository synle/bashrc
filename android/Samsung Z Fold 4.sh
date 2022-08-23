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
