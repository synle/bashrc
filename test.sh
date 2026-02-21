#! /bin/sh

echo '< test.sh'

# How to use?
# Single script:
#   sh ./test.sh "git.js"
#   sh ./test.sh "vim.js"
#
# Multiple scripts:
#   sh ./test.sh "vim.js,git.js"
#   sh ./test.sh """
#     vim.js
#     git.js
#     vundle.js
#   """

export TEST_SCRIPT_MODE=1

if [ -n "$1" ]; then
  export TEST_SCRIPT_FILES="$1"
fi

{ \
  cat software/base-node-script.js && \
  cat software/test.sh.js && \
  echo "filesToTest = \`$TEST_SCRIPT_FILES\`;";
} | node | bash
