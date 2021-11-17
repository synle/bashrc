#! /bin/sh
# sudo echo 'This script requires sudo...'

echo """
=======================================================
= Start time: $(date)
=======================================================
"""

# bootstrap the bashrc
export TEST_SCRIPT_FILES="""
  _bash-rc-bootstrap.js
  git.js
  vim-configurations.js
  vim-vundle.sh
  bash-inputrc.js
  bash-autocomplete.js
  bash-syle-content.js
" \
&& curl -s $SY_REPO_PREFIX/test-live.sh | bash

# re-source
# . ~/.bash_syle

echo """
=======================================================
= End time: $(date)
=======================================================

# to refresh to this
. ~/.bash_syle
"""
