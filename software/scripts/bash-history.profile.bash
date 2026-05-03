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

# rewrites a history file in place. Filter pipeline:
#   1. trim leading/trailing whitespace
#   2. strip leading wrapper prefixes (`br;`, `clear;` — user-defined no-op
#      wrappers that don't change the meaningful command). Looped so chains
#      like `br; clear; foo` collapse to `foo` before dedupe sees them, which
#      lets `foo` and `clear; foo` count as the same entry.
#   3. drop empty lines (post-trim — blank lines from pasted blocks)
#   4. drop `#`-prefixed lines (HISTTIMEFORMAT timestamp markers — tradeoff is
#      losing `history`'s timestamp display for old entries)
#   5. drop any line starting with `"` (JSON / PowerShell / config paste
#      fragments — `"model": "..."`, `"$edgeBase\Main" = @{...}`, etc. Legit
#      bash starting with `"` is rare in interactive history — usually you'd
#      type `$VAR arg` not `"$VAR" arg` — so the simpler blanket rule beats
#      narrower patterns)
#   6. drop lines ending in bare `{` (JS/TS/Go/Java block-opener paste — `try {`,
#      `function foo() {`, `if (x) {`. Real bash multi-line defs get joined by
#      `cmdhist` into a single entry, so a stored entry ending in `{` is paste
#      residue. Catches what `bash -n` misses since `{` in arg position parses fine)
#   7. drop lines starting with `}` (closing-brace paste residue: `}`, `});`,
#      `} catch`, `} else {`. Mostly redundant with `bash -n` but cheaper and
#      defends against future parser quirks)
#   8. dedupe
#   9. drop anything that fails `bash -n` (unbalanced quotes, dangling pipes,
#      half-pasted commands)
# Atomic via tmp + mv. Used by both _backup_history (clean before snapshot) and
# fuzzy_history (clean before fzf).
# usage: _clean_history_file [path]   (default: ~/.bash_history)
function _clean_history_file() {
  local file="${1:-$HOME/.bash_history}"
  [ -f "$file" ] || return 0
  local tmp="$file.tmp.$$"
  sed 's/^[[:space:]]*//;s/[[:space:]]*$//' "$file" \
    | sed -E -e ':loop' -e 's/^(br|clear)[[:space:]]*;[[:space:]]*//' -e 't loop' \
    | command grep -v '^$' \
    | command grep -v '^#' \
    | command grep -v '^"' \
    | command grep -v '\{$' \
    | command grep -v '^}' \
    | awk '!seen[$0]++' \
    | while IFS= read -r line; do bash -n <<< "$line" 2> /dev/null && printf '%s\n' "$line"; done \
      > "$tmp" && mv "$tmp" "$file"
}

# backs up ~/.bash_history daily (rotated, keeps HISTORY_BACKUP_MAX copies)
# runs automatically on shell startup. Cleans the live file first so the backup
# is the cleaned snapshot, not the raw stream.
function _backup_history() {
  local today
  today=$(command date +%Y-%m-%d)
  local backup_file="$HISTORY_BACKUP_DIR/bash_history_$today"

  # skip if already backed up today
  [ -f "$backup_file" ] && return

  _clean_history_file "$HOME/.bash_history"

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

  # Detect bind -x context: bash sets READLINE_LINE in the function env when invoked
  # via "bind -x". Use "${var+x}" (set-but-empty-safe) instead of "[[ -v ]]" which
  # requires bash 4.2+ — macOS still ships /bin/bash 3.2.
  local from_bind=0
  [ -n "${READLINE_LINE+x}" ] && from_bind=1

  local header
  if ((from_bind)); then
    header="(Ctrl+R) - fzf history search; selection placed on prompt for edit"
  else
    header="fuzzy_history - fzf history search; selection runs on Enter"
  fi

  # Clean the live history file first (dedupe + bash -n), then fzf reads the cleaned
  # content. Mutating ~/.bash_history here means subsequent Ctrl+R calls are fast
  # (no-op on already-clean entries) and `history` reflects the cleaned dataset.
  _clean_history_file "$HOME/.bash_history"

  local selected
  selected=$(command cat "$HOME/.bash_history" | fzf \
    --no-sort --tac --layout=reverse --height=100% --query="${1:-}" \
    --prompt="history> " \
    --header="$header" \
    --preview='echo {} | bat --paging=never --style=plain --color=always --language=bash' \
    --preview-window=down:25%:wrap)

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
