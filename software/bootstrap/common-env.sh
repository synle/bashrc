#!/usr/bin/env bash

# Shared environment constants sourced by run.sh (via BEGIN/END) and vite.config.js.
export TZ=UTC
export REPO_PATH_IDENTIFIER="synle/bashrc"
export REPO_BRANCH_NAME="main"
export BASH_SYLE_PATH="$HOME/.bash_syle"
export BASH_SYLE_COMMON_PATH="$HOME/.bash_syle_common"
export BASH_PROFILE_CODE_REPO_RAW_URL="https://github.com/$REPO_PATH_IDENTIFIER/blob/HEAD" # https://github.com/synle/bashrc/blob/HEAD
# Personal root - one visible folder under $HOME owning everything this setup
# creates for the user rather than for a tool. `sy` matches the namespace
# already used everywhere else (sy-commands, /sy-* commands, _SY_LLM_SPECS).
# THIS IS THE ONLY DECLARATION. Consumers derive their own subfolder from it and
# never write a second $HOME literal:
#   bash   "$SY_HOME_FOLDER/<thing>" - run.sh re-exports it into
#          ~/.bash_syle_common, so interactive shells and profile partials see it
#   node   SY_HOME_FOLDER in software/index.js, read from this same env var
# Planned follow-up: ~/sy_llm_ai -> $SY_HOME_FOLDER/llm_ai.
export SY_HOME_FOLDER="$HOME/sy"
export LIMITED_SUPPORT_OSES="is_os_android_termux,is_os_mingw64"
export ALL_OS_FLAGS="is_os_mac,is_os_ubuntu,is_os_chromeos,is_os_mingw64,is_os_android_termux,is_os_arch_linux,is_os_steamos,is_os_redhat,is_os_windows,is_os_wsl"

# Detect physical battery to set is_system_laptop / is_system_desktop.
# Used by scripts that tune resource usage to expected power envelope
# (e.g. software/scripts/advanced/llm/ollama.profile.bash gates OLLAMA_NUM_PARALLEL
# and OLLAMA_KV_CACHE_TYPE on this flag).
#
# Detection cascade — first probe that yields a battery flips the host to laptop;
# every probe silent → desktop default. Order = cheap/local probes first, slow
# subprocess (powershell.exe cold-start) last so WSL/mingw64 setups don't stall
# 30-60s of silence on first invocation while CLR loads.
#   1. macOS: pmset -g batt | grep InternalBattery
#      - Laptops print "-InternalBattery-0 (id=...)"; iMac / Mac mini / Mac Studio
#        / Mac Pro print only the AC line, so grep -q exits 1. ~12ms, documented
#        in `man pmset`, present on every macOS since 10.5.
#   2. Linux / ChromeOS / Steam Deck / Termux: /sys/class/power_supply/BAT*
#      - The canonical Linux power-supply sysfs path. UPower, GNOME, KDE, and
#        every modern battery applet read from it. Works on Chromebooks
#        (Chrome OS Linux container), Steam Deck (handheld battery), and Termux
#        on Android (where it surfaces the phone's battery). Uses `ls` rather
#        than a glob expansion so it stays bash-3.2-safe.
#   3. powershell.exe Get-CimInstance Win32_Battery (Windows / WSL / mingw64)
#      - Last resort because WSL2's /sys/class/power_supply is sparse (no BAT*
#        device exposed) so step 2 misses laptops where Windows is the source
#        of truth. Guarded by `type -P powershell.exe` so native Linux skips
#        the spawn entirely, and capped with `timeout 5` so a cold/slow Windows
#        host can't stall the whole shell startup. 5s false-negative on a
#        heavily-loaded laptop is acceptable — this flag only tunes resource
#        envelopes, never correctness.
if type -P pmset > /dev/null 2>&1 && pmset -g batt 2> /dev/null | grep -q InternalBattery; then
  export is_system_laptop=1
  export is_system_desktop=0
elif ls /sys/class/power_supply/BAT* > /dev/null 2>&1; then
  export is_system_laptop=1
  export is_system_desktop=0
elif type -P powershell.exe > /dev/null 2>&1 \
  && [[ -n $(timeout 5 powershell.exe -Command "Get-CimInstance Win32_Battery" 2> /dev/null | tr -d '\r') ]]; then
  export is_system_laptop=1
  export is_system_desktop=0
else
  export is_system_laptop=0
  export is_system_desktop=1
fi

# --- Display / GUI Detection ---
# _detect_gui_flags - Single source of truth for "does this host have a display?".
# Sets and exports three 0/1 flags, mirroring the is_os_* / is_system_* convention:
#
#   is_gui_x11      1 iff $DISPLAY is set — an X11 (or XWayland / WSLg / Termux:X11)
#                   server is reachable. Picks x11-only tools (xclip, wmctrl, xrandr).
#   is_gui_wayland  1 iff $WAYLAND_DISPLAY is set — a Wayland compositor is reachable.
#                   Picks wayland-only tools (wl-copy/wl-paste, wlr-randr, swaymsg).
#   is_gui          1 iff a GUI surface exists at all. Use this for "should we
#                   install/run GUI apps?". mac and Windows always have a desktop
#                   session, so they are 1 unconditionally; every other platform
#                   needs an X11 or Wayland server.
#
# SSH sessions force is_gui=0: the remote box may well have a physical monitor, but
# nothing we launch there is visible to the person on the other end of the pipe, so
# GUI installs and window-manager calls are wasted work. is_gui_x11 deliberately
# stays 1 under `ssh -X` — X11 forwarding really does give xclip a working server.
#
# Cheap and side-effect free (pure env reads, no subprocess), so it is safe to call
# on every shell start. Re-callable: run `_detect_gui_flags` by hand after changing
# $DISPLAY in a live shell to refresh the flags.
#
# Overrides: $BASHRC_FORCE_IS_GUI / _X11 / _WAYLAND (set by run.sh from
# `--is_gui=0` and friends) win over detection. The override lives INSIDE this
# function rather than being exported over it afterwards because $BASH_ENV points
# every non-interactive bash at ~/.bash_syle_common, so the emitted install script
# — and every node heredoc it spawns — re-runs this function and would otherwise
# silently recompute the detected value back on top of the override.
#
# Consumers:
#   bash     ((is_gui)) / ((is_gui_x11)) / ((is_gui_wayland))
#   node     is_gui / is_gui_x11 / is_gui_wayland globals + exitIfNoGui() (software/index.js)
#
# Read by run.sh via $BASH_SYLE_COMMON_PATH (which invokes this after the is_os_*
# exports), so node inherits the flags as environment variables. Override for a
# single run with `bash run.sh --is_gui=0` to rehearse a headless install.
function _detect_gui_flags() {
  is_gui_x11=0 && [ -n "${DISPLAY:-}" ] && is_gui_x11=1
  is_gui_wayland=0 && [ -n "${WAYLAND_DISPLAY:-}" ] && is_gui_wayland=1

  is_gui=0
  if [ -n "${SSH_CONNECTION:-}" ] || [ -n "${SSH_CLIENT:-}" ]; then
    is_gui=0
  elif ((${is_os_mac:-0} || ${is_os_windows:-0} || is_gui_x11 || is_gui_wayland)); then
    is_gui=1
  fi

  # Explicit overrides win, and are applied last so they survive a re-detect.
  # Compared against a literal 0/1 rather than run through is_truthy so this
  # function stays dependency-free — it is declared into ~/.bash_syle_common and
  # runs in contexts where the other helpers may not be defined yet. run.sh
  # normalizes the user-supplied value to exactly "0" or "1" before exporting.
  case "${BASHRC_FORCE_IS_GUI:-}" in 0 | 1) is_gui="$BASHRC_FORCE_IS_GUI" ;; esac
  case "${BASHRC_FORCE_IS_GUI_X11:-}" in 0 | 1) is_gui_x11="$BASHRC_FORCE_IS_GUI_X11" ;; esac
  case "${BASHRC_FORCE_IS_GUI_WAYLAND:-}" in 0 | 1) is_gui_wayland="$BASHRC_FORCE_IS_GUI_WAYLAND" ;; esac

  export is_gui is_gui_x11 is_gui_wayland
}

# checks if a value is truthy (1, true, y, yes — case-insensitive)
function is_truthy() {
  if is_help_arg "${1:-}"; then
    echo "
      is_truthy: check if a value is truthy (1, true, y, yes — case-insensitive)
        is_truthy 1           returns 0 (success)
        is_truthy yes         returns 0 (success)
        is_truthy false       returns 1 (failure)
        is_truthy \"\${1:-}\" && do_something
    "
    return 0
  fi
  local _val
  _val=$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')
  case "$_val" in 1 | true | y | yes) return 0 ;; *) return 1 ;; esac
}
