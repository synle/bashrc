#!/usr/bin/env bash
# add prettyping: http://denilson.sa.nom.br/prettyping/

# Skip on unsupported OS
[ "$is_os_android_termux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_android_termux"; exit 0; }
[ "$is_os_arch_linux" = "1" ] && { echo ">>> Skipped : Not supported on is_os_arch_linux"; exit 0; }
[ "$is_os_chromeos" = "1" ] && { echo ">>> Skipped : Not supported on is_os_chromeos"; exit 0; }

TEMP_PATH=/tmp/prettyping
DEST_PATH=/usr/local/bin/prettyping

echo '>> Installing prettyping: ' $DEST_PATH;
echo '>>> Downloading prettyping'
curl -s "$BASH_PROFILE_CODE_REPO_RAW_URL/assets/prettyping" > $TEMP_PATH
chmod +x $TEMP_PATH
sudo mv $TEMP_PATH $DEST_PATH
