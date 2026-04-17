#!/usr/bin/env bash
# software/bootstrap/profile-core.sh

################################################################################
# ---- Pre-core Profile Blocks (registerWithBashSyleProfile) ----
#
# BEGIN/END | Profile Generated Timestamp
#
################################################################################
# SOURCE | software/scripts/bash-history-profile.bash
# BEGIN/END | fnm - fast node manager
# BEGIN/END | format script
# BEGIN/END | mac-system-setup
# BEGIN/END | temporal-cli
# SOURCE | software/scripts/bash-path-candidate-profile.bash

export EDITOR='vim'
export BASH_PATH=~/.bash_syle
export LINE_BREAK_COUNT=100
export LINE_BREAK_HASH=$(printf '#%.0s' $(seq 1 $LINE_BREAK_COUNT))

################################################################################
# ---- Aliases: Coreutils Defaults ----
################################################################################
alias cp='cp -p'                              # preserve timestamps and permissions
alias ping='ping -c 5'                        # stop after 5 pings instead of infinite
alias mkdir='mkdir -p'                        # create parent dirs automatically
alias df='df -h'                              # human-readable sizes
alias du='du -h'                              # human-readable sizes
alias free='free -h'                          # human-readable sizes (linux)
function less() { command vim -R "${@:--}"; } # open in vim read-only mode (supports piping)
alias grep='grep --color'                     # colorize matches
alias ls="ls -1 -F --color"
alias ll="ls -lah"
alias ls_newest="ll -t"               # sort by modification time (newest first)
alias ls_newest_last="ls_newest -r"   # sort by modification time (oldest first)
alias ls_biggest="ll -S"              # sort by file size (biggest first)
alias ls_biggest_last="ls_biggest -r" # sort by file size (smallest first)
# prevent curl from using cached responses
alias curl="curl \
  -H 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0' \
  -H 'Pragma: no-cache' \
  -H 'Expires: 0' \
  -H 'If-None-Match:' \
  -H 'If-Modified-Since:'"
# Cache-Control: no-cache, no-store, must-revalidate, max-age=0 — HTTP/1.1: don't cache, don't store, revalidate, expire immediately
# Pragma: no-cache — HTTP/1.0 fallback
# Expires: 0 — forces expiration
# If-None-Match: — empties ETag to prevent 304 responses
# If-Modified-Since: — empties last-modified check to prevent 304 responses
