#! /bin/sh

echo '''
====================================================
>> Do a test dependencies with LOCAL code
====================================================
'''

sh run.sh --local --run-only-prescripts --pre-scripts="setup-dependencies.sh"
