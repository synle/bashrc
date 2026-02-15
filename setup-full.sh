#! /bin/sh
sudo echo 'This script requires sudo...'

echo """
=======================================================
= Start time: $(date)
=======================================================
"""

##########################################################
# Load barebone bash profile
##########################################################
echo '>> Loading synle/bashrc script from upstream...'
. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/bash-profile-barebone.sh?$(date +%s))"

##########################################################
# One time setup (skip for Android Termux)
##########################################################
if [ $is_os_android_termux == "1" ]; then
  echo '>> [Skipped] Running one time setup script for Android Termux'
else
  echo '>> Running one time setup script for System'
  . /dev/stdin <<< "$(curl -s curl -s https://raw.githubusercontent.com/synle/bashrc/master/bash-first-and-only-one-time.sh?$(date +%s))"
fi

##########################################################
# Run full test suite
##########################################################
curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-full-run-live.sh | bash

##########################################################
echo -e """
=======================================================
= End time: $(date)
=======================================================

# to refresh to this
. ~/.bash_syle
"""
