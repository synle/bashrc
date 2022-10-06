#! /bin/sh
export TEST_SCRIPT_MODE=1

echo '''

====================================================
>> Do a test dependencies with LOCAL code
====================================================
'''

{ \
  cat setup-dependencies.sh
} | bash
