#!/usr/bin/env bash

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }

DEST_PATH=/opt/jq

# Force refresh: remove existing binary
if [ "$IS_FORCE_REFRESH" == "1" ] && [ -f "$DEST_PATH" ]; then
  echo ">> Force refresh: removing $DEST_PATH"
  sudo rm "$DEST_PATH"
fi

# Skip if already installed with correct permissions
if [ -f "$DEST_PATH" ] && [ -x "$DEST_PATH" ]; then
  echo ">> Skipped jq: already installed at $DEST_PATH"
  exit 0
fi

TEMP_PATH=/tmp/jq

echo '>> Installing jq: ' $DEST_PATH;
echo '>>> Downloading jq'
if [ "$is_os_mac" == "1" ]; then
  echo '>>>> For OSX'
  DOWNLOAD_PATH="$BASH_PROFILE_CODE_REPO_RAW_URL/assets/jq-osx"
else
  echo '>>>> For Linux'
  DOWNLOAD_PATH="$BASH_PROFILE_CODE_REPO_RAW_URL/assets/jq-linux"
fi

echo ">>>>>> $DOWNLOAD_PATH"
curl -s $DOWNLOAD_PATH > $TEMP_PATH
chmod +x $TEMP_PATH
sudo mv $TEMP_PATH $DEST_PATH
