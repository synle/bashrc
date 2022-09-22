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
  ecoh '>> Animation tweaks'
  # settings to speed up
  # https://gist.github.com/kidpixo/78b9a40ab58e026cf9a432573e27ced5
  #1. Disable animations when opening and closing windows.
  defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false

  #2. Disable animations when opening a Quick Look window.
  defaults write -g QLPanelAnimationDuration -float 0

  #3. Accelerated playback when adjusting the window size (Cocoa applications).
  defaults write NSGlobalDomain NSWindowResizeTime -float 0.001

  #4. Disable animation when opening the Info window in Finder (cmd⌘ + i).
  defaults write com.apple.finder DisableAllAnimations -bool true

  #5. Disable animations when you open an application from the Dock.
  defaults write com.apple.dock launchanim -bool false

  #6. Make all animations faster that are used by Mission Control.
  defaults write com.apple.dock expose-animation-duration -float 0.1

  #7. Disable the delay when you hide the Dock
  defaults write com.apple.Dock autohide-delay -float 0
  #Mail applicatie

  #8. Disable the animation when you sending and replying an e-mail
  defaults write com.apple.mail DisableReplyAnimations -bool true
  defaults write com.apple.mail DisableSendAnimations -bool true

  #9. Disable the standard delay in rendering a Web page.
  defaults write com.apple.Safari WebKitInitialTimedLayoutDelay 0.25

  echo '>> Set default shell as BASH (Catalina Mods): chsh -s /bin/bash'
  touch ~/.bashrc
  touch ~/.bash_profile
  
  if ! grep -q "source ~/.bashrc" ~/.bash_profile; then
     echo 'source ~/.bashrc' >> ~/.bash_profile
  fi

  chsh -s /bin/bash

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
  installPackage jq
  installPackage pv
  installPackage fd
  installPackage exa
  installPackage zoxide
  installPackage entr
  installPackage java
  installPackage python
  installPackage keka # zip
  installPackage kap # screen recording  

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
