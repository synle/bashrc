#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/ubuntu/_full-setup.sh
# Ubuntu / Debian dependencies - apt-get packages and user permissions

# SOURCE software/scripts/_full-setup.common.linux.bash

################################################################################
# ---- Package Manager Config ----
################################################################################

# Prevent interactive prompts from packages like tzdata/keyboard-configuration during unattended installs
export DEBIAN_FRONTEND=noninteractive
export APT_LISTCHANGES_FRONTEND=none

# Cache all installed packages once upfront — avoids spawning dpkg -s per package
_APT_INSTALLED=$(dpkg --get-selections 2> /dev/null | grep -w 'install' | cut -f1 | sed 's/:.*$//')
_SNAP_INSTALLED=$(timeout 10 snap list 2> /dev/null | tail -n +2 | awk '{print $1}')

################################################################################
# ---- Install Functions ----
################################################################################

# install a package via apt-get (skip if already installed)
function installAptPackage() {
  echo -n ">> $@ >> Installing with Apt >> "
  if echo "$_APT_INSTALLED" | grep -qxF "$1"; then
    echo "Skipped"
  else
    local _t0=$SECONDS
    if sudo apt-get install -y --fix-missing -o Dpkg::Options::="--force-confold" $@ < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
      echo "Success ($((SECONDS - _t0))s)"
    else
      echo "Error ($((SECONDS - _t0))s)"
    fi
  fi
}

# install a package via snap (skip if already installed)
function installSnapPackage() {
  echo -n ">> $1 >> Installing with Snap >> "
  if echo "$_SNAP_INSTALLED" | grep -qxF "$1"; then
    echo "Skipped"
  else
    local _t0=$SECONDS
    if sudo snap install $@ &> /dev/null; then
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
_BACKGROUND_INSTALL_LOG="/tmp/bashrc_bg_apt_$$.log"
_BACKGROUND_INSTALL_SCRIPT="/tmp/bashrc_bg_apt_$$.sh"
_BACKGROUND_PKG_NAMES=()
> "$_BACKGROUND_INSTALL_SCRIPT"

function installAptPackageInBackground() {
  _BACKGROUND_PKG_NAMES+=("$1")
  printf 'installAptPackage' >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf ' %q' "$@" >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf '\n' >> "$_BACKGROUND_INSTALL_SCRIPT"
}

function installSnapPackageInBackground() {
  _BACKGROUND_PKG_NAMES+=("$1")
  printf 'installSnapPackage' >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf ' %q' "$@" >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf '\n' >> "$_BACKGROUND_INSTALL_SCRIPT"
}

# install all queued background packages sequentially in a single background subshell
function _installBackgroundPackages() {
  _BACKGROUND_INSTALL_PID=""
  if [ ! -s "$_BACKGROUND_INSTALL_SCRIPT" ]; then return; fi
  echo ">> Installing ${#_BACKGROUND_PKG_NAMES[@]} background packages (log: $_BACKGROUND_INSTALL_LOG) >> ${_BACKGROUND_PKG_NAMES[*]}"
  (
    safe_source "$_BACKGROUND_INSTALL_SCRIPT"
    rm -f "$_BACKGROUND_INSTALL_SCRIPT"
  ) > "$_BACKGROUND_INSTALL_LOG" 2>&1 &
  _BACKGROUND_INSTALL_PID=$!
}

################################################################################
# ---- Package Maintenance ----
################################################################################

# refresh the apt package index so installs resolve the latest versions
function updatePackageIndex() {
  echo -n ">> Updating package index >> "
  if sudo apt-get update < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
    echo "Done"
  else
    echo "Error"
  fi
}

# upgrade all installed packages and remove unused dependencies (fire and forget)
function upgradeAndCleanPackages() {
  echo ">> Upgrading and cleaning packages (background) >>"
  (
    sudo apt-get upgrade -y -o Dpkg::Options::="--force-confold" < /dev/null
    sudo apt-get autoremove -y < /dev/null
    sudo apt-get autoclean -y < /dev/null
  ) > /dev/null 2>&1 &
}

################################################################################
# ---- Install Packages ----
################################################################################
echo ">> Begin setting up dependencies/ubuntu/deps.sh"
_waitForAptLock
if is_bash_syle_stale; then updatePackageIndex; else echo ">> Updating package index >> Skipped (not stale)"; fi

echo '>> Installing packages with apt-get'

# ---- Core tools ----
installAptPackage curl
installAptPackage git
installAptPackage make
installAptPackage python
installAptPackage vim

# ---- CLI utilities ----
installAptPackage bat
# cloudflared is not in default apt repos — use shared binary fallback
_installCloudflaredBinary
installAptPackage ripgrep
installAptPackage pv
installAptPackage entr
installAptPackage tmux
installAptPackage net-tools
installAptPackage jq
installAptPackage shfmt
installAptPackage yq
installAptPackage git-delta
installAptPackage zoxide
installAptPackage eza
installAptPackage fd-find
installAptPackage tree
installAptPackage tldr

# ---- Dev tools / Build ----
installAptPackage unzip
installAptPackage gnupg
installAptPackage software-properties-common
installAptPackage build-essential

# ---- AppImage runtime ----
# Ubuntu 22.04+ dropped libfuse2 by default; AppImages need it to mount and run.
installAptPackage libfuse2
installAptPackageInBackground android-tools-adb
installAptPackageInBackground gradle
installAptPackageInBackground rustc
installAptPackageInBackground golang-go
installAptPackageInBackground default-jdk
installAptPackageInBackground cmake
installAptPackageInBackground clang
installAptPackageInBackground dotnet-sdk-8.0

# ---- Git extensions ----
installAptPackage gh
installAptPackage git-filter-repo
installAptPackage git-lfs

# ---- Observability ----
# procs/bottom/gping are not in apt main — install via binary in advanced/observability.sh.
# btop is `required` per ci-binaries.json — install foreground so binary verification
# in CI doesn't race the 5-minute background queue cap (incident 2026-05-14: 19-package
# background batch including dotnet-sdk-8.0 blew past _waitForBackgroundPackages's 300s
# wait, leaving btop unbuilt → "Binary verification failed: 2/44 binaries missing").
installAptPackage btop

# ---- Infrastructure-as-Code ----
# terraform/tflint are not in apt main — install via binary in advanced/iac-tools.sh.
# ansible is `required` per ci-binaries.json — keep foreground (same reasoning as btop).
installAptPackage ansible

# ---- HTTP / RPC clients ----
# xh and grpcurl are not in apt main — install via curl|tarball in advanced/http-clients.sh.
# httpie provides the `http` binary which is `required` per ci-binaries.json — keep foreground.
installAptPackage httpie

# ---- Database clients ----
installAptPackageInBackground mycli # autocomplete + syntax-highlighted MySQL client
installAptPackageInBackground mysql-client
installAptPackageInBackground pgcli # autocomplete + syntax-highlighted Postgres client
installAptPackageInBackground postgresql-client
installAptPackageInBackground redis-tools
installAptPackageInBackground sqlite3

# ---- Multimedia ----
installAptPackage ffmpeg
installAptPackage imagemagick

# ---- OS-specific ----
installAptPackageInBackground openssh-server
installAptPackageInBackground xz-utils

# ---- Node.js (fnm) ----
_installFnmAndNode

# ---- GUI apps (only if a display server is available) ----
if ! ((is_os_windows)) && { [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; }; then
  echo '>> Installing GUI apps'

  # ---- Clipboard (install only for the active display server) ----
  if [ -n "$DISPLAY" ]; then installAptPackageInBackground xclip; fi
  if [ -n "$WAYLAND_DISPLAY" ]; then installAptPackageInBackground wl-clipboard; fi

  # ---- display-dj dependencies (DDC monitor control) ----
  installAptPackageInBackground ddcutil
  installAptPackageInBackground i2c-tools
  installAptPackageInBackground brightnessctl
  installAptPackageInBackground x11-xserver-utils
  installAptPackageInBackground wlr-randr

  installSnapPackageInBackground powershell --classic
  installSnapPackageInBackground postman
  installSnapPackageInBackground blender --classic

  _installZedEditor
fi

################################################################################
# ---- Power Management ----
################################################################################
_configureSystemdPowerManagement

################################################################################
# ---- User Permissions ----
################################################################################
echo '>> Setting up user permissions'
sudo usermod -aG input ${USER}
sudo usermod -aG video ${USER}

################################################################################
# ---- Background Install and Upgrade ----
################################################################################
_installBackgroundPackages
_waitForBackgroundPackages

################################################################################
# ---- Binary Aliases ----
# apt installs `bat` as /usr/bin/batcat and `fd-find` as /usr/bin/fdfind.
# Create $HOME/.local/bin/{bat,fd} symlinks so the canonical names resolve.
################################################################################
ensure_binary_alias bat
ensure_binary_alias fd

_configureDisplayDjPermissions
if is_bash_syle_stale; then upgradeAndCleanPackages; else echo ">> Upgrading and cleaning packages >> Skipped (not stale)"; fi
