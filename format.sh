#!/usr/bin/env bash
{
  echo '< format.sh'

  ##########################################################
  # step: build-include - Update files with BEGIN/END block inclusions
  ##########################################################
  echo '> Running build-include substitutions'
  node software/build-include.cjs

  FORMAT_SCRIPT_URL=https://raw.githubusercontent.com/synle/gha-workflows/refs/heads/main/format.sh
  echo ">> formatting script: $FORMAT_SCRIPT_URL"
  curl -s "$FORMAT_SCRIPT_URL" | bash - > /dev/null 2>&1

  exit
}
