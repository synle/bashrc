#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install oxfmt - Rust-based formatter from the JavaScript Oxidation Compiler (https://oxc.rs)
# Used by:
#   - the curl() wrapper in profile-advanced.sh, which formats JSON / HTML / JS /
#     TS / CSS response bodies with it (markdown and YAML stay on prettier)
#   - the oxfmt() wrapper in profile-advanced.sh (which also auto-installs on
#     first interactive use, but pre-installing here avoids the cold-start lag)

echo '> Installing oxfmt'
npm_install_global oxfmt
