#!/usr/bin/env bash

################################################################################
# --- Bash Readline Keybindings ---
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
# Ctrl+L   — clear screen AND kill input line (unix-line-discard + clear)
# Ctrl+R   — fzf history search (places command on prompt)
# Ctrl+T   — fuzzy edit (default editor) — pick file under cwd, open with default editor
# Ctrl+Y   — fuzzy recent files (default editor)
# Ctrl+P   — fuzzy cd to directory
# Ctrl+B   — fuzzy favorite command picker
# Ctrl+N   — fuzzy git log browser
# Ctrl+G   — open command in $EDITOR (alias of Ctrl+X; matches the AI CLI chord)
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
  # Two encodings: Terminal.app / iTerm2 send a meta-prefixed CSI ("\e\e[C"),
  # while Ghostty is configured to send the true alt+arrow CSI ("\e[1;3C") so
  # tmux can tell alt+arrow apart from M-f / M-b. Bind both.
  bind '"\e\e[C": forward-word'      # Option+Right — jump one word forward
  bind '"\e\e[D": backward-word'     # Option+Left — jump one word backward
  bind '"\e\e[A": beginning-of-line' # Option+Up — jump to beginning of line
  bind '"\e\e[B": end-of-line'       # Option+Down — jump to end of line
  bind '"\e[1;3C": forward-word'      # Option+Right — Ghostty CSI form
  bind '"\e[1;3D": backward-word'     # Option+Left — Ghostty CSI form
  bind '"\e[1;3A": beginning-of-line' # Option+Up — Ghostty CSI form
  bind '"\e[1;3B": end-of-line'       # Option+Down — Ghostty CSI form

  # History Navigation
  bind '"\e[A": history-search-backward' # Up arrow — search history backward matching prefix
  bind '"\e[B": history-search-forward'  # Down arrow — search history forward matching prefix

  # Shortcuts
  bind '"\C-a": beginning-of-line'          # Ctrl+A — jump to beginning of line
  bind '"\C-e": end-of-line'                # Ctrl+E — jump to end of line
  bind '"\C-x": edit-and-execute-command'   # Ctrl+X — open command in $EDITOR
  bind '"\C-t": "fuzzy_edit\r"'             # Ctrl+T — fuzzy edit (default editor)
  bind '"\C-y": "fuzzy_recent_files\r"'     # Ctrl+Y — fuzzy recent files (default editor)
  bind '"\C-p": "fuzzy_cd\r"'               # Ctrl+P — fuzzy cd to directory
  bind '"\C-b": "fuzzy_favorite_command\r"' # Ctrl+B — fuzzy favorite command picker
  bind '"\C-n": "fuzzy_git_show\r"'         # Ctrl+N — fuzzy git log browser

  # Ctrl+G — second chord for edit-and-execute-command, alongside Ctrl+X above.
  # ctrl+g is the canonical "open $EDITOR" chord across all four AI CLIs (Claude
  # Code, Copilot CLI, Gemini CLI, opencode — see docs/editor-keybindings.md →
  # "AI CLI Assistants"), so bash honors it too and the muscle memory carries in
  # and out of a TUI. The git log browser that used to own this chord moved to
  # Ctrl+N (readline's next-history default there was already orphaned, since
  # Ctrl+P is bound to fuzzy_cd above).
  # TRADEOFF: readline's default Ctrl+G (abort) is given up. Low impact — its
  # main job is cancelling an incremental search, and Ctrl+R is bound to fzf's
  # fuzzy_history below, which aborts on Esc / Ctrl+C instead.
  bind '"\C-g": edit-and-execute-command'

  # Ctrl+L — kill input line first, then clear the screen. Readline can't chain native
  # commands in one bind, so use bind -x with a function. Order: discard first so the
  # prompt redraws empty after clear (no flash of typed text on a freshly-cleared screen).
  # Use ANSI escapes directly instead of the `clear` binary so this works in minimal
  # environments (devcontainers, busybox, mingw64) where /usr/bin/clear isn't installed.
  # \033[H = cursor home, \033[2J = clear visible screen. Intentionally omits \033[3J
  # so the terminal's scrollback buffer is preserved (matches `clear` / `br` behavior) —
  # users can still scroll up to see previous output after Ctrl+L.
  function _clear_and_discard_line() {
    READLINE_LINE=""
    READLINE_POINT=0
    printf '\033[H\033[2J'
  }
  bind -x '"\C-l": _clear_and_discard_line'

  # ---- bind -x here (requires bash 5+) ----
  # bind -x executes a shell function directly instead of injecting keystrokes via
  # readline macros. The function sets READLINE_LINE / READLINE_POINT to place the
  # result on the prompt — more reliable than the old macro approach.

  # Ctrl+R — fzf history search (places selected command on prompt for edit).
  # Delegates to fuzzy_history (defined in bash-history.profile.bash). bind -x sets
  # READLINE_LINE in the function env, which fuzzy_history detects and switches to
  # "place on prompt" mode instead of its default "eval immediately" behavior.
  type -P fzf &> /dev/null && bind -x '"\C-r": fuzzy_history'

fi # end interactive shell guard
