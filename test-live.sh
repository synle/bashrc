#! /bin/sh
# How to use?
# Single script:
#   sh ./test-live.sh "git.js"
#   sh ./test-live.sh "vim.js"
#
# Multiple scripts:
#   sh ./test-live.sh "vim.js,git.js"
#   sh ./test-live.sh """
#     vim.js
#     git.js
#     vundle.js
#   """

if [ -n "$1" ]; then
  export TEST_SCRIPT_FILES="$1"
fi

{ \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/software/base-node-script.js && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/software/test.sh.js && \
  echo "filesToTest = \`$TEST_SCRIPT_FILES\`;";
} | node | bash
