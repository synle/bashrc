# Android Notes

## Wireless Debugging

On the device, go to Developer Options > Wireless debugging > Pair device with pairing code, and use the newly generated pairing code.

```bash
# pair with the device using pairing code
adb pair ip:port

# connect using IP address and port from the other screen
adb connect ip:port

adb shell

# disconnect
adb disconnect
```

## Remove Android Bloatware

### Core Commands

```bash
# list disabled packages
pm list packages -d

# list users
pm list users

# disable an app
pm disable-user --user 0 _some_package_
pm uninstall -k --user 0 _some_package_

# re-enable an app
cmd package install-existing _some_package_
pm enable _some_package_

# grant and revoke permissions
pm grant [package] android.permission.CAMERA
pm revoke [package] android.permission.CAMERA

# function to remove an app
function removeApp(){
  echo "> Remove: " $@
  pm uninstall $@ || pm uninstall -k --user 0 $@ || pm uninstall -k --user 10 $@
}
```

### Package Management

```bash
# list all packages
dumpsys package | grep "Package \[" | cut -d "\[" -f2 | cut -d "\]" -f1
pm list packages | cut -d ":" -f2

# list all packages including uninstalled
# https://adbshell.com/commands/adb-shell-pm-list-packages
pm list packages -u

# list all packages for a user
pm list packages --user USER_ID
```

### Settings and Permissions

```bash
settings list system
settings list global
settings list secure

# list granted permissions for an app
function listPermissions(){
  dumpsys package $@ | grep "granted=true" | grep permission
}

# revoke location permission for an app
function removePermissionLocation(){
  pm revoke $@ android.permission.ACCESS_COARSE_LOCATION
  pm revoke $@ android.permission.ACCESS_FINE_LOCATION
}
```

https://github.com/synle/bashrc/blob/master/docs/android/android.sh
