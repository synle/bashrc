#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Remove Microsoft Outlook, OneNote, and OneDrive from macOS
# Intended for personal work profile (macOS only).

# Guard: only run on macOS
exit_if_not_target_os is_os_mac

# Guard: skip in CI (sudo needed)
if ((IS_CI)); then
  echo ">> Skipped remove-microsoft: requires interactive sudo, not available in CI"
  exit 0
fi

# Guard: force-refresh gate for cleanup (2 weeks default)
if [ -f "$HOME/.config/synle/remove-microsoft.marker" ] && ! is_force_refresh_stale "$HOME/.config/synle/remove-microsoft.marker"; then
  echo ">> Skipped remove-microsoft: already completed ($HOME/.config/synle/remove-microsoft.marker)"
  exit 0
fi

echo ">> Removing Microsoft applications and data folders:"

# Applications
print_action_summary "/Applications/Microsoft Outlook.app" rm -rf "/Applications/Microsoft Outlook.app"
print_action_summary "/Applications/Microsoft OneNote.app" rm -rf "/Applications/Microsoft OneNote.app"
print_action_summary "/Applications/OneDrive.app" rm -rf "/Applications/OneDrive.app"

# Containers
print_action_summary "$HOME/Library/Containers/com.microsoft.Outlook" rm -rf "$HOME/Library/Containers/com.microsoft.Outlook"
print_action_summary "$HOME/Library/Containers/com.microsoft.onenote.mac" rm -rf "$HOME/Library/Containers/com.microsoft.onenote.mac"
print_action_summary "$HOME/Library/Containers/com.microsoft.errorreporting" rm -rf "$HOME/Library/Containers/com.microsoft.errorreporting"
print_action_summary "$HOME/Library/Containers/com.microsoft.netlib.shipassertprocess" rm -rf "$HOME/Library/Containers/com.microsoft.netlib.shipassertprocess"

# Group Containers
print_action_summary "$HOME/Library/Group Containers/UBF8T346G9.ms" rm -rf "$HOME/Library/Group Containers/UBF8T346G9.ms"
print_action_summary "$HOME/Library/Group Containers/UBF8T346G9.Office" rm -rf "$HOME/Library/Group Containers/UBF8T346G9.Office"

# Preferences
print_action_summary "$HOME/Library/Preferences/com.microsoft.Outlook.plist" rm -rf "$HOME/Library/Preferences/com.microsoft.Outlook.plist"
print_action_summary "$HOME/Library/Preferences/com.microsoft.onenote.mac.plist" rm -rf "$HOME/Library/Preferences/com.microsoft.onenote.mac.plist"

# Marker file for idempotency
safe_mkdir "$HOME/.config/synle"
safe_touch "$HOME/.config/synle/remove-microsoft.marker"

echo ">> Microsoft apps removed"