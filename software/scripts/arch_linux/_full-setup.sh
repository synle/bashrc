#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/arch_linux/_full-setup.sh
# Arch Linux dependencies - packages, config

# SOURCE software/scripts/_full-setup.common.linux.bash

################################################################################
# ---- Install Functions ----
################################################################################

# install a package via flatpak (skip if already installed)
function installFlatpakPackage() {
  local pkg_name="$1"
  local flatpak_id="$2"
  echo -n ">> $pkg_name >> Installing with Flatpak >> "
  if flatpak list --app | grep -q "$flatpak_id" &> /dev/null; then
    echo "Skipped"
  else
    local _t0=$SECONDS
    if flatpak install -y flathub "$flatpak_id" &> /dev/null; then
      echo "Success ($((SECONDS - _t0))s)"
    else
      echo "Error ($((SECONDS - _t0))s)"
    fi
  fi
}

# Cache all installed packages once upfront — avoids spawning pacman -Q per package
_PACMAN_INSTALLED=$(pacman -Qq 2> /dev/null)

# install a package via pacman (skip if already installed)
function installPacmanPackage() {
  echo -n ">> $@ >> Installing with Pacman >> "
  if echo "$_PACMAN_INSTALLED" | grep -qxF "$1"; then
    echo "Skipped"
  else
    local _t0=$SECONDS
    if sudo pacman -S --noconfirm --needed $@ < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
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
_BACKGROUND_INSTALL_LOG="/tmp/bashrc_bg_pacman_$$.log"
_BACKGROUND_INSTALL_SCRIPT="/tmp/bashrc_bg_pacman_$$.sh"
_BACKGROUND_PKG_NAMES=()
> "$_BACKGROUND_INSTALL_SCRIPT"

function installPacmanPackageInBackground() {
  _BACKGROUND_PKG_NAMES+=("$1")
  printf 'installPacmanPackage' >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf ' %q' "$@" >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf '\n' >> "$_BACKGROUND_INSTALL_SCRIPT"
}

function installFlatpakPackageInBackground() {
  _BACKGROUND_PKG_NAMES+=("$1")
  printf 'installFlatpakPackage' >> "$_BACKGROUND_INSTALL_SCRIPT"
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

# sync the pacman package database so installs resolve the latest versions
function updatePackageIndex() {
  echo -n ">> Updating package index >> "
  if sudo pacman -Sy --noconfirm < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
    echo "Done"
  else
    echo "Error"
  fi
}

# upgrade all installed packages and clean old cached packages (fire and forget)
function upgradeAndCleanPackages() {
  echo ">> Upgrading and cleaning packages (background) >>"
  (
    sudo pacman -Su --noconfirm < /dev/null
    sudo pacman -Sc --noconfirm < /dev/null
  ) > /dev/null 2>&1 &
}

################################################################################
# ---- Install Packages ----
################################################################################
echo ">> Begin setting up dependencies/arch_linux/deps.sh"
_waitForPacmanLock
if is_bash_syle_stale; then updatePackageIndex; else echo ">> Updating package index >> Skipped (not stale)"; fi

echo '>> Installing packages with pacman'

# ---- Core tools ----
installPacmanPackage curl
installPacmanPackage git
installPacmanPackage make
installPacmanPackage vim

# ---- CLI utilities ----
installPacmanPackage bat
installPacmanPackage cloudflared
installPacmanPackage ripgrep
installPacmanPackage pv
installPacmanPackage entr
installPacmanPackage tmux
installPacmanPackage jq
installPacmanPackage shfmt
installPacmanPackage yq
installPacmanPackage git-delta
installPacmanPackage zoxide
installPacmanPackage eza
installPacmanPackage fd
installPacmanPackage tree
installPacmanPackage tldr

# ---- Dev tools / Build ----
installPacmanPackage unzip
installPacmanPackage base-devel
installPacmanPackageInBackground android-tools
installPacmanPackageInBackground cmake
installPacmanPackageInBackground clang
installPacmanPackageInBackground rust
installPacmanPackageInBackground go
installPacmanPackageInBackground dotnet-sdk

# ---- Git extensions ----
installPacmanPackage github-cli
installPacmanPackage git-filter-repo
installPacmanPackage git-lfs

# ---- Docker extras ----
installPacmanPackageInBackground ctop       # top-like UI for container metrics
installPacmanPackageInBackground dive       # explore docker image layers
installPacmanPackageInBackground lazydocker # TUI for docker + compose

# ---- Kubernetes ----
installPacmanPackageInBackground helm
installPacmanPackageInBackground k9s
installPacmanPackageInBackground kubectx # provides kubectx + kubens
installPacmanPackageInBackground stern

# ---- HTTP / RPC clients ----
installPacmanPackageInBackground grpcurl
installPacmanPackageInBackground httpie
installPacmanPackageInBackground xh

# ---- Database clients ----
# pgcli/mycli are AUR-only on Arch — install via uv if needed; skip from pacman set.
installPacmanPackageInBackground mysql-clients
installPacmanPackageInBackground postgresql-libs # provides psql client
installPacmanPackageInBackground redis
installPacmanPackageInBackground sqlite

# ---- Multimedia (background: heavy transitive deps, wait syncs before build) ----
installPacmanPackageInBackground ffmpeg
installPacmanPackageInBackground imagemagick

# ---- OS-specific ----
installPacmanPackageInBackground xz

# ---- Node.js (fnm) ----
_installFnmAndNode

# ---- GUI apps (only if a display server is available) ----
if ! ((is_os_windows)) && { [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; }; then
  echo '>> Installing GUI apps'

  # ---- Clipboard (install only for the active display server) ----
  if [ -n "$DISPLAY" ]; then installPacmanPackageInBackground xclip; fi
  if [ -n "$WAYLAND_DISPLAY" ]; then installPacmanPackageInBackground wl-clipboard; fi

  installPacmanPackageInBackground libreoffice-fresh
  installPacmanPackageInBackground nautilus
  installPacmanPackageInBackground remmina
  installPacmanPackageInBackground terminator
  installPacmanPackageInBackground vlc

  # ---- display-dj dependencies (DDC monitor control) ----
  installPacmanPackageInBackground ddcutil
  installPacmanPackageInBackground i2c-tools
  installPacmanPackageInBackground brightnessctl
  installPacmanPackageInBackground xorg-xrandr
  installPacmanPackageInBackground wlr-randr

  installFlatpakPackageInBackground postman com.getpostman.Postman
  installFlatpakPackageInBackground blender org.blender.Blender

  _installZedEditor
fi

################################################################################
# ---- Power Management ----
################################################################################
_configureSystemdPowerManagement

################################################################################
# ---- Background Install and Upgrade ----
################################################################################
_installBackgroundPackages
_waitForBackgroundPackages
_configureDisplayDjPermissions
if is_bash_syle_stale; then upgradeAndCleanPackages; else echo ">> Upgrading and cleaning packages >> Skipped (not stale)"; fi
