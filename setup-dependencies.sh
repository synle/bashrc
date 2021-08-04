#! /bin/sh
echo '>> loading...'
. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/bash-profile-barebone.sh)"
clear

### Print OS Environments
node -e """
  console.log('===================== OS Flags ========================');
  Object.keys(process.env)
    .filter(envKey => envKey.indexOf('is_os_') === 0)
    .forEach(envKey => console.log('= ', envKey + ': ', process.env[envKey]))
  console.log('=======================================================');
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
