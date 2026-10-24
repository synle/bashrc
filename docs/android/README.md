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

## Back Up State Before ADB Cleanup

Run these commands from **Bash on your computer**, not inside `adb shell`.
If you entered the interactive Android shell above, run `exit` first.
Keep ADB connected until capture finishes; do not run cleanup concurrently.

These are read-only device queries, not an APK, app-data, or full-device backup.
Keep your normal device backup too.
Package dumps, AppOps history, and settings can contain personal identifiers, usage history, or sensitive configuration.
The commands create private local folders; do not commit or share their contents without reviewing them.

### 1. Package Inventory and Raw State

Check the connected device and Android users first:

```bash
adb devices -l
adb shell pm list users
```

With multiple devices connected, set `ANDROID_SERIAL` to the intended device's serial before continuing.
Set `android_user` below to the profile you will clean up; `0` is usually the owner, not necessarily the current foreground user.
Repeat for each relevant work, secondary, or private profile.
Record the model and firmware build from **Settings > About phone** alongside each snapshot.

Paste this entire block into host Bash before each cleanup run.
Every run creates a new folder under your home folder, preserving previous snapshots.

```bash
(
  set -euo pipefail
  umask 077
  android_user=0
  backup_folder=$(mktemp -d "$HOME/android-backup-$(date +%Y%m%d-%H%M%S)-XXXXXX")
  printf 'Backup folder: %s\n' "$backup_folder"
  printf '%s\n' "$android_user" > "$backup_folder/android-user.txt"
  adb version > "$backup_folder/adb-version.txt"
  adb shell -n pm list users > "$backup_folder/users.txt"

  # Preserve raw lists; pipefail prevents transport errors becoming an empty inventory.
  adb shell -n pm list packages --user "$android_user" -u > "$backup_folder/all.raw.txt"
  adb shell -n pm list packages --user "$android_user" -u -s > "$backup_folder/system.raw.txt"
  adb shell -n pm list packages --user "$android_user" -u -3 > "$backup_folder/user.raw.txt"
  adb shell -n pm list packages --user "$android_user" > "$backup_folder/installed.raw.txt"
  adb shell -n pm list packages --user "$android_user" -e > "$backup_folder/enabled.raw.txt"
  adb shell -n pm list packages --user "$android_user" -d > "$backup_folder/disabled.raw.txt"

  for list_name in all system user installed enabled disabled; do
    tr -d '\r' < "$backup_folder/$list_name.raw.txt" |
      awk '/^package:/ { sub(/^package:/, ""); print }' |
      LC_ALL=C sort -u > "$backup_folder/$list_name.txt"
  done
  test -s "$backup_folder/all.txt"

  # Use filenames rather than NR == FNR so empty input lists remain valid.
  awk '
    FILENAME == ARGV[1] { system_packages[$0] = 1; next }
    FILENAME == ARGV[2] { user[$0] = 1; next }
    FILENAME == ARGV[3] { installed[$0] = 1; next }
    FILENAME == ARGV[4] { enabled[$0] = 1; next }
    FILENAME == ARGV[5] { disabled[$0] = 1; next }
    FILENAME == ARGV[6] {
      type = ($0 in system_packages) ? "system" : (($0 in user) ? "user" : "unknown")
      status = "unknown"
      if (!($0 in installed)) status = "removed"
      else if ($0 in disabled) status = "disabled"
      else if ($0 in enabled) status = "active"
      printf "%s\t%s\t%s\n", $0, type, status
    }
  ' "$backup_folder/system.txt" "$backup_folder/user.txt" \
    "$backup_folder/installed.txt" "$backup_folder/enabled.txt" \
    "$backup_folder/disabled.txt" "$backup_folder/all.txt" > "$backup_folder/apps.rows.tsv"
  printf 'package\ttype\tstatus\n' > "$backup_folder/apps.tsv"
  command cat "$backup_folder/apps.rows.tsv" >> "$backup_folder/apps.tsv"

  # Raw evidence includes permission grants, per-user flags, and AppOps modes/history.
  # These two dumps may include other Android users; the inventory above does not.
  adb shell -n dumpsys package > "$backup_folder/packages.txt"
  adb shell -n dumpsys appops > "$backup_folder/appops.txt"

  # These tables contain current values, including defaults; see section 3 below.
  for namespace in system secure global; do
    adb shell -n settings --user "$android_user" list "$namespace" > "$backup_folder/settings-$namespace.raw.txt"
    tr -d '\r' < "$backup_folder/settings-$namespace.raw.txt" |
      LC_ALL=C sort > "$backup_folder/settings-$namespace.txt"
  done

  printf 'All capture commands exited successfully. Review raw output before cleanup.\n' > "$backup_folder/capture-finished.txt"
  printf 'Saved inventory: %s/apps.tsv\n' "$backup_folder"
)
```

Open `apps.tsv` in a spreadsheet; it has these three columns:

| Column            | Meaning                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `package`         | Package identifier, not the human-readable app label.                                                        |
| `type`            | `system` means a system-image app, including updated system apps; `user` means a third-party/non-system app. |
| `status=active`   | Installed and enabled for the selected user; not proof of a running process or unrestricted access.          |
| `status=disabled` | Installed but disabled for the selected user.                                                                |
| `status=removed`  | Known to Package Manager through `-u`, but absent from the installed list for the selected user.             |
| `unknown`         | Unclassified state; investigate before using the inventory for cleanup.                                      |

For system apps, `removed` commonly means uninstalled for that user while the system-image copy remains.
Third-party packages retained by Android can also appear as removed.
Completely uninstalled, forgotten packages cannot be reconstructed with `-u`; this is not a historical install log.
Hidden, suspended, stopped, or archived states need the raw package dump and the device UI; these are not separate TSV statuses.

Before cleanup, confirm `capture-finished.txt` exists and inspect raw files for errors, permission denials, or truncated dumps.
Some Android commands print errors while returning success; the marker alone does not prove a usable snapshot.
A missing marker means partial capture: keep the folder, fix the failing read, and rerun the entire block.
Stop before cleanup if the inventory is empty or the evidence is incomplete.
Cancel capture with Ctrl-C; it requires no device rollback because it changes no device state.

### 2. Permissions for a Selected App

Set `app_package` to an installed package from `apps.tsv`; there is no single reliable "current app" during capture.
Run this block in host Bash to save focused evidence in a separate private folder:

```bash
(
  set -euo pipefail
  umask 077
  android_user=0
  app_package=com.example.app
  permission_folder=$(mktemp -d "$HOME/android-permissions-$(date +%Y%m%d-%H%M%S)-XXXXXX")
  printf 'Permission folder: %s\n' "$permission_folder"
  printf 'user=%s\npackage=%s\n' "$android_user" "$app_package" > "$permission_folder/target.txt"
  adb shell -n dumpsys package "$app_package" > "$permission_folder/package.txt"
  adb shell -n cmd appops get --user "$android_user" "$app_package" > "$permission_folder/appops.txt"

  # Extract only the selected user's runtime grants, not manifest declarations.
  # dumpsys is diagnostic text; keep the raw dump if an OEM changes its layout.
  tr -d '\r' < "$permission_folder/package.txt" | awk -v target="$android_user" '
    /^[[:space:]]*User [0-9]+:/ {
      selected = ($2 == target ":")
      runtime = 0
      next
    }
    selected && /^[[:space:]]*runtime permissions:/ {
      runtime = 1
      indent = match($0, /[^[:space:]]/)
      next
    }
    runtime && /[^[:space:]]/ {
      if (match($0, /[^[:space:]]/) <= indent) { runtime = 0; next }
      if ($0 ~ /: granted=/) print
    }
  ' > "$permission_folder/runtime-permissions.txt"
  command cat "$permission_folder/runtime-permissions.txt"
)
```

`granted=true` records a grant; `granted=false` records a denial at capture time.
An absent line is **unknown or not applicable**, not automatically denied.
If extraction is empty, inspect `package.txt`, its `User N:` section, and the app's Permissions screen before interpreting it.
The raw dump also includes install-time permissions, which are not all runtime prompts.

AppOps is a second layer: compare `appops.txt` with permission grants, device policy, and global privacy switches.
`allow` allows that operation at the AppOps layer; `foreground` restricts it to qualifying foreground use; `ignore` or `deny` blocks it.
`default`, a missing entry, or `No operations.` does not mean an explicit grant or denial.
Usage timestamps are history, not permission settings.

All permission names below use the prefix `android.permission.`.
Use the grouped names to review `runtime-permissions.txt` and the corresponding entries in the raw package and AppOps dumps.

#### Location: Approximate, Precise, and Background

- Approximate: `ACCESS_COARSE_LOCATION` granted with `ACCESS_FINE_LOCATION` denied means approximate-only permission.
- Precise: `ACCESS_FINE_LOCATION` granted permits precise access, subject to AppOps and device restrictions.
- Background location: review `ACCESS_BACKGROUND_LOCATION` separately from foreground accuracy.
- One-time grants can expire; keep permission flags and capture time rather than treating a grant as permanent.
- A location grant does not override the device's location switch, sensor availability, or policy.

#### Background Processing and Background Running

There is no universal "run in background" permission.
Review these independent controls in addition to runtime grants:

```bash
# Host commands; replace this package and profile before running.
android_user=0
app_package=com.example.app
adb shell cmd appops get --user "$android_user" "$app_package" RUN_IN_BACKGROUND
adb shell cmd appops get --user "$android_user" "$app_package" RUN_ANY_IN_BACKGROUND
adb shell am get-inactive --user "$android_user" "$app_package"
adb shell am get-standby-bucket --user "$android_user" "$app_package"
adb shell dumpsys deviceidle
```

Save these outputs alongside the focused permission snapshot when reviewing background behavior.
Check battery-optimization exemptions in the device-idle dump and **Settings > Apps > app > Battery**.
`WAKE_LOCK` and `FOREGROUND_SERVICE` appear among declared/install-time permissions; neither guarantees unrestricted background execution.
`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permits requesting an exemption, not proof that an exemption was granted.
App standby, Data Saver, OEM sleeping-app/autostart rules, and device policy can impose additional restrictions.
Unsupported operations or unavailable dumps are gaps to record, not evidence that background access is allowed.

#### Phone and Call Access

Review `READ_PHONE_STATE`, `CALL_PHONE`, `READ_CALL_LOG`, `WRITE_CALL_LOG`, and `ANSWER_PHONE_CALLS` separately.
Call-log access can also depend on roles or platform restrictions; a phone-state grant is not call-log access.

#### Contacts and Accounts

Review `READ_CONTACTS`, `WRITE_CONTACTS`, and `GET_ACCOUNTS` separately.
Read access does not imply write access, and account visibility has additional platform restrictions.

#### Calendar

Review `READ_CALENDAR` and `WRITE_CALENDAR` separately.

#### Other Useful Permission Groups

| Group                | Permissions or additional evidence                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Camera               | `CAMERA`; also check the device-wide camera privacy switch.                                                                                                  |
| Microphone           | `RECORD_AUDIO`; also check the device-wide microphone privacy switch.                                                                                        |
| SMS/MMS              | `READ_SMS`, `SEND_SMS`, `RECEIVE_SMS`, `RECEIVE_MMS`; roles and restrictions can further limit access.                                                       |
| Notifications        | `POST_NOTIFICATIONS` on Android 13+; channel-level settings can still block individual notification types.                                                   |
| Photos, video, audio | `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`; `READ_MEDIA_VISUAL_USER_SELECTED` indicates selected visual-media access on supported versions. |
| Older storage access | `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`; behavior depends on Android version, target SDK, and scoped storage.                                      |
| Nearby devices       | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `NEARBY_WIFI_DEVICES`; applicability varies by Android version.                                                       |
| Body sensors         | `BODY_SENSORS`; newer Android versions add separate controls for some sensor/background access.                                                              |
| Special access       | Review Accessibility, notification access, usage access, display-over-other-apps, all-files access, VPN, and device-admin screens separately.                |

Special access is not fully represented by runtime grants.
The raw snapshots preserve some related settings and AppOps evidence, but do not guarantee a complete or restorable special-access backup.

### 3. Settings Snapshot and Non-Default Candidates

The first block saves sorted `settings-system.txt`, `settings-secure.txt`, and `settings-global.txt`, plus unmodified raw outputs.
System and secure settings are user-scoped; global settings are device-wide even when a user argument is supplied.
These exports include defaults, generated values, and runtime state, not only intentional user changes.
They omit app-private preferences, inaccessible settings, and some OEM configuration.

Android provides no universal ADB command that reliably exports only settings changed from factory defaults.
A meaningful comparison needs a trusted baseline from the **same device, firmware build, and Android user** before customization.
Without that baseline, keep the complete snapshots; do not label every exported key a non-default override.
Do not factory-reset a working device just to obtain a baseline.

For example, set these variables to two existing snapshot folders:

```bash
baseline_folder="$HOME/android-backup-baseline"
current_folder="$HOME/android-backup-before-cleanup"
for namespace in system secure global; do
  diff -u "$baseline_folder/settings-$namespace.txt" "$current_folder/settings-$namespace.txt"
done
```

`diff` exits `1` for differences and greater than `1` for errors; a missing file is not a valid comparison.
Differences identify changed-key candidates, not proof of user changes: Android and apps also update these tables automatically.
Keep the before-cleanup snapshot unchanged and capture another after cleanup to verify exactly what changed.

### Recovery Scope and Limits

This is an audit snapshot, not an automatic restore script.
Review recovery one package or setting at a time, for the original user and compatible firmware.
The existing package-management notes below describe reinstalling retained packages and re-enabling apps.
A missing APK, removed app data, or expired one-time grant cannot be restored from these text files.
Do not replay settings tables or bulk-grant permissions: some values are identifiers, policy-controlled, obsolete, or unsafe to copy.
Restore only reviewed changes through the relevant device UI or a separately verified command, then query the state again.
A reset-to-defaults job is not restoration of your captured prior state.

References: [ADB and Package Manager](https://developer.android.com/tools/adb), [dumpsys](https://developer.android.com/tools/dumpsys),
[location permission semantics](https://developer.android.com/develop/sensors-and-location/location/permissions/runtime),
[permission reference](https://developer.android.com/reference/android/Manifest.permission), and
[AOSP settings command help](https://android.googlesource.com/platform/frameworks/base/+/master/packages/SettingsProvider/src/com/android/providers/settings/SettingsService.java).

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
