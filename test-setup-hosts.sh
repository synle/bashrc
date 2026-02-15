#! /bin/sh
export TEST_SCRIPT_MODE=1

echo '''
====================================================
>> Do setup host with LOCAL code
====================================================
'''

{ \
  cat software/base-node-script.js && \
  cat software/scripts/etc-hosts.su.js;
} | sudo -E node
