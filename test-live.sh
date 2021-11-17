#! /bin/sh
# How to use?
# do single one
# sh ./test-live.sh "git.js"
# sh ./test-live.sh "vim.js"
#
# do multiple ones
# sh ./test-live.sh "vim.js,git.js"
# sh ./test-live.sh """
# vim.js
# git.js
# vundle.js
# """

if [ -n "$1" ]; then
  # provided, then use that provided var
  export TEST_SCRIPT_FILES="$1"
fi

{ \
  curl -s $SY_REPO_PREFIX/software/base-node-script.js && \
  curl -s $SY_REPO_PREFIX/software/test.sh.js && \
  echo "filesToTest = \`$TEST_SCRIPT_FILES\`;";
} | node | bash
