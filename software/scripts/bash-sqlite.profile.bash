#!/usr/bin/env bash
################################################################################
# --- SQLite Utilities ---
#
# _sqlite_bin               — [internal] Resolve the sqlite CLI (sqlite3 -> sqlite)
# _sqlite_auto_vacuum_label — [internal] Render a PRAGMA auto_vacuum code as a name
# sqlite_raw                — Run raw SQL against a db, from an argument or stdin
# sqlite_vaccum             — VACUUM a db (rebuild the file, reclaim free pages)
# sqlite_vaccum_auto        — Turn auto_vacuum on for a db (PRAGMA + VACUUM to apply)
#
# `sqlite_vacuum` / `sqlite_vacuum_auto` are aliases for the two vacuum
# functions so the correctly-spelled name resolves too.
#
# Every call goes through `command "$bin"` rather than the bare name — the
# `sqlite` wrapper in bash-command-wrappers.profile.bash is a shell function
# and would shadow the binary (and recurse, since it resolves through
# _sqlite_bin as well).
################################################################################

# _sqlite_bin: echo the sqlite CLI binary name, or fail when none is installed
function _sqlite_bin() {
  if type -P sqlite3 &> /dev/null; then
    echo "sqlite3"
  elif type -P sqlite &> /dev/null; then
    echo "sqlite"
  else
    echo "sqlite: not installed (install sqlite3)" >&2
    return 1
  fi
}

# _sqlite_auto_vacuum_label <code>: map a PRAGMA auto_vacuum code to its name
function _sqlite_auto_vacuum_label() {
  case "${1:-}" in
  0) echo "NONE (0)" ;;
  1) echo "FULL (1)" ;;
  2) echo "INCREMENTAL (2)" ;;
  "") echo "unknown" ;;
  *) echo "$1" ;;
  esac
}

# sqlite_raw: run raw SQL against a SQLite database
function sqlite_raw() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "sqlite_raw: run raw SQL against a SQLite database
  Usage: sqlite_raw <path.db> '<raw sql>'
         <raw sql> | sqlite_raw <path.db>
  The database must already exist — a typo'd path is an error, not a new db.
  Examples:
    sqlite_raw ./app.db 'SELECT * FROM users LIMIT 10;'
    cat raw_query.sql | sqlite_raw ./app.db
    sqlite_raw ./app.db '.tables'"
    return 0
  fi

  local bin
  bin="$(_sqlite_bin)" || return 1

  local db="$1"
  shift

  if [ ! -f "$db" ]; then
    echo "sqlite_raw: no such database file: $db" >&2
    return 1
  fi

  local sql="$*"
  if [ -z "$sql" ] && [ ! -t 0 ]; then
    sql="$(command cat)"
  fi

  if [ -z "$(printf '%s' "$sql" | tr -d '[:space:]')" ]; then
    echo "sqlite_raw: no SQL given — pass it as the second argument or pipe it on stdin" >&2
    return 1
  fi

  # Summary goes to stderr — stdout here is the query result and gets piped.
  print_action_summary "$db" "$bin" >&2
  command "$bin" "$db" "$sql"
}

# sqlite_vaccum: VACUUM a SQLite database
function sqlite_vaccum() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "sqlite_vaccum: VACUUM a SQLite database (rebuild the file, reclaim free pages)
  Usage: sqlite_vaccum <path.db>
  Rewrites the whole file, so it needs free disk space of roughly the db size.
  Also aliased as sqlite_vacuum."
    return 0
  fi

  local bin
  bin="$(_sqlite_bin)" || return 1

  local db="$1"
  if [ ! -f "$db" ]; then
    echo "sqlite_vaccum: no such database file: $db" >&2
    return 1
  fi

  print_action_summary "$db" "$bin"

  local before after
  before="$(wc -c < "$db" | tr -d '[:space:]')"
  command "$bin" "$db" "VACUUM;" || return 1
  after="$(wc -c < "$db" | tr -d '[:space:]')"
  echo "  > VACUUM > $db > $before -> $after bytes"
}
alias sqlite_vacuum=sqlite_vaccum

# sqlite_vaccum_auto: turn auto_vacuum FULL on for a SQLite database
function sqlite_vaccum_auto() {
  if [ $# -eq 0 ] || is_help_arg "${1:-}"; then
    echo "sqlite_vaccum_auto: turn auto_vacuum FULL on for a SQLite database
  Usage: sqlite_vaccum_auto <path.db>
  Sets PRAGMA auto_vacuum = FULL then runs VACUUM — on an existing database the
  rebuild is what makes the new mode stick. Pages freed afterwards are returned
  to the filesystem automatically, so a manual VACUUM is no longer needed.
  Also aliased as sqlite_vacuum_auto."
    return 0
  fi

  local bin
  bin="$(_sqlite_bin)" || return 1

  local db="$1"
  if [ ! -f "$db" ]; then
    echo "sqlite_vaccum_auto: no such database file: $db" >&2
    return 1
  fi

  print_action_summary "$db" "$bin"

  local before after
  before="$(command "$bin" "$db" "PRAGMA auto_vacuum;" 2> /dev/null | tr -d '[:space:]')"
  command "$bin" "$db" "PRAGMA auto_vacuum = FULL; VACUUM;" || return 1
  after="$(command "$bin" "$db" "PRAGMA auto_vacuum;" 2> /dev/null | tr -d '[:space:]')"

  echo "  > Auto-vacuum > $db > $(_sqlite_auto_vacuum_label "$before") -> $(_sqlite_auto_vacuum_label "$after")"

  if [ "$after" != "1" ]; then
    echo ">> Warning: auto_vacuum did not stick (still $(_sqlite_auto_vacuum_label "$after")) — the VACUUM may not have completed." >&2
    return 1
  fi
}
alias sqlite_vacuum_auto=sqlite_vaccum_auto
