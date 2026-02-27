#!/usr/bin/env bash

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo "    >> Skipped : Not supported on is_os_android_termux"; exit 0; }

TEMP_PATH=/tmp/jq
DEST_PATH=/opt/jq

echo '  >> Installing jq: ' $DEST_PATH;
echo '    >> Downloading jq'
if [ $is_os_darwin_mac == "1" ]; then
  echo '      >> For OSX'
  DOWNLOAD_PATH="$BASH_PROFILE_CODE_REPO_RAW_URL/binaries/jq-osx"
else
  echo '      >> For Linux'
  DOWNLOAD_PATH="$BASH_PROFILE_CODE_REPO_RAW_URL/binaries/jq-linux"
fi

echo "          >> $DOWNLOAD_PATH"
curl -s $DOWNLOAD_PATH > $TEMP_PATH
chmod +x $TEMP_PATH
sudo mv $TEMP_PATH $DEST_PATH
