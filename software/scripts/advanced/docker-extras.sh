#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install lazydocker + dive + ctop on Linux distros that don't ship them in the
# main repos (Ubuntu/Debian apt and Fedora/RHEL dnf). Other platforms use their
# package managers: brew (mac), pacman (Arch/SteamOS), winget (Windows host).

# Skip on platforms whose package manager already ships these tools.
if ((is_os_mac)) || ((is_os_arch_linux)) || ((is_os_steamos)) || ((is_os_android_termux)); then
  printf '%s\n' ">>> Skipped docker-extras: package manager already provides lazydocker/dive/ctop"
  exit 0
fi

# Only run on Linux flavors that match the apt/dnf binary fallback.
if ! ((is_os_ubuntu)) && ! ((is_os_redhat)) && ! ((is_os_chromeos)) && ! ((is_os_windows)); then
  printf '%s\n' ">>> Skipped docker-extras: unsupported platform"
  exit 0
fi

_arch=$(uname -m)
case "$_arch" in
x86_64 | amd64) _gh_arch="x86_64" _ctop_arch="amd64" ;;
aarch64 | arm64) _gh_arch="arm64" _ctop_arch="arm64" ;;
*)
  printf '%s\n' ">>> Skipped docker-extras: unsupported arch $_arch"
  exit 0
  ;;
esac

# --- lazydocker (https://github.com/jesseduffield/lazydocker) ---
if is_force_refresh_stale "$HOME/.local/bin/lazydocker"; then
  printf '%s\n' ">> Force refresh: removing lazydocker"
  rm -f "$HOME/.local/bin/lazydocker"
fi
if has_persistent_binary lazydocker &> /dev/null; then
  printf '%s\n' ">> Skipped lazydocker: already installed at $(has_persistent_binary lazydocker)"
else
  printf '%s\n' '>> Installing lazydocker'
  # Upstream installer drops the binary into $DIR (default ~/.local/bin).
  DIR="$HOME/.local/bin" \
    curl -fsSL https://raw.githubusercontent.com/jesseduffield/lazydocker/master/scripts/install_update_linux.sh | bash > /dev/null
fi

# --- dive (https://github.com/wagoodman/dive) ---
if is_force_refresh_stale "$HOME/.local/bin/dive"; then
  printf '%s\n' ">> Force refresh: removing dive"
  rm -f "$HOME/.local/bin/dive"
fi
if has_persistent_binary dive &> /dev/null; then
  printf '%s\n' ">> Skipped dive: already installed at $(has_persistent_binary dive)"
else
  printf '%s\n' '>> Installing dive'
  _dive_version=$(curl -fsSL -o /dev/null -w '%{url_effective}' \
    https://github.com/wagoodman/dive/releases/latest 2> /dev/null \
    | sed -E 's@.*/tag/v?@@')
  if [ -n "$_dive_version" ]; then
    _dive_url="https://github.com/wagoodman/dive/releases/download/v${_dive_version}/dive_${_dive_version}_linux_${_ctop_arch}.tar.gz"
    _dive_tmp=$(mktemp -d)
    if curl -fsSL "$_dive_url" | tar -xz -C "$_dive_tmp" \
      && install -m 755 "$_dive_tmp/dive" "$HOME/.local/bin/dive"; then
      printf '%s\n' ">> dive ${_dive_version} installed to $HOME/.local/bin/dive"
    else
      printf '%s\n' ">> dive install failed"
    fi
    rm -rf "$_dive_tmp"
  else
    printf '%s\n' ">> dive install skipped: could not resolve latest version"
  fi
fi

# --- ctop (https://github.com/bcicen/ctop) ---
# ctop ships a single static binary per arch — no tarball.
if is_force_refresh_stale "$HOME/.local/bin/ctop"; then
  printf '%s\n' ">> Force refresh: removing ctop"
  rm -f "$HOME/.local/bin/ctop"
fi
if has_persistent_binary ctop &> /dev/null; then
  printf '%s\n' ">> Skipped ctop: already installed at $(has_persistent_binary ctop)"
else
  printf '%s\n' '>> Installing ctop'
  _ctop_version=$(curl -fsSL -o /dev/null -w '%{url_effective}' \
    https://github.com/bcicen/ctop/releases/latest 2> /dev/null \
    | sed -E 's@.*/tag/v?@@')
  if [ -n "$_ctop_version" ]; then
    _ctop_url="https://github.com/bcicen/ctop/releases/download/v${_ctop_version}/ctop-${_ctop_version}-linux-${_ctop_arch}"
    if curl -fsSL "$_ctop_url" -o "$HOME/.local/bin/ctop" \
      && chmod +x "$HOME/.local/bin/ctop"; then
      printf '%s\n' ">> ctop ${_ctop_version} installed to $HOME/.local/bin/ctop"
    else
      printf '%s\n' ">> ctop install failed"
    fi
  else
    printf '%s\n' ">> ctop install skipped: could not resolve latest version"
  fi
fi
