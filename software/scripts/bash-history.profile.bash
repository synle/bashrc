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

# history_cleanup: deep-clean $HISTFILE in place. Sole history-file cleaner —
# replaces the earlier two-tier _clean_history_file (quick) + history_cleanup
# (deep) split now that all paste-residue heuristics live in _canonicalize_command.
#
# Pipeline:
#   1. walk (#<epoch>, <cmd>) pairs from $HISTFILE
#   2. canonicalize every cmd via _canonicalize_command:
#        - trim whitespace
#        - strip leading/trailing marker commands (clear|clean|br) in compound chains
#        - drop bare markers
#        - drop paste-residue patterns (JSON/PowerShell/JS brace/hex byte/cmdlet)
#        - expand ≤2-char aliases via BASH_ALIASES
#        - drop entries failing `bash -nc` syntax check
#   3. dedup (ts, cmd) pairs in node — most recent sighting wins, chronological
#      order preserved
#   4. atomic write back; reload in-memory history via `history -r`
#
# Called once per shell startup (first one of the day) by _backup_history.
# Safe to invoke manually at any time. usage: history_cleanup [help]
function history_cleanup() {
  if is_help_arg "${1:-}"; then
    echo "history_cleanup: deep-clean \$HISTFILE (canonicalize + bash -nc drop + dedup)"
    echo "  history_cleanup       run on \$HISTFILE (default ~/.bash_history)"
    echo "  history_cleanup help  show this help"
    return 0
  fi

  local histfile="${HISTFILE:-$HOME/.bash_history}"
  [ -f "$histfile" ] || return 0

  local tmp
  tmp=$(mktemp)
  local ts="" cmd="" canonical=""

  # Phase 1: canonicalize every entry, preserve timestamps
  while IFS= read -r line; do
    if [[ "$line" == \#* ]]; then
      ts="$line"
    else
      canonical=$(_canonicalize_command "$line")
      if [ -n "$canonical" ]; then
        echo "${ts:-}"
        echo "$canonical"
      fi
      ts=""
    fi
  done < "$histfile" > "$tmp"

  # Phase 2: dedup (ts, cmd) pairs keeping last occurrence per command — most
  # recent wins. Implemented in node for consistency with the rest of the repo
  # (run.sh, profile-advanced.sh, scripts/* all shell out to `node -e` for
  # non-trivial text munging). Input is the Phase 1 temp file on stdin; output
  # to deduped on stdout.
  local deduped
  deduped=$(mktemp)
  node -e "$(
    command cat << 'JS_EOF'
const fs = require('fs');
const lines = fs.readFileSync(0, 'utf8').split('\n');
// Phase 1 emits "${ts:-}\n${cmd}\n" pairs — every cmd is preceded by a ts
// line (possibly empty). Trailing newline produces an extra empty element;
// drop it so iteration pairs line up.
if (lines.length && lines[lines.length - 1] === '') lines.pop();
const seen = new Set();
const out = [];
// Walk back-to-front in (ts, cmd) pairs. First sighting wins (= most recent
// in file); unshift restores original chronological order.
for (let i = lines.length - 1; i >= 1; i -= 2) {
  const cmd = lines[i];
  const ts = lines[i - 1];
  if (!cmd) continue;
  if (seen.has(cmd)) continue;
  seen.add(cmd);
  out.unshift(ts ? ts + '\n' + cmd + '\n' : cmd + '\n');
}
process.stdout.write(out.join(''));
JS_EOF
  )" < "$tmp" > "$deduped"

  if ! cmp -s "$histfile" "$deduped" 2> /dev/null; then
    command cat "$deduped" > "$histfile"
    builtin history -r "$histfile"
  fi

  rm -f "$tmp" "$deduped"
}

# _maybe_history_cleanup: gates history_cleanup to at most once per 6 hours.
# Last-run epoch stored in $HISTORY_CLEANUP_GATE — a flat path directly under
# /tmp (no subdirs to mkdir; /tmp always exists). Wiped on reboot, desirable —
# first shell after boot triggers a fresh clean. Concurrent shells crossing
# the gate at the same moment may both run cleanup; benign because the
# canonicalize pipeline is deterministic and the writes converge.
HISTORY_CLEANUP_GATE="/tmp/synle_bashrc_history_cleanup_last"
HISTORY_CLEANUP_INTERVAL_SECONDS=21600 # 6h → 4 runs/day
function _maybe_history_cleanup() {
  local now last
  now=$(command date +%s)
  if [ -f "$HISTORY_CLEANUP_GATE" ]; then
    last=$(command cat "$HISTORY_CLEANUP_GATE" 2> /dev/null)
    # Defensive: reject empty / non-numeric / corrupted gate content. Without
    # this, $((now - "garbage")) raises a bash arithmetic error and the gate
    # wedges. Treat anything that isn't pure digits as "never ran".
    [[ "$last" =~ ^[0-9]+$ ]] || last=0
    if [ $((now - last)) -lt $HISTORY_CLEANUP_INTERVAL_SECONDS ]; then
      return 0
    fi
  fi
  history_cleanup
  echo "$now" > "$HISTORY_CLEANUP_GATE"
}

# backs up ~/.bash_history daily (rotated, keeps HISTORY_BACKUP_MAX copies).
# Runs after _maybe_history_cleanup so the daily snapshot captures the freshly
# cleaned file (assuming the 6h gate fired on this shell startup; if not, the
# live file is still recent enough — at most 6h of post-cleanup activity).
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
_maybe_history_cleanup
_backup_history

# interactive fuzzy history search using fzf. Dual-mode based on call context:
#   - From Ctrl+R (bind -x sets READLINE_LINE in env): place selection on the
#     readline prompt for the user to edit before pressing Enter — matches the
#     standard Ctrl+R behavior, safer for destructive commands.
#   - From the prompt or a script (READLINE_LINE unset): eval the selection
#     immediately. Useful for `fuzzy_history docker` style "find-and-run" calls.
function fuzzy_history() {
  if is_help_arg "${1:-}"; then
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

  # No per-Ctrl+R cleanup — history_cleanup runs once daily via _backup_history
  # and is too expensive (bash -nc per line) for a hot keystroke. Filter out
  # HISTTIMEFORMAT timestamp lines (`#<epoch>`) so fzf shows only commands.
  local selected
  selected=$(command grep -v '^#[0-9][0-9]*$' "$HOME/.bash_history" | fzf \
    --no-sort --tac --layout=reverse --height=100% --query="${1:-}" \
    --prompt="history> " \
    --header="$header" \
    --preview='echo {} | bat --paging=never --style=plain --color=always --language=bash' \
    --preview-window=down:20%:wrap)

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

# lists all available history backups with date, line count, and a 1-based
# index. Index matches the same `ls -1t` newest-first order used by
# history_restore, so the integer printed here can be passed directly to
# `history_restore N` as a shortcut for the date.
function history_list_backups() {
  if is_help_arg "${1:-}"; then
    echo "history_list_backups: list all available history backups (with index for history_restore N)"
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
  local idx=1
  while IFS= read -r file; do
    local date_part lines
    date_part=$(basename "$file" | sed 's/bash_history_//')
    lines=$(wc -l < "$file" 2> /dev/null | tr -d ' ')
    echo "  $idx  $date_part  $lines lines  $file"
    idx=$((idx + 1))
  done <<< "$backups"
}

# restores ~/.bash_history from a backup. Target identifier may be either a
# YYYY-MM-DD date string or a 1-based numeric index from history_list_backups
# (matching the same `ls -1t` newest-first order — `1` = most recent).
function history_restore() {
  if is_help_arg "${1:-}"; then
    echo "history_restore: restore ~/.bash_history from a backup"
    echo "  history_restore              restore latest (only if history is empty)"
    echo "  history_restore YYYY-MM-DD   restore specific date (overwrites)"
    echo "  history_restore N            restore by index from history_list_backups (1 = newest)"
    echo "  history_restore help         show this help"
    return
  fi
  local target="$1"

  if [ -n "$target" ]; then
    # Resolve numeric index → backup file via `ls -1t` order (same as
    # history_list_backups). Anything else falls through to date-string mode.
    local specific_file=""
    if [[ "$target" =~ ^[0-9]+$ ]]; then
      specific_file=$(ls -1t "$HISTORY_BACKUP_DIR"/bash_history_* 2> /dev/null | sed -n "${target}p")
      if [ -z "$specific_file" ]; then
        echo "history_restore: no backup at index $target"
        echo "Run history_list_backups to see available indexes"
        return 1
      fi
    else
      specific_file="$HISTORY_BACKUP_DIR/bash_history_$target"
    fi

    # restore a specific backup (overwrites current history)
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
