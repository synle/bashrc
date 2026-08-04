#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# software/scripts/android_termux/termux-config.sh
# Termux terminal emulator config - properties, extra-keys row, and color theme

echo '>> Setup termux config'

safe_mkdir "$HOME/.termux"

_TERMUX_PROPERTIES="$HOME/.termux/termux.properties"
_TERMUX_COLORS="$HOME/.termux/colors.properties"

################################################################################
# --- Termux Properties ---
################################################################################
# Session shortcuts (shortcut.create-session and friends) are deliberately NOT
# set. Termux only accepts `ctrl + <single char>` for those, which would steal
# keys the shell already owns — `ctrl + [` is ESC and `ctrl + p`/`ctrl + n` are
# readline history. Termux's built-in hardware-keyboard shortcuts
# (ctrl+alt+c / n / p / r and ctrl+alt+1-9) cover the same ground without the
# collisions. See docs/editor-keybindings.md.
backup_config_file "$_TERMUX_PROPERTIES"
command cat > "$_TERMUX_PROPERTIES" << 'EOF'
# maps the Android back button to ESC instead of closing the terminal
# useful for exiting vim insert mode, dismissing fzf, and cancelling prompts
back-key=escape

# black theme (night-mode supersedes the deprecated use-black-ui property)
night-mode = true

# never vibrate on the terminal bell — tab-completion in bash rings it constantly
bell-character = ignore

# 20k lines of scrollback instead of the 2k default; `| less` is painful on a
# touch screen, so keeping more history in the buffer is the cheaper fix
terminal-transcript-rows = 20000

# tap a URL in the transcript to open it instead of long-press -> select -> share
terminal-onclick-url-open = true

# blinking cursor — a static block is easy to lose on a small, bright screen
terminal-cursor-blink-rate = 600

# no toast on every session switch
disable-terminal-session-change-toast = true

# extra keys row - two rows of special keys above the on-screen keyboard, since
# Android keyboards lack ESC, TAB, CTRL, arrows, and pipe/tilde keys needed for
# vim, tmux, and general terminal use.
# Long-press a key for its popup value:
#   ESC -> ^C macro   /  -> ~   -  -> _   HOME -> PGUP   END -> PGDN
#   |   -> &          TAB -> shift+tab    KEYBOARD -> session drawer
extra-keys = [[{key: 'ESC', popup: {macro: 'CTRL c', display: '^C'}}, {key: '/', popup: '~'}, {key: '-', popup: '_'}, {key: 'HOME', popup: 'PGUP'}, 'UP', {key: 'END', popup: 'PGDN'}, {key: '|', popup: '&'}], [{key: 'TAB', popup: {macro: 'SHIFT TAB', display: 'S-TAB'}}, 'CTRL', 'ALT', 'LEFT', 'DOWN', 'RIGHT', {key: 'KEYBOARD', popup: 'DRAWER'}]]

# font size
font-size = 14
EOF

################################################################################
# --- Termux Dracula Theme ---
################################################################################
backup_config_file "$_TERMUX_COLORS"
command cat > "$_TERMUX_COLORS" << 'EOF'
background:     #282a36
foreground:     #f8f8f2

color0:         #000000
color8:         #4d4d4d

color1:         #ff5555
color9:         #ff6e67

color2:         #50fa7b
color10:        #5af78e

color3:         #f1fa8c
color11:        #f4f99d

color4:         #bd93f9
color12:        #caa9fa

color5:         #ff79c6
color13:        #ff92d0

color6:         #8be9fd
color14:        #9aedfe

color7:         #bfbfbf
color15:        #e6e6e6
EOF

################################################################################
# --- Shared Storage ---
################################################################################
# termux-setup-storage is NOT run automatically: it raises an Android runtime
# permission dialog, which would hang an unattended run and re-prompt anyone who
# previously denied it. Print the one-liner instead.
if [ ! -d "$HOME/storage" ]; then
  echo ">> Shared storage not linked. Run 'termux-setup-storage' to get ~/storage/{downloads,dcim,shared}"
fi

################################################################################
# --- Reload ---
################################################################################
# guarded: termux-reload-settings ships in termux-tools, which is absent when this
# script runs outside the Termux app (proot/chroot, or a dry-run on another OS)
if type -P termux-reload-settings &> /dev/null; then
  termux-reload-settings
else
  echo ">> Skipped termux-reload-settings: not available"
fi
