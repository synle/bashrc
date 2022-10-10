#! /bin/sh
TEMP_PATH=/tmp/jq
DEST_PATH=/opt/jq

echo '  >> Installing jq: ' $DEST_PATH;
echo '    >> Downloading jq'
if [ $is_os_darwin_mac == "1" ]; then
  echo '      >> For OSX'
  DOWNLOAD_PATH=https://raw.githubusercontent.com/synle/bashrc/master/binaries/jq-osx
else
  echo '      >> For Linux'
  DOWNLOAD_PATH=https://raw.githubusercontent.com/synle/bashrc/master/binaries/jq-linux
fi

echo "          >> $DOWNLOAD_PATH"
curl -s $DOWNLOAD_PATH > $TEMP_PATH
chmod +x $TEMP_PATH
sudo mv $TEMP_PATH $DEST_PATH
