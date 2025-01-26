## Wireless Debugging

On the device, go to Developer Options > Wireless debugging > Pair device with pairing code, and use the newly generated pairing code

```
# start with Pair device with pairing code
adb pair ip:port

# then use IpAddress & Port from the other screen
adb connect ip:port

adb shell
```

## Remove Android Bloats

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
function listPermissions(){
  dumpsys package $@ | grep "granted=true" | grep permission
}

### Remove permission
function removePermissionLocation(){
  # ignore the following
  # com.android.phone
  # com.chase.sig.android
  # com.coulombtech # chargepoint
  # com.dd.doordash
  # com.google.android.apps.tycho # google fi
  # com.google.android.calendar
  # com.target.ui # target
  # com.teslacoilsw.launcher # nova
  # com.teslamotors.tesla # tesla
  # com.yelp.android
  # com.google.android.apps.maps # google map
  # com.google.android.googlequicksearchbox # google now
  # echo $1

  pm revoke $@ android.permission.ACCESS_COARSE_LOCATION
  pm revoke $@ android.permission.ACCESS_FINE_LOCATION
}

###### safe to remove
```
