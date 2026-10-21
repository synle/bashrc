#!/usr/bin/env bash

# TODO: Delete this temporary script once Deno is fully decommissioned.

if [ -z "${HOME:-}" ] || [ "$HOME" = "/" ]; then
  printf '%s\n' 'Cannot uninstall Deno: HOME is empty or root.' >&2
  exit 1
fi

deno_home="$HOME/.deno"

if [ -L "$deno_home" ]; then
  printf 'Cannot uninstall Deno: refusing symlink at %s\n' "$deno_home" >&2
  exit 1
fi

if [ ! -e "$deno_home" ]; then
  printf 'Deno install not found: %s\n' "$deno_home"
elif [ ! -d "$deno_home" ]; then
  printf 'Cannot uninstall Deno: expected a directory at %s\n' "$deno_home" >&2
  exit 1
else
  printf 'Removing Deno install and cache: %s\n' "$deno_home"
  rm -rf "$deno_home"
fi

if type -P winget.exe > /dev/null 2>&1; then
  if ! winget_packages=$(winget.exe list --id DenoLand.Deno -e < /dev/null 2> /dev/null); then
    printf '%s\n' 'Cannot check Windows Deno package; winget list failed.' >&2
    exit 1
  fi
  if printf '%s\n' "$winget_packages" | tr -d '\000\r' | command grep -F 'DenoLand.Deno' > /dev/null; then
    printf '%s\n' 'Removing Windows Deno package: DenoLand.Deno'
    winget.exe uninstall --id DenoLand.Deno -e --silent --accept-source-agreements < /dev/null || exit 1
  fi
fi
