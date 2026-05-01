#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/steamos/_full-setup.sh
# SteamOS dependencies - packages, config

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
echo ">> Begin setting up dependencies/steamos/deps.sh"
_waitForPacmanLock

# Steam Deck file system is immutable and will be removed after each update.
# This command opens it up for write.
echo '>> Make the partition readable (Steam Deck is immutable)'
sudo btrfs property set -ts / ro false

echo '>> Setting up pacman to install stuffs'
sudo pacman-key --init < /dev/null
sudo pacman-key --populate archlinux < /dev/null
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

# ---- Git extensions ----
installPacmanPackage gh
installPacmanPackage git-filter-repo
installPacmanPackage git-lfs

# ---- Observability ----
installPacmanPackageInBackground bottom # `btm` — fast cross-platform top
installPacmanPackageInBackground btop   # animated resource monitor
installPacmanPackageInBackground gping  # ping with a graph
installPacmanPackageInBackground procs  # modern ps replacement

# ---- Infrastructure-as-Code ----
installPacmanPackageInBackground ansible
installPacmanPackageInBackground terraform
installPacmanPackageInBackground tflint

# ---- Docker extras ----
installPacmanPackageInBackground ctop       # top-like UI for container metrics
installPacmanPackageInBackground dive       # explore docker image layers
installPacmanPackageInBackground lazydocker # TUI for docker + compose

# ---- Kubernetes ----
installPacmanPackageInBackground helm
installPacmanPackageInBackground k9s
installPacmanPackageInBackground kubectx # provides kubectx + kubens
installPacmanPackageInBackground stern

# ---- Cloud CLIs ----
installPacmanPackageInBackground aws-cli-v2       # `aws` — AWS CLI v2
installPacmanPackageInBackground azure-cli        # `az` — Microsoft Azure CLI
installPacmanPackageInBackground google-cloud-cli # `gcloud` — Google Cloud CLI

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

# ---- Multimedia ----
installPacmanPackage ffmpeg
installPacmanPackage imagemagick

# ---- Dev tools / Build ----
installPacmanPackage base-devel
installPacmanPackageInBackground android-tools
installPacmanPackageInBackground cmake
installPacmanPackageInBackground clang
installPacmanPackageInBackground dotnet-sdk

# ---- OS-specific ----
installPacmanPackageInBackground xz

# ---- Node.js (fnm) ----
_installFnmAndNode

# ---- GUI apps (only if a display server is available) ----
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
  echo '>> Installing GUI apps'

  # ---- Clipboard (install only for the active display server) ----
  if [ -n "$DISPLAY" ]; then installPacmanPackageInBackground xclip; fi
  if [ -n "$WAYLAND_DISPLAY" ]; then installPacmanPackageInBackground wl-clipboard; fi

  installPacmanPackageInBackground libreoffice-fresh
  installPacmanPackageInBackground nautilus
  installPacmanPackageInBackground remmina
  installPacmanPackageInBackground ghostty
  installPacmanPackageInBackground vlc

  # TODO: remove me — terminator uninstall (we migrated to ghostty); drop this block once every host has rolled through.
  sudo pacman -Rns --noconfirm terminator < /dev/null &>> "$BASHRC_TEMP_DIR/fullsetup.log" || true

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
# ---- Boot Video Directory ----
################################################################################
# https://steamdeckrepo.com
echo '>> Create the folder for boot video'
safe_mkdir "$HOME/.steam/root/config/uioverrides/movies/"

################################################################################
# ---- Background Install and Upgrade ----
################################################################################
_installBackgroundPackages
_waitForBackgroundPackages
_configureDisplayDjPermissions
if is_bash_syle_stale; then upgradeAndCleanPackages; else echo ">> Upgrading and cleaning packages >> Skipped (not stale)"; fi
