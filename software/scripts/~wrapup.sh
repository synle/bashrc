#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Final wrapup - profile sourcing

echo '
# Source .bash_syle
[ -f ~/.bash_syle ] && . ~/.bash_syle
'

# Final cleanup - macOS Finder junk (.DS_Store, ._* AppleDouble sidecars) inside the
# config folders this repo writes to. Finder drops a .DS_Store into any folder it is
# pointed at, and these folders get opened by hand often enough (skills, commands,
# instructions) that the junk accumulates and shows up as noise in `ls` and in any
# folder-scanning deploy loop. clean_junk_macosx_files no-ops off mac and on a missing
# folder, so no is_os_mac guard is needed here.
for junk_folder in \
  "$HOME/.claude" \
  "$HOME/.copilot" \
  "$HOME/.gemini" \
  "$HOME/.config/opencode" \
  "$HOME/.agents" \
  "${LLM_ROOT_FOLDER}"; do
  clean_junk_macosx_files "$junk_folder"
done

# dump fullsetup log in CI for debugging package install errors
if ((IS_CI)) && [ -f "$BASHRC_TEMP_DIR/fullsetup.log" ]; then
  echo ">> fullsetup.log ($BASHRC_TEMP_DIR/fullsetup.log)"
  cat "$BASHRC_TEMP_DIR/fullsetup.log"
fi
