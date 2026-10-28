#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Remove macOS bloat from personal machines: Spotlight index writes, Microsoft
# (Outlook/OneNote/OneDrive + updater daemons), Google auto-update daemons,
# the Zoom updater daemon, and the Oracle Java helper daemon.
# Intended for personal profile (macOS only). Safe to re-run.

# Guard: only run on macOS
exit_if_not_target_os is_os_mac

# Guard: skip in CI (sudo needed)
if ((IS_CI)); then
  echo ">> Skipped remove-bloat: requires interactive sudo, not available in CI"
  exit 0
fi

# Guard: force-refresh gate for cleanup (2 weeks default)
if [ -f "$HOME/.config/synle/remove-bloat.marker" ] && ! is_force_refresh_stale "$HOME/.config/synle/remove-bloat.marker"; then
  echo ">> Skipped remove-bloat: already completed ($HOME/.config/synle/remove-bloat.marker)"
  exit 0
fi

# All removals below touch system paths (/Library) or index daemons — need root.
sudo -v && sudo -k 2> /dev/null || true

echo ">> Removing macOS bloat:"

################################################################################
# --- Spotlight (macOS only) ---
################################################################################

# Disable Spotlight file indexing on all volumes — stops constant background
# disk writes (index updates). Search still works for apps/contacts/etc.
# Re-enable later with: sudo mdutil -i on
if mdutil -s / 2> /dev/null | grep -q 'Indexing enabled'; then
  echo "  - Disabling Spotlight indexing on all volumes"
  sudo mdutil -a -i off > /dev/null
else
  echo "  - Spotlight indexing already disabled, skipping"
fi

################################################################################
# --- Microsoft (apps + updater/telemetry daemons) ---
################################################################################

# Microsoft apps — the actual products, not just the update daemons
echo "  - Removing Microsoft apps (Outlook, OneNote, OneDrive)"
print_action_summary "/Applications/Microsoft Outlook.app" rm -rf "/Applications/Microsoft Outlook.app"
print_action_summary "/Applications/Microsoft OneNote.app" rm -rf "/Applications/Microsoft OneNote.app"
print_action_summary "/Applications/OneDrive.app" rm -rf "/Applications/OneDrive.app"

# App data & preferences — containers hold mail/notes caches and settings
echo "  - Removing Microsoft app data (containers, group containers, prefs)"
print_action_summary "$HOME/Library/Containers/com.microsoft.Outlook" rm -rf "$HOME/Library/Containers/com.microsoft.Outlook"
print_action_summary "$HOME/Library/Containers/com.microsoft.onenote.mac" rm -rf "$HOME/Library/Containers/com.microsoft.onenote.mac"
print_action_summary "$HOME/Library/Containers/com.microsoft.errorreporting" rm -rf "$HOME/Library/Containers/com.microsoft.errorreporting"
print_action_summary "$HOME/Library/Containers/com.microsoft.netlib.shipassertprocess" rm -rf "$HOME/Library/Containers/com.microsoft.netlib.shipassertprocess"
print_action_summary "$HOME/Library/Group Containers/UBF8T346G9.ms" rm -rf "$HOME/Library/Group Containers/UBF8T346G9.ms"
print_action_summary "$HOME/Library/Group Containers/UBF8T346G9.Office" rm -rf "$HOME/Library/Group Containers/UBF8T346G9.Office"
print_action_summary "$HOME/Library/Preferences/com.microsoft.Outlook.plist" rm -rf "$HOME/Library/Preferences/com.microsoft.Outlook.plist"
print_action_summary "$HOME/Library/Preferences/com.microsoft.onenote.mac.plist" rm -rf "$HOME/Library/Preferences/com.microsoft.onenote.mac.plist"

# OneDrive updater daemons & telemetry — background processes that wake to
# check for updates and report usage. Safe to remove: the OneDrive app above
# is gone anyway, and these only serve auto-update and crash reporting.
# "bootout" is no-op if the daemon was never loaded (hence 2>/dev/null).
echo "  - Removing Microsoft OneDrive updater daemons and telemetry"
sudo launchctl bootout system/com.microsoft.OneDriveStandaloneUpdaterDaemon 2> /dev/null
sudo rm -f /Library/LaunchAgents/com.microsoft.OneDriveStandaloneUpdater.plist
sudo rm -f /Library/LaunchAgents/com.microsoft.SyncReporter.plist
sudo rm -f /Library/LaunchDaemons/com.microsoft.OneDriveStandaloneUpdaterDaemon.plist
sudo rm -f /Library/LaunchDaemons/com.microsoft.OneDriveUpdaterDaemon.plist

################################################################################
# --- Google (auto-update daemons) ---
################################################################################

# Google auto-update daemon — background process that keeps checking for
# Chrome/Google updates even without any other Google app running.
# Chrome itself still works; it just stops auto-updating.
echo "  - Removing Google updaters"
sudo launchctl bootout system/com.google.keystone.daemon 2> /dev/null
sudo rm -f /Library/LaunchAgents/com.google.keystone.agent.plist
sudo rm -f /Library/LaunchAgents/com.google.keystone.xpcservice.plist
sudo rm -f /Library/LaunchDaemons/com.google.keystone.daemon.plist
sudo rm -f /Library/LaunchDaemons/com.google.GoogleUpdater.wake.system.plist

################################################################################
# --- Zoom (updater daemon) ---
################################################################################

# Zoom daemon — background updater that wakes to check for Zoom updates.
# The Zoom app itself still works fine when opened manually.
echo "  - Removing Zoom updater daemon"
sudo launchctl bootout system/us.zoom.ZoomDaemon 2> /dev/null
sudo rm -f /Library/LaunchDaemons/us.zoom.ZoomDaemon.plist

################################################################################
# --- Oracle (Java helper) ---
################################################################################

# Oracle Java helper tool — registers the Java runtime on the system for all
# users. Only needed by Java apps that auto-detect Oracle's install.
# Removing it stops the helper daemon; installed JREs are left in place.
echo "  - Removing Oracle Java helper daemon"
sudo launchctl bootout system/com.oracle.java.Helper-Tool 2> /dev/null
sudo rm -f /Library/LaunchDaemons/com.oracle.java.Helper-Tool.plist

# Marker file for idempotency — gates re-runs (2-week force-refresh window)
safe_mkdir "$HOME/.config/synle"
safe_touch "$HOME/.config/synle/remove-bloat.marker"

echo ">> macOS bloat removed"
