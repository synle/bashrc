#! /bin/sh
# diff-so-fancy and integration with git
TEMP_PATH=/tmp/diff-so-fancy
DEST_PATH=/usr/local/bin/diff-so-fancy

echo '  >> Installing diff-so-fancy and git integration: ' $DEST_PATH;

rm -rf $TEMP_PATH
curl -s $SY_REPO_PREFIX/binaries/diff-so-fancy > $TEMP_PATH
chmod +x $TEMP_PATH
sudo mv $TEMP_PATH $DEST_PATH
git config --global core.pager "diff-so-fancy | less --tabs=4 -RFX"
