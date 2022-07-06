# Remove Android Bloats

```

###########################################
### Core Commands
# list disabled packages
pm list packages -d

# list users
pm list users

# disable the app
pm disable-user --user 0 _some_package_
pm uninstall -k --user 0 _some_package_

# re-enable the apps
cmd package install-existing _some_package_
pm enable _some_package_

# grant and revoke permission
pm grant [package] android.permission.CAMERA
pm revoke [package] android.permission.CAMERA

# function to remove an app
function removeApp(){
  echo "> Remove: " $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}

###########################################
###### Other commands
settings list system
settings list global
settings list secure

### All packages:
dumpsys package | grep "Package \[" | cut -d "\[" -f2 | cut -d "\]" -f1
pm list packages | cut -d ":" -f2

# https://adbshell.com/commands/adb-shell-pm-list-packages

# list all packages including all uninstalled
pm list packages -u

# list all packages for a user
pm list packages --user USER_ID


### Get permission
dumpsys package com.brave.browser | grep permission

### Remove permission
pm revoke com.brave.browser android.permission.ACCESS_COARSE_LOCATION
pm revoke com.brave.browser android.permission.ACCESS_FINE_LOCATION

###### safe to remove
```
