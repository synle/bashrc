#!/usr/bin/env bash
# diff-so-fancy and integration with git

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo "    >> Skipped : Not supported on is_os_android_termux"; exit 0; }

TEMP_PATH=/tmp/diff-so-fancy
DEST_PATH=/usr/local/bin/diff-so-fancy

echo '  >> Installing diff-so-fancy and git integration: ' $DEST_PATH;

rm -rf $TEMP_PATH
curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/binaries/diff-so-fancy" > $TEMP_PATH
chmod +x $TEMP_PATH
sudo mv $TEMP_PATH $DEST_PATH
git config --global core.pager "diff-so-fancy | less --tabs=4 -RFX"
