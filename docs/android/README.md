# Android Notes

https://github.com/synle/bashrc/blob/master/docs/android/android.sh

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

### Disabled and Removed Apps

```bash
# list disabled packages
pm list packages -d

# list all packages including uninstalled/removed ones
pm list packages -u

# list only uninstalled/removed packages (were installed, now removed)
# compares full list (-u) against currently installed to find removed ones
diff <(pm list packages -u | sort) <(pm list packages | sort) | grep "^<" | sed 's/^< //'

# list system apps only (-s) that have been disabled
pm list packages -d -s

# check if a specific package is disabled or uninstalled
dumpsys package <package_name> | grep -i "enabled\|suspended\|hidden\|stopped"

# re-enable a disabled/removed app
cmd package install-existing <package_name>
pm enable <package_name>
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
  pm revoke $@ android.permission.ACCESS_BACKGROUND_LOCATION
}

# check location permissions for a specific app
dumpsys package <package_name> | grep -i "location"

# check location permission grant status for a specific app
dumpsys package <package_name> | grep -A1 "ACCESS_FINE_LOCATION\|ACCESS_COARSE_LOCATION\|ACCESS_BACKGROUND_LOCATION"

# list all third-party apps with location permission granted
pm list packages -3 | sed 's/package://' | while read pkg; do
  granted=$(dumpsys package "$pkg" | grep "ACCESS_FINE_LOCATION" | grep "granted=true")
  if [ -n "$granted" ]; then
    echo "$pkg"
  fi
done

# disable location services entirely (0=off, 3=high accuracy)
settings put secure location_mode 0

# re-enable location services
settings put secure location_mode 3

# revoke location permissions for all third-party apps
pm list packages -3 | sed 's/package://' | while read pkg; do
  pm revoke "$pkg" android.permission.ACCESS_FINE_LOCATION 2>/dev/null
  pm revoke "$pkg" android.permission.ACCESS_COARSE_LOCATION 2>/dev/null
  pm revoke "$pkg" android.permission.ACCESS_BACKGROUND_LOCATION 2>/dev/null
done
```

### Common Permission Strings

| Category       | Permission                                      |
| -------------- | ----------------------------------------------- |
| Contacts       | `android.permission.READ_CONTACTS`              |
| Contacts       | `android.permission.WRITE_CONTACTS`             |
| Contacts       | `android.permission.GET_ACCOUNTS`               |
| Phone          | `android.permission.READ_PHONE_STATE`           |
| Phone          | `android.permission.CALL_PHONE`                 |
| Phone          | `android.permission.READ_CALL_LOG`              |
| Phone          | `android.permission.WRITE_CALL_LOG`             |
| Phone          | `android.permission.ANSWER_PHONE_CALLS`         |
| SMS/MMS        | `android.permission.SEND_SMS`                   |
| SMS/MMS        | `android.permission.RECEIVE_SMS`                |
| SMS/MMS        | `android.permission.READ_SMS`                   |
| SMS/MMS        | `android.permission.RECEIVE_MMS`                |
| Microphone     | `android.permission.RECORD_AUDIO`               |
| Camera         | `android.permission.CAMERA`                     |
| Storage        | `android.permission.READ_EXTERNAL_STORAGE`      |
| Storage        | `android.permission.WRITE_EXTERNAL_STORAGE`     |
| Storage        | `android.permission.READ_MEDIA_IMAGES`          |
| Storage        | `android.permission.READ_MEDIA_VIDEO`           |
| Storage        | `android.permission.READ_MEDIA_AUDIO`           |
| Location       | `android.permission.ACCESS_FINE_LOCATION`       |
| Location       | `android.permission.ACCESS_COARSE_LOCATION`     |
| Location       | `android.permission.ACCESS_BACKGROUND_LOCATION` |
| Calendar       | `android.permission.READ_CALENDAR`              |
| Calendar       | `android.permission.WRITE_CALENDAR`             |
| Sensors        | `android.permission.BODY_SENSORS`               |
| Nearby Devices | `android.permission.BLUETOOTH_CONNECT`          |
| Nearby Devices | `android.permission.BLUETOOTH_SCAN`             |
| Nearby Devices | `android.permission.NEARBY_WIFI_DEVICES`        |

```bash
# revoke a specific permission for an app
pm revoke <package_name> <permission>

# grant a specific permission for an app
pm grant <package_name> <permission>

# bulk revoke a category for all third-party apps (example: contacts)
pm list packages -3 | sed 's/package://' | while read pkg; do
  pm revoke "$pkg" android.permission.READ_CONTACTS 2>/dev/null
  pm revoke "$pkg" android.permission.WRITE_CONTACTS 2>/dev/null
  pm revoke "$pkg" android.permission.GET_ACCOUNTS 2>/dev/null
done
```

## Fix Visual Voicemail on Google Fi (Samsung S24)

### 1. Re-provision voicemail via dialer code

Open the Phone dialer and enter:

```
*#*#FIXVM#*#*    (or *#*#34986#*#*)
```

### 2. Reset Google Fi app

- Go to **Settings > Apps > Google Fi > Storage > Clear Cache** and **Clear Data**
- Reopen Google Fi and let it re-activate

### 3. Set default phone app

- Go to **Settings > Apps** > three dots > **Default apps > Phone app**
- Try **Samsung Phone** or **Google Phone** (install from Play Store if needed)
- Make sure **Visual Voicemail** app is enabled under **Settings > Apps**

### 4. Check Fi diagnostics

```
*#*#FIINFO#*#*   (or *#*#344636#*#*)
```

Check if voicemail is listed as active.

### 5. Reset conditional call forwarding

In the dialer:

```
##004#          # deactivate all conditional forwarding
**004*1#        # reactivate all conditional forwarding to voicemail
```

### 6. Reset network settings (last resort)

- **Settings > General Management > Reset > Reset Network Settings**
- Restart the phone, then open Google Fi and let it re-activate
