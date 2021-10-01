#! /bin/sh
echo '>> Build Assets - Host Mappings'
export TEST_SCRIPT_FILES="software/metadata/hosts-blocked-ads.config.js"  \
  && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash

echo '>> DONE Building'
