#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install clasp - Google Apps Script CLI tool (https://github.com/google/clasp)

printf '%s\n' '> Installing clasp'
npm_install_global @google/clasp clasp
