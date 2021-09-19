# This script will compile all the common configs
# used for sublime and vscode keybindings

mkdir -p .build

export DEBUG_WRITE_TO_DIR="./.build" && \
sh test.sh """
software/scripts/sublime-text-configurations.js
software/scripts/sublime-text-keybindings.js
software/scripts/vs-code-configurations.js
software/scripts/vs-code-keybindings.js
"""

find .build
