#! /bin/sh
# os flags are set in this file
# https://github.com/synle/bashrc/blob/master/bash-profile-barebone.sh

if [ "$is_os_chromeos" = "1" ]; then
##########################################################
# ChromeOS Linux Dependencies
##########################################################
sudo apt-get update -y

sudo apt-get install -y \
  curl \
  git \
  libreoffice \
  make \
  nautilus \
  python \
  remmina \
  terminator \
  vim \
  vlc \
&& echo '> Done Installing Dependencies...'
fi
