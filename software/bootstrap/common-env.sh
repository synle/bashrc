#!/usr/bin/env bash

# Shared environment constants sourced by run.sh (via BEGIN/END) and vite.config.js.
export TZ=UTC
export REPO_PATH_IDENTIFIER="synle/bashrc"
export REPO_BRANCH_NAME="main"
export BASH_SYLE_PATH="$HOME/.bash_syle"
export BASH_SYLE_COMMON_PATH="$HOME/.bash_syle_common"
export BASH_PROFILE_CODE_REPO_RAW_URL="https://github.com/$REPO_PATH_IDENTIFIER/blob/HEAD" # https://github.com/synle/bashrc/blob/HEAD
export LIMITED_SUPPORT_OSES="is_os_android_termux,is_os_mingw64"
export ALL_OS_FLAGS="is_os_mac,is_os_ubuntu,is_os_chromeos,is_os_mingw64,is_os_android_termux,is_os_arch_linux,is_os_steamos,is_os_redhat,is_os_windows,is_os_wsl"

# Detect physical battery to set is_system_laptop / is_system_desktop.
# Used by scripts that tune resource usage to expected power envelope
# (e.g. software/scripts/advanced/llm/ollama.profile.bash gates OLLAMA_NUM_PARALLEL
# and OLLAMA_KV_CACHE_TYPE on this flag).
#
# Detection cascade — first probe that yields a battery flips the host to laptop;
# every probe silent → desktop default. Order matters: powershell first so Windows
# / WSL / mingw64 keep the existing well-tested code path.
#   1. powershell.exe Get-CimInstance Win32_Battery
#      - Windows-native, WSL (powershell.exe is on PATH from /mnt/c), and
#        mingw64 (PowerShell installed alongside Git Bash). Existing check.
#   2. macOS: pmset -g batt | grep InternalBattery
#      - Laptops print "-InternalBattery-0 (id=...)"; iMac / Mac mini / Mac Studio
#        / Mac Pro print only the AC line, so grep -q exits 1. ~12ms, documented
#        in `man pmset`, present on every macOS since 10.5.
#   3. Linux / ChromeOS / Steam Deck / Termux: /sys/class/power_supply/BAT*
#      - The canonical Linux power-supply sysfs path. UPower, GNOME, KDE, and
#        every modern battery applet read from it. Works on Chromebooks
#        (Chrome OS Linux container), Steam Deck (handheld battery), and Termux
#        on Android (where it surfaces the phone's battery). Uses `ls` rather
#        than a glob expansion so it stays bash-3.2-safe.
if [[ -n $(powershell.exe -Command "Get-CimInstance Win32_Battery" 2> /dev/null | tr -d '\r') ]]; then
  export is_system_laptop=1
  export is_system_desktop=0
elif type -P pmset > /dev/null 2>&1 && pmset -g batt 2> /dev/null | grep -q InternalBattery; then
  export is_system_laptop=1
  export is_system_desktop=0
elif ls /sys/class/power_supply/BAT* > /dev/null 2>&1; then
  export is_system_laptop=1
  export is_system_desktop=0
else
  export is_system_laptop=0
  export is_system_desktop=1
fi
