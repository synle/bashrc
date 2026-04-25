#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/redhat/_full-setup.sh
# RedHat / Fedora / CentOS / Rocky / Alma dependencies - dnf/yum packages

# SOURCE software/scripts/_full-setup.common.linux.bash

################################################################################
# ---- Package Manager Config ----
################################################################################

# Speed up dnf downloads — enable parallel downloads and fastest mirror selection
if type -P dnf > /dev/null 2>&1 && [ -f /etc/dnf/dnf.conf ]; then
  grep -q '^max_parallel_downloads' /etc/dnf/dnf.conf || echo 'max_parallel_downloads=10' | sudo tee -a /etc/dnf/dnf.conf > /dev/null
  grep -q '^fastestmirror' /etc/dnf/dnf.conf || echo 'fastestmirror=True' | sudo tee -a /etc/dnf/dnf.conf > /dev/null
fi

# Cache all installed packages once upfront — avoids spawning rpm -q per package
_RPM_INSTALLED=$(rpm -qa --queryformat '%{NAME}\n' 2> /dev/null)
_SNAP_INSTALLED=$(timeout 10 snap list 2> /dev/null | tail -n +2 | awk '{print $1}')

################################################################################
# ---- Install Functions ----
################################################################################

# install a package via dnf/yum (skip if already installed, skip optional weak deps to reduce download size)
function installDnfPackage() {
  echo -n ">> $@ >> Installing with dnf/yum >> "
  if echo "$_RPM_INSTALLED" | grep -qxF "$1"; then
    echo "Skipped"
  else
    local _t0=$SECONDS
    if sudo dnf install -y --setopt=install_weak_deps=False $@ < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log || sudo yum install -y $@ < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
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
_BACKGROUND_INSTALL_LOG="/tmp/bashrc_bg_dnf_$$.log"
_BACKGROUND_INSTALL_SCRIPT="/tmp/bashrc_bg_dnf_$$.sh"
_BACKGROUND_PKG_NAMES=()
> "$_BACKGROUND_INSTALL_SCRIPT"

function installDnfPackageInBackground() {
  _BACKGROUND_PKG_NAMES+=("$1")
  printf 'installDnfPackage' >> "$_BACKGROUND_INSTALL_SCRIPT"
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

# refresh the dnf/yum metadata cache so installs resolve the latest versions
function updatePackageIndex() {
  echo -n ">> Updating package index >> "
  if sudo dnf makecache < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log || sudo yum makecache < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
    echo "Done"
  else
    echo "Error"
  fi
}

# upgrade all installed packages, remove unused deps, and clean cache (fire and forget)
function upgradeAndCleanPackages() {
  echo ">> Upgrading and cleaning packages (background) >>"
  (
    sudo dnf upgrade -y < /dev/null || sudo yum upgrade -y < /dev/null
    sudo dnf autoremove -y < /dev/null || sudo yum autoremove -y < /dev/null
    sudo dnf clean all < /dev/null || sudo yum clean all < /dev/null
  ) > /dev/null 2>&1 &
}

################################################################################
# ---- Install Packages ----
################################################################################
echo ">> Begin setting up dependencies/redhat/deps.sh"
_waitForDnfLock
if is_bash_syle_stale; then updatePackageIndex; else echo ">> Updating package index >> Skipped (not stale)"; fi

echo '>> Installing packages with dnf/yum'

# ---- Core tools ----
installDnfPackage curl
installDnfPackage git
installDnfPackage make
installDnfPackage python3
installDnfPackage vim

# ---- CLI utilities ----
installDnfPackage bat
# cloudflared is not in default dnf repos — use shared binary fallback
_installCloudflaredBinary
installDnfPackage ripgrep
installDnfPackage pv
installDnfPackage entr
installDnfPackage tmux
installDnfPackage jq
installDnfPackage shfmt
installDnfPackage yq
installDnfPackage git-delta
installDnfPackage zoxide
installDnfPackage eza
installDnfPackage fd-find
installDnfPackage tree
installDnfPackage tldr

# ---- Dev tools / Build ----
installDnfPackage gcc
installDnfPackage gcc-c++
installDnfPackage unzip
installDnfPackage gnupg2
installDnfPackageInBackground android-tools
installDnfPackageInBackground cmake
installDnfPackageInBackground clang
installDnfPackageInBackground gradle
installDnfPackageInBackground rust
installDnfPackageInBackground golang
installDnfPackageInBackground java-latest-openjdk
installDnfPackageInBackground dotnet-sdk-8.0

# ---- Git extensions ----
installDnfPackage gh
installDnfPackage git-filter-repo
# Fedora/RHEL drops git-filter-repo at /usr/libexec/git-core/git-filter-repo (git's plugin
# dir, not on PATH). Ubuntu/brew/pacman put it at /usr/bin/git-filter-repo. Symlink it into
# /usr/local/bin so `git-filter-repo` works as a standalone command on all platforms and the
# CI binary check (`type -P git-filter-repo`) passes.
if [ -x /usr/libexec/git-core/git-filter-repo ] && [ ! -e /usr/local/bin/git-filter-repo ]; then
  sudo ln -sf /usr/libexec/git-core/git-filter-repo /usr/local/bin/git-filter-repo
fi
installDnfPackage git-lfs

# ---- Observability ----
# procs/bottom/gping are not in dnf default repos — install via binary in advanced/observability.sh.
installDnfPackageInBackground btop

# ---- Infrastructure-as-Code ----
# terraform/tflint are not in dnf default repos — install via binary in advanced/iac-tools.sh.
installDnfPackageInBackground ansible

# ---- HTTP / RPC clients ----
# xh and grpcurl are not in dnf default repos — install via curl|tarball in advanced/http-clients.sh.
installDnfPackageInBackground httpie

# ---- Database clients ----
installDnfPackageInBackground mycli # autocomplete + syntax-highlighted MySQL client
installDnfPackageInBackground mysql
installDnfPackageInBackground pgcli      # autocomplete + syntax-highlighted Postgres client
installDnfPackageInBackground postgresql # provides psql client
installDnfPackageInBackground redis
installDnfPackageInBackground sqlite

# ---- Multimedia ----
installDnfPackage ffmpeg
installDnfPackage ImageMagick

# ---- OS-specific ----
installDnfPackageInBackground openssh-server
installDnfPackageInBackground xz

# ---- Node.js (fnm) ----
_installFnmAndNode

# ---- GUI apps (only if a display server is available) ----
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
  echo '>> Installing GUI apps'

  # ---- Clipboard (install only for the active display server) ----
  if [ -n "$DISPLAY" ]; then installDnfPackageInBackground xclip; fi
  if [ -n "$WAYLAND_DISPLAY" ]; then installDnfPackageInBackground wl-clipboard; fi
  installDnfPackageInBackground libreoffice
  installDnfPackageInBackground nautilus
  installDnfPackageInBackground remmina
  installDnfPackageInBackground terminator
  installDnfPackageInBackground vlc

  # ---- display-dj dependencies (DDC monitor control) ----
  installDnfPackageInBackground ddcutil
  installDnfPackageInBackground i2c-tools
  installDnfPackageInBackground brightnessctl
  installDnfPackageInBackground xrandr
  installDnfPackageInBackground wlr-randr

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
# ---- Background Install and Upgrade ----
################################################################################
_installBackgroundPackages
_waitForBackgroundPackages
_configureDisplayDjPermissions
if is_bash_syle_stale; then upgradeAndCleanPackages; else echo ">> Upgrading and cleaning packages >> Skipped (not stale)"; fi
