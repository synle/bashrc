#!/usr/bin/env bash

# steamos-setup.md - SteamOS / Steam Deck post-install helpers
#
# Downloads three desktop installers to ~/Desktop/ so they can be launched
# from Desktop Mode on the Steam Deck:
#   1. Decky Loader        - plugin loader for the Steam UI
#   2. Decky LSFG (Lossless Scaling) - FSR-like frame-gen plugin via decky
#   3. EmuDeck             - retro emulator bundle
#
# Run from Desktop Mode (Konsole). Re-running overwrites existing downloads.

set -euo pipefail

DESKTOP_FOLDER="$HOME/Desktop"
mkdir -p "$DESKTOP_FOLDER"

# --- 1. Decky Loader ---
# Source: https://decky.xyz/download (redirects to the official .desktop file)
echo ">>> Downloading Decky Loader installer to $DESKTOP_FOLDER/"
curl -fsSL "https://decky.xyz/download" -o "$DESKTOP_FOLDER/decky_installer.desktop"
chmod +x "$DESKTOP_FOLDER/decky_installer.desktop"

# --- 2. Decky Lossless Scaling (decky-lsfg-vk) ---
# Repo:    https://github.com/xXJSONDeruloXx/decky-lsfg-vk
# Setup guide (YouTube): https://www.youtube.com/watch?v=3cTFfln13pc
# Resolves the latest release's first downloadable asset via the GitHub API
# then curls it down. Handles tag bumps without code changes.
echo ">>> Resolving latest decky-lsfg-vk release asset"
DECKY_LSFG_URL="$(
  curl -fsSL "https://api.github.com/repos/xXJSONDeruloXx/decky-lsfg-vk/releases/latest" \
    | grep -oE '"browser_download_url":[[:space:]]*"[^"]+"' \
    | head -n 1 \
    | sed -E 's/.*"(https:[^"]+)".*/\1/'
)"

if [ -z "$DECKY_LSFG_URL" ]; then
  echo "!!! Could not resolve latest decky-lsfg-vk release URL" >&2
  exit 1
fi

DECKY_LSFG_FILE="$(basename "$DECKY_LSFG_URL")"
echo ">>> Downloading $DECKY_LSFG_FILE to $DESKTOP_FOLDER/"
curl -fsSL "$DECKY_LSFG_URL" -o "$DESKTOP_FOLDER/$DECKY_LSFG_FILE"

# --- 3. EmuDeck ---
# Source: https://www.emudeck.com/EmuDeck.desktop
echo ">>> Downloading EmuDeck installer to $DESKTOP_FOLDER/"
curl -fsSL "https://www.emudeck.com/EmuDeck.desktop" -o "$DESKTOP_FOLDER/EmuDeck.desktop"
chmod +x "$DESKTOP_FOLDER/EmuDeck.desktop"

echo ">>> Done. Launch each .desktop file from Desktop Mode to start installation."
