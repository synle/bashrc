#! /bin/sh
export TEST_SCRIPT_MODE=1

{ \
  cat software/base-node-script.js && \
  cat software/index.sh.js;
} | node | bash
