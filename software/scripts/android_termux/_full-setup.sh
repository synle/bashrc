#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/android_termux/_full-setup.sh
# Android Termux dependencies - packages, theme, config

# SOURCE software/scripts/_full-setup.common.linux.bash

################################################################################
# --- Package Manager Config ---
################################################################################
# Prevent interactive prompts during unattended installs (pkg is apt-based)
export DEBIAN_FRONTEND=noninteractive
export APT_LISTCHANGES_FRONTEND=none

# Cache all installed packages once upfront — avoids spawning dpkg -s per package
_PKG_INSTALLED=$(dpkg --get-selections 2> /dev/null | grep -w 'install' | cut -f1 | sed 's/:.*$//')

################################################################################
# --- Wake Lock ---
################################################################################
# Android puts the device into Doze while the screen is off and will freeze or
# kill Termux mid-install. termux-wake-lock keeps the CPU alive for the duration
# of the setup. Both halves are best-effort:
#   - the binary ships in termux-api, which may not be installed on a first run
#   - the CLI blocks forever when the companion Termux:API app is missing, hence
#     the timeout
# No EXIT trap: this script is one segment of a larger bundled bash stream, so a
# trap here would clobber traps belonging to the rest of the run. If the script
# dies early, release the lock by hand with `termux-wake-unlock`.
function _acquireWakeLock() {
  type -P termux-wake-lock &> /dev/null || return 0
  printf '%s' ">> Acquiring Android wake lock >> "
  if timeout 5 termux-wake-lock &> /dev/null; then printf '%s\n' "Done"; else printf '%s\n' "Skipped (Termux:API app unavailable)"; fi
}

function _releaseWakeLock() {
  type -P termux-wake-unlock &> /dev/null || return 0
  printf '%s' ">> Releasing Android wake lock >> "
  if timeout 5 termux-wake-unlock &> /dev/null; then printf '%s\n' "Done"; else printf '%s\n' "Skipped (Termux:API app unavailable)"; fi
}

################################################################################
# --- Install Functions ---
################################################################################
# install a package via pkg (skip if already installed)
function installPkgPackage() {
  (
    set -- ">> $@ >> Installing with Pkg >> "
    IFS=' '
    printf '%s' "$*"
  )
  if printf '%s\n' "$_PKG_INSTALLED" | grep -qxF "$1"; then
    printf '%s\n' "Skipped"
  else
    local _t0=$SECONDS
    if pkg install -y $@ < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
      printf '%s\n' "Success ($((SECONDS - _t0))s)"
    else
      printf '%s\n' "Error ($((SECONDS - _t0))s)"
    fi
  fi
}

################################################################################
# --- Background Install Queue ---
################################################################################
# queue a package for background installation after essential packages finish
_BACKGROUND_INSTALL_LOG="$BASHRC_TEMP_ROOT_DIR/bashrc_bg_pkg_$$.log"
_BACKGROUND_INSTALL_SCRIPT="$BASHRC_TEMP_ROOT_DIR/bashrc_bg_pkg_$$.sh"
_BACKGROUND_PKG_NAMES=()
> "$_BACKGROUND_INSTALL_SCRIPT"

function installPkgPackageInBackground() {
  _BACKGROUND_PKG_NAMES+=("$1")
  printf 'installPkgPackage' >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf ' %q' "$@" >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf '\n' >> "$_BACKGROUND_INSTALL_SCRIPT"
}

# install all queued background packages sequentially in a single background subshell
function _installBackgroundPackages() {
  _BACKGROUND_INSTALL_PID=""
  if [ ! -s "$_BACKGROUND_INSTALL_SCRIPT" ]; then return; fi
  (
    set -- ">> Installing ${#_BACKGROUND_PKG_NAMES[@]} background packages (log: $_BACKGROUND_INSTALL_LOG) >> ${_BACKGROUND_PKG_NAMES[*]}"
    IFS=' '
    printf '%s\n' "$*"
  )
  (
    safe_source "$_BACKGROUND_INSTALL_SCRIPT"
  ) > "$_BACKGROUND_INSTALL_LOG" 2>&1 &
  _BACKGROUND_INSTALL_PID=$!
}

################################################################################
# --- Package Maintenance ---
################################################################################
# refresh the pkg package index so installs resolve the latest versions
function updatePackageIndex() {
  printf '%s' ">> Updating package index >> "
  if pkg update -y < /dev/null >> "$BASHRC_TEMP_DIR/fullsetup.log" 2>&1; then
    printf '%s\n' "Done"
  else
    printf '%s\n' "Error"
  fi
}

# upgrade all installed packages and clean cached archives (fire and forget)
function upgradeAndCleanPackages() {
  printf '%s\n' ">> Upgrading and cleaning packages (background) >>"
  (
    pkg upgrade -y < /dev/null
    pkg autoclean -y < /dev/null
  ) > /dev/null 2>&1 &
}

################################################################################
# --- Termux Config Directory ---
################################################################################
safe_mkdir "$HOME/.termux"

################################################################################
# --- Install Packages ---
################################################################################
printf '%s\n' ">> Begin setting up dependencies/android_termux/deps.sh"
_acquireWakeLock
_waitForPkgLock
if is_bash_syle_stale; then updatePackageIndex; else printf '%s\n' ">> Updating package index >> Skipped (not stale)"; fi

printf '%s\n' '>> Installing packages with pkg'

# --- Core tools ---
installPkgPackage curl
installPkgPackage wget
installPkgPackage git
installPkgPackage make
installPkgPackage python
installPkgPackage vim
installPkgPackage openssh # ssh / scp / sshd — the whole point of a phone terminal
installPkgPackage less    # pager for git, man, and every `| less` in the profile
installPkgPackage man

# --- CLI utilities ---
installPkgPackage bat
installPkgPackage cloudflared
installPkgPackage ripgrep
installPkgPackage pv
installPkgPackage entr
installPkgPackage jq
installPkgPackage shfmt
installPkgPackage yq
installPkgPackage git-delta
installPkgPackage fd
installPkgPackage tree
installPkgPackage tldr
installPkgPackage unzip
installPkgPackage zip
installPkgPackage rsync
installPkgPackage gh
installPkgPackage htop
installPkgPackage dnsutils # dig / nslookup

# procps (ps/top) and psmisc (fuser/killall) are NOT preinstalled on Termux —
# _waitForPkgLock needs fuser, and the profile's process helpers need ps.
installPkgPackage procps
installPkgPackage psmisc

# termux-api ships the termux-clipboard-*/termux-wake-* CLIs used by the clipboard
# helper in bash-clipboard.profile.bash. It also needs the Termux:API companion app
# from F-Droid — without it the CLIs are present but hang, so every caller wraps
# them in `timeout`.
installPkgPackage termux-api

# --- Database clients ---
installPkgPackageInBackground mariadb
installPkgPackageInBackground sqlite
installPkgPackageInBackground redis

# --- Dev tools / Build ---
installPkgPackageInBackground clang
installPkgPackageInBackground cmake

# --- OS-specific ---
installPkgPackage proot # needed for android termux fhd fixes
# installPkgPackage nodejs # not needed, already handled with the run.sh
installPkgPackageInBackground perl
installPkgPackageInBackground tig
installPkgPackage tmux

################################################################################
# --- Background Install and Upgrade ---
################################################################################
_installBackgroundPackages
_waitForBackgroundPackages
if is_bash_syle_stale; then upgradeAndCleanPackages; else printf '%s\n' ">> Upgrading and cleaning packages >> Skipped (not stale)"; fi
_releaseWakeLock
