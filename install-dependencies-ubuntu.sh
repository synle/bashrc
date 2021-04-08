#! /bin/sh
# os flags are set in this file
# https://github.com/synle/bashrc/blob/master/bash-profile-barebone.sh

function installPackageWithAptGet(){
  echo "  >> $@"
  sudo apt-get install -y --fix-missing $@ &> /dev/null
}

if [ $is_os_ubuntu == "1" ]
then
  # non traditional (not in apt-get)
  pushd /tmp  &> /dev/null

  #
  # bat https://github.com/sharkdp/bat
  #
  echo '>> Installing bat'
  wget https://github.com/sharkdp/bat/releases/download/v0.6.1/bat_0.6.1_amd64.deb &>/dev/null
  sudo dpkg -i bat_0.6.1_amd64.deb &>/dev/null
  wget https://github.com/sharkdp/bat/releases/download/v0.6.1/bat_0.6.1_i386.deb &>/dev/null
  sudo dpkg -i bat_0.6.1_i386.deb &>/dev/null

  popd &> /dev/null

#   TODO: fix me
#   dbus-uuidgen > /tmp/machine-id
#   sudo mv /tmp/machine-id /etc/machine-id



echo '>> update packages'
sudo apt-get update -y &> /dev/null;


echo '>> Installing packages with apt-get'
installPackageWithAptGet git;
installPackageWithAptGet vim;
installPackageWithAptGet tmux;
installPackageWithAptGet python;
installPackageWithAptGet tig;
installPackageWithAptGet jq;
installPackageWithAptGet figlet;
installPackageWithAptGet curl;
installPackageWithAptGet redis-server;
#   installPackageWithAptGet dialog;

  ##########################################################################################################
  # ubuntu gui tweaks
  ##########################################################################################################
  echo '>> Installing lubuntu-rc tweak'
  [ -s $HOME/.config/openbox/lubuntu-rc.xml ] && \
  sed -i "s/<animateIconify>yes<\/animateIconify>/<animateIconify>no<\/animateIconify>/g" \
  $HOME/.config/openbox/lubuntu-rc.xml
fi
