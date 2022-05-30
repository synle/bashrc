curl -s "https://raw.githubusercontent.com/synle/bashrc/master/android/Core Android TV.sh" | sh


function removeApp(){
  echo "> Remove: " $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

# Common Android TV
removeApp com.jamdeo.tv.mediacenter

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
