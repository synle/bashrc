#! /bin/sh
# os flags are set in this file
# https://github.com/synle/bashrc/blob/master/bash-profile-barebone.sh

function installPackage(){
  echo "  >> $@"
  sudo apt-get install -y --fix-missing $@ &> /dev/null
}

if [ $is_os_ubuntu == "1" ]
then
  ##########################################################
  # Update Packages
  ##########################################################
  echo '>> update packages'
  sudo apt-get update -y &> /dev/null

  ##########################################################
  # Install Packages
  ##########################################################
  echo '>> Installing packages with apt-get'

  # Core tools
  installPackage curl
  installPackage make
  installPackage python
  installPackage vim

  # CLI utilities
  installPackage bat
  installPackage fzf
  installPackage git
  installPackage pv
  installPackage net-tools

  # Development tools
  installPackage default-jdk
  installPackage unzip
  installPackage entr

  # Server / Network
  installPackage openssh-server

  # Build essentials
  installPackage gnupg
  installPackage software-properties-common
  installPackage build-essential

  ##########################################################
  # User Permissions
  ##########################################################
  sudo usermod -aG input ${USER}
  sudo usermod -aG video ${USER}
fi
