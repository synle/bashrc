# This script will compile all the common configs
# used for sublime and vscode keybindings

mkdir -p .build

echo '>> Generate Script List Indexes'
export TEST_SCRIPT_FILES="software/metadata/script-list.config.js"  \
  && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash

echo '>> Build raw JSON configs for VSCode and Sublime'
export DEBUG_WRITE_TO_DIR="./.build" && \
sh test.sh """
software/scripts/sublime-text-configurations.js
software/scripts/sublime-text-keybindings.js
software/scripts/vs-code-configurations.js
software/scripts/vs-code-keybindings.js
"""

find .build
