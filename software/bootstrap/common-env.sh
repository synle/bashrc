#!/usr/bin/env bash

# Shared environment constants sourced by run.sh (via BEGIN/END) and vite.config.js.
export TZ=UTC
export REPO_PATH_IDENTIFIER="synle/bashrc"
export REPO_BRANCH_NAME="master"
export BASH_SYLE_PATH="$HOME/.bash_syle"
export BASH_SYLE_COMMON_PATH="$HOME/.bash_syle_common"
export BASH_PROFILE_CODE_REPO_RAW_URL="https://raw.githubusercontent.com/$REPO_PATH_IDENTIFIER/$REPO_BRANCH_NAME" # https://raw.githubusercontent.com/synle/bashrc/master
export LIGHT_WEIGHT_SCRIPTS="git.js,vim-configurations.js,vim-vundle.sh,bash-inputrc.js,bash-syle-content.js"
export LIMITED_SUPPORT_OSES="is_os_android_termux,is_os_mingw64"
export ALL_OS_FLAGS="is_os_mac,is_os_ubuntu,is_os_chromeos,is_os_mingw64,is_os_android_termux,is_os_arch_linux,is_os_steamos,is_os_redhat,is_os_windows,is_os_wsl"
