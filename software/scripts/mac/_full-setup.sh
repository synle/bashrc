#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/mac/_full-setup.sh
# macOS dependencies - Homebrew packages, system preferences, shell setup

# SOURCE software/scripts/_full-setup.common.linux.bash

################################################################################
# ---- Install Homebrew ----
################################################################################
if ! type -P brew > /dev/null 2>&1; then
  echo ">> Installing Homebrew"
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://github.com/Homebrew/install/blob/HEAD/install.sh?raw=1)" > /dev/null 2>&1
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -f /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

# Prevent brew from auto-updating before every install — updatePackageIndex handles it explicitly
export HOMEBREW_NO_AUTO_UPDATE=1
# Skip per-install cleanup — upgradeAndCleanPackages handles it at the end
export HOMEBREW_NO_INSTALL_CLEANUP=1
# Disable analytics — removes network round-trips on each brew operation
export HOMEBREW_NO_ANALYTICS=1

# NOTE: macOS defaults write tweaks (UI, animations, performance) are in
# software/scripts/mac/_only.sh which runs as part of the software scripts phase.

################################################################################
# ---- Screenshots Directory ----
################################################################################
safe_mkdir "$HOME/Desktop/_screenshots"

################################################################################
# ---- Shell Setup (touch files) ----
################################################################################
safe_touch "$BASH_SYLE_PATH"

################################################################################
# ---- Headless Chrome Fixes ----
################################################################################
echo '>> Headless Chrome Fixes for MacOSX'
safe_mkdir "$HOME/Library/LaunchAgents"
cat << EOF > "$HOME/Library/LaunchAgents/com.user.chrome.headless.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.user.chrome.headless</string>
  <key>ProgramArguments</key>
  <array>
      <string>/bin/launchctl</string>
      <string>setenv</string>
      <string>CHROME_HEADLESS</string>
      <string>1</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF
launchctl load "$HOME/Library/LaunchAgents/com.user.chrome.headless.plist"

################################################################################
# ---- Homebrew ----
################################################################################
# Cache all installed packages once upfront — avoids spawning brew list per package (~0.5-1s each)
_BREW_INSTALLED_FORMULAE=$(brew list --formulae 2> /dev/null)
_BREW_INSTALLED_CASKS=$(brew list --cask 2> /dev/null)

# install a package via brew (skip if already installed, --app checks /Applications)
# NOTE: < /dev/null prevents brew from reading the heredoc's stdin (brew subprocesses inherit
# stdin, consuming remaining script commands and causing the heredoc bash to exit prematurely).
# Output is redirected to a log file for debugging — dumped by ~wrapup.sh in CI.
# installBrewPackage [--cask] [--app="App Name.app"] [--force] <pkg>
function installBrewPackage() {
  local pkg_name="${@: -1}"
  local is_cask=""
  local install_flags=""
  local app_name=""
  for arg in "${@:1:$#-1}"; do
    case "$arg" in
    --cask)
      is_cask="1"
      install_flags="$install_flags $arg --force"
      ;;
    --app=*) app_name="${arg#--app=}" ;;
    *) install_flags="$install_flags $arg" ;;
    esac
  done
  echo -n ">> $pkg_name >> Installing with Brew >> "
  # fast path: check /Applications directly, no brew call needed
  if [ -n "$app_name" ] && [ -d "/Applications/$app_name" ]; then
    echo "Skipped"
    return
  fi
  # fast path: check against cached installed list (no brew call needed)
  if [ -n "$is_cask" ]; then
    if echo "$_BREW_INSTALLED_CASKS" | grep -qxF "$pkg_name"; then
      echo "Skipped"
      return
    fi
  else
    if echo "$_BREW_INSTALLED_FORMULAE" | grep -qxF "$pkg_name"; then
      echo "Skipped"
      return
    fi
  fi
  local _t0=$SECONDS
  if brew install $install_flags "$pkg_name" < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
    echo "Success ($((SECONDS - _t0))s)"
  else
    echo "Error ($((SECONDS - _t0))s) (see $BASHRC_TEMP_DIR/fullsetup.log)"
  fi
}

# queue a package for background installation after essential packages finish
_BACKGROUND_INSTALL_LOG="/tmp/bashrc_bg_brew_$$.log"
_BACKGROUND_INSTALL_SCRIPT="/tmp/bashrc_bg_brew_$$.sh"
_BACKGROUND_PKG_NAMES=()
> "$_BACKGROUND_INSTALL_SCRIPT"

function installBrewPackageInBackground() {
  if ((IS_CI)); then
    echo ">> ${@: -1} >> Skipped (CI)"
    return
  fi
  _BACKGROUND_PKG_NAMES+=("${@: -1}")
  printf 'installBrewPackage' >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf ' %q' "$@" >> "$_BACKGROUND_INSTALL_SCRIPT"
  printf '\n' >> "$_BACKGROUND_INSTALL_SCRIPT"
}

# install all queued background packages in a single background subshell
function _installBackgroundPackages() {
  _BACKGROUND_INSTALL_PID=""
  if [ ! -s "$_BACKGROUND_INSTALL_SCRIPT" ]; then return; fi
  echo ">> Installing ${#_BACKGROUND_PKG_NAMES[@]} background packages (log: $_BACKGROUND_INSTALL_LOG) >> ${_BACKGROUND_PKG_NAMES[*]}"
  (
    safe_source "$_BACKGROUND_INSTALL_SCRIPT"
    rm -f "$_BACKGROUND_INSTALL_SCRIPT"
  ) > "$_BACKGROUND_INSTALL_LOG" 2>&1 &
  _BACKGROUND_INSTALL_PID=$!
}

# refresh the brew formula/cask index so installs resolve the latest versions
function updatePackageIndex() {
  echo -n ">> Updating package index >> "
  if brew update < /dev/null &>> $BASHRC_TEMP_DIR/fullsetup.log; then
    echo "Done"
  else
    echo "Error"
  fi
}

# wait for background jobs, then upgrade and clean packages in the background (fire and forget)
function upgradeAndCleanPackages() {
  echo ">> Upgrading and cleaning packages (background) >>"
  (
    brew upgrade < /dev/null
    brew cleanup < /dev/null
  ) > /dev/null 2>&1 &
}

################################################################################
# ---- Install Packages ----
################################################################################
echo ">> Begin setting up dependencies/mac/deps.sh"
if is_bash_syle_stale; then updatePackageIndex; else echo ">> Updating package index >> Skipped (not stale)"; fi

echo '>> Installing packages with Homebrew'

# ---- Core tools ----
installBrewPackage git
installBrewPackage python

# ---- CLI utilities ----
installBrewPackage make # GNU Make (gmake) 4.x+ — supports .ONESHELL (macOS ships Make 3.81 which does not)
# symlink gmake → make so `command make` and scripts use GNU Make without needing the alias
if [ -x /opt/homebrew/bin/gmake ] && [ ! -L /opt/homebrew/bin/make ]; then
  echo ">> Symlinking /opt/homebrew/bin/gmake → /opt/homebrew/bin/make"
  ln -sf /opt/homebrew/bin/gmake /opt/homebrew/bin/make
fi
installBrewPackage bash
installBrewPackage coreutils # GNU coreutils (tac, gdate, etc.) - needed by fzf-tab-completion
installBrewPackage gnu-sed   # GNU sed (gsed) - needed by fzf-tab-completion (BSD sed lacks -u flag)
installBrewPackage gawk      # GNU awk (gawk) - needed by fzf-tab-completion (BSD awk lacks -W interactive)
installBrewPackage grep      # GNU grep (ggrep) - needed by fzf-tab-completion (BSD grep -E incompatible)
installBrewPackage bat
installBrewPackage cloudflared
installBrewPackage ripgrep
installBrewPackage pv
installBrewPackage entr
installBrewPackage tmux
installBrewPackage jq
installBrewPackage shfmt
installBrewPackage yq
installBrewPackage git-delta
installBrewPackage zoxide
installBrewPackage eza
installBrewPackage fd
installBrewPackage tree
installBrewPackage tldr

# ---- Git extensions ----
installBrewPackage gh
installBrewPackage git-filter-repo
installBrewPackage git-lfs

# ---- Node.js (fnm) ----
_installFnmAndNode

# ---- Multimedia (last — large packages with many dependencies) ----
installBrewPackage imagemagick
installBrewPackage ffmpeg

# ---- Dev tools / Build ----
# NOTE: packages validated by CI binary verification must use installBrewPackage (foreground).
# installBrewPackageInBackground skips in CI, so those binaries would be missing.
installBrewPackageInBackground cmake
installBrewPackageInBackground gradle
installBrewPackageInBackground rust
installBrewPackageInBackground go
installBrewPackageInBackground --cask dotnet-sdk
installBrewPackageInBackground --cask powershell

# ---- Local LLM ----
installBrewPackageInBackground ollama

# ---- HTTP / RPC clients ----
installBrewPackageInBackground grpcurl # gRPC equivalent of curl
installBrewPackageInBackground httpie  # human-friendly HTTP client (`http GET ...`)
installBrewPackageInBackground xh      # fast Rust httpie clone (compatible CLI)

# ---- Database clients ----
installBrewPackageInBackground libpq # provides psql + pg_dump (lighter than full postgresql)
installBrewPackageInBackground mycli  # autocomplete + syntax-highlighted MySQL client
installBrewPackageInBackground mysql-client
installBrewPackageInBackground pgcli  # autocomplete + syntax-highlighted Postgres client
installBrewPackageInBackground redis
installBrewPackageInBackground sqlite

# ---- OS-specific ----
installBrewPackageInBackground --force android-platform-tools
installBrewPackageInBackground --cask font-jetbrains-mono-nerd-font
installBrewPackageInBackground java
installBrewPackageInBackground duti
installBrewPackageInBackground xz

# ---- Node.js (fnm) ----
echo -n ">> fnm >> Installing with curl >> "
if has_persistent_binary fnm &> /dev/null; then
  echo "Skipped"
else
  if curl_bash_install https://fnm.vercel.app/install --skip-shell; then
    echo "Success"
  else
    echo "Error"
  fi
fi
if type -P fnm &> /dev/null || [ -x "$FNM_DIR/fnm" ]; then
  export PATH="$FNM_DIR:$PATH"
  eval "$(fnm env)" 2> /dev/null
  if ! fnm ls "$NODE_JS_VERSION" > /dev/null 2>&1; then
    echo -n ">> Node $NODE_JS_VERSION >> Installing with fnm >> "
    if fnm install "$NODE_JS_VERSION" > /dev/null 2>&1; then
      echo "Success"
    else
      echo "Error"
    fi
  fi
  fnm default "$NODE_JS_VERSION" > /dev/null 2>&1
  fnm use "$NODE_JS_VERSION" > /dev/null 2>&1
  export FNM_DEFAULT_NODE_PATH="$FNM_DIR/node-versions/$(node -v 2> /dev/null)/installation"
fi

# ---- GUI apps (only if a display server is available) ----
installBrewPackageInBackground --cask --app="iTerm.app" iterm2
installBrewPackageInBackground --cask --app="Sublime Text.app" sublime-text
installBrewPackageInBackground --cask --app="Sublime Merge.app" sublime-merge
installBrewPackageInBackground --cask --app="Visual Studio Code.app" visual-studio-code
installBrewPackageInBackground --cask --app="Zed.app" zed

# ---- GUI apps (reinstall in background) ----
installBrewPackageInBackground --cask --force balenaetcher
installBrewPackageInBackground --cask --force blender
installBrewPackageInBackground --cask --force vlc
installBrewPackageInBackground --cask --force keka
installBrewPackageInBackground --cask --force docker

################################################################################
# ---- Shell Setup (default shell) ----
################################################################################
# Switch to Homebrew bash (5.x) if available, otherwise ensure bash is the default.
# Homebrew bash is required for bind -x (fzf-tab-completion) and other bash 4+ features.
# Also upgrades from macOS system bash (/bin/bash 3.2) to Homebrew bash.
if [ -x /opt/homebrew/bin/bash ] && [ "$SHELL" != /opt/homebrew/bin/bash ]; then
  echo ">> Set default shell as Homebrew Bash: chsh -s /opt/homebrew/bin/bash"
  if ! grep -q /opt/homebrew/bin/bash /etc/shells 2> /dev/null; then
    echo /opt/homebrew/bin/bash | sudo tee -a /etc/shells > /dev/null
  fi
  chsh -s /opt/homebrew/bin/bash "$USER"
elif [[ "$SHELL" == */bash ]]; then
  echo ">> Default shell already set to bash: $SHELL"
else
  echo ">> Set default shell as BASH (fallback): chsh -s /bin/bash"
  chsh -s /bin/bash "$USER"
fi

################################################################################
# ---- Power Management ----
################################################################################
# WARNING: hibernatemode 0 and standby 0 improve sleep/wake speed but have side effects:
#   - hibernatemode 0: RAM is NOT saved to disk on sleep. If battery fully drains, unsaved work is LOST.
#   - standby 0: Mac stays in regular sleep forever (~1-2% battery/hour). Left in a bag overnight = dead battery.
#   To revert to safe defaults: sudo pmset -a hibernatemode 3 && sudo pmset -a standby 1
_pmset_current=$(pmset -g custom 2> /dev/null)
_pmset_all=""
_pmset_ac=""
_pmset_battery=""

# queue_pmset [-a|-b|-c] <key> <value> <description>
# Queues a pmset change if the current value differs. Batched into a single sudo call per source.
# -a = all sources (default), -b = battery only, -c = charger/AC only.
function queue_pmset() {
  local flag="-a"
  if [[ "$1" == -* ]]; then
    flag="$1"
    shift
  fi
  local key="$1" val="$2" desc="$3"
  local section=""
  if [ "$flag" = "-b" ]; then section="Battery Power"; fi
  if [ "$flag" = "-c" ]; then section="AC Power"; fi
  local check_output="$_pmset_current"
  if [ -n "$section" ]; then
    check_output=$(echo "$_pmset_current" | sed -n "/$section/,/^\S/p")
  fi
  if ! echo "$check_output" | grep -q " $key[[:space:]]"; then
    echo ">> Power: $desc >> Skipped (key not supported)"
  elif echo "$check_output" | grep -q " $key[[:space:]]*$val"; then
    echo ">> Power: $desc >> Skipped (already $val)"
  else
    echo ">> Power: $desc >> Queued"
    if [ "$flag" = "-a" ]; then _pmset_all+=" $key $val"; fi
    if [ "$flag" = "-b" ]; then _pmset_battery+=" $key $val"; fi
    if [ "$flag" = "-c" ]; then _pmset_ac+=" $key $val"; fi
  fi
}

# ---- Sleep & Wake ----
queue_pmset hibernatemode 0 "Disable hibernation (faster sleep/wake)"
queue_pmset standby 0 "Disable standby (instant wake)"
queue_pmset autopoweroff 0 "Disable auto power off (prevents USB dock disconnects)"

# ---- USB & Device Power ----
queue_pmset lowpowermode 0 "Disable Low Power Mode (prevents USB/CPU throttling)"
queue_pmset -c disksleep 0 "AC: disable disk sleep (prevents USB disk disconnects)"
queue_pmset -b disksleep 180 "Battery: disk sleep after 180 min (must be non-zero when sleep is non-zero)"
queue_pmset powernap 0 "Disable Power Nap (prevents periodic wakes)"

# ---- Display & Sleep Timeouts ----
queue_pmset lessbright 0 "Disable display dimming on battery"
queue_pmset -c sleep 0 "AC: disable sleep (never)"
queue_pmset -c displaysleep 0 "AC: disable display sleep (never)"
queue_pmset -b sleep 180 "Battery: sleep after 180 min (3 hours)"
queue_pmset -b displaysleep 180 "Battery: display off after 180 min (3 hours)"

# ---- Network & Wake Triggers ----
queue_pmset womp 0 "Disable wake for network access (better battery)"
queue_pmset proximitywake 0 "Disable proximity wake (prevents spurious wakes)"
queue_pmset tcpkeepalive 0 "Disable TCP keepalive during sleep (better battery)"

# flush all queued pmset changes in up to 3 sudo calls (one per power source)
if [ -n "$_pmset_all" ]; then
  echo ">> Power: Applying all-source changes:$_pmset_all"
  sudo pmset -a $_pmset_all
fi
if [ -n "$_pmset_ac" ]; then
  echo ">> Power: Applying AC-only changes:$_pmset_ac"
  sudo pmset -c $_pmset_ac
fi
if [ -n "$_pmset_battery" ]; then
  echo ">> Power: Applying battery-only changes:$_pmset_battery"
  sudo pmset -b $_pmset_battery
fi

unset _pmset_current

################################################################################
# ---- Cleanup ----
################################################################################
if is_force_refresh_stale && [ ! -f "$BASH_SYLE_COMMON_PATH" ]; then
  echo '>> Kill all dock icons'
  defaults write com.apple.dock persistent-apps -array
  killall Dock

  # disable spotlight indexing (background), skip if already disabled
  if mdutil -s / 2> /dev/null | grep -q 'Indexing enabled'; then
    echo '>> Disable spotlight indexing (background) >>'
    (sudo mdutil -i off) > /dev/null 2>&1 &
  fi
fi

################################################################################
# ---- iTerm / Terminal Setup ----
################################################################################
if [ -f /etc/pam.d/sudo_local.template ] && ! grep -q '^auth' /etc/pam.d/sudo_local 2> /dev/null; then
  echo '>> iTerm TouchID sudo'
  sudo cp /etc/pam.d/sudo_local.template /etc/pam.d/sudo_local
  sudo sed -i '' 's/^#auth/auth/' /etc/pam.d/sudo_local
fi
defaults write com.googlecode.iterm2 CustomToolTip -string "No"

################################################################################
# ---- Background Install and Upgrade ----
################################################################################
_installBackgroundPackages
_waitForBackgroundPackages
if is_bash_syle_stale; then upgradeAndCleanPackages; else echo ">> Upgrading and cleaning packages >> Skipped (not stale)"; fi
