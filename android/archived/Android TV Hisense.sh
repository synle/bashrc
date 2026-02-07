curl -s "https://raw.githubusercontent.com/synle/bashrc/master/android/Core Android TV.sh" | sh

function removeApp(){
  echo "> Remove:" $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

function restoreApp(){
  echo "> Restore:" $@
  cmd package install-existing $@
}

# Common Android TV
removeApp com.jamdeo.tv.mediacenter
removeApp com.google.android.backdrop
removeApp com.amazon.amazonvideo.livingroom
removeApp com.android.dreams.basic
removeApp com.google.android.apps.youtube.kids
removeApp com.google.android.apps.youtube.music
removeApp com.google.android.apps.youtube.unplugged
removeApp com.google.android.videos
removeApp com.google.android.youtube


# Hisense ULED 4K Premium 75U6G (xiaoyushan)
removeApp com.hisense.favkey
removeApp com.hisense.service.message
removeApp com.hisense.tv.protector

# cautious!
removeApp com.mstar.android.tv.disclaimercustomization
removeApp com.mstar.netflixobserver # can be replaced with button mapper

# experimental!
removeApp com.hisense.storemode
removeApp com.hisense.alexa
removeApp com.hisense.hitv.hicloud.account
# removeApp com.jamdeo.tv.mediacenterapplication
