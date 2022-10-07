#! /bin/sh
TEMP_PATH=/tmp/jq
DEST_PATH=/opt/jq

echo '  >> Installing jq: ' $DEST_PATH;
echo '    >> Downloading jq'
curl -s https://raw.githubusercontent.com/synle/bashrc/master/binaries/jq > $TEMP_PATH
chmod +x $TEMP_PATH
sudo mv $TEMP_PATH $DEST_PATH
