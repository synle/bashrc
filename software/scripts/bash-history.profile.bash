#!/usr/bin/env bash

################################################################################
# ---- Bash History Backup & Search ----
#
# fuzzy_history        — Interactive fzf search over bash history (deduped)
# history_list_backups — List available backups with date and line count
# history_restore      — Restore ~/.bash_history from a backup by date
#
# Automatic daily backup on shell startup with rotation (7-day retention).
# Backups stored in: ~/.bash_history_backups/bash_history_YYYY-MM-DD
################################################################################
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

# interactive fuzzy history search using fzf. Dual-mode based on call context:
#   - From Ctrl+R (bind -x sets READLINE_LINE in env): place selection on the
#     readline prompt for the user to edit before pressing Enter — matches the
#     standard Ctrl+R behavior, safer for destructive commands.
#   - From the prompt or a script (READLINE_LINE unset): eval the selection
#     immediately. Useful for `fuzzy_history docker` style "find-and-run" calls.
function fuzzy_history() {
  if [[ "${1:-}" =~ ^(help|--help|-h|-\?|/\?)$ ]]; then
    echo "fuzzy_history: interactive fzf search over bash history"
    echo "  fuzzy_history [query]    search with optional initial query"
    echo "  fuzzy_history help       show this help"
    echo "  (also bound to Ctrl+R — that variant places selection on prompt instead of running it)"
    return
  fi
  if ! type -P fzf &> /dev/null; then
    echo "fuzzy_history: fzf not installed, use Ctrl+R for built-in search"
    return 1
  fi

  local from_bind=0
  [[ -v READLINE_LINE ]] && from_bind=1

  local header
  if ((from_bind)); then
    header="(Ctrl+R) - fzf history search; selection placed on prompt for edit"
  else
    header="fuzzy_history - fzf history search; selection runs on Enter"
  fi

  local selected
  selected=$(sed 's/^[[:space:]]*//;s/[[:space:]]*$//' ~/.bash_history | command grep -v '^#' | awk '!seen[$0]++' | fzf \
    --no-sort --tac --layout=reverse --height=100% --query="${1:-}" \
    --prompt="history> " \
    --header="$header")

  if [ -n "$selected" ]; then
    if ((from_bind)); then
      READLINE_LINE="$selected"
      READLINE_POINT=${#selected}
    else
      echo "$selected"
      history -s "$selected"
      eval "$selected"
    fi
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
