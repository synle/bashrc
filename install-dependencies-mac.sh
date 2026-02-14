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
  #!/bin/bash

  echo ">> Mac UI & System Optimization..."

  # begin mac tweaks
  defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false # Disable opening/closing window animations
  defaults write -g QLPanelAnimationDuration -float 0 # Disable Quick Look fade-in/out
  defaults write NSGlobalDomain NSWindowResizeTime -float 0.001 # Accelerate window resizing (Cocoa apps)
  defaults write com.apple.finder DisableAllAnimations -bool true # Disable Finder animations (Info windows, etc.)
  # --- Dock & Mission Control ---
  defaults write com.apple.dock launchanim -bool false # Disable Dock opening animations
  defaults write com.apple.dock expose-animation-duration -float 0.1 # Speed up Mission Control animations
  defaults write com.apple.dock autohide-delay -float 0 # Remove Dock hide/show delay
  defaults write com.apple.dock autohide-time-modifier -float 0.1 # Speed up the animation of showing the Dock
  # --- Safari & Web ---
  defaults write com.apple.Safari WebKitInitialTimedLayoutDelay -float 0.1 # Reduce rendering delay (making pages feel like they load faster)
  # --- System & Finder Behaviors ---
  defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true # Disable .DS_Store on network and USB volumes (Prevents lag on external drives)
  defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true
  defaults write -g NSScrollAnimationEnabled -bool false # Disable smooth scrolling (Saves GPU cycles on older hardware)
  defaults write -g NSAutoFillHeuristicControllerEnabled -bool false # Disable "Heuristic" predictive features to save CPU
  defaults write -g NSAutoHeuristicEnabled -bool false
  defaults write com.apple.LaunchServices LSQuarantine -bool false # Disable the "Are you sure you want to open this app?" dialog
  defaults write -g com.apple.mouse.scaling -float 3 # Increase trackpad/mouse tracking speed beyond the slider limit
  defaults write -g com.apple.trackpad.scaling -float 3
  # Disable the delay when typing (Key Repeat Speed)
  defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false # This makes the cursor fly across the screen when holding a key
  defaults write NSGlobalDomain KeyRepeat -int 1
  defaults write NSGlobalDomain InitialKeyRepeat -int 10
  defaults write com.apple.finder _FXShowPosixPathInTitle -bool true # Disable window animations and "Get Info" animations in Finder
  defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false
  # end mac tweaks

  echo "  >> Restarting affected services..."
  for app in "Dock" "Finder" "Mail" "Safari" "SystemUIServer"; do
      killall "$app" > /dev/null 2>&1
  done
  echo "  >> Done"

  if ! grep -q "source ~/.bashrc" ~/.bash_profile; then
     echo 'source ~/.bashrc' >> ~/.bash_profile
  fi

  echo '>> Set default shell as BASH (Catalina Mods): chsh -s /bin/bash'
  touch ~/.bashrc
  touch ~/.bash_profile

  echo '>> Change Shell to bash'
  chsh -s /bin/bash

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

  ####################################################################
  # homebrew
  ####################################################################
  hasHomebrewInstalled=1
  type brew &> /dev/null || hasHomebrewInstalled=0
  if [[ $hasHomebrewInstalled == "0" ]]
  then
    echo '>> Installing Homebrew Package Manager'
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi


  echo '>> Installing homebrew repos (brew tap)'
  brew tap homebrew/cask-fonts &> /dev/null
  # brew tap heroku/brew &> /dev/null

  echo '>> Update Homebrew'
  brew update &> /dev/null


  echo '>> Installing packages with Homebrew'
  # installPackage azure-cli
  # installPackage heroku
  # installPackage tig
  installPackage bat
  installPackage fzf
  installPackage git
  installPackage pv
  installPackage entr
  installPackage java
  installPackage python
#   installPackage keka # zip
#   installPackage kap # screen recording

  echo '  >> android-platform-tools'
  installPackage android-platform-tools

  echo '  >> Fira Font'
  installPackage font-fira-code

  echo '  >> Cascadia Font'
  installPackage font-cascadia

  echo '>> Kill all dock icons'
  defaults write com.apple.dock persistent-apps -array
  killall Dock

  # disable spotlight indexing
  sudo mdutil -i off
fi
