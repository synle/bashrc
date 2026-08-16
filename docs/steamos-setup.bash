#!/usr/bin/env bash

# steamos-setup.bash - SteamOS / Steam Deck post-install helpers
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
echo ">>> Downloading Decky LSFG-VK to $DESKTOP_FOLDER/Decky.LSFG-VK.zip"
curl -fsSL "https://github.com/xXJSONDeruloXx/decky-lsfg-vk/releases/download/v0.12.8/Decky.LSFG-VK.zip" \
	-o "$DESKTOP_FOLDER/Decky.LSFG-VK.zip"

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

if type -P pacman >/dev/null; then
	echo ">>> pacman detected - updating system and installing flatpak"
	sudo pacman -Syu --noconfirm
	sudo pacman -S --needed --noconfirm flatpak fuse2
	flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo
	flatpak update -y
fi

if type -P paru >/dev/null && grep -q '^ID=cachyos' /etc/os-release 2>/dev/null; then
	echo ">>> CachyOS with paru detected - updating AUR packages"
	paru -Syu --noconfirm
fi

echo ">>> Done. Launch each .desktop file from Desktop Mode to start installation."
echo ">>> AppImages live in $APPS_FOLDER/ - run them directly."
