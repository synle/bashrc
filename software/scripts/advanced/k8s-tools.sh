#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install helm + k9s + stern + kubectx on Linux distros that don't ship them in the
# main repos (Ubuntu/Debian apt and Fedora/RHEL dnf). Other platforms use their
# package managers: brew (mac), pacman (Arch/SteamOS), winget (Windows host).

# Skip on platforms whose package manager already ships these tools.
if ((is_os_mac)) || ((is_os_arch_linux)) || ((is_os_steamos)) || ((is_os_android_termux)); then
  printf '%s\n' ">>> Skipped k8s-tools: package manager already provides helm/k9s/stern/kubectx"
  exit 0
fi

# Only run on Linux flavors that match the apt/dnf binary fallback.
if ! ((is_os_ubuntu)) && ! ((is_os_redhat)) && ! ((is_os_chromeos)) && ! ((is_os_windows)); then
  printf '%s\n' ">>> Skipped k8s-tools: unsupported platform"
  exit 0
fi

_arch=$(uname -m)
case "$_arch" in
x86_64 | amd64) _gh_arch="amd64" ;;
aarch64 | arm64) _gh_arch="arm64" ;;
*)
  printf '%s\n' ">>> Skipped k8s-tools: unsupported arch $_arch"
  exit 0
  ;;
esac

# --- helm (https://helm.sh) ---
# Upstream installer is the canonical install path — handles version detection,
# checksum verification, and dropping the binary on PATH.
if is_force_refresh_stale "$HOME/.local/bin/helm"; then
  printf '%s\n' ">> Force refresh: removing helm"
  rm -f "$HOME/.local/bin/helm"
fi
if has_persistent_binary helm &> /dev/null; then
  printf '%s\n' ">> Skipped helm: already installed at $(has_persistent_binary helm)"
else
  printf '%s\n' '>> Installing helm'
  # USE_SUDO=false + custom install dir keeps it under $HOME/.local/bin (no sudo).
  HELM_INSTALL_DIR="$HOME/.local/bin" USE_SUDO=false \
    curl -fsSL https://raw.githubusercontent.com/helm/helm/HEAD/scripts/get-helm-3 | bash > /dev/null
fi

# --- k9s (https://github.com/derailed/k9s) ---
if is_force_refresh_stale "$HOME/.local/bin/k9s"; then
  printf '%s\n' ">> Force refresh: removing k9s"
  rm -f "$HOME/.local/bin/k9s"
fi
if has_persistent_binary k9s &> /dev/null; then
  printf '%s\n' ">> Skipped k9s: already installed at $(has_persistent_binary k9s)"
else
  printf '%s\n' '>> Installing k9s'
  _k9s_url="https://github.com/derailed/k9s/releases/latest/download/k9s_Linux_${_gh_arch}.tar.gz"
  _k9s_tmp=$(mktemp -d)
  if curl -fsSL "$_k9s_url" | tar -xz -C "$_k9s_tmp" \
    && install -m 755 "$_k9s_tmp/k9s" "$HOME/.local/bin/k9s"; then
    printf '%s\n' ">> k9s installed to $HOME/.local/bin/k9s"
  else
    printf '%s\n' ">> k9s install failed"
  fi
  rm -rf "$_k9s_tmp"
fi

# --- stern (https://github.com/stern/stern) ---
if is_force_refresh_stale "$HOME/.local/bin/stern"; then
  printf '%s\n' ">> Force refresh: removing stern"
  rm -f "$HOME/.local/bin/stern"
fi
if has_persistent_binary stern &> /dev/null; then
  printf '%s\n' ">> Skipped stern: already installed at $(has_persistent_binary stern)"
else
  printf '%s\n' '>> Installing stern'
  _stern_version=$(curl -fsSL -o /dev/null -w '%{url_effective}' \
    https://github.com/stern/stern/releases/latest 2> /dev/null \
    | sed -E 's@.*/tag/v?@@')
  if [ -n "$_stern_version" ]; then
    _stern_url="https://github.com/stern/stern/releases/download/v${_stern_version}/stern_${_stern_version}_linux_${_gh_arch}.tar.gz"
    _stern_tmp=$(mktemp -d)
    if curl -fsSL "$_stern_url" | tar -xz -C "$_stern_tmp" \
      && install -m 755 "$_stern_tmp/stern" "$HOME/.local/bin/stern"; then
      printf '%s\n' ">> stern ${_stern_version} installed to $HOME/.local/bin/stern"
    else
      printf '%s\n' ">> stern install failed"
    fi
    rm -rf "$_stern_tmp"
  else
    printf '%s\n' ">> stern install skipped: could not resolve latest version"
  fi
fi

# --- kubectx + kubens (https://github.com/ahmetb/kubectx) ---
# These are POSIX shell scripts (~10 KB each), no per-arch binary needed.
if is_force_refresh_stale "$HOME/.local/bin/kubectx"; then
  printf '%s\n' ">> Force refresh: removing kubectx + kubens"
  rm -f "$HOME/.local/bin/kubectx" "$HOME/.local/bin/kubens"
fi
if has_persistent_binary kubectx &> /dev/null; then
  printf '%s\n' ">> Skipped kubectx: already installed at $(has_persistent_binary kubectx)"
else
  printf '%s\n' '>> Installing kubectx + kubens'
  if curl -fsSL https://raw.githubusercontent.com/ahmetb/kubectx/HEAD/kubectx -o "$HOME/.local/bin/kubectx" \
    && curl -fsSL https://raw.githubusercontent.com/ahmetb/kubectx/HEAD/kubens -o "$HOME/.local/bin/kubens" \
    && chmod +x "$HOME/.local/bin/kubectx" "$HOME/.local/bin/kubens"; then
    printf '%s\n' ">> kubectx + kubens installed to $HOME/.local/bin"
  else
    printf '%s\n' ">> kubectx + kubens install failed"
  fi
fi
