#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install procs + bottom (btm) + gping on Linux distros that don't ship them in
# the main repos (Ubuntu/Debian apt and Fedora/RHEL dnf). Other platforms use
# their package managers: brew (mac), pacman (Arch/SteamOS).

# Skip on platforms whose package manager already ships these tools.
if ((is_os_mac)) || ((is_os_arch_linux)) || ((is_os_steamos)) || ((is_os_android_termux)); then
    printf '%s\n' \
      ' ">>> Skipped observability: package mana' \
      'ger already provides procs/bottom/gping'

  exit 0
fi

# Only run on Linux flavors that match the apt/dnf binary fallback.
if ! ((is_os_ubuntu)) && ! ((is_os_redhat)) && ! ((is_os_chromeos)) && ! ((is_os_windows)); then
    printf '%s\n' \
      ' ">>> Skipped observability: unsupported ' \
      'platform'

  exit 0
fi

_arch=$(uname -m)
case "$_arch" in
x86_64 | amd64) _gh_arch="x86_64" _procs_arch="x86_64-linux" ;;
aarch64 | arm64) _gh_arch="aarch64" _procs_arch="aarch64-linux" ;;
*)
    printf '%s\n' \
      ' ">>> Skipped observability: unsupported ' \
      'arch $_arch'

  exit 0
  ;;
esac

# --- procs (https://github.com/dalance/procs) ---
if is_force_refresh_stale "$HOME/.local/bin/procs"; then
    printf '%s\n' ' ">> Force refresh: removing procs'

  rm -f "$HOME/.local/bin/procs"
fi
if has_persistent_binary procs &> /dev/null; then
    printf '%s\n' \
      ' ">> Skipped procs: already installed at ' \
      '$(has_persistent_binary procs)'

else
    printf '%s\n' ' \'>> Installing procs'

  _procs_version=$(curl -fsSL -o /dev/null -w '%{url_effective}' \
    https://github.com/dalance/procs/releases/latest 2> /dev/null \
    | sed -E 's@.*/tag/v?@@')
  if [ -n "$_procs_version" ]; then
    _procs_url="https://github.com/dalance/procs/releases/download/v${_procs_version}/procs-v${_procs_version}-${_procs_arch}.zip"
    _procs_tmp=$(mktemp -d)
    if curl -fsSL "$_procs_url" -o "$_procs_tmp/procs.zip" \
      && unzip -q -o "$_procs_tmp/procs.zip" -d "$_procs_tmp" \
      && install -m 755 "$_procs_tmp/procs" "$HOME/.local/bin/procs"; then
    printf '%s\n' \
      ' ">> procs ${_procs_version} installed to' \
      ' $HOME/.local/bin/procs'

    else
    printf '%s\n' ' ">> procs install failed'

    fi
    rm -rf "$_procs_tmp"
  else
    printf '%s\n' \
      ' ">> procs install skipped: could not res' \
      'olve latest version'

  fi
fi

# --- bottom / btm (https://github.com/ClementTsang/bottom) ---
if is_force_refresh_stale "$HOME/.local/bin/btm"; then
    printf '%s\n' ' ">> Force refresh: removing btm'

  rm -f "$HOME/.local/bin/btm"
fi
if has_persistent_binary btm &> /dev/null; then
    printf '%s\n' \
      ' ">> Skipped btm: already installed at $(' \
      'has_persistent_binary btm)'

else
    printf '%s\n' ' \'>> Installing btm (bottom)'

  _btm_url="https://github.com/ClementTsang/bottom/releases/latest/download/bottom_${_gh_arch}-unknown-linux-gnu.tar.gz"
  _btm_tmp=$(mktemp -d)
  if curl -fsSL "$_btm_url" | tar -xz -C "$_btm_tmp" \
    && install -m 755 "$_btm_tmp/btm" "$HOME/.local/bin/btm"; then
    printf '%s\n' \
      ' ">> btm installed to $HOME/.local/bin/bt' \
      'm'

  else
    printf '%s\n' ' ">> btm install failed'

  fi
  rm -rf "$_btm_tmp"
fi

# --- gping (https://github.com/orf/gping) ---
if is_force_refresh_stale "$HOME/.local/bin/gping"; then
    printf '%s\n' ' ">> Force refresh: removing gping'

  rm -f "$HOME/.local/bin/gping"
fi
if has_persistent_binary gping &> /dev/null; then
    printf '%s\n' \
      ' ">> Skipped gping: already installed at ' \
      '$(has_persistent_binary gping)'

else
    printf '%s\n' ' \'>> Installing gping'

  _gping_url="https://github.com/orf/gping/releases/latest/download/gping-Linux-gnu-${_gh_arch}.tar.gz"
  _gping_tmp=$(mktemp -d)
  if curl -fsSL "$_gping_url" | tar -xz -C "$_gping_tmp" \
    && install -m 755 "$_gping_tmp/gping" "$HOME/.local/bin/gping"; then
    printf '%s\n' \
      ' ">> gping installed to $HOME/.local/bin/' \
      'gping'

  else
    printf '%s\n' ' ">> gping install failed'

  fi
  rm -rf "$_gping_tmp"
fi
