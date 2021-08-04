#! /bin/sh
sudo echo 'This script requires sudo...'

echo """
=======================================================
= Start time: $(date)
=======================================================
"""

echo '>> Loading synle/bashrc script from upstream...'
. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/bash-profile-barebone.sh?$(date +%s))"

### Print OS Environments
node -e """
  console.log('===================== OS Flags ========================');
  Object.keys(process.env)
    .filter(envKey => envKey.indexOf('is_os_') === 0)
    .forEach(envKey => console.log('= ', envKey + ': ', process.env[envKey]))
  console.log('=======================================================');
"""

###########################################################
if [ $is_os_android_termux == "1" ]; then
  echo '>> Running one time setup script for Android Termux'
else
  echo '>> Running one time setup script for System'
  . /dev/stdin <<< "$(curl -s curl -s https://raw.githubusercontent.com/synle/bashrc/master/bash-first-and-only-one-time.sh?$(date +%s))"
fi

curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-full-run-live.sh | bash


##########################################################
echo -e """
=======================================================

>> End time: $(date)...

# to refresh to this
. ~/.bash_syle
"""
