#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/advanced/ghostty.su.sh - installs Ghostty terminal via universal AppImage on Linux
# Downloads the latest AppImage from pkgforge-dev/ghostty-appimage and installs to $HOME/.local/bin/

# Only supported on Ubuntu/Debian Linux via the catch-all is_os_ubuntu flag.
if ! ((is_os_ubuntu)); then
  echo ">>> Skipped ghostty.su.sh: only supported on Ubuntu/Debian Linux"
  exit 0
fi

# Resolve target architecture
_arch=$(uname -m)
case "$_arch" in
x86_64 | amd64) _ghostty_arch="x86_64" ;;
aarch64 | arm64) _ghostty_arch="aarch64" ;;
*)
  echo ">>> Skipped ghostty.su.sh: unsupported arch $_arch"
  exit 0
  ;;
esac

if has_persistent_binary ghostty &> /dev/null; then
  echo ">> Skipped ghostty: already installed at $(has_persistent_binary ghostty)"
  exit 0
fi

# Fetch latest release info from GitHub API
echo ">> Resolving latest Ghostty AppImage release >>"
_response=$(curl -fsSL "https://api.github.com/repos/pkgforge-dev/ghostty-appimage/releases/latest" 2> /dev/null) || {
  echo ">> Failed to fetch latest release info"
  exit 1
}

# Parse tag and find the matching arch asset URL
# Uses python3 to reliably extract JSON — available on all Ubuntu targets.
_url=$(echo "$_response" | python3 -c "
import json, sys
data = json.load(sys.stdin)
tag = data.get('tag_name', '').lstrip('v')
arch = '${_ghostty_arch}'
for a in data.get('assets', []):
    name = a.get('name', '')
    if name.endswith(f'{arch}.AppImage') and tag in name:
        print(a['browser_download_url'])
        break
" 2> /dev/null) || {
  echo ">> Failed to find AppImage asset for $_ghostty_arch"
  exit 1
}

[ -z "$_url" ] && {
  echo ">> Failed to find AppImage asset for $_ghostty_arch"
  exit 1
}

echo ">> Downloading Ghostty ($_ghostty_arch) >>"
_tmp_appimage=$(mktemp)
if ! curl -fsSL -o "$_tmp_appimage" "$_url"; then
  echo ">> Download failed"
  rm -f "$_tmp_appimage"
  exit 1
fi

# Install to $HOME/.local/bin/
safe_mkdir "$HOME/.local/bin"
chmod +x "$_tmp_appimage"
install -m 755 "$_tmp_appimage" "$HOME/.local/bin/ghostty"
rm -f "$_tmp_appimage"

echo ">> Ghostty ${_version} installed to $HOME/.local/bin/ghostty"
