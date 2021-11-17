#! /bin/sh
# add prettyping: http://denilson.sa.nom.br/prettyping/
TEMP_PATH=/tmp/prettyping
DEST_PATH=/usr/local/bin/prettyping

echo '  >> Installing prettyping: ' $DEST_PATH;
echo '    >> Downloading prettyping'
curl -s https://raw.githubusercontent.com/synle/bashrc/master/binaries/prettyping > $TEMP_PATH
chmod +x $TEMP_PATH
sudo mv $TEMP_PATH $DEST_PATH
