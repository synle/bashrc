#! /bin/sh
# sudo echo 'This script requires sudo...'

echo """
=======================================================
= Start time: $(date)
=======================================================
"""

##########################################################
# Bootstrap the bashrc with lightweight scripts
##########################################################
export RUN_MODE=prod && \
export TEST_SCRIPT_FILES="""
  _bash-rc-bootstrap.js
  git.js
  vim-configurations.js
  vim-vundle.sh
  bash-inputrc.js
  bash-autocomplete.js
  bash-syle-content.js
" \
&& curl -s https://raw.githubusercontent.com/synle/bashrc/master/run.sh | bash

# re-source
# . ~/.bash_syle

echo """
=======================================================
= End time: $(date)
=======================================================

# to refresh to this
. ~/.bash_syle
"""
