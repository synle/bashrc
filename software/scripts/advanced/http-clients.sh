#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install xh + grpcurl on Linux distros that don't ship them in the main repos
# (Ubuntu/Debian apt and Fedora/RHEL dnf). Other platforms use their package
# managers: brew (macOS), pacman (Arch/SteamOS), winget (Windows host).

# Skip on platforms where the package manager already covers these tools.
if ((is_os_mac)) || ((is_os_arch_linux)) || ((is_os_steamos)) || ((is_os_android_termux)); then
  echo ">>> Skipped http-clients: package manager already provides xh + grpcurl"
  exit 0
fi

# Skip if not running on Linux (no glibc → upstream binaries don't apply).
if ! ((is_os_ubuntu)) && ! ((is_os_redhat)) && ! ((is_os_chromeos)) && ! ((is_os_windows)); then
  echo ">>> Skipped http-clients: unsupported platform"
  exit 0
fi

# Resolve target architecture once for both downloads.
_arch=$(uname -m)
case "$_arch" in
x86_64 | amd64) _xh_arch="x86_64-unknown-linux-musl" _grpcurl_arch="x86_64" ;;
aarch64 | arm64) _xh_arch="aarch64-unknown-linux-musl" _grpcurl_arch="arm64" ;;
*)
  echo ">>> Skipped http-clients: unsupported arch $_arch"
  exit 0
  ;;
esac

# ---- xh (https://github.com/ducaale/xh) ----
if is_force_refresh_stale "$HOME/.local/bin/xh"; then
  echo ">> Force refresh: removing xh"
  rm -f "$HOME/.local/bin/xh"
fi
if has_persistent_binary xh &> /dev/null; then
  echo ">> Skipped xh: already installed at $(has_persistent_binary xh)"
else
  echo '>> Installing xh'
  _xh_url="https://github.com/ducaale/xh/releases/latest/download/xh-${_xh_arch}.tar.gz"
  _xh_tmp=$(mktemp -d)
  if curl -fsSL "$_xh_url" | tar -xz -C "$_xh_tmp" --strip-components=1 \
    && install -m 755 "$_xh_tmp/xh" "$HOME/.local/bin/xh"; then
    echo ">> xh installed to $HOME/.local/bin/xh"
  else
    echo ">> xh install failed"
  fi
  rm -rf "$_xh_tmp"
fi

# ---- grpcurl (https://github.com/fullstorydev/grpcurl) ----
if is_force_refresh_stale "$HOME/.local/bin/grpcurl"; then
  echo ">> Force refresh: removing grpcurl"
  rm -f "$HOME/.local/bin/grpcurl"
fi
if has_persistent_binary grpcurl &> /dev/null; then
  echo ">> Skipped grpcurl: already installed at $(has_persistent_binary grpcurl)"
else
  echo '>> Installing grpcurl'
  # grpcurl release filenames look like: grpcurl_<version>_linux_<arch>.tar.gz
  # Resolve the latest version tag from the GitHub redirect, then build the asset URL.
  _grpcurl_version=$(curl -fsSL -o /dev/null -w '%{url_effective}' \
    https://github.com/fullstorydev/grpcurl/releases/latest 2> /dev/null \
    | sed -E 's@.*/tag/v?@@')
  if [ -n "$_grpcurl_version" ]; then
    _grpcurl_url="https://github.com/fullstorydev/grpcurl/releases/download/v${_grpcurl_version}/grpcurl_${_grpcurl_version}_linux_${_grpcurl_arch}.tar.gz"
    _grpcurl_tmp=$(mktemp -d)
    if curl -fsSL "$_grpcurl_url" | tar -xz -C "$_grpcurl_tmp" \
      && install -m 755 "$_grpcurl_tmp/grpcurl" "$HOME/.local/bin/grpcurl"; then
      echo ">> grpcurl ${_grpcurl_version} installed to $HOME/.local/bin/grpcurl"
    else
      echo ">> grpcurl install failed"
    fi
    rm -rf "$_grpcurl_tmp"
  else
    echo ">> grpcurl install skipped: could not resolve latest version"
  fi
fi
