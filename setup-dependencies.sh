#! /bin/sh
echo """
=======================================================
= Start time: $(date)
=======================================================
"""

echo '>> loading...'
. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/bash-profile-barebone.sh)"

echo '>> checking if we have all the minimal deps before starting'

if [ ! -f ~/.ssh/id_rsa ]; then
  echo '  >> set up ssh keygen id_rsa'
  ssh-keygen -q -t rsa -N '' -f ~/.ssh/id_rsa
fi

echo '>> started installing dependencies...'

if [ $is_os_darwin_mac == "1" ]; then
  echo '>> started install-dependencies-mac.sh'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/install-dependencies-mac.sh | bash -
elif [ $is_os_chromeos == "1" ]; then
  echo '>> started install-dependencies-chrome-os-linux.sh'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/install-dependencies-chrome-os-linux.sh | bash -
elif [ $is_os_android_termux == "1" ]; then
  echo '>> started install-dependencies-android-termux.sh'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/install-dependencies-android-termux.sh | bash -
elif [ $is_os_steamdeck == "1" ]; then
  echo '>> started install-dependencies-arch-linux-steam-deck.sh'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/install-dependencies-arch-linux-steam-deck.sh | bash -
elif [ $is_os_ubuntu == "1" ]; then
  echo '>> started install-dependencies-ubuntu.sh'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/install-dependencies-ubuntu.sh | bash -
else
  echo '>> skipped - This OS is not supported'
fi

# if windows (note that we separate it from the Ubuntu block for WSL)
if [ $is_os_window == "1" ]
then
  echo '>> started install-dependencies-windows.sh'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/install-dependencies-windows.sh | bash -
fi

##########################################################
echo -e """
=======================================================
= End time: $(date)
=======================================================
"""
