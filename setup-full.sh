#! /bin/sh
sudo echo 'This script requires sudo...'

echo """
=======================================================
= Start time: $(date)
=======================================================
"""

echo '>> Loading synle/bashrc script from upstream...'
. /dev/stdin <<< "$(curl -s $SY_REPO_PREFIX/bash-profile-barebone.sh?$(date +%s))"

###########################################################
if [ $is_os_android_termux == "1" ]; then
  echo '>> Running one time setup script for Android Termux'
else
  echo '>> Running one time setup script for System'
  . /dev/stdin <<< "$(curl -s curl -s $SY_REPO_PREFIX/bash-first-and-only-one-time.sh?$(date +%s))"
fi

curl -s $SY_REPO_PREFIX/test-full-run-live.sh | bash


##########################################################
echo -e """
=======================================================
= End time: $(date)
=======================================================

# to refresh to this
. ~/.bash_syle
"""
