#!/usr/bin/env bash

################################################################################
# ---- Bash Readline Keybindings ----
#
# No user-callable functions. Sets up readline bindings for interactive shells:
#
# --- Tab Completion ---
# Tab        — fzf-tab-completion (falls back to menu-complete)
# Shift+Tab  — cycle completions backward
#
# --- Cursor Movement ---
# Ctrl+Up/Down    — jump to beginning/end of line (Linux/WSL)
# Ctrl+Left/Right — jump one word backward/forward (Linux/WSL)
# Option+arrows   — same as above (macOS)
#
# --- History Navigation ---
# Up/Down — search history matching current prefix
#
# --- Shortcuts ---
# Ctrl+A/E — beginning/end of line
# Ctrl+L   — clear screen
# Ctrl+R   — fzf history search (places command on prompt)
# Ctrl+T   — fuzzy edit with vim
# Ctrl+Y   — fuzzy edit (default editor)
# Ctrl+O   — fuzzy recent files (default editor)
# Ctrl+P   — fuzzy cd to directory
# Ctrl+B   — fuzzy favorite command picker
# Ctrl+G   — fuzzy git log browser
# Ctrl+X   — open command in $EDITOR
#
# All bindings guarded by interactive shell check ([[ $- == *i* ]]).
################################################################################
if [[ $- == *i* ]]; then

  # Tab Completion — fzf-tab-completion with fallback to menu-complete
  if [ -f ~/.fzf-tab-completion/bash/fzf-bash-completion.sh ] && type -P fzf &> /dev/null && . ~/.fzf-tab-completion/bash/fzf-bash-completion.sh 2> /dev/null && type fzf_bash_completion &> /dev/null; then
    # Wrap fzf_bash_completer to strip trailing space after directory slash
    # so tab-completing into nested paths works without the extra space
    eval "$(declare -f fzf_bash_completer | command sed '1s/fzf_bash_completer/_fzf_bash_completer_orig/')"
    function fzf_bash_completer() {
      _fzf_bash_completer_orig "$@"
      COMPREPLY="${COMPREPLY/%\/ /\/}"
    }
    bind -x '"\t": fzf_bash_completion'
  else
    bind '"\t": menu-complete'
  fi
  bind '"\e[Z": menu-complete-backward' # Shift+Tab — cycle completions backward

  # Cursor Movement — Linux / WSL
  bind '"\e[1;5A": beginning-of-line' # Ctrl+Up — jump to beginning of line
  bind '"\e[1;5B": end-of-line'       # Ctrl+Down — jump to end of line
  bind '"\e[1;5D": backward-word'     # Ctrl+Left — jump one word backward
  bind '"\e[1;5C": forward-word'      # Ctrl+Right — jump one word forward

  # Cursor Movement — macOS (Option key)
  bind '"\e\e[C": forward-word'      # Option+Right — jump one word forward
  bind '"\e\e[D": backward-word'     # Option+Left — jump one word backward
  bind '"\e\e[A": beginning-of-line' # Option+Up — jump to beginning of line
  bind '"\e\e[B": end-of-line'       # Option+Down — jump to end of line

  # History Navigation
  bind '"\e[A": history-search-backward' # Up arrow — search history backward matching prefix
  bind '"\e[B": history-search-forward'  # Down arrow — search history forward matching prefix

  # Shortcuts
  bind '"\C-a": beginning-of-line'          # Ctrl+A — jump to beginning of line
  bind '"\C-e": end-of-line'                # Ctrl+E — jump to end of line
  bind '"\C-l": clear-screen'               # Ctrl+L — clear screen
  bind '"\C-x": edit-and-execute-command'   # Ctrl+X — open command in $EDITOR
  bind '"\C-t": "fuzzy_edit vim\r"'         # Ctrl+T — fuzzy edit with vim
  bind '"\C-y": "fuzzy_edit\r"'             # Ctrl+Y — fuzzy edit (default editor)
  bind '"\C-o": "fuzzy_recent_files\r"'     # Ctrl+O — fuzzy recent files (default editor)
  bind '"\C-p": "fuzzy_cd\r"'               # Ctrl+P — fuzzy cd to directory
  bind '"\C-b": "fuzzy_favorite_command\r"' # Ctrl+B — fuzzy favorite command picker
  bind '"\C-g": "fuzzy_git_show\r"'         # Ctrl+G — fuzzy git log browser

  # ---- bind -x here (requires bash 5+) ----
  # bind -x executes a shell function directly instead of injecting keystrokes via
  # readline macros. The function sets READLINE_LINE / READLINE_POINT to place the
  # result on the prompt — more reliable than the old macro approach.

  # Ctrl+R — fzf history search (places selected command on prompt)
  # reads from ~/.bash_history file directly so it searches commands from all tabs
  # (since we no longer reload shared history into memory with history -c/-r)
  if type -P fzf &> /dev/null; then
    function __fzf_history__() {
      local selected
      selected=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' ~/.bash_history | command grep -v '^#' | $(type -P tac &> /dev/null && echo tac || echo 'tail -r') | awk 'NF && !seen[$0]++' | fzf --height=60% --reverse --tac +s)
      if [ -n "$selected" ]; then
        READLINE_LINE="$selected"
        READLINE_POINT=${#selected}
      fi
    }
    bind -x '"\C-r": __fzf_history__'
  fi

fi # end interactive shell guard
