```bash
#!/usr/bin/env bash

# steamos-setup.md - SteamOS / Steam Deck post-install helpers
# Run from Desktop Mode (Konsole). Re-running overwrites existing downloads.

set -euo pipefail

DESKTOP_FOLDER="$HOME/Desktop"
APPS_FOLDER="$HOME/Apps"
mkdir -p "$DESKTOP_FOLDER" "$APPS_FOLDER"

# --- EmuDeck ---
echo ">>> Downloading EmuDeck installer to $DESKTOP_FOLDER/"
curl -fsSL "https://www.emudeck.com/EmuDeck.desktop" -o "$DESKTOP_FOLDER/EmuDeck.desktop"
chmod +x "$DESKTOP_FOLDER/EmuDeck.desktop"

# --- Decky Loader ---
echo ">>> Downloading Decky Loader installer to $DESKTOP_FOLDER/"
curl -fsSL "https://decky.xyz/download" -o "$DESKTOP_FOLDER/decky_installer.desktop"
chmod +x "$DESKTOP_FOLDER/decky_installer.desktop"

# --- Decky Lossless Scaling (decky-lsfg-vk) ---
echo ">>> Resolving latest decky-lsfg-vk release asset"
DECKY_LSFG_URL="$(
  curl -fsSL "https://api.github.com/repos/xXJSONDeruloXx/decky-lsfg-vk/releases/latest" |
    grep -o '"browser_download_url":[[:space:]]*"[^"]*"' |
    head -n 1 |
    sed 's/.*"\(https:[^"]*\)".*/\1/'
)"

if [ -z "$DECKY_LSFG_URL" ]; then
  echo "!!! Could not resolve latest decky-lsfg-vk release URL" >&2
  exit 1
fi

DECKY_LSFG_FILE="$(basename "$DECKY_LSFG_URL")"
echo ">>> Downloading $DECKY_LSFG_FILE to $DESKTOP_FOLDER/"
curl -fsSL "$DECKY_LSFG_URL" -o "$DESKTOP_FOLDER/$DECKY_LSFG_FILE"

# --- Moonlight (AppImage) ---
echo ">>> Downloading Moonlight AppImage to $APPS_FOLDER/Moonlight.AppImage"
curl -fsSL "https://github.com/moonlight-stream/moonlight-qt/releases/download/v6.1.0/Moonlight-6.1.0-x86_64.AppImage" \
  -o "$APPS_FOLDER/Moonlight.AppImage"
chmod +x "$APPS_FOLDER/Moonlight.AppImage"

# --- ProtonUp-Qt (AppImage) ---
echo ">>> Downloading ProtonUp-Qt AppImage to $APPS_FOLDER/ProtonUp-Qt.AppImage"
curl -fsSL "https://github.com/DavidoTek/ProtonUp-Qt/releases/download/v2.15.1/ProtonUp-Qt-2.15.1-x86_64.AppImage" \
  -o "$APPS_FOLDER/ProtonUp-Qt.AppImage"
chmod +x "$APPS_FOLDER/ProtonUp-Qt.AppImage"

if type -P pacman > /dev/null; then
  echo ">>> pacman detected - updating system and installing flatpak"
  sudo pacman -Syu --noconfirm
  sudo pacman -S --needed --noconfirm flatpak fuse2
  flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo
  flatpak update -y
fi

if type -P paru > /dev/null && grep -q '^ID=cachyos' /etc/os-release 2> /dev/null; then
  echo ">>> CachyOS with paru detected - updating AUR packages"
  paru -Syu --noconfirm
fi

echo ">>> Done. Launch each .desktop file from Desktop Mode to start installation."
echo ">>> AppImages live in $APPS_FOLDER/ - run them directly."

```
