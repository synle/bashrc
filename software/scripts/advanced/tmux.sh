#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# reload ~/.tmux.conf into the running tmux server so new bindings take effect
# without a restart. tmux.js writes the file; a live server never re-reads it on
# its own, which is how stale stock bindings survived a deploy before.
# Runs after tmux.js (alphabetical: tmux.js < tmux.sh). No `exit` anywhere -
# this body is inlined into the generated run, so exit would end the whole run.

_tmux_bin=$(has_persistent_binary tmux)
_tmux_conf="$HOME/.tmux.conf"

if [ -z "$_tmux_bin" ]; then
  echo ">> Skipped tmux reload: tmux is not installed"
elif [ ! -f "$_tmux_conf" ]; then
  echo ">> Skipped tmux reload: $_tmux_conf not found"
elif ! tmux list-sessions > /dev/null 2>&1; then
  echo ">> Skipped tmux reload: no tmux server running (next server reads $_tmux_conf at start)"
elif tmux source-file "$_tmux_conf"; then
  echo ">> Reloaded tmux config into the running server: $_tmux_conf ($(tmux list-sessions 2> /dev/null | wc -l | tr -d ' ') session(s))"
else
  echo ">> tmux reload FAILED: tmux source-file $_tmux_conf - see the error above"
fi
