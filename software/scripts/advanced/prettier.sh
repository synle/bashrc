#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install prettier - opinionated multi-language code formatter (https://prettier.io)
# Used by:
#   - `make format` (via `npx prettier` in software/scripts/advanced/format.js)
#   - the curl() wrapper in profile-advanced.sh for body pretty-printing
#   - the prettier() wrapper in profile-advanced.sh (which also auto-installs
#     on first interactive use, but pre-installing here avoids the cold-start lag)

echo '> Installing prettier'
npm_install_global prettier
