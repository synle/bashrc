#! /bin/sh
# os flags are set in this file
# https://github.com/synle/bashrc/blob/master/bash-profile-barebone.sh

function installPackage(){
  echo "  >> $@"
  brew install $@ &> /dev/null
  brew cask install &> /dev/null
}

if [[ $is_os_darwin_mac == "1" ]]
then
  ##########################################################
  # macOS UI & System Optimization
  ##########################################################
  echo ">> Mac UI & System Optimization..."

  # Window animations
  defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false
  defaults write -g QLPanelAnimationDuration -float 0
  defaults write NSGlobalDomain NSWindowResizeTime -float 0.001
  defaults write com.apple.finder DisableAllAnimations -bool true

  # Dock & Mission Control
  defaults write com.apple.dock launchanim -bool false
  defaults write com.apple.dock expose-animation-duration -float 0.1
  defaults write com.apple.dock autohide-delay -float 0
  defaults write com.apple.dock autohide-time-modifier -float 0.1

  # Safari & Web
  defaults write com.apple.Safari WebKitInitialTimedLayoutDelay -float 0.1

  # System & Finder Behaviors
  defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
  defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true
  defaults write -g NSScrollAnimationEnabled -bool false
  defaults write -g NSAutoFillHeuristicControllerEnabled -bool false
  defaults write -g NSAutoHeuristicEnabled -bool false
  defaults write com.apple.LaunchServices LSQuarantine -bool false

  # Mouse / Trackpad speed
  defaults write -g com.apple.mouse.scaling -float 3
  defaults write -g com.apple.trackpad.scaling -float 3

  # Key Repeat Speed
  defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false
  defaults write NSGlobalDomain KeyRepeat -int 1
  defaults write NSGlobalDomain InitialKeyRepeat -int 10

  # Finder
  defaults write com.apple.finder _FXShowPosixPathInTitle -bool true
  defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

  echo "  >> Restarting affected services..."
  for app in "Dock" "Finder" "Mail" "Safari" "SystemUIServer"; do
      killall "$app" > /dev/null 2>&1
  done
  echo "  >> Done"

  ##########################################################
  # Shell Setup
  ##########################################################
  if ! grep -q "source ~/.bashrc" ~/.bash_profile; then
     echo 'source ~/.bashrc' >> ~/.bash_profile
  fi

  echo '>> Set default shell as BASH (Catalina Mods): chsh -s /bin/bash'
  touch ~/.bashrc
  touch ~/.bash_profile

  echo '>> Change Shell to bash'
  chsh -s /bin/bash

  ##########################################################
  # Headless Chrome Fixes
  ##########################################################
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

  ##########################################################
  # Homebrew
  ##########################################################
  hasHomebrewInstalled=1
  type brew &> /dev/null || hasHomebrewInstalled=0
  if [[ $hasHomebrewInstalled == "0" ]]
  then
    echo '>> Installing Homebrew Package Manager'
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi

  echo '>> Installing homebrew repos (brew tap)'
  brew tap homebrew/cask-fonts &> /dev/null

  echo '>> Update Homebrew'
  brew update &> /dev/null

  ##########################################################
  # Install Packages
  ##########################################################
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

  ##########################################################
  # Cleanup
  ##########################################################
  echo '>> Kill all dock icons'
  defaults write com.apple.dock persistent-apps -array
  killall Dock

  # disable spotlight indexing
  sudo mdutil -i off
fi
