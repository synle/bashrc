# https://www.getdroidtips.com/uninstall-bloatware-samsung-z-flip-4-z-fold-4/#Samsung-Galaxy-Z-Flip-4-Galaxy-Z-Fold-4-Device-Overview

## animation speed
changeSetting global window_animation_scale 0
changeSetting global transition_animation_scale 0.35
changeSetting global animator_duration_scale 0.35


## remove app
function removeApp(){
  echo "> Remove:" $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

# function restoreApp(){
#   echo "> Restore:" $@
#   cmd package install-existing $@
# }

removeApp com.android.chrome
