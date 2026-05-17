#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# install github-copilot-cli - CLI for GitHub Copilot (https://github.com/githubnext/copilot-cli)

echo '> Installing github-copilot-cli'
npm_install_global @githubnext/github-copilot-cli github-copilot-cli
