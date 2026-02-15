#! /bin/sh

##########################################################
# Generate Script List Indexes
##########################################################
echo '> Generate Script List Indexes'
export SCRIPT_INDEX_CONFIG_FILE="software/metadata/script-list.config" && \
export TEST_SCRIPT_FILES="software/metadata/script-list.config.js" && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash
cat $SCRIPT_INDEX_CONFIG_FILE
export SHOULD_PRINT_OS_FLAGS='false'; # only print this flag the first time

##########################################################
# Prebuild Host Mappings
##########################################################
echo '> Prebuilding Host Mappings'
export TEST_SCRIPT_FILES="software/metadata/ip-address.config.js" && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash

##########################################################
# Build Raw JSON and Config Artifacts
# Compile common configs used for sublime and vscode keybindings.
# Only process files containing the method "writeToBuildFile".
##########################################################
echo '> Build raw JSON and raw JSON configs'
CONFIG_BUILD_PATH="./.build"
mkdir -p $CONFIG_BUILD_PATH
export DEBUG_WRITE_TO_DIR="$CONFIG_BUILD_PATH" && \
sh test.sh "$(grep -R -l 'writeToBuildFile' 'software/' | grep -v 'base-node-script.js')"
echo '>> Built Configs:'
find $CONFIG_BUILD_PATH

##########################################################
# Build Host Mappings (skip in CI)
##########################################################
if [ "$CI" != "true" ]; then
  echo '> Build Host Mappings'
  export DEBUG_WRITE_TO_DIR="" && \
  export TEST_SCRIPT_FILES="software/metadata/hosts-blocked-ads.config.js"  \
    && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash
fi

##########################################################
# Backup XFCE Configuration (if applicable)
##########################################################
if [ -d "$HOME/.config/xfce4" ]; then
  echo "Backing up XFCE configuration..."
  mkdir -p ./linux
  tar -czf ./linux/xfce-config.tar.gz \
    -C "$HOME/.config" xfce4
  echo "Backup complete: ./linux/xfce-config.tar.gz"
else
  echo "No XFCE configuration found. Skipping backup."
fi

##########################################################
# Build Web App
##########################################################
echo '> Building webapp'
echo '>> Installing npm dependencies'
npm install
echo '>> Building webapp with Vite'
npm run build

echo '>> Built webapp artifacts:'
find dist

echo '> DONE Building'
