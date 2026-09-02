#!/usr/bin/env bash

################################################################################
# --- LLM Prompt History — shared helpers ---
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
#   llm_search_plans                                    (plan-file picker, defined HERE)
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
#   _llm_cache_read_meta   — picker-only reader. Same rows as _llm_cache_read
#                            but emits `<type>\t<ts>\t<content>` so the fzf
#                            preview can render a provenance header. Kept
#                            separate so the public content-only contract of
#                            `*_list_prompts` never changes.
#   *_search_prompts       — count cache; if < _LLM_PROMPTS_CACHE_MIN_SIZE
#                            block on refresh first; otherwise fzf NOW and
#                            kick a background refresh in parallel.
#
# Cache layout (single sqlite DB, single table):
#   prompts(type TEXT, ts TEXT, prompt TEXT, UNIQUE(type, prompt))
# UPSERT on collision updates ts so repeated refreshes are idempotent and
# keep the newest ts for each (type, prompt) pair.
#
# Only prompts a HUMAN typed are harvested. Each raw lister drops the prompts
# a parent agent generated for a dispatched sub-agent (claude sidechains,
# opencode child sessions) — those are orchestration text, never run by hand,
# and they drowned the picker. See each `_<cli>_list_prompts_ts` for the
# per-CLI discriminator (and for copilot/gemini, why there is none).
################################################################################

# Cap on emitted prompts per lister. Single place to tune for ALL four CLIs.
_LLM_PROMPTS_LIMIT=500

# Cache thresholds.
_LLM_PROMPTS_CACHE_DB="${XDG_CACHE_HOME:-$HOME/.cache}/llm-prompts.db"
_LLM_PROMPTS_CACHE_MIN_SIZE=5

# Cache generation, stored in the DB's `PRAGMA user_version`. BUMP THIS
# whenever a raw `_<cli>_list_prompts_ts` lister changes WHICH prompts it
# emits — the cache is UPSERT-only, so rows harvested under the old rules
# would otherwise survive forever. Bumping wipes the table on next init and
# forces a clean re-crawl.
#   1 — sub-agent / sidechain prompts excluded (claude, opencode)
_LLM_PROMPTS_CACHE_VERSION=1

# Minimum prompt length (trimmed) before fzf surfaces a row. Raw listers and
# `*_list_prompts` still emit everything; this only filters the picker view
# so junk like "push", "yes", "ok" doesn't clutter the search.
_LLM_PROMPTS_MIN_LEN=20

# Canonical list of cache `type` labels. The aggregate refresh walks this
# array; `<type>_search_prompts` uses the same string as the cache key.
_LLM_PROMPTS_TYPES=(claude copilot gemini opencode)

################################################################################
# --- Shared session bootstrap for the LLM CLI wrappers ---
################################################################################

# llm_setup_activate: activate node once per shell session for the LLM CLI wrappers
#
# Every LLM wrapper (claude / copilot / gemini / opencode) needs a modern node
# on PATH before it runs, but node activation is slow enough that paying for it
# on each invocation is wasteful. Guarded by the exported
# LLM_SETUP_NODE_ACTIVATED flag so the activation happens exactly once per
# shell session; subsequent calls are a no-op. Returns non-zero when
# `activate_node` (aliased as `a_node`) is unavailable so callers can bail with
# their own message. Resolves the underlying function rather than the alias
# because aliases do not expand inside function bodies.
function llm_setup_activate() {
  if is_truthy "${LLM_SETUP_NODE_ACTIVATED:-}"; then
    return 0
  fi

  if [ "$(type -t activate_node)" != "function" ]; then
    return 1
  fi

  activate_node
  export LLM_SETUP_NODE_ACTIVATED=1
}

################################################################################
# --- Internal helpers: legacy NUL `<ts>\t<content>` pipeline ---
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
# --- Cache layer ---
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
#
# Also enforces the cache generation. `PRAGMA user_version` holds
# _LLM_PROMPTS_CACHE_VERSION; an older value means the rows on disk were
# harvested by a lister whose filtering has since changed, so they are dropped
# and re-crawled. Refreshes are UPSERT-only and never delete, so without this
# gate a prompt that a new filter excludes would live in the cache forever —
# which is exactly what would happen to the sub-agent prompts now filtered out
# at the claude/opencode listers.
function _llm_cache_init() {
  type -P sqlite3 > /dev/null 2>&1 || return 1
  local dir
  dir=$(command dirname "$_LLM_PROMPTS_CACHE_DB")
  [ -d "$dir" ] || command mkdir -p "$dir" 2> /dev/null
  sqlite3 "$_LLM_PROMPTS_CACHE_DB" \
    "CREATE TABLE IF NOT EXISTS prompts(type TEXT NOT NULL, ts TEXT NOT NULL DEFAULT '', prompt TEXT NOT NULL, UNIQUE(type, prompt));
     CREATE INDEX IF NOT EXISTS prompts_type_ts ON prompts(type, ts DESC);" 2> /dev/null || return 1

  local ver
  ver=$(sqlite3 "$_LLM_PROMPTS_CACHE_DB" "PRAGMA user_version;" 2> /dev/null)
  ver=${ver:-0}
  if [ "$ver" -lt "$_LLM_PROMPTS_CACHE_VERSION" ]; then
    sqlite3 "$_LLM_PROMPTS_CACHE_DB" \
      "DELETE FROM prompts; PRAGMA user_version=$_LLM_PROMPTS_CACHE_VERSION;" 2> /dev/null
  fi
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

# _llm_cache_read_meta: stream cached prompts as NUL `<type>\t<ts>\t<content>` records, newest first
#
# Args: _llm_cache_read_meta [<type>]   empty type = aggregate (cross-type dedupe)
#
# Sibling of `_llm_cache_read` that keeps the provenance columns instead of
# dropping them. Used ONLY by the fzf picker, which renders them as a
# `# prompted in <vendor> on <local time>` header above the preview body.
# `_llm_cache_read` stays content-only because that is the documented output
# contract of every public `*_list_prompts` function.
#
# The aggregate branch leans on SQLite's bare-column-with-MAX() rule: when a
# query uses MAX()/MIN(), bare columns in the same SELECT are taken from the
# row that produced the extreme value. So `type` is the vendor that owns the
# newest copy of a prompt seen across multiple CLIs.
#
# NOTE: content may itself contain tabs, so consumers MUST split on the first
# two tabs only (indexOf twice) — never a naive split.
function _llm_cache_read_meta() {
  _llm_cache_init 2> /dev/null || return 0
  type -P jq > /dev/null 2>&1 || return 0
  local type="${1:-}"
  local sql
  if [ -n "$type" ]; then
    sql="SELECT type, ts, prompt AS c FROM prompts WHERE type='$type' ORDER BY ts DESC LIMIT $_LLM_PROMPTS_LIMIT;"
  else
    sql="SELECT type, MAX(ts) AS ts, prompt AS c FROM prompts GROUP BY prompt ORDER BY ts DESC LIMIT $_LLM_PROMPTS_LIMIT;"
  fi
  sqlite3 -json "$_LLM_PROMPTS_CACHE_DB" "$sql" 2> /dev/null \
    | jq -j '.[] | select(.c != null and .c != "") | (.type // ""), "\t", (.ts // ""), "\t", .c, "\u0000"' 2> /dev/null
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
# --- fzf picker ---
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
# Row encoding for fzf: `idx<TAB>summary<TAB>b64(header)<TAB>b64(full-prompt)`.
# fzf shows field 2 (`--with-nth=2`); the preview decodes field 3 (provenance
# header) followed by field 4 (prompt body). On Enter, field 4 is decoded into
# `copy` (clipboard helper from profile-advanced.sh).
#
# The prompt body deliberately stays the LAST tab field so the existing
# `${OUT##*$'\t'}` extraction keeps copying the prompt and never the header.
# Both are base64'd so spaces/newlines/tabs never interact with fzf's field
# splitting or shell quoting.
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

  # Build fzf input as `idx<TAB>summary<TAB>b64(header)<TAB>b64(body)` lines
  # from the cache stream. Prompts shorter than _LLM_PROMPTS_MIN_LEN (default
  # 20) bytes after whitespace trim are skipped here — junk like "push", "ok",
  # "y" pollutes the picker but is still kept in the cache for any raw
  # consumers.
  #
  # Aggregate mode only (`name` = "llm") appends an ` [<type>]` origin tag to
  # each ROW SUMMARY, so a mixed list says which CLI a prompt came from at a
  # glance. A single-CLI picker already knows its vendor, so the tag would be
  # the same noise on every row and is suppressed. The tag lives on the fzf
  # display field only — it is never part of the b64 body, so the clipboard
  # copy stays byte-identical to the original prompt. The preview keeps
  # showing the fuller `# prompted in <vendor> on <time>` header.
  local show_origin=0
  [ "$name" = "llm" ] && show_origin=1

  local fzf_input
  fzf_input=$(_llm_cache_read_meta "$cache_type" | _LLM_PROMPTS_MIN_LEN="${_LLM_PROMPTS_MIN_LEN:-20}" _LLM_PROMPTS_SHOW_ORIGIN="$show_origin" node -e "
    process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); });
    const minLen = parseInt(process.env._LLM_PROMPTS_MIN_LEN || '20', 10);
    const showOrigin = process.env._LLM_PROMPTS_SHOW_ORIGIN === '1';
    // Display names for the cache 'type' column. Unknown types fall through
    // to the raw value so a newly added CLI still renders something sane.
    const VENDOR_LABELS = {
      claude: 'Claude Code',
      copilot: 'GitHub Copilot CLI',
      gemini: 'Gemini CLI',
      opencode: 'opencode',
    };
    // Format an ISO-8601 UTC timestamp as local 'YYYY-MM-DD HH:MM:SS TZ'.
    // Returns '' for empty/unparseable input so the caller can drop the
    // ' on <time>' clause entirely rather than printing 'Invalid Date'.
    const formatLocal = (ts) => {
      if (!ts) return '';
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      const p = (n) => String(n).padStart(2, '0');
      let tz = '';
      try {
        // Intl is unavailable on small-icu node builds — degrade to no tz.
        const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
          .formatToParts(d).find((x) => x.type === 'timeZoneName');
        if (part) tz = part.value;
      } catch (e) {}
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
        p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + (tz ? ' ' + tz : '');
    };
    let chunks = [];
    process.stdin.on('data', (d) => chunks.push(d));
    process.stdin.on('end', () => {
      const buf = Buffer.concat(chunks);
      let start = 0, idx = 0;
      for (let i = 0; i <= buf.length; i++) {
        if (i === buf.length || buf[i] === 0) {
          if (i > start) {
            const slice = buf.slice(start, i);
            const record = slice.toString('utf8');
            // Split on the FIRST TWO tabs only — prompt bodies contain tabs.
            const t1 = record.indexOf('\t');
            const t2 = t1 === -1 ? -1 : record.indexOf('\t', t1 + 1);
            if (t2 === -1) { start = i + 1; continue; }
            const type = record.slice(0, t1);
            const ts = record.slice(t1 + 1, t2);
            const text = record.slice(t2 + 1);
            // Filter — short / whitespace-only prompts never reach fzf.
            if (text.trim().length < minLen) { start = i + 1; continue; }
            idx++;
            const vendor = VENDOR_LABELS[type] || type || 'an unknown LLM CLI';
            const when = formatLocal(ts);
            const header = '# prompted in ' + vendor + (when ? ' on ' + when : '') + '\n\n';
            // Origin tag is appended AFTER the truncation so it can never be
            // sliced off on a long prompt.
            const origin = showOrigin && type ? ' [' + type + ']' : '';
            const summary = text.replace(/[\\r\\n\\t]+/g, ' ').slice(0, 240) + origin;
            const b64Header = Buffer.from(header, 'utf8').toString('base64');
            const b64Body = Buffer.from(text, 'utf8').toString('base64');
            process.stdout.write(String(idx).padStart(5, '0') + '\\t' + summary + '\\t' + b64Header + '\\t' + b64Body + '\\n');
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
    --preview="printf '%s' {3} | base64 -d; printf '%s' {4} | base64 -d" \
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
# --- Aggregate public surface ---
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
helper.

The preview pane prefixes each prompt with a provenance header:
  # prompted in <vendor> on <YYYY-MM-DD HH:MM:SS TZ, local time>
For a prompt seen in more than one CLI the vendor shown is whichever one
holds the newest copy. The header is preview-only — it is never copied.

Each row is also tagged with its origin CLI (\` [opencode]\`, \` [claude]\`, ...)
so a mixed list reads at a glance. The tag is display-only and, like the
header, is never part of what Enter copies. Single-CLI pickers such as
\`opencode_search_prompts\` omit it — every row there has the same origin."
    return 0
  fi
  _llm_search_prompts llm
}

################################################################################
# --- Plan artifacts ---
################################################################################

# llm_search_plans: fzf-pick a plan file from the shared LLM plans folder, open in vim
#
# Thin wrapper over `fuzzy_edit vim` scoped to $LLM_ROOT_FOLDER/plans — the flat
# folder every Sy plan artifact (and its sidecars) lands in. The picker fuzzy-
# finds a plan and Enter opens it in vim; the preview shows each file's contents
# with its `# modified on <time>` header (see _fzf_preview_path). $LLM_ROOT_FOLDER
# is exported by common-env.sh, so it is read directly with no fallback literal.
function llm_search_plans() {
  if is_help_arg "${1:-}"; then
    echo "llm_search_plans: fzf-pick a plan file from \$LLM_ROOT_FOLDER/plans and open it in vim
  Usage: llm_search_plans"
    return 0
  fi
  local plans_dir="${LLM_ROOT_FOLDER}/plans"
  if [ ! -d "$plans_dir" ]; then
    echo "llm_search_plans: no plans folder at $plans_dir" >&2
    return 1
  fi
  fuzzy_edit vim "$plans_dir"
}
