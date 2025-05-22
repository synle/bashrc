#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install gemini - Google's AI CLI tool (https://github.com/google-gemini/gemini-cli)

echo '> Installing gemini cli'
npm_install_global @google/gemini-cli gemini

# ensure ~/.gemini directory exists (gemini crashes on first run without it)
safe_mkdir "$HOME/.gemini"
