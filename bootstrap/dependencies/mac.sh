# bootstrap/dependencies/mac.sh
# macOS dependencies - Homebrew packages, system preferences, shell setup

installPackage() {
  echo "  >> $@"
  brew install $@ &> /dev/null
  brew cask install &> /dev/null
}

if [ "$is_os_mac" = "1" ]; then
  echo ">> Begin setting up dependencies/mac.sh"

  echo ">> Mac UI & System Optimization..."

  # ---- Window Animations ----
  defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false # Disable opening/closing window animations
  defaults write -g QLPanelAnimationDuration -float 0 # Disable Quick Look fade-in/out
  defaults write NSGlobalDomain NSWindowResizeTime -float 0.001 # Accelerate window resizing (Cocoa apps)
  defaults write com.apple.finder DisableAllAnimations -bool true # Disable Finder animations (Info windows, etc.)

  # ---- Dock & Mission Control ----
  defaults write com.apple.dock launchanim -bool false # Disable Dock opening animations
  defaults write com.apple.dock expose-animation-duration -float 0.1 # Speed up Mission Control animations
  defaults write com.apple.dock autohide-delay -float 0 # Remove Dock hide/show delay
  defaults write com.apple.dock autohide-time-modifier -float 0.1 # Speed up the animation of showing the Dock

  # ---- Safari & Web ----
  defaults write com.apple.Safari WebKitInitialTimedLayoutDelay -float 0.1 # Reduce rendering delay

  # ---- System & Finder Behaviors ----
  defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true # Disable .DS_Store on network volumes
  defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true # Disable .DS_Store on USB volumes
  defaults write -g NSScrollAnimationEnabled -bool false # Disable smooth scrolling
  defaults write -g NSAutoFillHeuristicControllerEnabled -bool false # Disable predictive features to save CPU
  defaults write -g NSAutoHeuristicEnabled -bool false
  defaults write com.apple.LaunchServices LSQuarantine -bool false # Disable "Are you sure?" dialog
  defaults write com.apple.finder _FXShowPosixPathInTitle -bool true # Show full POSIX path in Finder title bar
  defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false # Disable file extension change warning

  # ---- Mouse / Trackpad Speed ----
  defaults write -g com.apple.mouse.scaling -float 3 # Increase mouse tracking speed
  defaults write -g com.apple.trackpad.scaling -float 3 # Increase trackpad tracking speed

  # ---- Key Repeat Speed ----
  defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false # Disable press-and-hold for faster key repeat
  defaults delete NSGlobalDomain KeyRepeat
  defaults delete NSGlobalDomain InitialKeyRepeat

  ################################################################################
  # ---- Misc Performance ----
  ################################################################################
  echo ">> Misc Performance tweaks..."

  # Reduce transparency effects (less compositing overhead)
  defaults write com.apple.universalaccess reduceTransparency -bool true

  # Disable automatic termination of inactive apps
  defaults write NSGlobalDomain NSDisableAutomaticTermination -bool true

  # Disable Resume system-wide (don't reopen windows on login)
  defaults write com.apple.systempreferences NSQuitAlwaysKeepsWindows -bool false

  # Disable auto-correct and smart features that add input lag
  defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false

  # Disable the crash reporter dialog
  defaults write com.apple.CrashReporter DialogType -string "none"

  # Auto-hide Dock for snappier response
  defaults write com.apple.dock autohide -bool true

  # Disable Time Machine prompts for new disks
  defaults write com.apple.TimeMachine DoNotOfferNewDisksForBackup -bool true

  # Disable Spotlight indexing for faster disk I/O (re-enable with mdutil -i on /)
# sudo mdutil -i off / > /dev/null 2>&1

  echo "  >> Restarting affected services..."
  for app in "Dock" "Finder" "Mail" "Safari" "SystemUIServer"; do
    killall "$app" > /dev/null 2>&1
  done
  echo "  >> Done"

  ################################################################################
  # ---- Shell Setup ----
  ################################################################################
  echo '>> Set default shell as BASH (Catalina Mods): chsh -s /bin/bash'
  touch "$BASH_SYLE_PATH" ~/.bash_profile ~/.bashrc
  chown "$USER" "$BASH_SYLE_PATH" ~/.bash_profile ~/.bashrc

  echo '>> Change Shell to bash: $USER'
  if [ "$SHELL" != "/bin/bash" ]; then
    chsh -s /bin/bash "$USER"
  fi

  ################################################################################
  # ---- Headless Chrome Fixes ----
  ################################################################################
  echo '>> Headless Chrome Fixes for MacOSX'
  mkdir -p ~/Library/LaunchAgents
cat <<EOF > ~/Library/LaunchAgents/com.user.chrome.headless.plist
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
  launchctl load ~/Library/LaunchAgents/com.user.chrome.headless.plist

  ################################################################################
  # ---- Homebrew ----
  ################################################################################
  hasHomebrewInstalled=1
  type brew &> /dev/null || hasHomebrewInstalled=0
  if [ "$hasHomebrewInstalled" = "0" ]; then
    echo '>> Installing Homebrew Package Manager'
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi

  echo '>> Installing homebrew repos (brew tap)'
  brew tap homebrew/cask-fonts &> /dev/null

  echo '>> Update Homebrew'
  brew update &> /dev/null

  ################################################################################
  # ---- Install Packages ----
  ################################################################################
  echo '>> Installing packages with Homebrew'
  installPackage bat
  installPackage fzf
  installPackage git
  installPackage pv
  installPackage entr
  installPackage java
  installPackage python
  installPackage android-platform-tools
  installPackage font-fira-code
  installPackage font-cascadia

  ################################################################################
  # ---- Cleanup ----
  ################################################################################
  if [ "$IS_FORCE_REFRESH" = "1" ] || [ ! -f "$BASH_SYLE_COMMON" ]; then
    echo '>> Kill all dock icons'
    defaults write com.apple.dock persistent-apps -array
    killall Dock
  fi

  # disable spotlight indexing
  echo '>> Disable spotlight indexing'
  sudo mdutil -i off

else
  echo ">> Skipped dependencies/mac.sh"
fi
