#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Final wrapup - profile sourcing

echo '
# Source .bash_syle
[ -f ~/.bash_syle ] && . ~/.bash_syle
'

# dump fullsetup log in CI for debugging package install errors
if ((IS_CI)) && [ -f "$BASHRC_TEMP_DIR/fullsetup.log" ]; then
  echo ">> fullsetup.log ($BASHRC_TEMP_DIR/fullsetup.log)"
  cat "$BASHRC_TEMP_DIR/fullsetup.log"
fi
