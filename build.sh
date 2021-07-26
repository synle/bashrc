#! /bin/sh
echo '>> Build Assets - Host Mappings'
export TEST_SCRIPT_FILES="software/metadata/blocked-hosts.config.js"  \
  && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash

echo '>> Generate Script List Indexes'
export TEST_SCRIPT_FILES="software/metadata/script-list.config.js"  \
  && curl -s https://raw.githubusercontent.com/synle/bashrc/master/test.sh | bash

echo '>> DONE Building'
