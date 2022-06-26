#! /bin/sh
echo '''

====================================================
>> Do a full run with Upstream online code
====================================================
'''

{ \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/software/base-node-script.js && \
  curl -s https://raw.githubusercontent.com/synle/bashrc/master/software/index.sh.js ;
} | node | bash
