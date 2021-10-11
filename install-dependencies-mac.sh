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
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  fi


  echo '>> Installing homebrew repos (brew tap)'
  brew tap homebrew/cask-fonts &> /dev/null
  # brew tap heroku/brew &> /dev/null

  echo '>> Update Homebrew'
  brew update &> /dev/null


  echo '>> Installing packages with Homebrew'
  # installPackage azure-cli;
  # installPackage heroku;
  # installPackage tig;
  installPackage bat;
  installPackage fzf;
  installPackage git;
  installPackage jq;

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
