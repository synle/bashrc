#!/usr/bin/env bash
################################################################################
# --- Clipboard (copy / paste) ---
# universal clipboard with graceful fallbacks:
#   mac: native pbcopy/pbpaste
#   wsl: clip.exe / powershell.exe Get-Clipboard
#   termux: termux-clipboard-set / termux-clipboard-get (Android system clipboard)
#   wayland: wl-copy / wl-paste
#   x11: xclip -selection clipboard
#   fallback: folder-only (no native clipboard)
# all copies are saved to ~/.bash_syle_copies/ (last 10 entries)
# input is piped through unwrap() first so the clipboard never holds
# terminal-wrapped paragraphs.
################################################################################

_CLIPBOARD_DIR=~/.bash_syle_copies
_CLIPBOARD_MAX=10
mkdir -p "$_CLIPBOARD_DIR"

if ((is_os_mac)); then
  _COPY_CMD="pbcopy"
  _PASTE_CMD="pbpaste"
elif ((is_os_wsl)) && type -P clip.exe &> /dev/null && type -P powershell.exe &> /dev/null; then
  _COPY_CMD="clip.exe"
  _PASTE_CMD="powershell.exe -NoProfile -Command Get-Clipboard | sed 's/\r$//'"
# Termux is checked before wayland/x11 on purpose: Termux:X11 can set $DISPLAY,
# but the Android system clipboard is still the one the rest of the phone reads.
# The timeout is not optional — termux-clipboard-* ship in the termux-api package
# but block forever when the Termux:API companion app is not installed, which
# would otherwise hang every copy() and paste() call.
elif ((is_os_android_termux)) && type -P timeout &> /dev/null && type -P termux-clipboard-set &> /dev/null; then
  _COPY_CMD="timeout 5 termux-clipboard-set"
  _PASTE_CMD="timeout 5 termux-clipboard-get"
elif has_a_gui wayland && type -P wl-copy &> /dev/null && type -P wl-paste &> /dev/null; then
  _COPY_CMD="wl-copy"
  _PASTE_CMD="wl-paste"
elif has_a_gui x11 && type -P xclip &> /dev/null; then
  _COPY_CMD="xclip -selection clipboard"
  _PASTE_CMD="xclip -selection clipboard -o"
else
  _COPY_CMD=""
  _PASTE_CMD=""
fi

# save stdin to clipboard history folder + native clipboard (if available)
# prunes entries beyond _CLIPBOARD_MAX
function _clipboard_save() {
  local clip_file="$_CLIPBOARD_DIR/$(date +%Y-%m-%d_%H-%M-%S)"
  [ -f "$clip_file" ] && clip_file="${clip_file}_${RANDOM}"
  # unwrap rejoins terminal-wrapped paragraphs before anything reaches the
  # OS clipboard or the history file — the user's intent is to copy logical
  # lines, not the visual wrap that happened to fit the terminal width.
  if [ -n "$_COPY_CMD" ]; then
    unwrap | tee "$clip_file" | eval "$_COPY_CMD"
  else
    unwrap > "$clip_file"
  fi
  ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | tail -n +$((_CLIPBOARD_MAX + 1)) | while read -r f; do
    rm -f "$_CLIPBOARD_DIR/$f"
  done
}

# copy: stdin or files/strings into clipboard + history
function copy() {
  if [ $# -eq 0 ]; then
    # No args + stdin is a TTY (no pipe) → rewrap the existing clipboard in
    # place. `paste` is raw by default, so we pass --unwrap explicitly to pull
    # the clipboard through the unwrap filter, then pipe to copy which writes
    # it back. The recursive `copy` call hits the pipe branch (stdin not a
    # TTY) and bottoms out at _clipboard_save — no infinite loop.
    if [ -t 0 ]; then
      paste --unwrap | copy
    else
      _clipboard_save
    fi
  elif is_help_arg "$1"; then
    echo "
      copy: stdin or files/strings into clipboard + history
        copy                   rewrap the existing clipboard in place (no pipe, no args)
        echo foo | copy        pipe stdin into clipboard
        copy file.txt          copy file contents into clipboard
        copy a.txt b.txt       copy multiple files (concatenated) into clipboard
        copy \"hello world\"     copy a string into clipboard
        copy help              show this help
    "
  else
    local arg
    for arg in "$@"; do
      if [ -f "$arg" ]; then
        command cat "$arg"
      else
        echo "$arg"
      fi
    done | _clipboard_save
  fi
}

# paste: print clipboard, recall from history, or forward to real paste(1)
# Default is RAW — clipboard contents are returned verbatim. Pass --unwrap
# (or pipe through `unwrap` manually) to rejoin terminal-wrapped paragraphs.
function paste() {
  if [ $# -eq 0 ]; then
    if [ -n "$_PASTE_CMD" ]; then
      eval "$_PASTE_CMD"
    else
      local latest
      latest=$(ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | head -1)
      [ -n "$latest" ] && command cat "$_CLIPBOARD_DIR/$latest"
    fi
  elif [ "$1" = "--unwrap" ]; then
    paste | unwrap
  elif is_help_arg "$1"; then
    echo "
      paste: print clipboard, recall from history, or forward to paste(1)
        paste                  print clipboard contents (raw) to stdout
        paste --unwrap         print clipboard rejoined via unwrap
        paste list             show clipboard history entries
        paste <entry>          recall a specific entry from history (raw)
        paste help             show this help
        paste file1 file2      forward to /usr/bin/paste (merge lines)
    "
  elif [ "$1" = "list" ]; then
    ls -1t "$_CLIPBOARD_DIR" 2> /dev/null | head -n "$_CLIPBOARD_MAX"
  elif [ -f "$_CLIPBOARD_DIR/$1" ]; then
    command cat "$_CLIPBOARD_DIR/$1"
  else
    command paste "$@"
  fi
}
