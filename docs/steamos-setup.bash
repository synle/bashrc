#!/usr/bin/env bash

# steamos-setup.bash - SteamOS / Steam Deck post-install helpers
# Run from Desktop Mode (Konsole). Re-running overwrites existing downloads.

# System upgrade (pacman -Syu / paru -Syu) is opt-in: it takes a long time and
# touches the whole system, so default to skipping and just print the commands.
printf ">>> Run system upgrade (sudo pacman -Syu / paru -Syu)? [y/N] "
read -r upgrade_choice
case "$upgrade_choice" in
	y|Y|yes|YES) DO_SYSTEM_UPGRADE=1 ;;
	*) DO_SYSTEM_UPGRADE=0 ;;
esac

DESKTOP_FOLDER="$HOME/Desktop"
DECKY_PLUGINS_FOLDER="$DESKTOP_FOLDER/decky_plugins"
CSS_LOADER_THEMES_FOLDER="$DECKY_PLUGINS_FOLDER/css_loader_themes"
APPS_FOLDER="$HOME/Apps"
mkdir -p "$DESKTOP_FOLDER" "$APPS_FOLDER"

# --- EmuDeck ---
echo ">>> Downloading EmuDeck installer to $DESKTOP_FOLDER/"
curl -fsSL "https://www.emudeck.com/EmuDeck.desktop" -o "$DESKTOP_FOLDER/EmuDeck.desktop"
chmod +x "$DESKTOP_FOLDER/EmuDeck.desktop"

# --- SponsorBlock config (vendor-verified export for the YouTube blocker) ---
echo ">>> Downloading SponsorBlock config to $DESKTOP_FOLDER/sponsporblock.json"
curl -fsSL "https://raw.githubusercontent.com/synle/bashrc/HEAD/assets/steamos/sponsporblock.json" \
	-o "$DESKTOP_FOLDER/sponsporblock.json"

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

	# Decky plugin and CSS Loader theme zips are vendored in this repo under
	# assets/steamos/ so the helper never depends on third-party release URLs.
	# See assets/steamos/README.md for the upstream author and repo of each file.
	DECKY_ASSETS_BASE="https://raw.githubusercontent.com/synle/bashrc/HEAD/assets/steamos"

	# Decky plugins -> $DECKY_PLUGINS_FOLDER
	DECKY_PLUGINS=(
		"xXJSONDeruloXx_decky-lsfg-vk_v0.14.4.zip"
		"hulkrelax_hltb-for-deck.zip"
		"SteamGridDB_decky-steamgriddb.zip"
		"suchmememanyskill_SDH-CssLoader.zip"
		"OMGDuke_protondb-decky.zip"
		"EmuDeck_EmuDecky.zip"
		"saumya-banthia_volume-boost.zip"
		"jurassicplayer_decky-autoflatpaks_v1.6.8.zip"
		"honjow_HueSync_v3.9.0.zip"
	)
	for asset in "${DECKY_PLUGINS[@]}"; do
		echo ">>> Downloading $asset to $DECKY_PLUGINS_FOLDER/"
		curl -fsSL "$DECKY_ASSETS_BASE/decky_plugin/$asset" -o "$DECKY_PLUGINS_FOLDER/$asset"
	done

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

	# CSS Loader Themes (vendored from the DeckThemes store: https://deckthemes.com/)
	CSS_LOADER_THEMES=(
		"Round_c6844008-a809-41f6-b140-7aa76f2a62ad.zip"
		"Clean_Gameview_a9776f60-2724-4ff0-824b-e1f82a04688e.zip"
		"Centered_Home_865407ae-fb14-4db7-b123-61f6995ed757.zip"
		"No_Home_Text_0e8a208f-136f-4f26-b0e1-344bcd186ed9.zip"
		"No_Home_Recent_Text_95c4e310-0770-4e1f-9f9d-cbe444e9bb17.zip"
		"Obsidian_f16cf40d-7ccc-4981-95bf-77b28e8d101e.zip"
		"Faster_Transition_Animations_921a7ec8-b355-4799-b23f-73f4b9c713b8.zip"
		"Mini_Carousel_4788b3d9-f4f3-40f2-ae0e-a80afa9fce5b.zip"
		"No_Home_Edge_Fade_2dab90ab-2cf3-480f-adce-f6c67caadd67.zip"
	)
	for asset in "${CSS_LOADER_THEMES[@]}"; do
		echo ">>> Downloading CSS Loader theme $asset to $CSS_LOADER_THEMES_FOLDER/"
		curl -fsSL "$DECKY_ASSETS_BASE/decky_css_loader/$asset" -o "$CSS_LOADER_THEMES_FOLDER/$asset"
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
	echo ">>> Installing Brave, vim, tmux and flatpak"
	if [ "$DO_SYSTEM_UPGRADE" -eq 1 ]; then
		echo ">>> Updating system (pacman -Syu)"
		sudo pacman -Syu --noconfirm
	else
		echo ">>> Skipped system upgrade: sudo pacman -Syu --noconfirm"
	fi
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
	if [ "$DO_SYSTEM_UPGRADE" -eq 1 ]; then
		echo ">>> CachyOS with paru detected - updating AUR packages"
		paru -Syu --noconfirm
	else
		echo ">>> Skipped AUR upgrade: paru -Syu --noconfirm"
	fi
fi

# --- Limine bootloader: set menu timeout to 2 + quiet boot ---
LIMINE_CONF="/boot/limine.conf"
if [ -f "$LIMINE_CONF" ]; then
	echo ">>> Limine config found: $LIMINE_CONF"

	# Replace any 'timeout: <anything>' with 'timeout: 2'
	if grep -q '^[[:space:]]*timeout:' "$LIMINE_CONF"; then
		echo ">>> Limine: setting timeout to 2"
		sudo awk '{ if (!done && $0 ~ /^[[:space:]]*timeout:/) { print "timeout: 2"; done = 1 } else print }' \
			"$LIMINE_CONF" | sudo tee "$LIMINE_CONF.tmp" > /dev/null && sudo mv "$LIMINE_CONF.tmp" "$LIMINE_CONF"
	else
		echo ">>> Limine: adding timeout: 2"
		printf 'timeout: 2\n' | sudo tee -a "$LIMINE_CONF" > /dev/null
	fi

	# Add 'quiet: yes' only if no line starting with 'quiet:' exists
	if ! grep -q '^[[:space:]]*quiet:' "$LIMINE_CONF"; then
		echo ">>> Limine: adding quiet: yes"
		printf 'quiet: yes\n' | sudo tee -a "$LIMINE_CONF" > /dev/null
	fi
fi

echo ">>> Done. Launch each .desktop file from Desktop Mode to start installation."
echo ">>> AppImages live in $APPS_FOLDER/ - run them directly."
