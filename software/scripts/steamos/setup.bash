#!/usr/bin/env bash

# setup.bash - SteamOS / Steam Deck post-install helpers
# Manual only: not run by default; run from Desktop Mode (Konsole) when needed.
# Re-running overwrites existing downloads.

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
# Install Decky Loader when missing, then stage and install its plugins and themes.
function _bootstrap_decky_loader_plugins_themes() {
	# Wipe any prior staging so stale downloads or renamed plugins never linger
	if [ -n "${DECKY_PLUGINS_FOLDER:-}" ] && [ "$DECKY_PLUGINS_FOLDER" != "/" ]; then
		echo ">>> Cleaning up old $DECKY_PLUGINS_FOLDER/"
		rm -rf "$DECKY_PLUGINS_FOLDER"
	fi
	mkdir -p "$DECKY_PLUGINS_FOLDER" "$CSS_LOADER_THEMES_FOLDER"

	# The upstream installer creates the plugin folder and starts the Loader service.
	if [ ! -x "$HOME/homebrew/services/PluginLoader" ] || [ ! -d "$HOME/homebrew/plugins" ]; then
		if ! type -P jq >/dev/null; then
			echo ">>> Decky Loader requires jq; install jq and re-run this script."
			return 1
		fi
		echo ">>> Installing Decky Loader"
		curl -fsSL "https://github.com/SteamDeckHomebrew/decky-installer/releases/latest/download/install_release.sh" \
			-o "$HOME/decky_loader_installer.sh" || return 1
		sudo bash "$HOME/decky_loader_installer.sh" || return 1
		if [ ! -x "$HOME/homebrew/services/PluginLoader" ] || [ ! -d "$HOME/homebrew/plugins" ]; then
			echo ">>> Decky Loader installation did not create its service and plugin folder."
			return 1
		fi
	else
		echo ">>> Decky Loader already installed"
	fi

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
		curl -fsSL "$DECKY_ASSETS_BASE/decky_plugin/$asset" -o "$DECKY_PLUGINS_FOLDER/$asset" || return 1
	done

	# Install Decky plugins after the Loader created its plugin folder.
	echo ">>> Installing Decky plugins into $HOME/homebrew/plugins/"
	for zip in "$DECKY_PLUGINS_FOLDER"/*.zip; do
		plugin_folder=$(unzip -Z -1 "$zip" | awk -F/ 'NR == 1 { print $1 }')
		if [ -z "$plugin_folder" ] || [ "$plugin_folder" = "." ] || [ "$plugin_folder" = ".." ]; then
			echo ">>> Invalid plugin folder in $(basename "$zip")"
			return 1
		fi
		installed_plugin="$HOME/homebrew/plugins/$plugin_folder"
		if [ -d "$installed_plugin" ]; then
			if [ ! -f "$installed_plugin/package.json" ] || ! type -P jq >/dev/null; then
				echo ">>> Skipping installed Decky plugin $plugin_folder"
				continue
			fi
			archive_version=$(unzip -p "$zip" "$plugin_folder/package.json" 2>/dev/null | jq -r '.version // empty')
			installed_version=$(jq -r '.version // empty' "$installed_plugin/package.json")
			if [ -z "$archive_version" ] || [ "$archive_version" = "$installed_version" ]; then
				echo ">>> Skipping installed Decky plugin $plugin_folder"
				continue
			fi
		fi
		echo ">>> Unzipping $(basename "$zip")"
		unzip -o "$zip" -d "$HOME/homebrew/plugins" || return 1
	done

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
_bootstrap_decky_loader_plugins_themes || exit 1

# --- Steam shortcuts ---
# Locate the single local Steam account's shortcut file.
# Prints path; returns nonzero if the account cannot be identified safely.
function _steam_shortcuts_file() {
	local steam_userdata account_folder
	local -a accounts=()

	steam_userdata="$HOME/.steam/steam/userdata"
	if [ ! -d "$steam_userdata" ]; then
		steam_userdata="$HOME/.local/share/Steam/userdata"
	fi
	if [ ! -d "$steam_userdata" ]; then
		echo ">>> Steam: userdata not found. Sign in to Steam first." >&2
		return 1
	fi
	for account_folder in "$steam_userdata"/[0-9]*; do
		[ -d "$account_folder/config" ] && accounts+=("$account_folder")
	done
	if [ "${#accounts[@]}" -ne 1 ]; then
		echo ">>> Steam: expected one Steam account in $steam_userdata, found ${#accounts[@]}." >&2
		return 1
	fi
	echo "[DEBUG] Steam shortcuts: account ${accounts[0]##*/}; userdata $steam_userdata" >&2
	printf '%s\n' "${accounts[0]}/config/shortcuts.vdf"
}

# Check local Steam shortcuts by exact executable or title without modifying them.
# $1: "path" or "title"; $2: exact value. Returns 0 for found, 1 for absent, 2 on error.
function _steam_shortcut_exists() {
	local mode="$1" target="$2" shortcuts

	if ! shortcuts=$(_steam_shortcuts_file); then
		return 2
	fi
	echo "[DEBUG] Steam shortcuts: checking $mode match in $shortcuts" >&2
	if [ -e "$shortcuts" ] && [ ! -f "$shortcuts" ]; then
		echo ">>> Steam: shortcut data is not a regular file: $shortcuts" >&2
		return 2
	fi
	if [ ! -e "$shortcuts" ]; then
		echo "[DEBUG] Steam shortcuts: no shortcuts.vdf yet" >&2
		return 1
	fi
	if ! type -P python3 >/dev/null; then
		echo ">>> Steam: python3 required to inspect shortcuts.vdf." >&2
		return 2
	fi
	python3 - "$shortcuts" "$mode" "$target" <<'PY'
import sys

try:
    with open(sys.argv[1], "rb") as shortcuts_file:
        data = shortcuts_file.read()
    offset = 0

    def read_bytes(size):
        global offset
        if offset + size > len(data):
            raise ValueError("truncated Steam shortcut data")
        result = data[offset:offset + size]
        offset += size
        return result

    def read_string():
        global offset
        end = data.find(b"\0", offset)
        if end < 0:
            raise ValueError("unterminated Steam shortcut string")
        value = data[offset:end].decode("utf-8")
        offset = end + 1
        return value

    def read_object():
        entries = {}
        while True:
            kind = read_bytes(1)[0]
            if kind == 8:
                return entries
            key = read_string()
            if kind == 0:
                value = read_object()
            elif kind == 1:
                value = read_string()
            elif kind in (2, 3, 4, 6):
                value = read_bytes(4)
            elif kind in (7, 10):
                value = read_bytes(8)
            else:
                raise ValueError("unsupported Steam shortcut field type")
            entries[key] = value

    root = read_object()
    if offset != len(data) or "shortcuts" not in root or not isinstance(root["shortcuts"], dict):
        raise ValueError("invalid Steam shortcut structure")
    mode, target = sys.argv[2:4]
    print(f"[DEBUG] Steam shortcuts: parsed {len(root['shortcuts'])} entries for {mode} lookup", file=sys.stderr)
    if mode not in ("path", "title"):
        raise ValueError("invalid shortcut lookup mode")
    for shortcut in root["shortcuts"].values():
        if not isinstance(shortcut, dict):
            raise ValueError("invalid Steam shortcut entry")
        executable = shortcut.get("Exe", shortcut.get("exe", ""))
        title = shortcut.get("AppName", shortcut.get("appname", ""))
        if not isinstance(executable, str) or not isinstance(title, str):
            raise ValueError("invalid Steam shortcut fields")
        if mode == "path" and executable.strip('"') == target:
            print("[DEBUG] Steam shortcuts: exact executable match", file=sys.stderr)
            sys.exit(0)
        if mode == "title" and title == target:
            print("[DEBUG] Steam shortcuts: exact title match", file=sys.stderr)
            sys.exit(0)
    print(f"[DEBUG] Steam shortcuts: no {mode} match", file=sys.stderr)
    sys.exit(1)
except (OSError, UnicodeError, ValueError) as error:
    print(f">>> Steam: cannot inspect shortcuts.vdf: {error}", file=sys.stderr)
    sys.exit(2)
PY
}

# Add a native app once per executable path; keep Steam's shortcut file read-only.
# $1: label; $2: absolute executable; $3: optional comma-separated Steam collections.
# Returns nonzero when shortcut inspection or registration fails.
function _add_steam_shortcut() {
	local name="$1" executable="$2" collections="${3:-}" status
	local -a shortcut_args=()

	echo "[DEBUG] Steam add: $name; executable $executable; collections ${collections:-none}"
	if [[ "$executable" == *.AppImage ]] && [ -f "$executable" ] && [ ! -x "$executable" ]; then
		echo ">>> Steam: making $name AppImage executable: $executable"
		if ! chmod +x "$executable"; then
			echo ">>> Steam: skipping $name; could not make AppImage executable."
			return 1
		fi
	fi
	if [ ! -x "$executable" ]; then
		echo ">>> Steam: skipping $name; executable missing or not runnable: $executable"
		return 1
	fi
	_steam_shortcut_exists path "$executable"
	status=$?
	echo "[DEBUG] Steam add: $name path lookup status $status"
	if [ "$status" -eq 0 ]; then
		echo ">>> Steam: $name already registered at $executable; skipping."
		return 0
	fi
	if [ "$status" -ne 1 ]; then
		echo ">>> Steam: skipping $name; cannot safely check existing shortcuts."
		return 1
	fi
	if ! type -P steamtinkerlaunch >/dev/null; then
		echo ">>> Steam: skipping $name; install SteamTinkerLaunch via ProtonUp-Qt, then re-run setup."
		return 1
	fi
	if pgrep -x steam >/dev/null 2>&1; then
		echo ">>> Steam: skipping $name; exit Steam before adding shortcuts, then re-run setup."
		return 1
	fi
	echo "[DEBUG] Steam add: $name prerequisites passed; invoking SteamTinkerLaunch"
	if [ -n "$collections" ]; then
		echo ">>> Steam: adding $name ($executable) to collections: $collections"
		shortcut_args+=("--tags=$collections")
	else
		echo ">>> Steam: adding $name ($executable) without collections"
	fi
	if ! steamtinkerlaunch addnonsteamgame --appname="$name" --exepath="$executable" "${shortcut_args[@]}"; then
		echo ">>> Steam: failed to add $name; check SteamTinkerLaunch output."
		return 1
	fi
	echo ">>> Steam: added $name. Restart Steam to see it in the library."
}

# Add a Brave site as a Steam tile, deduplicating by exact shortcut title.
# $1: Steam title; $2: HTTPS URL. Returns nonzero if inspection or registration fails.
function _add_url_steam_shortcut() {
	local title="$1" url="$2" brave_executable status

	echo "[DEBUG] Steam URL add: $title; checking existing title"
	if [ -z "$title" ] || [[ "$url" != https://* ]]; then
		echo ">>> Steam: skipping URL shortcut; title and HTTPS URL required."
		return 1
	fi
	_steam_shortcut_exists title "$title"
	status=$?
	echo "[DEBUG] Steam URL add: $title title lookup status $status"
	if [ "$status" -eq 0 ]; then
		echo ">>> Steam: $title already exists; skipping URL shortcut."
		return 0
	fi
	if [ "$status" -ne 1 ]; then
		echo ">>> Steam: skipping $title; cannot safely check existing shortcuts."
		return 1
	fi
	brave_executable=$(type -P brave-browser || type -P brave)
	if [ -z "$brave_executable" ]; then
		echo ">>> Steam: skipping $title; Brave executable not found."
		return 1
	fi
	if ! type -P steamtinkerlaunch >/dev/null; then
		echo ">>> Steam: skipping $title; install SteamTinkerLaunch via ProtonUp-Qt, then re-run setup."
		return 1
	fi
	if pgrep -x steam >/dev/null 2>&1; then
		echo ">>> Steam: skipping $title; exit Steam before adding shortcuts, then re-run setup."
		return 1
	fi
	echo "[DEBUG] Steam URL add: $title prerequisites passed; Brave $brave_executable"
	echo ">>> Steam: adding $title in Brave ($url) to collections: Streaming,Apps"
	if ! steamtinkerlaunch addnonsteamgame --appname="$title" --exepath="$brave_executable" \
		--launchoptions="--app=$url" --tags="Streaming,Apps"; then
		echo ">>> Steam: failed to add $title; check SteamTinkerLaunch output."
		return 1
	fi
	echo ">>> Steam: added $title. Restart Steam to see it in the library."
}

# Replace all shortcuts with an exact title, then add the Brave URL shortcut.
# $1: Steam title; $2: HTTPS URL. Not called during automatic setup.
# Backs up shortcuts.vdf and restores it if SteamTinkerLaunch fails to add.
function _upsert_url_steam_shortcut() {
	local title="$1" url="$2" shortcuts backup status

	echo "[DEBUG] Steam URL upsert: $title; preflight"
	if [ -z "$title" ] || [[ "$url" != https://* ]]; then
		echo ">>> Steam: skipping URL shortcut; title and HTTPS URL required."
		return 1
	fi
	if ! type -P steamtinkerlaunch >/dev/null; then
		echo ">>> Steam: skipping $title; SteamTinkerLaunch not installed."
		return 1
	fi
	if ! type -P brave-browser >/dev/null && ! type -P brave >/dev/null; then
		echo ">>> Steam: skipping $title; Brave not installed."
		return 1
	fi
	if pgrep -x steam >/dev/null 2>&1; then
		echo ">>> Steam: skipping $title; exit Steam before replacing shortcuts."
		return 1
	fi
	if ! shortcuts=$(_steam_shortcuts_file) || [ -L "$shortcuts" ] || [ ! -f "$shortcuts" ]; then
		echo ">>> Steam: skipping $title; regular shortcuts.vdf required."
		return 1
	fi
	echo "[DEBUG] Steam URL upsert: $title; target $shortcuts"
	_steam_shortcut_exists title "$title"
	status=$?
	echo "[DEBUG] Steam URL upsert: $title title lookup status $status"
	if [ "$status" -eq 1 ]; then
		_add_url_steam_shortcut "$title" "$url"
		return $?
	fi
	if [ "$status" -ne 0 ]; then
		echo ">>> Steam: skipping $title; cannot safely inspect shortcuts."
		return 1
	fi
	backup=$(mktemp "${shortcuts}.backup.XXXXXX") || return 1
	echo "[DEBUG] Steam URL upsert: $title; backup $backup"
	if ! cp -p "$shortcuts" "$backup"; then
		echo ">>> Steam: failed to back up $shortcuts; skipping $title."
		return 1
	fi
	echo ">>> Steam: backing up shortcuts to $backup; replacing entries titled $title"
	if ! python3 - "$shortcuts" "$backup" "$title" <<'PY'
import os
import stat
import sys
import tempfile

path, backup, title = sys.argv[1:]

def parse(data):
    offset = 0

    def read(size):
        nonlocal offset
        if offset + size > len(data):
            raise ValueError("truncated VDF")
        value = data[offset:offset + size]
        offset += size
        return value

    def string():
        nonlocal offset
        end = data.find(b"\0", offset)
        if end < 0:
            raise ValueError("unterminated VDF string")
        value = data[offset:end].decode("utf-8")
        offset = end + 1
        return value

    def obj():
        fields = {}
        while True:
            kind = read(1)[0]
            if kind == 8:
                return fields
            key = string()
            if kind == 0:
                value = obj()
            elif kind == 1:
                value = string()
            elif kind in (2, 3, 4, 6):
                value = read(4)
            elif kind in (7, 10):
                value = read(8)
            else:
                raise ValueError("unsupported VDF field type")
            if key in fields:
                raise ValueError("duplicate VDF field")
            fields[key] = value

    if read(1) != b"\0" or string() != "shortcuts":
        raise ValueError("unexpected VDF root")
    entries = []
    while offset < len(data) and data[offset] != 8:
        start = offset
        if read(1) != b"\0":
            raise ValueError("unexpected VDF entry type")
        key = string()
        fields = obj()
        name = fields.get("AppName", fields.get("appname", ""))
        if not key.isdigit() or not isinstance(name, str):
            raise ValueError("invalid shortcut entry")
        entries.append((name, data[start:offset], key))
    if read(2) != b"\x08\x08" or offset != len(data):
        raise ValueError("invalid VDF terminator")
    return entries

try:
    with open(backup, "rb") as source:
        original = source.read()
    entries = parse(original)
    retained = [entry for entry in entries if entry[0] != title]
    print(f"[DEBUG] Steam URL upsert: parsed {len(entries)} entries; matching title count {len(entries) - len(retained)}")
    if len(retained) == len(entries):
        raise ValueError("title disappeared before replacement")
    # Keep the surviving entry bytes intact; renumber only the outer numeric keys.
    result = bytearray(b"\0shortcuts\0")
    for index, (_, raw, key) in enumerate(retained):
        old_prefix = b"\0" + key.encode() + b"\0"
        if not raw.startswith(old_prefix):
            raise ValueError("invalid entry boundary")
        result += b"\0" + str(index).encode() + b"\0" + raw[len(old_prefix):]
    result += b"\x08\x08"
    parse(result)
    print(f"[DEBUG] Steam URL upsert: validated {len(retained)} retained entries")
    if os.path.islink(path):
        raise ValueError("shortcut file became a symlink")
    with open(path, "rb") as source:
        if source.read() != original:
            raise ValueError("shortcuts changed during replacement")
    mode = stat.S_IMODE(os.stat(path).st_mode)
    fd, staged = tempfile.mkstemp(prefix=".shortcuts-upsert-", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(result)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(staged, mode)
        os.replace(staged, path)
    finally:
        if os.path.exists(staged):
            os.unlink(staged)
    print(f">>> Steam: removed {len(entries) - len(retained)} matching shortcut(s): {title}")
except (OSError, UnicodeError, ValueError) as error:
    print(f">>> Steam: could not replace {title}: {error}", file=sys.stderr)
    sys.exit(1)
PY
	then
		echo ">>> Steam: $title unchanged; backup at $backup"
		return 1
	fi
	if ! _add_url_steam_shortcut "$title" "$url"; then
		echo "[DEBUG] Steam URL upsert: $title add failed; restoring backup"
		echo ">>> Steam: re-add failed; restoring $shortcuts from $backup"
		cp -p "$backup" "$shortcuts" || echo ">>> Steam: restore failed; recover manually from $backup" >&2
		return 1
	fi
	echo ">>> Steam: replaced $title; previous shortcuts backed up at $backup"
}

# --- Moonlight (AppImage) ---
echo ">>> Downloading Moonlight AppImage to $APPS_FOLDER/Moonlight.AppImage"
if curl -fsSL "https://github.com/moonlight-stream/moonlight-qt/releases/download/v6.1.0/Moonlight-6.1.0-x86_64.AppImage" \
	-o "$APPS_FOLDER/Moonlight.AppImage"; then
	_add_steam_shortcut "Moonlight" "$APPS_FOLDER/Moonlight.AppImage" "Streaming,Apps"
else
	echo ">>> Steam: skipping Moonlight; AppImage download failed."
fi

# --- ProtonUp-Qt (AppImage) ---
echo ">>> Downloading ProtonUp-Qt AppImage to $APPS_FOLDER/ProtonUp-Qt.AppImage"
if curl -fsSL "https://github.com/DavidoTek/ProtonUp-Qt/releases/download/v2.16.0/ProtonUp-Qt-2.16.0-x86_64.AppImage" \
	-o "$APPS_FOLDER/ProtonUp-Qt.AppImage"; then
	_add_steam_shortcut "ProtonUp-Qt" "$APPS_FOLDER/ProtonUp-Qt.AppImage" "Utilities,Apps"
else
	echo ">>> Steam: skipping ProtonUp-Qt; AppImage download failed."
fi

# --- Brave, vim, tmux + system packages (pacman) ---
if type -P pacman >/dev/null; then
	echo ">>> Installing Brave, vim, tmux and flatpak"
	if [ "$DO_SYSTEM_UPGRADE" -eq 1 ]; then
		echo ">>> Updating system (pacman -Syu)"
		sudo pacman -Syu --noconfirm
	else
		echo ">>> Skipped system upgrade: sudo pacman -Syu --noconfirm"
	fi
	if sudo pacman -S --needed --noconfirm brave-bin vim tmux flatpak fuse2; then
		BRAVE_EXECUTABLE=$(type -P brave-browser || type -P brave)
		if [ -n "$BRAVE_EXECUTABLE" ]; then
			_add_steam_shortcut "Brave" "$BRAVE_EXECUTABLE" "Browsers,Apps"
			_add_url_steam_shortcut "Netflix" "https://www.netflix.com/"
			_add_url_steam_shortcut "Disney+" "https://www.disneyplus.com/"
			_add_url_steam_shortcut "Prime Video" "https://www.primevideo.com/"
			_add_url_steam_shortcut "YouTube" "https://www.youtube.com/"
			_add_url_steam_shortcut "Plex" "https://app.plex.tv/desktop/"
		else
			echo ">>> Steam: skipping Brave; brave-bin executable not found after package install."
		fi
	else
		echo ">>> Steam: skipping Brave; pacman installation failed."
	fi
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

# --- Limine bootloader: set menu timeout + quiet boot ---
readonly _LIMINE_BOOT_TIMEOUT=2
LIMINE_CONF="/boot/limine.conf"
if [ -f "$LIMINE_CONF" ]; then
	echo ">>> Limine config found: $LIMINE_CONF"

	# Normalize quiet boot directly below the first timeout entry.
	echo ">>> Limine: setting timeout to $_LIMINE_BOOT_TIMEOUT with quiet boot"
	sudo awk -v timeout="$_LIMINE_BOOT_TIMEOUT" '
		/^[[:space:]]*quiet:/ { next }
		!done && /^[[:space:]]*timeout:/ { print "timeout: " timeout; print "quiet: yes"; done = 1; next }
		{ print }
		END { if (!done) { print "timeout: " timeout; print "quiet: yes" } }
	' "$LIMINE_CONF" | sudo tee "$LIMINE_CONF.tmp" > /dev/null && sudo mv "$LIMINE_CONF.tmp" "$LIMINE_CONF"
fi

echo ">>> Done. Launch each .desktop file from Desktop Mode to start installation."
echo ">>> AppImages live in $APPS_FOLDER/ - run them directly."
