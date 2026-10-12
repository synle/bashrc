#!/usr/bin/env bash

# steamos-setup.bash - SteamOS / Steam Deck post-install helpers
# Run from Desktop Mode (Konsole). Re-running overwrites existing downloads.

set -euo pipefail

DESKTOP_FOLDER="$HOME/Desktop"
DECKY_PLUGINS_FOLDER="$DESKTOP_FOLDER/decky_plugins"
CSS_LOADER_THEMES_FOLDER="$DECKY_PLUGINS_FOLDER/css_loader_themes"
APPS_FOLDER="$HOME/Apps"
mkdir -p "$DESKTOP_FOLDER" "$APPS_FOLDER"

# --- EmuDeck ---
echo ">>> Downloading EmuDeck installer to $DESKTOP_FOLDER/"
curl -fsSL "https://www.emudeck.com/EmuDeck.desktop" -o "$DESKTOP_FOLDER/EmuDeck.desktop"
chmod +x "$DESKTOP_FOLDER/EmuDeck.desktop"

# --- Decky Loader + plugins + CSS Loader themes ---
function _bootstrap_decky_loader_plugins_themes() {
	# Wipe any prior staging so stale downloads or renamed plugins never linger
	if [ -n "${DECKY_PLUGINS_FOLDER:-}" ] && [ "$DECKY_PLUGINS_FOLDER" != "/" ]; then
		echo ">>> Cleaning up old $DECKY_PLUGINS_FOLDER/"
		rm -rf "$DECKY_PLUGINS_FOLDER"
	fi
	mkdir -p "$DECKY_PLUGINS_FOLDER" "$CSS_LOADER_THEMES_FOLDER"

	# Decky Loader installer
	echo ">>> Downloading Decky Loader installer to $HOME/decky_loader_installer.sh (run it from Konsole)"
	curl -fsSL "https://github.com/SteamDeckHomebrew/decky-installer/releases/latest/download/install_release.sh" \
		-o "$HOME/decky_loader_installer.sh"
	chmod +x "$HOME/decky_loader_installer.sh"

	# Decky Plugin - Lossless Scaling (decky-lsfg-vk)
	echo ">>> Downloading Decky LSFG-VK to $DECKY_PLUGINS_FOLDER/Decky.LSFG-VK.zip"
	curl -fsSL "https://github.com/xXJSONDeruloXx/decky-lsfg-vk/releases/download/v0.14.4/Decky.LSFG-VK.zip" \
		-o "$DECKY_PLUGINS_FOLDER/Decky.LSFG-VK.zip"

	# Decky Plugin - HLTB for Deck
	echo ">>> Downloading HLTB for Deck to $DECKY_PLUGINS_FOLDER/hltb-for-deck.zip"
	curl -fsSL "https://github.com/hulkrelax/hltb-for-deck/releases/latest/download/hltb-for-deck.zip" \
		-o "$DECKY_PLUGINS_FOLDER/hltb-for-deck.zip"

	# Decky Plugin - SteamGridDB
	echo ">>> Downloading SteamGridDB to $DECKY_PLUGINS_FOLDER/SteamGridDB.zip"
	curl -fsSL "https://cdn.tzatzikiweeb.moe/file/steam-deck-homebrew/versions/e84f5b1f111af8862b06218479491fbf61036e1bfd9f16f93f9901e9b9ebc5e0.zip" \
		-o "$DECKY_PLUGINS_FOLDER/SteamGridDB.zip"

	# Decky Plugin - CSS Loader (SDH-CssLoader)
	echo ">>> Downloading CSS Loader to $DECKY_PLUGINS_FOLDER/SDH-CSSLoader-Decky.zip"
	curl -fsSL "https://github.com/suchmememanyskill/SDH-CssLoader/releases/latest/download/SDH-CSSLoader-Decky.zip" \
		-o "$DECKY_PLUGINS_FOLDER/SDH-CSSLoader-Decky.zip"

	# Decky Plugin - ProtonDB Badges
	echo ">>> Downloading ProtonDB Badges to $DECKY_PLUGINS_FOLDER/protondb-decky.zip"
	curl -fsSL "https://github.com/OMGDuke/protondb-decky/releases/latest/download/protondb-decky.zip" \
		-o "$DECKY_PLUGINS_FOLDER/protondb-decky.zip"

	# Decky Plugin - EmuDecky
	echo ">>> Downloading EmuDecky to $DECKY_PLUGINS_FOLDER/EmuDecky.zip"
	curl -fsSL "https://github.com/EmuDeck/EmuDecky/releases/latest/download/EmuDecky.zip" \
		-o "$DECKY_PLUGINS_FOLDER/EmuDecky.zip"

	# Decky Plugin - Volume Boost
	echo ">>> Downloading Volume Boost to $DECKY_PLUGINS_FOLDER/volume-boost.zip"
	curl -fsSL "https://cdn.tzatzikiweeb.moe/file/steam-deck-homebrew/versions/2cc576a7f60751306d690268e227df626e59d3733680ced753de4c116629a9cc.zip" \
		-o "$DECKY_PLUGINS_FOLDER/volume-boost.zip"

	# Decky Plugin - AutoFlatpaks (decky-autoflatpaks)
	echo ">>> Downloading AutoFlatpaks to $DECKY_PLUGINS_FOLDER/decky-autoflatpaks.zip"
	curl -fsSL "https://github.com/jurassicplayer/decky-autoflatpaks/releases/download/v1.6.8/decky-autoflatpaks.zip" \
		-o "$DECKY_PLUGINS_FOLDER/decky-autoflatpaks.zip"

	# Decky Plugin - HueSync
	echo ">>> Downloading HueSync to $DECKY_PLUGINS_FOLDER/huesync.zip"
	curl -fsSL "https://github.com/honjow/HueSync/releases/download/v3.9.0/huesync.zip" \
		-o "$DECKY_PLUGINS_FOLDER/huesync.zip"

	# Install Decky plugins (requires Decky Loader installed first)
	if [ -d "$HOME/homebrew/plugins" ]; then
		echo ">>> Installing Decky plugins into $HOME/homebrew/plugins/"
		for zip in "$DECKY_PLUGINS_FOLDER"/*.zip; do
			echo ">>> Unzipping $(basename "$zip")"
			unzip -o "$zip" -d "$HOME/homebrew/plugins"
		done
	else
		echo ">>> Decky plugins staged in $DECKY_PLUGINS_FOLDER/ - run decky_loader_installer.sh first,"
		echo ">>> then re-run this script to auto-install them."
	fi

	# CSS Loader Themes (from the DeckThemes store: https://deckthemes.com/)
	# themeId -> https://api.deckthemes.com/themes/<id> -> blob id -> https://api.deckthemes.com/blobs/<blob>
	CSS_LOADER_THEMES=(
		"Round:c6844008-a809-41f6-b140-7aa76f2a62ad"
		"Art Hero:994360e7-cfca-46d3-9337-80d28ad169ba"
		"Clean Gameview:a9776f60-2724-4ff0-824b-e1f82a04688e"
		"Centered Home:865407ae-fb14-4db7-b123-61f6995ed757"
		"No Home Text:0e8a208f-136f-4f26-b0e1-344bcd186ed9"
		"No Recent Text:95c4e310-0770-4e1f-9f9d-cbe444e9bb17"
		"Obsidian:f16cf40d-7ccc-4981-95bf-77b28e8d101e"
	)
	for entry in "${CSS_LOADER_THEMES[@]}"; do
		theme_name="${entry%%:*}"
		theme_id="${entry##*:}"
		theme_slug=$(printf '%s' "$theme_name" | tr ' ' '_')
		theme_blob=$(curl -fsSL "https://api.deckthemes.com/themes/$theme_id" | python3 -c 'import json,sys; print(json.load(sys.stdin)["download"]["id"])')
		echo ">>> Downloading CSS Loader theme $theme_name to $CSS_LOADER_THEMES_FOLDER/$theme_slug.zip"
		curl -fsSL "https://api.deckthemes.com/blobs/$theme_blob" -o "$CSS_LOADER_THEMES_FOLDER/$theme_slug.zip"
	done

	# Install CSS Loader themes (requires CSS Loader plugin installed first)
	if [ -d "$HOME/homebrew" ]; then
		mkdir -p "$HOME/homebrew/themes"
		echo ">>> Installing CSS Loader themes into $HOME/homebrew/themes/"
		for zip in "$CSS_LOADER_THEMES_FOLDER"/*.zip; do
			echo ">>> Unzipping $(basename "$zip")"
			unzip -o "$zip" -d "$HOME/homebrew/themes"
		done
	else
		echo ">>> CSS Loader themes staged in $CSS_LOADER_THEMES_FOLDER/ - install Decky Loader + CSS Loader first,"
		echo ">>> then re-run this script to auto-install them."
	fi
}
_bootstrap_decky_loader_plugins_themes

# --- Moonlight (AppImage) ---
echo ">>> Downloading Moonlight AppImage to $APPS_FOLDER/Moonlight.AppImage"
curl -fsSL "https://github.com/moonlight-stream/moonlight-qt/releases/download/v6.1.0/Moonlight-6.1.0-x86_64.AppImage" \
	-o "$APPS_FOLDER/Moonlight.AppImage"
chmod +x "$APPS_FOLDER/Moonlight.AppImage"

# --- ProtonUp-Qt (AppImage) ---
echo ">>> Downloading ProtonUp-Qt AppImage to $APPS_FOLDER/ProtonUp-Qt.AppImage"
curl -fsSL "https://github.com/DavidoTek/ProtonUp-Qt/releases/download/v2.16.0/ProtonUp-Qt-2.16.0-x86_64.AppImage" \
	-o "$APPS_FOLDER/ProtonUp-Qt.AppImage"
chmod +x "$APPS_FOLDER/ProtonUp-Qt.AppImage"

# --- Brave, vim, tmux + system packages (pacman) ---
if type -P pacman >/dev/null; then
	echo ">>> Installing Brave, vim, tmux; updating system and installing flatpak"
	sudo pacman -Syu --noconfirm
	sudo pacman -S --needed --noconfirm brave-bin vim tmux flatpak fuse2
	flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo
	flatpak update -y
fi

# --- Browser Extensions + tmux/vim (via the synle/bashrc installer) ---
# Installs url-porter + skippy-ff Chrome extensions, plus tmux and vim config.
tmp=$(mktemp -d) && pushd "$tmp" &&
	curl -fsSL "https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh" -o run.sh
bash run.sh --files=url-porter,skippy-ff,tmux,vim-config,vim-jetpack,vim-plug
rm -rf "$tmp"
popd

if type -P paru >/dev/null && grep -q '^ID=cachyos' /etc/os-release 2>/dev/null; then
	echo ">>> CachyOS with paru detected - updating AUR packages"
	paru -Syu --noconfirm
fi

echo ">>> Done. Launch each .desktop file from Desktop Mode to start installation."
echo ">>> AppImages live in $APPS_FOLDER/ - run them directly."
