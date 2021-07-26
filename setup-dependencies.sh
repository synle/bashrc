#! /bin/sh
echo '>> loading...'
. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/bash-profile-barebone.sh)"
clear

echo """
=======================================================
=  is_os_darwin_mac     : $is_os_darwin_mac
=  is_os_window         : $is_os_window
=  is_os_ubuntu         : $is_os_ubuntu
=  is_os_chromeos       : $is_os_chromeos
=  is_os_mingw64        : $is_os_mingw64
=  is_os_android_termux : $is_os_android_termux
=======================================================
"""

echo '>> started installing dependencies...'

if [ $is_os_darwin_mac == "1" ]; then
  echo '>> started install-dependencies-mac.sh'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/install-dependencies-mac.sh | bash -
elif [ $is_os_chromeos == "1" ]; then
  echo '>> started install-dependencies-chrome-os-linux.sh'
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/install-dependencies-chrome-os-linux.sh | bash -
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
\e[31m
=======================================================

>> Done...
\e[m
"""
