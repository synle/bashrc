#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/android_termux/_full-setup.sh
# Android Termux dependencies - packages, theme, config

################################################################################
# ---- Package Manager Config ----
################################################################################
# Prevent interactive prompts during unattended installs (pkg is apt-based)
export DEBIAN_FRONTEND=noninteractive
export APT_LISTCHANGES_FRONTEND=none

# Cache all installed packages once upfront — avoids spawning dpkg -s per package
_PKG_INSTALLED=$(dpkg --get-selections 2> /dev/null | grep -w 'install' | cut -f1 | sed 's/:.*$//')

################################################################################
# ---- Install Functions ----
################################################################################
# install a package via pkg (skip if already installed)
function installPkgPackage() {
  echo -n ">> $@ >> Installing with Pkg >> "
  if echo "$_PKG_INSTALLED" | grep -qxF "$1"; then
    echo "Skipped"
  else
    local _t0=$SECONDS
    if pkg install -y $@ < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
      echo "Success ($((SECONDS - _t0))s)"
    else
      echo "Error ($((SECONDS - _t0))s)"
    fi
  fi
}

################################################################################
# ---- Background Install Queue ----
################################################################################
# queue a package for background installation after essential packages finish
_BACKGROUND_INSTALL_LOG="/tmp/bashrc_bg_pkg_$$.log"
_BACKGROUND_INSTALL_SCRIPT="/tmp/bashrc_bg_pkg_$$.sh"
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
  if [ ! -s "$_BACKGROUND_INSTALL_SCRIPT" ]; then return; fi
  echo ">> Installing ${#_BACKGROUND_PKG_NAMES[@]} background packages (log: $_BACKGROUND_INSTALL_LOG) >> ${_BACKGROUND_PKG_NAMES[*]}"
  (
    safe_source "$_BACKGROUND_INSTALL_SCRIPT"
    rm -f "$_BACKGROUND_INSTALL_SCRIPT"
  ) > "$_BACKGROUND_INSTALL_LOG" 2>&1 &
}

################################################################################
# ---- Package Maintenance ----
################################################################################
# refresh the pkg package index so installs resolve the latest versions
function updatePackageIndex() {
  echo -n ">> Updating package index >> "
  if pkg update -y < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
    echo "Done"
  else
    echo "Error"
  fi
}

# upgrade all installed packages and clean cached archives (fire and forget)
function upgradeAndCleanPackages() {
  wait
  echo ">> Upgrading and cleaning packages (background) >>"
  (
    pkg upgrade -y
    pkg autoclean -y
  ) > /dev/null 2>&1 &
}

################################################################################
# ---- Termux Config Directory ----
################################################################################
safe_mkdir "$HOME/.termux"

################################################################################
# ---- Install Packages ----
################################################################################
echo ">> Begin setting up dependencies/android_termux/deps.sh"
if is_bash_syle_stale; then updatePackageIndex; else echo ">> Updating package index >> Skipped (not stale)"; fi

echo '>> Installing packages with pkg'

# ---- Core tools ----
installPkgPackage curl
installPkgPackage git
installPkgPackage make
installPkgPackage python
installPkgPackage vim

# ---- CLI utilities ----
installPkgPackage bat
installPkgPackage cloudflared
installPkgPackage ripgrep
installPkgPackage pv
installPkgPackage entr
installPkgPackage jq
installPkgPackage shfmt
installPkgPackage yq
installPkgPackage git-delta
installPkgPackage zoxide
installPkgPackage eza
installPkgPackage fd
installPkgPackage tree
installPkgPackage tldr

# ---- Database clients ----
installPkgPackageInBackground mariadb
installPkgPackageInBackground sqlite
installPkgPackageInBackground redis

# ---- Dev tools / Build ----
installPkgPackageInBackground clang
installPkgPackageInBackground cmake

# ---- OS-specific ----
installPkgPackage proot # needed for android termux fhd fixes
installPkgPackage nodejs
installPkgPackageInBackground perl
installPkgPackageInBackground tig
installPkgPackage tmux

################################################################################
# ---- Background Install and Upgrade ----
################################################################################
_installBackgroundPackages
if is_bash_syle_stale; then upgradeAndCleanPackages; else echo ">> Upgrading and cleaning packages >> Skipped (not stale)"; fi
