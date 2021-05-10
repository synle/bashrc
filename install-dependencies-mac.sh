#! /bin/sh
# os flags are set in this file
# https://github.com/synle/bashrc/blob/master/bash-profile-barebone.sh

function installMacPackageWithHomebrew(){
  echo "  >> $@"
  brew install $@ &> /dev/null
  brew cask install &> /dev/null
}

if [[ $is_os_darwin_mac == "1" ]]
then
  touch ~/.bash_profile;

  ####################################################################
  # homebrew
  ####################################################################
  hasHomebrewInstalled=1
  type brew &> /dev/null || hasHomebrewInstalled=0
  if [[ $hasHomebrewInstalled == "0" ]]
  then
    echo ">> Installing Homebrew Package Manager"
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  fi


  echo '>> Installing homebrew repos (brew tap)'
  brew tap homebrew/cask-fonts &> /dev/null
  brew tap heroku/brew &> /dev/null

  echo '>> update homebrew formulae'
  brew update &> /dev/null


  echo '>> Installing packages with Homebrew'
  installMacPackageWithHomebrew jq;
  installMacPackageWithHomebrew fzf;
  installMacPackageWithHomebrew tig;
  installMacPackageWithHomebrew bat;
  installMacPackageWithHomebrew azure-cli;
  installMacPackageWithHomebrew heroku;

  echo ">> Installing android-platform-tools"
  installMacPackageWithHomebrew android-platform-tools

  echo ">> Installing Fira Code Font"
  installMacPackageWithHomebrew font-fira-code

  echo '>> Kill all dock icons'
  defaults write com.apple.dock persistent-apps -array
  killall Dock

  echo ">> Set default shell as BASH (Catalina Mods)"
  chsh -sh /bin/bash
  touch ~/.bashrc
  touch ~/.bash_profile

  echo '''
source ~/.bashrc
''' >> ~/.bash_profile
fi
