#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install prettier
# Used by:
#   - the curl() wrapper in profile-advanced.sh, which formats JSON / HTML / JS /
#     TS / CSS response bodies with it (markdown and YAML stay on prettier)
#   - the prettier() wrapper in profile-advanced.sh (which also auto-installs on
#     first interactive use, but pre-installing here avoids the cold-start lag)

echo '> Installing prettier'
npm_install_global prettier
