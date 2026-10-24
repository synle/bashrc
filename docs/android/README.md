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
Run the standalone host scripts from the repository root, or use their absolute paths.
Android user `0` is usually the owner, not necessarily the current foreground user.
Repeat for each relevant work, secondary, or private profile.
Record the model and firmware build from **Settings > About phone** alongside each snapshot.

```bash
# Creates a private mktemp folder; prints its path before and after capture.
# stdout contains only the full inventory TSV path; progress goes to stderr.
inventory_tsv=$(bash docs/android/scripts/android-access.sh inventory 0)
```

Every invocation creates a new folder with `mktemp -d "$HOME/android-backup-$(date +%Y%m%d-%H%M%S)-XXXXXX"`.
The final message includes the full generated TSV path, including on a later capture failure if the TSV already exists.
The scripts pin the selected ADB serial and save device/user metadata alongside the inventory.
Rows sort system apps first, then non-system apps, with package names sorted within each type; unknown types sort last.
The optional friendly-name column is omitted because standard ADB package lists do not reliably expose localized app labels.
No APK extraction or extra Android build-tool dependency is required.

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

Use the same `get` command for one package, a comma-separated package list, or an inventory TSV.
There is no default placeholder package: provide real installed package identifiers from your inventory.
For example, choose actual packages before using the first two forms below:

```bash
bash docs/android/scripts/android-access.sh get camera 'com.example.selectedapp' 0
bash docs/android/scripts/android-access.sh get contacts 'com.example.firstapp,com.example.secondapp' 0
bash docs/android/scripts/android-access.sh get all "$inventory_tsv"
```

CSV accepts surrounding whitespace and removes duplicate identifiers; it does not accept human-readable app labels.
TSV parsing locates the `package` and `status` headers, so an extra friendly-name column does not shift the package selector.
Keep selected rows and the header when editing an inventory TSV.
`active` and `disabled` rows are selected; `removed` rows are skipped because AppOps requires an installed package UID.
Unknown statuses, empty selections, malformed identifiers, missing packages, and device/user mismatches fail before any permission writes.
CSV defaults to Android user `0`; TSV uses adjacent `android-user.txt` metadata when present.
If you move an edited TSV away from its metadata, pass the intended Android user explicitly.

A private timestamped folder contains `results.tsv` and one private subfolder per app.
Each app folder contains raw `package.txt`, `appops.txt`, selected-user `runtime-permissions.tsv`, and normalized `access.tsv`.
Background queries also preserve per-operation output, app inactivity, and standby-bucket evidence.
Individual failed reads remain in `results.tsv`; other selected apps are still attempted, but the command exits nonzero.
The scripts print the backup folder at start and finish, and the full results TSV path at finish.
Read raw package dumps carefully: they can include users other than the selected user.

#### One-Step Inventory and Access Backup

```bash
bash docs/android/scripts/backup-all.sh 0
```

The bundle first creates the inventory, then passes that TSV to `get all`.
It prints both full TSV paths and retains the inventory if access capture fails.
No device permissions or settings are changed.
A large inventory can take several minutes; do not clean up apps while capture runs.

#### Shared Access Types for Bulk Get and Set

| Type                                          | What it selects                                             | Set actions                  |
| --------------------------------------------- | ----------------------------------------------------------- | ---------------------------- |
| `all`                                         | Runtime grant evidence plus both background AppOps          | Read-only                    |
| `location`, `location-precise`                | Coarse and fine foreground location                         | `grant`, `revoke`            |
| `location-approximate`                        | Coarse location; granting also revokes fine location        | `grant`, `revoke`            |
| `location-background`                         | Background location, separate from foreground accuracy      | `grant`, `revoke`            |
| `camera`, `microphone`                        | Camera or audio recording                                   | `grant`, `revoke`            |
| `contacts`, `calendar`                        | Read and write permissions for that category                | `grant`, `revoke`            |
| `phone`, `sms`                                | Common phone/call or messaging permission groups            | `grant`, `revoke`            |
| `notifications`, `media`, `nearby`, `sensors` | Corresponding runtime permission groups                     | `grant`, `revoke`            |
| `background-running`                          | `RUN_IN_BACKGROUND` AppOp                                   | `allow`, `ignore`, `default` |
| `background-processing`                       | `RUN_ANY_IN_BACKGROUND` AppOp                               | `allow`, `ignore`, `default` |
| `android.permission.PERMISSION_NAME`          | One exact runtime permission, useful for selective recovery | `grant`, `revoke`            |

The category definitions live in the script, not separate grant/revoke copies.
Some groups contain permissions unavailable or undeclared on a particular app or Android version.
Unknown runtime grant evidence blocks `set --apply`; policy-fixed, signature, or special-access permissions may not be changeable through ADB.

#### Bulk Grant, Revoke, and Background Changes

`set` defaults to preview, prints the selected packages, and writes `preview.tsv` without changing device access.
Review that output first; append `--apply` only when you intend to change every selected package.

```bash
# Preview contact grants for selected inventory rows.
bash docs/android/scripts/android-access.sh set grant contacts "$inventory_tsv"

# Explicit device changes after review; choose the intended subset first.
bash docs/android/scripts/android-access.sh set grant contacts "$inventory_tsv" --apply
bash docs/android/scripts/android-access.sh set revoke contacts "$inventory_tsv" --apply
bash docs/android/scripts/android-access.sh set grant location-approximate "$inventory_tsv" --apply
bash docs/android/scripts/android-access.sh set grant location-background "$inventory_tsv" --apply
bash docs/android/scripts/android-access.sh set ignore background-running "$inventory_tsv" --apply
bash docs/android/scripts/android-access.sh set allow background-processing "$inventory_tsv" --apply
```

CSV and explicit-user forms work here exactly as they do for `get`.
All selected apps must pass before-state capture before the first mutation.
The script rechecks installed state at each package's write boundary, preserves command output, and captures after-state evidence.
`changes.tsv` records command outcomes; `verification.tsv` compares requested values with after-state reads.
A command that exits successfully but leaves the wrong state causes a nonzero batch result.
A batch is not transactional: failures or Ctrl-C can leave some changes applied.
Keep the printed backup folder; review its before/after folders and logs before retrying or recovering.
Granting background location does not establish foreground location; grant the intended foreground accuracy separately if needed.
Revoking `location-approximate` revokes coarse access only; use the `location` category to revoke both foreground location permissions.

`granted=true` records a grant; `granted=false` records a denial at capture time.
An absent line is **unknown or not applicable**, not automatically denied.
If extraction is empty, inspect `package.txt`, its `User N:` section, and the app's Permissions screen before interpreting it.
The raw dump also includes install-time permissions, which are not all runtime prompts.

AppOps is a second layer: compare `appops.txt` with permission grants, device policy, and global privacy switches.
`allow` allows that operation at the AppOps layer; `foreground` restricts it to qualifying foreground use; `ignore` or `deny` blocks it.
`default`, a missing entry, or `No operations.` does not mean an explicit grant or denial.
Usage timestamps are history, not permission settings.

All permission names below use the prefix `android.permission.`.
Use the grouped names to review `runtime-permissions.tsv` and the corresponding entries in the raw package and AppOps dumps.

#### Location: Approximate, Precise, and Background

- Approximate: `ACCESS_COARSE_LOCATION` granted with `ACCESS_FINE_LOCATION` denied means approximate-only permission.
- Precise: `ACCESS_FINE_LOCATION` granted permits precise access, subject to AppOps and device restrictions.
- Background location: review `ACCESS_BACKGROUND_LOCATION` separately from foreground accuracy.
- One-time grants can expire; keep permission flags and capture time rather than treating a grant as permanent.
- A location grant does not override the device's location switch, sensor availability, or policy.

#### Background Processing and Background Running

There is no universal "run in background" permission.
Use the same app selection for each independent background control:

```bash
bash docs/android/scripts/android-access.sh get background-running "$inventory_tsv"
bash docs/android/scripts/android-access.sh get background-processing "$inventory_tsv"
```

These snapshots include AppOps modes, inactivity, and standby-bucket evidence.
Use `get all` for a combined snapshot; the separate categories remain available for focused reads and writes.
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

The `inventory` command saves sorted `settings-system.txt`, `settings-secure.txt`, and `settings-global.txt`, plus unmodified raw outputs.
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

This is an audit snapshot, not a universal automatic restore.
Review recovery one package or setting at a time, for the original device/user and compatible firmware.
The existing package-management notes below describe reinstalling retained packages and re-enabling apps.
A missing APK, removed app data, or expired one-time grant cannot be restored from these text files.

For permission recovery, inspect each package's before-state `access.tsv`, `runtime-permissions.tsv`, and raw dump.
Group only packages that shared the same original value; do not blanket-grant an entire category to restore mixed prior grants.
Use one exact permission when restoring a single grant:

```bash
# Preview restoration for a reviewed package subset; substitute actual selected package identifiers.
bash docs/android/scripts/android-access.sh set grant android.permission.READ_CONTACTS 'com.example.firstapp,com.example.secondapp' 0
# Append --apply only after confirming these packages originally had this grant.
# Use set revoke for packages whose original value was false.

# Restore the original explicit AppOps mode for a reviewed TSV subset.
bash docs/android/scripts/android-access.sh set default background-running "$inventory_tsv"
```

For AppOps, inspect the raw operation output: an effective `allow` value does not prove a prior explicit allow override.
`default` resets only the chosen AppOp; it does not restore OEM sleeping-app rules, all battery settings, or app standby history.
Modes outside the script's allow/ignore/default write allowlist require separate review rather than silent coercion.
UID-level overrides can prevent package-level AppOps changes; the script reports failed verification instead of modifying every app sharing that UID.
When restoring location, establish the original coarse grant before fine/background grants where required by the platform.
One-time, policy-fixed, and other permission flags cannot be faithfully restored by plain grant/revoke operations.
Re-run `get` after recovery and review `verification.tsv` from applied changes.

Do not replay settings tables: some values are identifiers, policy-controlled, obsolete, or unsafe to copy.
Restore only reviewed settings through the device UI or a separately verified command, then query their state again.
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
