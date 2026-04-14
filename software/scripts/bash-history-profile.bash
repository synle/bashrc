#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# ---- Bash History Backup & Search ----
# Automatic daily backup of ~/.bash_history with rotation, fuzzy search via fzf,
# and restore from any backup by date.
#
# Backups stored in: ~/.bash_history_backups/bash_history_YYYY-MM-DD
# Retention: 7 days (HISTORY_BACKUP_MAX)
#
# Functions:
#
#   _backup_history (automatic)
#     Runs on every shell startup. Copies ~/.bash_history to
#     ~/.bash_history_backups/bash_history_YYYY-MM-DD once per day.
#     Old backups beyond HISTORY_BACKUP_MAX (7) are deleted.
#
#   fuzzy_history [query]
#     Interactive fzf-powered search over the full live bash history.
#     Deduplicates entries. Selecting a command runs it and adds it
#     to the current session history. Requires fzf.
#     Example: fuzzy_history docker
#
#   history_list_backups
#     Lists all available backup files with date and line count.
#     Example output:
#       2026-03-20  48231 lines  ~/.bash_history_backups/bash_history_2026-03-20
#       2026-03-19  48100 lines  ~/.bash_history_backups/bash_history_2026-03-19
#
#   history_restore [YYYY-MM-DD]
#     Restores ~/.bash_history from a backup.
#     - No argument: restores from the latest backup (only if ~/.bash_history
#       is empty or missing, to prevent accidental overwrites).
#     - With date argument: restores from that specific backup (overwrites
#       current history, use with caution).
#     Examples:
#       history_restore              # restore latest (safe, only if empty)
#       history_restore 2026-03-15   # restore specific date (overwrites)
#
HISTORY_BACKUP_DIR="$HOME/.bash_history_backups"
HISTORY_BACKUP_MAX=7

# backs up ~/.bash_history daily (rotated, keeps HISTORY_BACKUP_MAX copies)
# runs automatically on shell startup
function _backup_history() {
  local today
  today=$(command date +%Y-%m-%d)
  local backup_file="$HISTORY_BACKUP_DIR/bash_history_$today"

  # skip if already backed up today
  [ -f "$backup_file" ] && return

  mkdir -p "$HISTORY_BACKUP_DIR"
  cp "$HOME/.bash_history" "$backup_file" 2> /dev/null

  # rotate: keep only the most recent backups
  ls -1t "$HISTORY_BACKUP_DIR"/bash_history_* 2> /dev/null | tail -n +$((HISTORY_BACKUP_MAX + 1)) | xargs rm -f 2> /dev/null
}
_backup_history

# interactive fuzzy history search using fzf — requires fzf, falls back to Ctrl+R
function fuzzy_history() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "fuzzy_history: interactive fzf search over bash history"
    echo "  fuzzy_history [query]    search with optional initial query"
    echo "  fuzzy_history help       show this help"
    return
  fi
  if ! type -P fzf &> /dev/null; then
    echo "fuzzy_history: fzf not installed, use Ctrl+R for built-in search"
    return 1
  fi

  local selected
  selected=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' ~/.bash_history | command grep -v '^#' | awk '!seen[$0]++' | fzf --no-sort --tac --layout=reverse --query="$1")

  if [ -n "$selected" ]; then
    echo "$selected"
    history -s "$selected"
    eval "$selected"
  fi
}

# lists all available history backups with date and line count
function history_list_backups() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "history_list_backups: list all available history backups"
    echo "  history_list_backups help  show this help"
    return
  fi
  local backups
  backups=$(ls -1t "$HISTORY_BACKUP_DIR"/bash_history_* 2> /dev/null)

  if [ -z "$backups" ]; then
    echo "history_list_backups: no backups found in $HISTORY_BACKUP_DIR"
    return 1
  fi

  echo "Available history backups:"
  while IFS= read -r file; do
    local date_part lines
    date_part=$(basename "$file" | sed 's/bash_history_//')
    lines=$(wc -l < "$file" 2> /dev/null | tr -d ' ')
    echo "  $date_part  $lines lines  $file"
  done <<< "$backups"
}

# restores ~/.bash_history from a backup
function history_restore() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "history_restore: restore ~/.bash_history from a backup"
    echo "  history_restore              restore latest (only if history is empty)"
    echo "  history_restore YYYY-MM-DD   restore specific date (overwrites)"
    echo "  history_restore help         show this help"
    return
  fi
  local target_date="$1"

  if [ -n "$target_date" ]; then
    # restore a specific date (overwrites current history)
    local specific_file="$HISTORY_BACKUP_DIR/bash_history_$target_date"
    if [ ! -f "$specific_file" ]; then
      echo "history_restore: backup not found: $specific_file"
      echo "Run history_list_backups to see available dates"
      return 1
    fi
    cp "$specific_file" "$HOME/.bash_history"
    history -c
    history -r
    local lines
    lines=$(wc -l < "$HOME/.bash_history" | tr -d ' ')
    echo "history_restore: restored $lines lines from $specific_file"
  else
    # restore latest (safe mode: only if history is empty or missing)
    if [ -s "$HOME/.bash_history" ]; then
      echo "history_restore: ~/.bash_history is not empty, skipping"
      echo "To force restore a specific date: history_restore YYYY-MM-DD"
      return 0
    fi
    local latest
    latest=$(ls -1t "$HISTORY_BACKUP_DIR"/bash_history_* 2> /dev/null | head -1)
    if [ -n "$latest" ]; then
      cp "$latest" "$HOME/.bash_history"
      history -c
      history -r
      local lines
      lines=$(wc -l < "$HOME/.bash_history" | tr -d ' ')
      echo "history_restore: restored $lines lines from $latest"
    else
      echo "history_restore: no backups found in $HISTORY_BACKUP_DIR"
    fi
  fi
}
