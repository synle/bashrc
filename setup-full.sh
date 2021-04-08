#! /bin/sh
sudo echo 'This script requires sudo...'

echo """
=======================================================
= Start time: $(date)
=======================================================
"""

echo '>> Loading synle/bashrc script from upstream...'
. /dev/stdin <<< "$(curl -s https://raw.githubusercontent.com/synle/bashrc/master/bash-profile-barebone.sh?$(date +%s))"

echo """
=======================================================
=  is_os_darwin_mac : $is_os_darwin_mac
=  is_os_window : $is_os_window
=  is_os_ubuntu : $is_os_ubuntu
=  is_os_mingw64 : $is_os_mingw64
=======================================================
"""

###########################################################
export TEST_SCRIPT_FILES="""etc-hosts.su.js"""; curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-full-run-live.sh | bash


##########################################################
echo -e """
=======================================================

>> End time: $(date)...
"""

. ~/.bash_syle
