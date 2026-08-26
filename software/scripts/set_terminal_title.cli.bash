#!/usr/bin/env bash
# set_terminal_title - set the terminal tab/window title from any context,
# including an agent tool shell that has no controlling terminal of its own.
#
# Installed to ~/.local/bin/set_terminal_title by
# software/scripts/terminal-title.js (source: this file). It is a standalone
# executable rather than a shell function on purpose: an agent's bash tool runs
# NON-interactively (no ~/.bash_syle sourced), so a profile function would be
# invisible to it, but a command on PATH is callable from every shell and CLI.
#
# Why not a plain OSC printf: under a TUI harness like opencode the tool shell's
# stdout is a captured pipe with no tty, so `printf '\033]0;...'` writes into the
# harness as text and never reaches the terminal. This routes around that:
#
#   Route 1  inside a tmux pane   -> rename OUR OWN window, resolved by walking
#            this process's ancestry to the owning pane process. Deterministic
#            and independent of allow-rename; never tmux's ambiguous "current"
#            window, so parallel agents in sibling panes never retitle each
#            other. With `set-titles on` (set in tmux.config) tmux forwards the
#            window name to the outer terminal's tab, so this reaches the tab.
#   Route 2  a controlling tty    -> OSC 2 written straight to it. Covers plain
#            interactive shells and any CLI whose tool shell keeps a real tty.
#   Route 3  neither              -> silent no-op, exit 0. The title is cosmetic;
#            a shell with nowhere to send it must never fail the caller.

set -u

if [ "$#" -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ "$1" = "help" ]; then
  echo "set_terminal_title: set the terminal tab/window title
  Usage: set_terminal_title <title...>
  All arguments join into the title. Works from an interactive shell, from
  inside tmux, and from an agent tool shell with no controlling terminal (it
  renames this process's own tmux window in that case). Prints nothing and
  exits 0 when there is no terminal to target."
  exit 1
fi

# Be conservative about how long a title we push to the terminal: a tab strip has
# little room, so cap it and mark truncation with a single ellipsis char. The
# scrollback echo (echo_and_set_terminal_title) is unaffected - only what reaches
# the tab/window title here is trimmed.
MAX_TITLE_LENGTH=40

title="$*"
if [ "${#title}" -gt "$MAX_TITLE_LENGTH" ]; then
  title="${title:0:$((MAX_TITLE_LENGTH - 1))}…"
fi

# Route 1: inside a tmux pane - rename our own window.
if command -v tmux > /dev/null 2>&1; then
  # Ancestor pids of this process, self up to init, space-delimited for a
  # substring test below.
  ancestors=" "
  p="$$"
  while [ "$p" -gt 1 ]; do
    ancestors="$ancestors$p "
    p=$(ps -o ppid= -p "$p" 2> /dev/null | tr -d ' ')
    [ -n "$p" ] || break
  done

  # A pane whose top process is one of our ancestors is our own window.
  while read -r pane_pid win_id; do
    [ -n "$pane_pid" ] || continue
    case "$ancestors" in
    *" $pane_pid "*)
      tmux rename-window -t "$win_id" "$title" 2> /dev/null && exit 0
      ;;
    esac
  done < <(tmux list-panes -a -F '#{pane_pid} #{window_id}' 2> /dev/null)
fi

# Route 2: not inside tmux - OSC 2 to the controlling terminal, if any.
if { printf '\033]2;%s\007' "$title" > /dev/tty; } 2> /dev/null; then
  exit 0
fi

# Route 3: nowhere to send it - cosmetic, never fail the caller.
exit 0
