#!/usr/bin/env bash
# diff-so-fancy and integration with git

if [ "$is_os_android_termux" = "1" ]; then
  DEST_PATH="/data/data/com.termux/files/usr/bin/diff-so-fancy"
else
  DEST_PATH="/usr/local/bin/diff-so-fancy"
fi

# Skip download if already installed (unless force refresh)
if [ -f "$DEST_PATH" ] && [ "$IS_FORCE_REFRESH" != "1" ]; then
  echo ">> diff-so-fancy already installed, skipping: $DEST_PATH"
else
  echo '>> Installing diff-so-fancy: ' $DEST_PATH;
  TEMP_PATH=/tmp/diff-so-fancy
  rm -rf $TEMP_PATH
  curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/binaries/diff-so-fancy" > $TEMP_PATH
  chmod +x $TEMP_PATH
  if [ "$is_os_android_termux" = "1" ]; then
    mv $TEMP_PATH $DEST_PATH
  else
    sudo mv $TEMP_PATH $DEST_PATH
  fi
fi

git config --global core.pager "diff-so-fancy | less --tabs=4 -RFX"
