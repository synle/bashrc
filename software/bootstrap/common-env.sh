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

# Check if the host has a physical battery (Laptops have batteries, Desktops do not)
if [[ -n $(powershell.exe -Command "Get-CimInstance Win32_Battery" 2>/dev/null | tr -d '\r') ]]; then
    export is_system_laptop=1
    export is_system_desktop=0
else
    export is_system_laptop=0
    export is_system_desktop=1
fi
