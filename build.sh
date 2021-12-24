#! /bin/sh
echo '> Generate Script List Indexes'
export SCRIPT_INDEX_CONFIG_FILE="./software/metadata/script-list.config" && \
export TEST_SCRIPT_FILES="software/metadata/script-list.config.js" && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash
cat $SCRIPT_INDEX_CONFIG_FILE

echo '> Prebuilding Host Mappings'
export HOST_CONFIG_FILE='./software/metadata/ip-address.config'
export TEST_SCRIPT_FILES="software/metadata/ip-address.config.js" && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash

# This script will compile all the common configs
# used for sublime and vscode keybindings
echo '> Build raw JSON configs for VSCode and Sublime'
CONFIG_BUILD_PATH="./.build"
mkdir -p $CONFIG_BUILD_PATH
export DEBUG_WRITE_TO_DIR="$CONFIG_BUILD_PATH" && \
sh test.sh """
software/scripts/sublime-text-configurations.js
software/scripts/sublime-text-keybindings.js
software/scripts/vs-code-configurations.js
software/scripts/vs-code-keybindings.js
software/scripts/ssh.js
software/scripts/sublime-merge.js
"""
find $CONFIG_BUILD_PATH


if [ "$CI" != "true" ]; then
  echo '> Build Autocomplete Config'
  export DEBUG_WRITE_TO_DIR="" && \
  sh test.sh """
  software/metadata/bash-autocomplete.docker.js
  """
fi


echo '> Build Host Mappings'
export DEBUG_WRITE_TO_DIR="" && \
export TEST_SCRIPT_FILES="software/metadata/hosts-blocked-ads.config.js"  \
  && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash


echo '> DONE Building'
