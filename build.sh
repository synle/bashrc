#! /bin/sh
echo '> Generate Script List Indexes'
export SCRIPT_INDEX_CONFIG_FILE="software/metadata/script-list.config" && \
export TEST_SCRIPT_FILES="software/metadata/script-list.config.js" && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash
cat $SCRIPT_INDEX_CONFIG_FILE
export SHOULD_PRINT_OS_FLAGS='false'; # only print this flag the first time

echo '> Prebuilding Host Mappings'
export TEST_SCRIPT_FILES="software/metadata/ip-address.config.js" && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash

# This script will compile all the common configs
# used for sublime and vscode keybindings
# here we only want to do this for files containing the method "writeToBuildFile"
echo '> Build raw JSON and raw JSON configs'
CONFIG_BUILD_PATH="./.build"
mkdir -p $CONFIG_BUILD_PATH
export DEBUG_WRITE_TO_DIR="$CONFIG_BUILD_PATH" && \
sh test.sh "$(grep -R -l 'writeToBuildFile' 'software/' | grep -v 'base-node-script.js')"
echo '>> Built Configs:'
find $CONFIG_BUILD_PATH

if [ "$CI" != "true" ]; then
  echo '> Build Autocomplete Config'
  export DEBUG_WRITE_TO_DIR="" && \
  sh test.sh """
    software/metadata/bash-autocomplete.docker.js
  """

  echo '> Build Host Mappings'
  export DEBUG_WRITE_TO_DIR="" && \
  export TEST_SCRIPT_FILES="software/metadata/hosts-blocked-ads.config.js"  \
    && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash
fi

echo '> DONE Building'
