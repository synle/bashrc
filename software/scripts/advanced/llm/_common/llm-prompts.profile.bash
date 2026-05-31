#!/usr/bin/env bash

################################################################################
# ---- LLM Prompt History — shared helpers ----
#
# Single source of truth for the four `<cli>_list_prompts` / `<cli>_search_prompts`
# pairs (claude / copilot / gemini / opencode) plus the aggregate `llm_*` pair.
#
# Public surface:
#   claude_list_prompts    / claude_search_prompts      (defined in claude.profile.bash)
#   copilot_list_prompts   / copilot_search_prompts     (defined in copilot.profile.bash)
#   gemini_list_prompts    / gemini_search_prompts      (defined in gemini.profile.bash)
#   opencode_list_prompts  / opencode_search_prompts    (defined in opencode.profile.bash)
#   llm_list_prompts       / llm_search_prompts         (aggregate, defined HERE)
#
# Internal contract:
#   _<cli>_list_prompts_ts — emit `<ISO-8601 ts>\t<content>` NUL-delimited
#                            records straight from the CLI's storage. Slow
#                            (jsonl scan / sqlite query / find). Authoritative.
#   _llm_cache_*           — SQLite cache layer at $_LLM_PROMPTS_CACHE_DB.
#                            Public listers read from the cache; refresh
#                            populates it from the raw `_*_ts` streams.
#   *_list_prompts         — read from cache (fast). One-shot foreground
#                            refresh on empty cache so first-run isn't blank.
#                            Output: NUL-delimited content-only records.
#   *_search_prompts       — count cache; if < _LLM_PROMPTS_CACHE_MIN_SIZE
#                            block on refresh first; otherwise fzf NOW and
#                            kick a background refresh in parallel.
#
# Cache layout (single sqlite DB, single table):
#   prompts(type TEXT, ts TEXT, prompt TEXT, UNIQUE(type, prompt))
# UPSERT on collision updates ts so repeated refreshes are idempotent and
# keep the newest ts for each (type, prompt) pair.
################################################################################

# Cap on emitted prompts per lister. Single place to tune for ALL four CLIs.
_LLM_PROMPTS_LIMIT=500

# Cache thresholds.
_LLM_PROMPTS_CACHE_DB="${XDG_CACHE_HOME:-$HOME/.cache}/llm-prompts.db"
_LLM_PROMPTS_CACHE_MIN_SIZE=5

# Minimum prompt length (trimmed) before fzf surfaces a row. Raw listers and
# `*_list_prompts` still emit everything; this only filters the picker view
# so junk like "push", "yes", "ok" doesn't clutter the search.
_LLM_PROMPTS_MIN_LEN=20

# Canonical list of cache `type` labels. The aggregate refresh walks this
# array; `<type>_search_prompts` uses the same string as the cache key.
_LLM_PROMPTS_TYPES=(claude copilot gemini opencode)

################################################################################
# ---- Internal helpers: legacy NUL `<ts>\t<content>` pipeline ----
################################################################################

# _llm_dedupe_and_cap: sort+dedupe NUL `<ts>\t<content>` records, cap, emit content-only NUL records
#
# Input: NUL-delimited records of `<ISO-8601 ts>\t<prompt content>`. Empty ts
# is tolerated (sorts last). Behavior: collect all records, sort by ts DESC
# (lex sort works for ISO-8601), dedupe by content (first kept wins), cap at
# _LLM_PROMPTS_LIMIT. Output: NUL-delimited records of the content only — ts
# stripped, so downstream consumers see clean prompt bytes.
#
# Still used as a fallback path when sqlite3 is missing (cache disabled) and
# by the cache-warmth fallback inside the public listers.
function _llm_dedupe_and_cap() {
  local limit="${_LLM_PROMPTS_LIMIT:-500}"
  node -e "
    process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); });
    let chunks = [];
    process.stdin.on('data', (d) => chunks.push(d));
    process.stdin.on('end', () => {
      const buf = Buffer.concat(chunks);
      const lim = parseInt(process.argv[1], 10);
      const records = [];
      let start = 0;
      for (let i = 0; i <= buf.length; i++) {
        if (i === buf.length || buf[i] === 0) {
          if (i > start) {
            const s = buf.slice(start, i).toString('utf8');
            const tabIdx = s.indexOf('\t');
            const ts = tabIdx === -1 ? '' : s.slice(0, tabIdx);
            const content = tabIdx === -1 ? s : s.slice(tabIdx + 1);
            if (content.length > 0) records.push({ ts, content });
          }
          start = i + 1;
        }
      }
      records.sort((a, b) => (b.ts < a.ts ? -1 : b.ts > a.ts ? 1 : 0));
      const seen = new Set();
      let kept = 0;
      for (const r of records) {
        if (seen.has(r.content)) continue;
        seen.add(r.content);
        process.stdout.write(r.content);
        process.stdout.write('\0');
        if (++kept >= lim) break;
      }
    });
  " "$limit"
}

################################################################################
# ---- Cache layer ----
################################################################################

# _llm_cache_upsert_js: prints the node script that turns a NUL stream into SQL
#
# Heredoc-quoted so the JS stays readable (no `node -e` escaping hell). Read
# via process substitution: `... | node <(_llm_cache_upsert_js) <type> | sqlite3 ...`.
# Reads NUL `<ts>\t<content>` records from stdin, builds one transactional
# UPSERT script on stdout. The caller pipes that script into sqlite3.
function _llm_cache_upsert_js() {
  command cat << 'JS_EOF'
process.stdout.on('error', () => process.exit(0));
const type = process.argv[2];
let chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const buf = Buffer.concat(chunks);
  const records = [];
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0) {
      if (i > start) {
        const s = buf.slice(start, i).toString('utf8');
        const t = s.indexOf('\t');
        if (t > 0) records.push({ ts: s.slice(0, t), content: s.slice(t + 1) });
      }
      start = i + 1;
    }
  }
  if (records.length === 0) return;
  const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'";
  const out = ['BEGIN;'];
  for (const r of records) {
    out.push(
      'INSERT INTO prompts(type, ts, prompt) VALUES(' +
      esc(type) + ',' + esc(r.ts) + ',' + esc(r.content) +
      ') ON CONFLICT(type, prompt) DO UPDATE SET ts=excluded.ts;'
    );
  }
  out.push('COMMIT;');
  process.stdout.write(out.join('\n'));
});
JS_EOF
}

# _llm_cache_init: ensure the cache DB exists with the canonical schema. Idempotent.
#
# Returns non-zero only when sqlite3 itself is missing — callers should treat
# that as "cache disabled" and fall back to the live pipeline.
function _llm_cache_init() {
  type -P sqlite3 > /dev/null 2>&1 || return 1
  local dir
  dir=$(command dirname "$_LLM_PROMPTS_CACHE_DB")
  [ -d "$dir" ] || command mkdir -p "$dir" 2> /dev/null
  sqlite3 "$_LLM_PROMPTS_CACHE_DB" \
    "CREATE TABLE IF NOT EXISTS prompts(type TEXT NOT NULL, ts TEXT NOT NULL DEFAULT '', prompt TEXT NOT NULL, UNIQUE(type, prompt));
     CREATE INDEX IF NOT EXISTS prompts_type_ts ON prompts(type, ts DESC);" 2> /dev/null
}

# _llm_cache_count: distinct-prompt count for a given type (empty = aggregate, cross-type-deduped)
function _llm_cache_count() {
  _llm_cache_init 2> /dev/null || {
    echo 0
    return
  }
  local type="${1:-}"
  local sql
  if [ -n "$type" ]; then
    sql="SELECT COUNT(*) FROM prompts WHERE type='$type';"
  else
    sql="SELECT COUNT(DISTINCT prompt) FROM prompts;"
  fi
  sqlite3 "$_LLM_PROMPTS_CACHE_DB" "$sql" 2> /dev/null || echo 0
}

# _llm_cache_read: stream cached prompts as NUL-delimited records (content only), newest first
#
# Args: _llm_cache_read [<type>]   empty type = aggregate (cross-type dedupe)
# Output: NUL-delimited content-only records, newest first, capped at _LLM_PROMPTS_LIMIT.
function _llm_cache_read() {
  _llm_cache_init 2> /dev/null || return 0
  type -P jq > /dev/null 2>&1 || return 0
  local type="${1:-}"
  local sql
  if [ -n "$type" ]; then
    sql="SELECT ts, prompt AS c FROM prompts WHERE type='$type' ORDER BY ts DESC LIMIT $_LLM_PROMPTS_LIMIT;"
  else
    # Aggregate: collapse cross-type duplicates, keep newest ts per prompt.
    sql="SELECT MAX(ts) AS ts, prompt AS c FROM prompts GROUP BY prompt ORDER BY ts DESC LIMIT $_LLM_PROMPTS_LIMIT;"
  fi
  sqlite3 -json "$_LLM_PROMPTS_CACHE_DB" "$sql" 2> /dev/null \
    | jq -j '.[] | select(.c != null and .c != "") | .c, "\u0000"' 2> /dev/null
}

# _llm_cache_refresh: re-pull from a single CLI's raw `_<cli>_list_prompts_ts` lister into the cache
#
# Args: _llm_cache_refresh <type> <raw-list-fn>
# UPSERT semantics — preserves existing rows, refreshes ts on duplicates,
# inserts new rows. Stays silent on success; returns non-zero only when
# sqlite3 is missing or the raw lister is undefined.
function _llm_cache_refresh() {
  local type="$1" list_fn="$2"
  _llm_cache_init 2> /dev/null || return 1
  type "$list_fn" > /dev/null 2>&1 || return 0
  "$list_fn" | node <(_llm_cache_upsert_js) "$type" | sqlite3 "$_LLM_PROMPTS_CACHE_DB" 2> /dev/null
}

# _llm_cache_refresh_all: refresh cache for every type in _LLM_PROMPTS_TYPES
function _llm_cache_refresh_all() {
  local t
  for t in "${_LLM_PROMPTS_TYPES[@]}"; do
    _llm_cache_refresh "$t" "_${t}_list_prompts_ts"
  done
}

# _llm_list_prompts_cached: read cache for <type>; if empty, run a one-shot
# foreground refresh and read again. Used by all four public `<cli>_list_prompts`
# and by `llm_list_prompts` (empty <type> = aggregate).
function _llm_list_prompts_cached() {
  local type="${1:-}"
  local cnt
  cnt=$(_llm_cache_count "$type")
  cnt=${cnt:-0}
  if [ "$cnt" -lt 1 ]; then
    if [ -n "$type" ]; then
      _llm_cache_refresh "$type" "_${type}_list_prompts_ts" > /dev/null 2>&1
    else
      _llm_cache_refresh_all > /dev/null 2>&1
    fi
  fi
  _llm_cache_read "$type"
}

# llm_cache_clear: drop the prompt cache. Useful for forcing a clean re-crawl.
function llm_cache_clear() {
  if is_help_arg "${1:-}"; then
    echo "llm_cache_clear: drop the LLM prompt cache (\$_LLM_PROMPTS_CACHE_DB)
  Usage: llm_cache_clear              # delete the DB file
         llm_cache_clear <type>       # delete only rows for one type"
    return 0
  fi
  local type="${1:-}"
  if [ -n "$type" ]; then
    _llm_cache_init 2> /dev/null || return 1
    sqlite3 "$_LLM_PROMPTS_CACHE_DB" "DELETE FROM prompts WHERE type='$type';" 2> /dev/null
    echo ">> Cleared cache rows for type=$type"
  else
    command rm -f "$_LLM_PROMPTS_CACHE_DB" 2> /dev/null
    echo ">> Removed cache DB at $_LLM_PROMPTS_CACHE_DB"
  fi
}

################################################################################
# ---- fzf picker ----
################################################################################

# _llm_search_prompts: cache-backed fzf picker; copies selection to clipboard
#
# Usage: _llm_search_prompts <cli-name>
#   <cli-name>   "claude" | "copilot" | "gemini" | "opencode" | "llm" (aggregate)
#
# Flow:
#   1. Count cache rows for the relevant type.
#   2. If count >= _LLM_PROMPTS_CACHE_MIN_SIZE: kick a refresh in the
#      background (subshell `( … & )` so no job-control noise), then show
#      fzf over the current cache contents immediately.
#   3. Otherwise (cold cache): refresh foreground first, then show fzf.
#
# Row encoding for fzf: `idx<TAB>summary<TAB>b64(full-prompt)`. fzf shows
# field 2 (`--with-nth=2`); preview decodes field 3 inline; on Enter, field 3
# is decoded into `copy` (clipboard helper from profile-advanced.sh).
function _llm_search_prompts() {
  local name="$1"

  if ! type -P fzf > /dev/null 2>&1; then
    echo "fzf is not installed" >&2
    return 1
  fi

  # "llm" = aggregate (cross-type). Any other name is a single CLI type.
  local cache_type=""
  [ "$name" != "llm" ] && cache_type="$name"

  local cnt
  cnt=$(_llm_cache_count "$cache_type")
  cnt=${cnt:-0}

  if [ "$cnt" -ge "$_LLM_PROMPTS_CACHE_MIN_SIZE" ]; then
    # Hot cache: refresh in background so it doesn't block the picker.
    if [ "$name" = "llm" ]; then
      (_llm_cache_refresh_all > /dev/null 2>&1 &)
    else
      (_llm_cache_refresh "$name" "_${name}_list_prompts_ts" > /dev/null 2>&1 &)
    fi
  else
    # Cold cache: block on refresh so the picker has something to show.
    echo ">> Warming ${name} prompt cache (count=${cnt})..." >&2
    if [ "$name" = "llm" ]; then
      _llm_cache_refresh_all > /dev/null 2>&1
    else
      _llm_cache_refresh "$name" "_${name}_list_prompts_ts" > /dev/null 2>&1
    fi
  fi

  # Build fzf input as `idx<TAB>summary<TAB>b64` lines from the cache stream.
  # Prompts shorter than _LLM_PROMPTS_MIN_LEN (default 20) bytes after
  # whitespace trim are skipped here — junk like "push", "ok", "y" pollutes
  # the picker but is still kept in the cache for any raw consumers.
  local fzf_input
  fzf_input=$(_llm_cache_read "$cache_type" | _LLM_PROMPTS_MIN_LEN="${_LLM_PROMPTS_MIN_LEN:-20}" node -e "
    process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); });
    const minLen = parseInt(process.env._LLM_PROMPTS_MIN_LEN || '20', 10);
    let chunks = [];
    process.stdin.on('data', (d) => chunks.push(d));
    process.stdin.on('end', () => {
      const buf = Buffer.concat(chunks);
      let start = 0, idx = 0;
      for (let i = 0; i <= buf.length; i++) {
        if (i === buf.length || buf[i] === 0) {
          if (i > start) {
            const slice = buf.slice(start, i);
            const text = slice.toString('utf8');
            // Filter — short / whitespace-only prompts never reach fzf.
            if (text.trim().length < minLen) { start = i + 1; continue; }
            idx++;
            const summary = text.replace(/[\\r\\n\\t]+/g, ' ').slice(0, 240);
            const b64 = slice.toString('base64');
            process.stdout.write(String(idx).padStart(5, '0') + '\\t' + summary + '\\t' + b64 + '\\n');
          }
          start = i + 1;
        }
      }
    });
  ")

  if [ -z "$fzf_input" ]; then
    echo "No ${name} prompts found" >&2
    return 0
  fi

  local OUT
  OUT=$(fzf <<< "$fzf_input" \
    --prompt="${name} prompts> " \
    --header="(${name}) - select a past prompt; Enter copies full prompt to clipboard" \
    --delimiter=$'\t' --with-nth=2 \
    --preview="printf '%s' {3} | base64 -d" \
    --preview-window=down:60%:wrap)

  if [ -n "$OUT" ]; then
    local sel_idx="${OUT%%$'\t'*}"
    local sel_b64="${OUT##*$'\t'}"
    local content
    content=$(printf '%s' "$sel_b64" | base64 -d 2> /dev/null)
    local bytes=${#content}
    printf '%s' "$content" | copy
    echo ">> Copied ${name} prompt #${sel_idx} (${bytes} bytes) to clipboard" >&2
  fi
}

################################################################################
# ---- Aggregate public surface ----
################################################################################

# llm_list_prompts: aggregate user prompts from ALL four LLM CLIs (cache-backed)
function llm_list_prompts() {
  if is_help_arg "${1:-}"; then
    echo "llm_list_prompts: stream merged user prompts from claude+copilot+gemini+opencode
  Usage: llm_list_prompts                # NUL-delimited stream, newest first across ALL CLIs

Reads from the shared cache (\$_LLM_PROMPTS_CACHE_DB). On a cold cache the
call blocks on a one-shot refresh from every CLI's raw lister; subsequent
calls are sub-millisecond. Use \`llm_cache_clear\` to force a fresh crawl.

Cross-type duplicates are collapsed; capped at \$_LLM_PROMPTS_LIMIT
(currently ${_LLM_PROMPTS_LIMIT:-500})."
    return 0
  fi
  _llm_list_prompts_cached ""
}

# llm_search_prompts: fuzzy-pick across past prompts from ALL four LLM CLIs
function llm_search_prompts() {
  if is_help_arg "${1:-}"; then
    echo "llm_search_prompts: fzf picker over past prompts from claude+copilot+gemini+opencode
  Usage: llm_search_prompts

Hot cache (>=${_LLM_PROMPTS_CACHE_MIN_SIZE} rows): shows fzf immediately and
refreshes in the background. Cold cache: refreshes foreground first, then
shows. Selection is copied to the system clipboard via the universal copy
helper."
    return 0
  fi
  _llm_search_prompts llm
}
