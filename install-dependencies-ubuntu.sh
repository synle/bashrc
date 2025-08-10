#! /bin/sh
# os flags are set in this file
# https://github.com/synle/bashrc/blob/master/bash-profile-barebone.sh

function installPackage(){
  echo "  >> $@"
  sudo apt-get install -y --fix-missing $@ &> /dev/null
}

if [ $is_os_ubuntu == "1" ]
then
  # non traditional (not in apt-get)
  pushd /tmp  &> /dev/null

  # bat https://github.com/sharkdp/bat
  # echo '>> Installing bat'
  # wget https://github.com/sharkdp/bat/releases/download/v0.18.3/bat_0.18.3_amd64.deb &>/dev/null
  # sudo dpkg -i bat_*_amd64.deb &>/dev/null

  popd &> /dev/null

  echo '>> update packages'
  sudo apt-get update -y &> /dev/null


  echo '>> Installing packages with apt-get'
  # installPackage dialog
  # installPackage figlet
  # installPackage redis-server
  # installPackage tig
  # installPackage tmux
  ###
  installPackage curl
  installPackage make
  installPackage python
  installPackage vim
  ###
  installPackage bat
  installPackage fzf
  installPackage git
  installPackage pv
  installPackage net-tools
  ###
  installPackage default-jdk
  # installPackage maven
  installPackage unzip
  installPackage entr

  ###
  installPackage openssh-server

  installPackage gnupg
  installPackage software-properties-common
  installPackage build-essential

  ### Add you to the input group
  sudo usermod -aG input ${USER}
  sudo usermod -aG video ${USER}

fi
