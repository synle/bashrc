#!/usr/bin/env bash
################################################################################
# --- Maximize & Focus Window (cross-platform dispatcher) ---
#
# Brings a GUI app's window to the foreground and maximizes its main window.
# Used by run_editor and run_browser after launching the app in the background.
#
# Platform detection order:
#   1. macOS              — JXA + osascript (maximize to visible frame of the
#                           display under the mouse, tile extras in a grid)
#   2. WSL (Windows host) — powershell.exe + user32 P/Invoke (matches window by
#                           MainWindowTitle, ShowWindow(SW_MAXIMIZE), SetForegroundWindow)
#   3. Wayland            — try sway first (swaymsg), then XWayland via wmctrl;
#                           noop on KDE/GNOME where no portable CLI exists
#   4. X11                — wmctrl (preferred), fallback xdotool
#
# All branches silently noop if the required tool is missing. Callers do not
# need to guard with `((is_os_*))`.
################################################################################

function maximize_and_focus_window() {
  local app_name="$1"
  # Optional 2nd arg: macOS System Events process name. Defaults to app_name.
  # Pass explicitly when bundle display name != executable name (e.g. VS Code:
  # bundle "Visual Studio Code" / process "Code").
  local process_name="${2:-$app_name}"
  [[ -z "$app_name" ]] && return 0

  if ((is_os_mac)); then
    _mac_activate_and_tile "$app_name" "$process_name" 2> /dev/null
  elif ((is_os_wsl)); then
    _wsl_activate_and_maximize "$app_name" 2> /dev/null
  elif ((is_gui_wayland)); then
    _wayland_activate_and_maximize "$app_name" 2> /dev/null
  elif ((is_gui_x11)); then
    _x11_activate_and_maximize "$app_name" 2> /dev/null
  fi
  # Best-effort: never signal failure to the caller. An app that is not running,
  # does not expose window-1, or a missing wmctrl/powershell.exe should not trip
  # `set -e` or leave a non-zero $? in the user's shell.
  return 0
}

# X11 implementation: prefer wmctrl, fall back to xdotool. Both match by window
# title substring. Silent noop if neither tool is installed.
function _x11_activate_and_maximize() {
  local app_name="$1"
  if type -P wmctrl &> /dev/null; then
    wmctrl -a "$app_name" 2> /dev/null || return 0
    wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz 2> /dev/null
  elif type -P xdotool &> /dev/null; then
    local wid
    wid=$(xdotool search --name "$app_name" 2> /dev/null | head -1)
    [[ -z "$wid" ]] && return 0
    xdotool windowactivate "$wid" 2> /dev/null
    xdotool key --window "$wid" super+Up 2> /dev/null
  fi
}

# Wayland implementation: no universal window-control protocol. Best effort:
# - sway             — swaymsg focus + fullscreen
# - XWayland apps    — wmctrl still works for X11 apps in Wayland sessions
# - KDE/GNOME native — noop (requires shell extensions / DBus plumbing per-app)
function _wayland_activate_and_maximize() {
  local app_name="$1"
  if type -P swaymsg &> /dev/null; then
    swaymsg "[title=\"$app_name\"] focus" 2> /dev/null
    swaymsg "[title=\"$app_name\"] fullscreen enable" 2> /dev/null
  elif type -P wmctrl &> /dev/null; then
    wmctrl -a "$app_name" 2> /dev/null || return 0
    wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz 2> /dev/null
  fi
}

# WSL implementation: drive the Windows side via powershell.exe. Matches a
# window by MainWindowTitle substring, then calls user32!ShowWindow(SW_MAXIMIZE)
# + SetForegroundWindow via a tiny P/Invoke type. Silent noop if powershell.exe
# is missing or no matching window is found.
function _wsl_activate_and_maximize() {
  local app_name="$1"
  type -P powershell.exe &> /dev/null || return 0
  powershell.exe -NoProfile -Command "
    Add-Type -Name Win32 -Namespace BashrcWin -MemberDefinition '
      [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);
      [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    ' 2>\$null;
    Get-Process | Where-Object { \$_.MainWindowTitle -like '*$app_name*' } | ForEach-Object {
      [BashrcWin.Win32]::ShowWindow(\$_.MainWindowHandle, 3) | Out-Null;
      [BashrcWin.Win32]::SetForegroundWindow(\$_.MainWindowHandle) | Out-Null;
    }
  " 2> /dev/null
}

# macOS implementation: resolve the visible frame of the display under the mouse
# cursor, set window 1 of $app_name to that rect, and tile extra windows in a
# 300x200 grid from the top-left so they are easy to reach.
function _mac_activate_and_tile() {
  local app_name="$1"
  # System Events uses the *process* (executable) name, not the bundle display
  # name. Fall back to app_name when the caller does not provide one. e.g. VS
  # Code: bundle "Visual Studio Code" / process "Code".
  local process_name="${2:-$app_name}"
  [[ -z "$app_name" ]] && return 0

  # Resolve visible frame (AppleScript coords: top-left origin) of the display containing the mouse cursor
  # The JXA body is read into a variable rather than heredoc'd straight into
  # `$( ... )` — bash 3.2 keeps tracking quotes through a nested heredoc body, so
  # an odd apostrophe count in the JS would break the parse of the whole profile.
  local _disp _jxa _mx _my _mw _mh
  IFS= read -r -d '' _jxa << 'JXA' || true
ObjC.import('AppKit');
const m = $.NSEvent.mouseLocation;
const ss = $.NSScreen.screens;
let t = ss.objectAtIndex(0);
for (let i = 0; i < ss.count; i++) {
  const s = ss.objectAtIndex(i), f = s.frame;
  if (m.x >= f.origin.x && m.x < f.origin.x + f.size.width &&
      m.y >= f.origin.y && m.y < f.origin.y + f.size.height) {
    t = s;
    break;
  }
}
const vf = t.visibleFrame;
const ph = ss.objectAtIndex(0).frame.size.height;
[Math.round(vf.origin.x), Math.round(ph - (vf.origin.y + vf.size.height)), Math.round(vf.size.width), Math.round(vf.size.height)].join(' ');
JXA
  _disp=$(printf '%s\n' "$_jxa" | osascript -l JavaScript 2> /dev/null)
  read -r _mx _my _mw _mh <<< "$_disp"
  # Fallback to primary desktop bounds if JXA failed
  if [[ -z "$_mw" || -z "$_mh" ]]; then
    _mx=0
    _my=0
    read -r _mw _mh <<< "$(osascript -e 'tell application "Finder" to set {_, _, sw, sh} to bounds of window of desktop' -e 'return (sw as string) & " " & (sh as string)' 2> /dev/null)"
  fi
  # `activate` is non-blocking — Electron apps (VS Code) take a beat to spawn their
  # first window, so we poll up to ~10s for window 1 of the process to exist before
  # tiling. Without this, a cold `code .` no-ops because window 1 does not exist yet.
  osascript << APPLESCRIPT 2> /dev/null
tell application "$app_name" to activate
tell application "System Events"
  set deadline to (current date) + 10
  repeat while (current date) < deadline
    if exists process "$process_name" then
      tell process "$process_name"
        if (count of windows) > 0 then exit repeat
      end tell
    end if
    delay 0.2
  end repeat
end tell
tell application "System Events" to tell process "$process_name"
  if (count of windows) is 0 then return
  set position of window 1 to {$_mx, $_my}
  set size of window 1 to {$_mw, $_mh}
  set windowCount to count of windows
  if windowCount > 1 then
    set tileW to 300
    set tileH to 200
    set tileCols to $_mw div tileW
    repeat with i from 2 to windowCount
      set tileCol to ((i - 2) mod tileCols)
      set tileRow to ((i - 2) div tileCols)
      set position of window i to {$_mx + (tileCol * tileW), $_my + (tileRow * tileH)}
      set size of window i to {tileW, tileH}
    end repeat
  end if
end tell
APPLESCRIPT
}
