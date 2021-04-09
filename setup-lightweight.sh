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
  vim.js
  vundle.js
  bash-inputrc.js
  bash-autocomplete.js
  bash-syle-content.js
" \
&& curl -s https://raw.githubusercontent.com/synle/bashrc/master/test-live.sh | bash

# re-source
# . ~/.bash_syle

echo """
=======================================================

>> End time: $(date)...
"""
