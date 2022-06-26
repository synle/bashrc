#! /bin/sh
export TEST_SCRIPT_MODE=1

echo '''

====================================================
>> Do a full run with LOCAL code
====================================================
'''

{ \
  cat software/base-node-script.js && \
  cat software/index.sh.js;
} | node | bash
