#! /bin/sh
# How to use?
# do single one
# sh ./test.sh "git.js"
# sh ./test.sh "vim.js"
#
# do multiple ones
# sh ./test.sh "vim.js,git.js"
# sh ./test.sh """
# vim.js
# git.js
# vundle.js
# """

export USE_CAT_FOR_SOURCE_FILE=1

if [ -n "$1" ]; then
  # provided, then use that provided var
  export TEST_SCRIPT_FILES="$1"
fi

{ \
  cat software/base-node-script.js && \
  cat software/test.sh.js && \
  echo "filesToTest = \`$TEST_SCRIPT_FILES\`;";
} | node | bash
