#!/usr/bin/env bash

# setup.bash - SteamOS / Steam Deck post-install helpers
# Manual only: not run by default; run from Desktop Mode (Konsole) when needed.
# Re-running overwrites existing downloads.
# Required Brave install, run before remaining setup. Use Flatpak's generated Steam fields:
# flatpak install --user flathub com.brave.Browser
# Target: /usr/bin/flatpak | Start In: /usr/bin/
# Generic Launch Options: "run" "--branch=stable" "--arch=x86_64" "--command=brave" "--file-forwarding" "com.brave.Browser" "@@u" "@@"
# Fixed site URLs open directly in kiosk mode; do not use "--app=" or URI forwarding.
STEAMOS_SCRIPT_FOLDER="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# Print a red yes/no prompt. Return 0 for Yes, 1 for No or unavailable terminal.
# $1: prompt text; $2: optional default (Y or N; defaults to N).
function _prompt() {
  local prompt="$1" default="${2:-N}" reply="" hint="[y/N]"
  case "$default" in [Yy]*) hint="[Y/n]" ;; esac
  (: < /dev/tty) 2> /dev/null || return 1
  printf '\033[0;31m>>> %s %s \033[0m' "$prompt" "$hint" > /dev/tty
  read -r reply < /dev/tty || return 1
  case "$reply" in
  [Yy] | [Yy][Ee][Ss]) return 0 ;;
  [Nn] | [Nn][Oo]) return 1 ;;
  "") case "$default" in [Yy]*) return 0 ;; esac ;;
  esac
  return 1
}

# Steam must be fully closed before setup changes its shortcut database.
if ! type -P pgrep > /dev/null; then
  echo ">>> Steam setup: cannot check whether Steam is running; pgrep is unavailable." >&2
  exit 1
fi

while pgrep -x steam > /dev/null 2>&1; do
  if ! _prompt "Steam is open. Close Steam now, then answer Yes to recheck; No aborts setup." Y; then
    echo ">>> Steam setup stopped. Close Steam and re-run setup." >&2
    exit 1
  fi
done

if _prompt "Clear all user-defined non-Steam shortcuts from the active Steam account?" Y; then
  CLEAR_USER_STEAM_SHORTCUTS=1
else
  CLEAR_USER_STEAM_SHORTCUTS=0
fi

if _prompt "Install Decky Loader, plugins, and CSS Loader themes?"; then
  DO_DECKY_SETUP=1
else
  DO_DECKY_SETUP=0
fi

DESKTOP_FOLDER="$HOME/Desktop"
DECKY_PLUGINS_FOLDER="$DESKTOP_FOLDER/decky_plugins"
CSS_LOADER_THEMES_FOLDER="$DECKY_PLUGINS_FOLDER/css_loader_themes"
APPS_FOLDER="$HOME/Apps"
mkdir -p "$DESKTOP_FOLDER" "$APPS_FOLDER"

if _prompt "Run system upgrade (sudo pacman -Syu / paru -Syu)?"; then
  DO_SYSTEM_UPGRADE=1
else
  DO_SYSTEM_UPGRADE=0
fi

# Flatpak Brave is required before downloads and Steam shortcut setup.
function _install_flatpak_brave_prerequisite() {
  if ! type -P flatpak > /dev/null; then
    echo ">>> Brave prerequisite failed: flatpak command is unavailable." >&2
    return 1
  fi
  # TODO: remove this pacman Brave migration block after all Decks use Flatpak Brave.
  if type -P pacman > /dev/null && pacman -Qq brave-bin > /dev/null 2>&1; then
    echo ">>> Removing pacman brave-bin; preserving shared dependencies and user profile data."
    if ! sudo pacman -R --noconfirm brave-bin; then
      echo ">>> Brave migration failed; continuing with Flatpak Brave install." >&2
    fi
  fi
  # END TODO
  if ! flatpak install --user flathub com.brave.Browser; then
    echo ">>> Brave prerequisite failed: could not install com.brave.Browser." >&2
    return 1
  fi
}

BRAVE_FLATPAK_READY=0
if _install_flatpak_brave_prerequisite; then
  BRAVE_FLATPAK_READY=1
else
  echo ">>> Flatpak Brave setup failed; continuing with the remaining SteamOS setup." >&2
fi

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
    if ! type -P jq > /dev/null; then
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
      if [ ! -f "$installed_plugin/package.json" ] || ! type -P jq > /dev/null; then
        echo ">>> Skipping installed Decky plugin $plugin_folder"
        continue
      fi
      archive_version=$(unzip -p "$zip" "$plugin_folder/package.json" 2> /dev/null | jq -r '.version // empty')
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

# Remove every non-Steam shortcut for the active account after backing up its VDF.
# Prints removed names and an exact restore command; refuses to run while Steam is open.
function _clear_user_steam_shortcuts() {
  local shortcuts desktop_folder="${1:-$HOME/Desktop}"
  if pgrep -x steam > /dev/null 2>&1; then
    echo ">>> Steam cleanup: close Steam completely before clearing shortcuts." >&2
    return 1
  fi
  if ! shortcuts=$(_steam_shortcuts_file); then
    return 1
  fi
  if [ -L "$shortcuts" ] || { [ -e "$shortcuts" ] && [ ! -f "$shortcuts" ]; }; then
    echo ">>> Steam cleanup: refusing non-regular shortcuts file: $shortcuts" >&2
    return 1
  fi
  if [ ! -e "$shortcuts" ]; then
    echo ">>> Steam cleanup: no user-defined non-Steam shortcuts found; nothing removed."
    return 0
  fi
  mkdir -p "$desktop_folder" || return 1
  python3 - "$shortcuts" "$desktop_folder" << 'PY'
import json
import os
import shlex
import stat
import sys
import tempfile
from datetime import datetime

path, desktop_folder = sys.argv[1:]

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

    def fields():
        nonlocal offset
        result = {}
        while True:
            kind = read(1)[0]
            if kind == 8:
                return result
            key = string()
            if key in result:
                raise ValueError("duplicate VDF field")
            if kind == 0:
                value = fields()
            elif kind == 1:
                value = string()
            elif kind == 5:
                start = offset
                end = start
                while end + 1 < len(data) and data[end:end + 2] != b"\0\0":
                    end += 2
                if end + 1 >= len(data):
                    raise ValueError("unterminated VDF wide string")
                value = data[start:end].decode("utf-16-le")
                offset = end + 2
            elif kind in (2, 3, 4, 6):
                value = read(4)
            elif kind in (7, 9, 10):
                value = read(8)
            else:
                raise ValueError(f"unsupported VDF field type: {kind}")
            result[key] = value

    root = fields()
    if offset != len(data) or set(root) != {"shortcuts"} or not isinstance(root["shortcuts"], dict):
        raise ValueError("invalid shortcuts.vdf root")
    shortcuts = root["shortcuts"]
    names = []
    for key, shortcut in shortcuts.items():
        if not key.isdigit() or not isinstance(shortcut, dict):
            raise ValueError("invalid shortcut entry")
        name = shortcut.get("AppName", shortcut.get("appname", ""))
        if not isinstance(name, str):
            raise ValueError("invalid shortcut name")
        names.append(name or "(unnamed shortcut)")
    return names

try:
    with open(path, "rb") as source:
        original = source.read()
    names = parse(original)
    if not names:
        print(">>> Steam cleanup: no user-defined non-Steam shortcuts found; nothing removed.")
        sys.exit(0)
    if os.path.islink(path):
        raise ValueError("shortcuts.vdf became a symlink")
    with open(path, "rb") as current:
        if current.read() != original:
            raise ValueError("shortcuts changed during cleanup")
    mode = stat.S_IMODE(os.stat(path).st_mode)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    backup = os.path.join(desktop_folder, f"shortcuts.vdf.bak_{timestamp}")
    backup_fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(backup_fd, "wb") as output:
        output.write(original)
        output.flush()
        os.fsync(output.fileno())
    os.chmod(backup, mode)
    restore_script = backup + ".restore.sh"
    restore_contents = (
        "#!/usr/bin/env bash\n"
        "# Restore Steam non-Steam shortcuts. Exit Steam before running this file.\n"
        "set -e\n"
        "if pgrep -x steam >/dev/null 2>&1; then\n"
        '  echo ">>> Steam is running. Exit Steam completely, then re-run this restore script." >&2\n'
        "  exit 1\n"
        "fi\n"
        f"cp -- {shlex.quote(backup)} {shlex.quote(path)}\n"
        'echo ">>> Restored Steam shortcuts. Restart Steam to reload the library."\n'
    )
    restore_fd = os.open(restore_script, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o700)
    with os.fdopen(restore_fd, "w", encoding="utf-8") as output:
        output.write(restore_contents)
        output.flush()
        os.fsync(output.fileno())
    folder = os.path.dirname(path)
    staged_fd, staged = tempfile.mkstemp(prefix=".shortcuts-clear-", dir=folder)
    try:
        with os.fdopen(staged_fd, "wb") as output:
            output.write(b"\0shortcuts\0\x08\x08")
            output.flush()
            os.fsync(output.fileno())
        os.chmod(staged, mode)
        os.replace(staged, path)
    finally:
        if os.path.exists(staged):
            os.unlink(staged)
    print(f">>> Steam cleanup: removed {len(names)} non-Steam shortcut(s) from {path}:")
    for name in names:
        print(f"  - {json.dumps(name, ensure_ascii=False)}")
    print(f">>> Steam cleanup backup: {backup}")
    print(f">>> Restore instructions: {restore_script}")
    print(f">>> To restore: close Steam, then run: bash {restore_script}")
    print(">>> Restart Steam after restoring the backup.")
except (OSError, UnicodeError, ValueError) as error:
    print(f">>> Steam cleanup: could not clear shortcuts: {error}", file=sys.stderr)
    sys.exit(1)
PY
}

if [ "$CLEAR_USER_STEAM_SHORTCUTS" -eq 1 ]; then
  if ! _clear_user_steam_shortcuts "$HOME/Desktop"; then
    echo ">>> Steam shortcut cleanup failed; continuing without clearing shortcuts." >&2
    CLEAR_USER_STEAM_SHORTCUTS=0
  fi
fi

decky_setup_failed=0
if [ "$DO_DECKY_SETUP" -eq 1 ]; then
  if ! _bootstrap_decky_loader_plugins_themes; then
    decky_setup_failed=1
    echo ">>> Decky setup failed; continuing with independent SteamOS steps."
  fi
else
  echo ">>> Skipping Decky Loader setup."
fi

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
  if ! type -P python3 > /dev/null; then
    echo ">>> Steam: python3 required to inspect shortcuts.vdf." >&2
    return 2
  fi
  python3 - "$shortcuts" "$mode" "$target" << 'PY'
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

# Configure SteamTinkerLaunch to regenerate its path cache for the verified account.
# $1: numeric Steam account ID. Returns nonzero when its config cannot be updated safely.
function _configure_steamtinkerlaunch_account() {
  local account_id="$1" config_folder global_config staged_config

  if [[ ! "$account_id" =~ ^[0-9]+$ ]]; then
    echo ">>> Steam: refusing invalid Steam account ID: $account_id" >&2
    return 1
  fi
  config_folder="${XDG_CONFIG_HOME:-$HOME/.config}/steamtinkerlaunch"
  global_config="$config_folder/global.conf"
  if [ -e "$global_config" ] && { [ -L "$global_config" ] || [ ! -f "$global_config" ]; }; then
    echo ">>> Steam: SteamTinkerLaunch config is not a regular file: $global_config" >&2
    return 1
  fi
  mkdir -p "$config_folder" || return 1
  if ! grep -Fxq "STEAMUSERID=\"$account_id\"" "$global_config" 2> /dev/null; then
    if [ -f "$global_config" ]; then
      [ -f "$global_config.bak_original" ] || cp -p "$global_config" "$global_config.bak_original" || return 1
      cp -p "$global_config" "$global_config.bak_latest" || return 1
    fi
    staged_config=$(mktemp "$config_folder/.global.conf.XXXXXX") || return 1
    if [ -f "$global_config" ]; then
      grep -v '^STEAMUSERID=' "$global_config" > "$staged_config" || true
    fi
    printf 'STEAMUSERID="%s"\n' "$account_id" >> "$staged_config"
    mv "$staged_config" "$global_config" || return 1
  fi
  rm -f "/dev/shm/steamtinkerlaunch/steampaths.txt"
}

# Run SteamTinkerLaunch for the verified account after checking executable exists.
# Arguments: addnonsteamgame options including --exepath=<executable>. Returns nonzero if invalid or command fails.
function _steamtinkerlaunch_add() {
  local shortcuts account_folder account_id argument executable_path=""
  for argument in "$@"; do
    case "$argument" in
    --exepath=*) executable_path=${argument#--exepath=} ;;
    esac
  done
  if [ -z "$executable_path" ] || [ ! -x "$executable_path" ]; then
    echo ">>> Steam: binary or AppImage path not found or not present: ${executable_path:-<missing --exepath>}" >&2
    return 1
  fi

  if ! shortcuts=$(_steam_shortcuts_file); then
    return 1
  fi
  account_folder=${shortcuts%/config/shortcuts.vdf}
  account_id=${account_folder##*/}
  _configure_steamtinkerlaunch_account "$account_id" || return 1
  steamtinkerlaunch addnonsteamgame "$@"
}

# Update one same-name shortcut while preserving unrelated Steam metadata.
# Arguments: title, executable, start directory, launch options. Returns nonzero on unsafe update.
function _steam_shortcut_update_by_name() {
  local title="$1" executable="$2" startdir="${3:-}" launchoptions="${4:-}" shortcuts
  if ! shortcuts=$(_steam_shortcuts_file) || [ -L "$shortcuts" ] || [ ! -f "$shortcuts" ]; then
    echo ">>> Steam: cannot update $title; regular shortcuts.vdf required." >&2
    return 1
  fi
  python3 - "$shortcuts" "$title" "$executable" "$startdir" "$launchoptions" << 'PY'
import os
import stat
import sys
import tempfile

path, title, executable, startdir, launchoptions = sys.argv[1:]
updates = {"Exe": f'"{executable}"'}
if startdir:
    updates["StartDir"] = f'"{startdir}"'
if launchoptions:
    updates["LaunchOptions"] = launchoptions

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
        start = offset
        offset = end + 1
        return value, start, end

    def fields():
        nonlocal offset
        result = {}
        while True:
            kind = read(1)[0]
            if kind == 8:
                return result, offset - 1
            key, _, _ = string()
            if key in result:
                raise ValueError("duplicate VDF field")
            if kind == 0:
                value, end = fields()
                result[key] = {"kind": kind, "value": value, "end": end}
            elif kind == 1:
                value, start, end = string()
                result[key] = {"kind": kind, "value": value, "start": start, "end": end}
            elif kind == 5:
                end = offset
                while end + 1 < len(data) and data[end:end + 2] != b"\0\0":
                    end += 2
                if end + 1 >= len(data):
                    raise ValueError("unterminated VDF wide string")
                value = data[offset:end].decode("utf-16-le")
                offset = end + 2
                result[key] = {"kind": kind, "value": value}
            elif kind in (2, 3, 4, 6):
                result[key] = {"kind": kind, "value": read(4)}
            elif kind in (7, 9, 10):
                result[key] = {"kind": kind, "value": read(8)}
            else:
                raise ValueError(f"unsupported VDF field type: {kind}")

    if read(1) != b"\0" or string()[0] != "shortcuts":
        raise ValueError("unexpected VDF root")
    entries = []
    while offset < len(data) and data[offset] != 8:
        start = offset
        if read(1) != b"\0":
            raise ValueError("unexpected shortcut entry type")
        key, _, _ = string()
        shortcut_fields, end = fields()
        name = shortcut_fields.get("AppName", shortcut_fields.get("appname", {})).get("value", "")
        if not key.isdigit() or not isinstance(name, str):
            raise ValueError("invalid shortcut entry")
        entries.append({"name": name, "start": start, "end": offset, "fields_end": end, "fields": shortcut_fields})
    if read(2) != b"\x08\x08" or offset != len(data):
        raise ValueError("invalid VDF terminator")
    return entries

try:
    with open(path, "rb") as source:
        original = source.read()
    entries = parse(original)
    matches = [entry for entry in entries if entry["name"] == title]
    if not matches:
        raise ValueError("shortcut name disappeared before update")
    chosen = matches[0]
    already_current = len(matches) == 1
    for key, value in updates.items():
        field_name = next((name for name in chosen["fields"] if name.lower() == key.lower()), key)
        field = chosen["fields"].get(field_name)
        if field is None or field["kind"] != 1 or field["value"] != value:
            already_current = False
    if already_current:
        print(f">>> Steam: {title} already current.")
        sys.exit(0)
    if os.path.islink(path):
        raise ValueError("shortcuts.vdf became a symlink")
    with open(path, "rb") as source:
        if source.read() != original:
            raise ValueError("shortcuts changed during update")
    result = bytearray(b"\0shortcuts\0")
    index = 0
    for entry in entries:
        if entry["name"] == title and entry is not chosen:
            continue
        raw = bytearray(original[entry["start"]:entry["end"]])
        prefix_end = original.find(b"\0", entry["start"] + 1) + 1
        if entry is chosen:
            inserted = bytearray()
            edits = []
            for key, value in updates.items():
                field_name = next((name for name in entry["fields"] if name.lower() == key.lower()), key)
                field = entry["fields"].get(field_name)
                if field is None:
                    inserted.extend(b"\x01" + field_name.encode() + b"\0" + value.encode() + b"\0")
                elif field["kind"] != 1:
                    raise ValueError(f"{key} is not a string field")
                else:
                    edits.append((field["start"] - entry["start"], field["end"] - entry["start"], value.encode()))
            for start, end, value in sorted(edits, reverse=True):
                raw[start:end] = value
            if inserted:
                raw[entry["fields_end"] - entry["start"]:entry["fields_end"] - entry["start"]] = inserted
        old_prefix = original[entry["start"]:prefix_end]
        result.extend(b"\0" + str(index).encode() + b"\0" + raw[len(old_prefix):])
        index += 1
    result.extend(b"\x08\x08")
    parse(result)
    mode = stat.S_IMODE(os.stat(path).st_mode)
    backup_fd, backup = tempfile.mkstemp(prefix="shortcuts.vdf.backup.", dir=os.path.dirname(path))
    with os.fdopen(backup_fd, "wb") as backup_file:
        backup_file.write(original)
        backup_file.flush()
        os.fsync(backup_file.fileno())
    os.chmod(backup, mode)
    fd, staged = tempfile.mkstemp(prefix=".shortcuts-update-", dir=os.path.dirname(path))
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
    print(f">>> Steam: updated {title}; removed {len(matches) - 1} same-name duplicate(s). Backup: {backup}")
except (OSError, UnicodeError, ValueError) as error:
    print(f">>> Steam: could not update {title}: {error}", file=sys.stderr)
    sys.exit(1)
PY
}

# Add or refresh a native app shortcut by app name.
# $1: label; $2: absolute executable; $3: optional comma-separated Steam collections.
# $4: optional registered exepath (defaults to $2); $5: optional start directory.
# Returns nonzero when shortcut inspection or registration fails.
function _add_steam_shortcut() {
  local name="$1" executable="$2" collections="${3:-}" registered_exepath="${4:-$2}" startdir="${5:-}" launchoptions="${6:-}" status
  local -a shortcut_args=()

  echo "[DEBUG] Steam add: $name; executable $executable; registered $registered_exepath; collections ${collections:-none}"
  if [[ "$executable" == *.AppImage ]] && [ -f "$executable" ] && [ ! -x "$executable" ]; then
    echo ">>> Steam: making $name AppImage executable: $executable"
    if ! chmod +x "$executable"; then
      echo ">>> Steam: skipping $name; could not make AppImage executable."
      return 1
    fi
  fi
  if [ ! -x "$executable" ]; then
    echo ">>> Steam: binary or AppImage path not found or not present: $executable"
    return 1
  fi
  _steam_shortcut_exists title "$name"
  status=$?
  echo "[DEBUG] Steam add: $name title lookup status $status"
  if [ "$status" -eq 0 ]; then
    if pgrep -x steam > /dev/null 2>&1; then
      echo ">>> Steam: skipping $name; exit Steam before updating shortcuts, then re-run setup."
      return 1
    fi
    _steam_shortcut_update_by_name "$name" "$registered_exepath" "$startdir" "$launchoptions"
    return $?
  fi
  if [ "$status" -ne 1 ]; then
    echo ">>> Steam: skipping $name; cannot safely check existing shortcuts."
    return 1
  fi
  if ! type -P steamtinkerlaunch > /dev/null; then
    echo ">>> Steam: skipping $name; install SteamTinkerLaunch via ProtonUp-Qt, then re-run setup."
    return 1
  fi
  if pgrep -x steam > /dev/null 2>&1; then
    echo ">>> Steam: skipping $name; exit Steam before adding shortcuts, then re-run setup."
    return 1
  fi
  echo "[DEBUG] Steam add: $name prerequisites passed; invoking SteamTinkerLaunch"
  if [ -n "$startdir" ]; then
    shortcut_args+=("--startdir=$startdir")
  fi
  if [ -n "$launchoptions" ]; then
    shortcut_args+=("--launchoptions=$launchoptions")
  fi
  if [ -n "$collections" ]; then
    echo ">>> Steam: adding $name ($registered_exepath) to collections: $collections"
    shortcut_args+=("--tags=$collections")
  else
    echo ">>> Steam: adding $name ($registered_exepath) without collections"
  fi
  if ! _steamtinkerlaunch_add --appname="$name" --exepath="$registered_exepath" "${shortcut_args[@]}"; then
    echo ">>> Steam: failed to add $name; check SteamTinkerLaunch output."
    return 1
  fi
  if ! _steam_shortcut_exists path "$registered_exepath"; then
    echo ">>> Steam: failed to add $name; SteamTinkerLaunch returned success but shortcut is absent."
    return 1
  fi
  echo ">>> Steam: added $name. Restart Steam to see it in the library."
}

# Add or refresh a Brave site as a Steam tile, deduplicating by exact shortcut title.
# $1: Steam title; $2: HTTPS URL. Trailing slashes are stripped before adding `--app=` to avoid Steam URL-forwarding artifacts.
# Returns nonzero if inspection or registration fails.
function _add_url_steam_shortcut() {
  local title="$1" url="$2" flatpak_executable launchoptions status

  echo "[DEBUG] Steam URL add: $title; checking existing title"
  if [ -z "$title" ] || [[ "$url" != https://* ]]; then
    echo ">>> Steam: skipping URL shortcut; title and HTTPS URL required."
    return 1
  fi
  while [[ "$url" == */ ]]; do
    url=${url%/}
  done
  flatpak_executable=$(type -P flatpak)
  if [ -z "$flatpak_executable" ]; then
    echo ">>> Steam: skipping $title; flatpak executable not found."
    return 1
  fi
  launchoptions="\"run\" \"--command=brave\" \"com.brave.Browser\" \"--kiosk\" \"$url\""
  _steam_shortcut_exists title "$title"
  status=$?
  echo "[DEBUG] Steam URL add: $title title lookup status $status"
  if [ "$status" -eq 0 ]; then
    if pgrep -x steam > /dev/null 2>&1; then
      echo ">>> Steam: skipping $title; exit Steam before updating shortcuts, then re-run setup."
      return 1
    fi
    _steam_shortcut_update_by_name "$title" "/usr/bin/flatpak" "/usr/bin/" "$launchoptions"
    return $?
  fi
  if [ "$status" -ne 1 ]; then
    echo ">>> Steam: skipping $title; cannot safely check existing shortcuts."
    return 1
  fi
  if ! type -P steamtinkerlaunch > /dev/null; then
    echo ">>> Steam: skipping $title; install SteamTinkerLaunch via ProtonUp-Qt, then re-run setup."
    return 1
  fi
  if pgrep -x steam > /dev/null 2>&1; then
    echo ">>> Steam: skipping $title; exit Steam before adding shortcuts, then re-run setup."
    return 1
  fi
  echo "[DEBUG] Steam URL add: $title prerequisites passed; Flatpak $flatpak_executable"
  echo ">>> Steam: adding $title in Brave ($url) to collections: Streaming,Apps"
  if ! _steamtinkerlaunch_add --appname="$title" --exepath="/usr/bin/flatpak" --startdir="/usr/bin/" \
    --launchoptions="$launchoptions" --tags="Streaming,Apps"; then
    echo ">>> Steam: failed to add $title; check SteamTinkerLaunch output."
    return 1
  fi
  if ! _steam_shortcut_exists title "$title"; then
    echo ">>> Steam: failed to add $title; SteamTinkerLaunch returned success but shortcut is absent."
    return 1
  fi
  echo ">>> Steam: added $title. Restart Steam to see it in the library."
}

# Replace all shortcuts with an exact title, then add the Brave Flatpak URL shortcut.
# $1: Steam title; $2: HTTPS URL. Not called during automatic setup.
# Backs up shortcuts.vdf and restores it if SteamTinkerLaunch fails to add.
function _upsert_url_steam_shortcut() {
  local title="$1" url="$2" shortcuts backup status

  echo "[DEBUG] Steam URL upsert: $title; preflight"
  if [ -z "$title" ] || [[ "$url" != https://* ]]; then
    echo ">>> Steam: skipping URL shortcut; title and HTTPS URL required."
    return 1
  fi
  if ! type -P steamtinkerlaunch > /dev/null; then
    echo ">>> Steam: skipping $title; SteamTinkerLaunch not installed."
    return 1
  fi
  if pgrep -x steam > /dev/null 2>&1; then
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
  if ! python3 - "$shortcuts" "$backup" "$title" << 'PY'; then
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

# Install SteamTinkerLaunch runtime dependencies before invoking it.
function _install_steamtinkerlaunch_dependencies() {
  local binary yad_version yad_major yad_minor
  local -a missing=()

  for binary in xdotool xwininfo yad; do
    type -P "$binary" > /dev/null || missing+=("$binary")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    if ! type -P pacman > /dev/null; then
      echo ">>> SteamTinkerLaunch dependencies missing: ${missing[*]}"
      return 1
    fi
    echo ">>> Installing SteamTinkerLaunch dependencies: xdotool xorg-xwininfo yad"
    if ! sudo pacman -S --needed --noconfirm xdotool xorg-xwininfo yad; then
      echo ">>> SteamTinkerLaunch dependency installation failed."
      return 1
    fi
  else
    echo ">>> SteamTinkerLaunch dependencies already installed"
  fi
  for binary in xdotool xwininfo yad; do
    if ! type -P "$binary" > /dev/null; then
      echo ">>> SteamTinkerLaunch dependency still missing after installation: $binary"
      return 1
    fi
  done
  yad_version=$(yad --version 2> /dev/null | awk '{print $1}')
  yad_major=${yad_version%%.*}
  yad_minor=${yad_version#*.}
  yad_minor=${yad_minor%%.*}
  if [[ "$yad_version" != *.* ]] || [[ ! "$yad_major" =~ ^[0-9]+$ ]] || [[ ! "$yad_minor" =~ ^[0-9]+$ ]] \
    || [ "$yad_major" -lt 7 ] || { [ "$yad_major" -eq 7 ] && [ "$yad_minor" -lt 2 ]; }; then
    echo ">>> SteamTinkerLaunch requires Yad 7.2 or newer; found ${yad_version:-unknown}."
    return 1
  fi
}

# Install SteamTinkerLaunch using its upstream Steam Deck layout when missing.
function _install_steamtinkerlaunch() {
  local install_folder="$HOME/stl/prefix" launcher="$HOME/.local/bin/steamtinkerlaunch"
  local staging_folder extracted_folders

  if type -P steamtinkerlaunch > /dev/null; then
    echo ">>> SteamTinkerLaunch already installed: $(type -P steamtinkerlaunch)"
    return 0
  fi
  if [ ! -x "$install_folder/steamtinkerlaunch" ]; then
    if [ -e "$install_folder" ]; then
      echo ">>> SteamTinkerLaunch install incomplete at $install_folder; move it aside and re-run setup."
      return 1
    fi
    staging_folder=$(mktemp -d) || return 1
    echo ">>> Installing SteamTinkerLaunch to $install_folder"
    if ! curl -fsSL "https://github.com/sonic2kk/steamtinkerlaunch/archive/refs/heads/master.tar.gz" \
      -o "$staging_folder/steamtinkerlaunch.tar.gz" \
      || ! tar -xzf "$staging_folder/steamtinkerlaunch.tar.gz" -C "$staging_folder"; then
      echo ">>> SteamTinkerLaunch download or extraction failed."
      rm -rf "$staging_folder"
      return 1
    fi
    extracted_folders=("$staging_folder"/steamtinkerlaunch-*)
    if [ "${#extracted_folders[@]}" -ne 1 ] || [ ! -d "${extracted_folders[0]}" ]; then
      echo ">>> SteamTinkerLaunch archive had an unexpected layout."
      rm -rf "$staging_folder"
      return 1
    fi
    mkdir -p "$HOME/stl"
    mv "${extracted_folders[0]}" "$install_folder"
    rm -rf "$staging_folder"
    chmod +x "$install_folder/steamtinkerlaunch"
    if ! (cd "$install_folder" && ./steamtinkerlaunch); then
      echo ">>> SteamTinkerLaunch initial setup failed."
      rm -rf "$install_folder"
      return 1
    fi
    if ! (cd "$install_folder" && ./steamtinkerlaunch compat add); then
      echo ">>> SteamTinkerLaunch compatibility-tool registration failed."
      rm -rf "$install_folder"
      return 1
    fi
  fi
  mkdir -p "$HOME/.local/bin"
  if [ -e "$launcher" ] && [ "$(readlink "$launcher" 2> /dev/null)" != "$install_folder/steamtinkerlaunch" ]; then
    echo ">>> SteamTinkerLaunch launcher already exists and is not managed by this setup: $launcher"
    return 1
  fi
  ln -sfn "$install_folder/steamtinkerlaunch" "$launcher"
  export PATH="$HOME/.local/bin:$PATH"
  echo ">>> SteamTinkerLaunch installed: $launcher"
}

if ! _install_steamtinkerlaunch_dependencies || ! _install_steamtinkerlaunch; then
  echo ">>> Steam shortcuts need SteamTinkerLaunch; fix installation output above and re-run setup."
fi

# --- Moonlight (AppImage) ---
MOONLIGHT_VERSION="6.2.0"
echo ">>> Downloading Moonlight AppImage to $APPS_FOLDER/Moonlight.AppImage"
if curl -fsSL "https://github.com/moonlight-stream/moonlight-qt/releases/download/v$MOONLIGHT_VERSION/Moonlight-$MOONLIGHT_VERSION-x86_64.AppImage" \
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

# --- ES-DE Emulation Station (installed by EmuDeck) ---
_add_steam_shortcut "ES-DE Emulation Station" "/home/deck/Applications/ES-DE.AppImage"

# --- Brave dependencies ---
if type -P pacman > /dev/null; then
  echo ">>> Installing vim, tmux and fuse2"
  if [ "$DO_SYSTEM_UPGRADE" -eq 1 ]; then
    echo ">>> Updating system (pacman -Syu)"
    sudo pacman -Syu --noconfirm
  else
    echo ">>> Skipped system upgrade: sudo pacman -Syu --noconfirm"
  fi
  if sudo pacman -S --needed --noconfirm vim tmux fuse2; then
    flatpak update -y
  else
    echo ">>> Steam: vim/tmux/fuse2 package installation failed; continuing."
  fi
fi

# --- Brave and URL shortcuts (Flatpak prerequisite installed at startup) ---
BRAVE_FLATPAK_EXECUTABLE=$(type -P flatpak)
if [ "$BRAVE_FLATPAK_READY" -eq 1 ] && [ -n "$BRAVE_FLATPAK_EXECUTABLE" ]; then
  BRAVE_FLATPAK_EXECUTABLE=/usr/bin/flatpak
  BRAVE_FLATPAK_OPTIONS='"run" "--branch=stable" "--arch=x86_64" "--command=brave" "--file-forwarding" "com.brave.Browser" "@@u" "@@"'
  _add_steam_shortcut "Brave" "$BRAVE_FLATPAK_EXECUTABLE" "Browsers,Apps" "$BRAVE_FLATPAK_EXECUTABLE" "/usr/bin/" "$BRAVE_FLATPAK_OPTIONS"
  _add_url_steam_shortcut "Netflix" "https://www.netflix.com/"
  _add_url_steam_shortcut "Disney+" "https://www.disneyplus.com/"
  _add_url_steam_shortcut "Prime Video" "https://www.primevideo.com/"
  _add_url_steam_shortcut "YouTube" "https://www.youtube.com/"
  _add_url_steam_shortcut "Plex" "http://192.168.1.45:32400/web/index.html/"
  _add_url_steam_shortcut "Fav" "https://synle.github.io/fav/"
else
  echo ">>> Steam: Brave shortcuts skipped; Flatpak Brave prerequisite is missing. Continuing setup." >&2
fi

# --- Browser Extensions + tmux/vim (via the synle/bashrc installer) ---
# Installs url-porter + skippy-ff Chrome extensions, plus tmux and vim config.
tmp=$(mktemp -d) && pushd "$tmp" \
  && curl -fsSL "https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh" -o run.sh
bash run.sh --files=url-porter,skippy-ff,tmux,vim-config,vim-jetpack,vim-plug
rm -rf "$tmp"
popd

if type -P paru > /dev/null && grep -q '^ID=cachyos' /etc/os-release 2> /dev/null; then
  if [ "$DO_SYSTEM_UPGRADE" -eq 1 ]; then
    echo ">>> CachyOS with paru detected - updating AUR packages"
    paru -Syu --noconfirm
  else
    echo ">>> Skipped AUR upgrade: paru -Syu --noconfirm"
  fi
fi

# --- Limine bootloader: set menu timeout + quiet boot ---
LIMINE_CONF="/boot/limine.conf"
if [ -f "$LIMINE_CONF" ]; then
  echo ">>> Limine config found: $LIMINE_CONF"

  # Normalize quiet boot directly below the first timeout entry.
  echo ">>> Limine: setting timeout to 2 with quiet boot"
  sudo awk -v timeout=2 '
		/^[[:space:]]*quiet:/ { next }
		!done && /^[[:space:]]*timeout:/ { print "timeout: " timeout; print "quiet: yes"; done = 1; next }
		{ print }
		END { if (!done) { print "timeout: " timeout; print "quiet: yes" } }
	' "$LIMINE_CONF" | sudo tee "$LIMINE_CONF.tmp" > /dev/null && sudo mv "$LIMINE_CONF.tmp" "$LIMINE_CONF"
fi

if [ "$decky_setup_failed" -eq 1 ]; then
  echo ">>> Decky setup failed earlier; review its output and re-run this script after fixing it."
fi
echo ">>> Done. Launch each .desktop file from Desktop Mode to start installation."
echo ">>> AppImages live in $APPS_FOLDER/ - run them directly."
finish_choice=""
until _prompt "Finish and exit setup?"; do
  :
done
