#!/usr/bin/env bash

################################################################################
# ---- LLM Prompt History — shared helpers ----
#
# Single source of truth for the four `<cli>_list_prompts` / `<cli>_search_prompts`
# pairs (claude / copilot / gemini / opencode). Each per-CLI `*.profile.bash`
# defines the storage-specific lister, then delegates the picker to the shared
# `_llm_search_prompts` helper here.
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
#                            records straight from the CLI's storage. Not
#                            deduped, not capped, not sorted across CLIs.
#                            The aggregate lister concatenates the four.
#   *_list_prompts         — public lister. Pipes the matching `*_ts` raw
#                            stream through `_llm_dedupe_and_cap`, which
#                            sorts newest first by ts, dedupes by content,
#                            caps at _LLM_PROMPTS_LIMIT, and emits content
#                            only (ts stripped).
#   *_search_prompts       — call `_llm_search_prompts <cli-name>` which
#                            consumes the matching `_list_prompts` function
#                            and drives fzf with an inline-base64 preview.
#                            On Enter, the selected prompt is piped to the
#                            shared `copy` helper (profile-advanced.sh).
#
# Why NUL records: user prompts span many lines. Newline-delimited would
# fracture every entry. NUL is the only byte legal prompt content cannot
# contain. ISO-8601 ts is lex-sortable across CLIs, so a single combined
# sort gives a correct newest-first global ordering.
################################################################################

# Cap on emitted prompts per lister. Single place to tune for ALL four CLIs.
_LLM_PROMPTS_LIMIT=500

# _llm_dedupe_and_cap: sort+dedupe NUL `<ts>\t<content>` records, cap, emit content-only NUL records
#
# Input: NUL-delimited records of `<ISO-8601 ts>\t<prompt content>`. Empty
# ts is tolerated (sorts last). Behavior: collect all records, sort by ts
# DESC (lex sort works for ISO-8601), dedupe by content (first kept wins),
# cap at _LLM_PROMPTS_LIMIT. Output: NUL-delimited records of the content
# only — ts stripped, so downstream consumers (`_llm_search_prompts`,
# user pipelines) see clean prompt bytes.
#
# node is used for portability — BSD awk on macOS does not reliably honor
# `RS='\0'`, and we also need NUL-aware splitting on the FIRST tab.
function _llm_dedupe_and_cap() {
  local limit="${_LLM_PROMPTS_LIMIT:-500}"
  node -e "
    // Silence EPIPE when a downstream consumer closes early (e.g. \`| head\`).
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
            // Split on FIRST tab only — prompt content may contain tabs.
            const tabIdx = s.indexOf('\t');
            const ts = tabIdx === -1 ? '' : s.slice(0, tabIdx);
            const content = tabIdx === -1 ? s : s.slice(tabIdx + 1);
            if (content.length > 0) records.push({ ts, content });
          }
          start = i + 1;
        }
      }
      // ISO-8601 lex DESC == chronological newest first.
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

# _llm_search_prompts: fzf picker over a `<cli>_list_prompts` stream; copies selection to clipboard
#
# Usage: _llm_search_prompts <cli-name> [<list-fn>]
#   <cli-name>  short label used in the fzf prompt + header (e.g. "claude")
#   <list-fn>   name of the lister function (default: "<cli-name>_list_prompts")
#
# Self-contained rows — no tempfile buffer. Each NUL-delimited prompt from the
# lister is encoded into a single fzf row as three TAB-separated fields:
#   1. zero-padded index (for stable ordering / display label)
#   2. one-line summary (newlines/tabs collapsed; truncated to 240 chars)
#   3. base64-encoded full prompt
# fzf renders fields 1+2 (`--with-nth=1,2`) and the preview decodes field 3
# inline (`{3} | base64 -d`). On Enter, field 3 is decoded again to recover
# the original bytes for the clipboard. No bat, no tempfiles, no path leaks.
function _llm_search_prompts() {
  local name="$1"
  local list_fn="${2:-${name}_list_prompts}"

  if ! type -P fzf > /dev/null 2>&1; then
    echo "fzf is not installed" >&2
    return 1
  fi
  if ! type "$list_fn" > /dev/null 2>&1; then
    echo "${list_fn} is not defined" >&2
    return 1
  fi

  # Build fzf input as `idx<TAB>summary<TAB>b64` lines. node is the cleanest
  # way to walk NUL records, build the one-line summary, and emit unwrapped
  # base64 (Buffer.toString('base64') has no embedded newlines).
  local fzf_input
  fzf_input=$("$list_fn" | node -e "
    process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); });
    let chunks = [];
    process.stdin.on('data', (d) => chunks.push(d));
    process.stdin.on('end', () => {
      const buf = Buffer.concat(chunks);
      let start = 0, idx = 0;
      for (let i = 0; i <= buf.length; i++) {
        if (i === buf.length || buf[i] === 0) {
          if (i > start) {
            idx++;
            const slice = buf.slice(start, i);
            // One-line summary — collapse whitespace runs, cap at 240 chars.
            const summary = slice.toString('utf8').replace(/[\\r\\n\\t]+/g, ' ').slice(0, 240);
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

  # Preview decodes field 3 inline. `base64 -d` works on macOS 10.13+ and all
  # GNU coreutils. No file path, no bat — the bytes are right there in the row.
  local OUT
  OUT=$(fzf <<< "$fzf_input" \
    --prompt="${name} prompts> " \
    --header="(${name}) - select a past prompt; Enter copies full prompt to clipboard" \
    --delimiter=$'\t' --with-nth=2 \
    --preview="printf '%s' {3} | base64 -d" \
    --preview-window=down:60%:wrap)

  if [ -n "$OUT" ]; then
    # Selection format mirrors input. Field 1 = idx; field 3 = b64 payload.
    local sel_idx="${OUT%%$'\t'*}"
    local sel_b64="${OUT##*$'\t'}"
    local content
    content=$(printf '%s' "$sel_b64" | base64 -d 2> /dev/null)
    local bytes=${#content}
    printf '%s' "$content" | copy
    echo ">> Copied ${name} prompt #${sel_idx} (${bytes} bytes) to clipboard" >&2
  fi
}

# llm_list_prompts: aggregate user prompts from ALL four LLM CLIs as NUL-delimited records
#
# Concatenates the four `_<cli>_list_prompts_ts` raw streams (each emits
# `<ISO-8601 ts>\t<content>` NUL records straight from its CLI's storage)
# and pipes through `_llm_dedupe_and_cap` for a single global newest-first
# sort, content-based dedupe, and cap at _LLM_PROMPTS_LIMIT.
function llm_list_prompts() {
  if is_help_arg "${1:-}"; then
    echo "llm_list_prompts: stream merged user prompts from claude+copilot+gemini+opencode
  Usage: llm_list_prompts                # NUL-delimited stream, newest first across ALL CLIs

Aggregates the four \`_<cli>_list_prompts_ts\` raw streams, sorts globally by
ISO-8601 timestamp (newest first), deduplicates identical prompts, and caps
at \$_LLM_PROMPTS_LIMIT (currently ${_LLM_PROMPTS_LIMIT:-500}).

When a CLI's raw lister is missing (CLI not installed / partial not sourced),
the missing source is silently skipped — the aggregate still works."
    return 0
  fi
  {
    type _claude_list_prompts_ts > /dev/null 2>&1 && _claude_list_prompts_ts
    type _copilot_list_prompts_ts > /dev/null 2>&1 && _copilot_list_prompts_ts
    type _gemini_list_prompts_ts > /dev/null 2>&1 && _gemini_list_prompts_ts
    type _opencode_list_prompts_ts > /dev/null 2>&1 && _opencode_list_prompts_ts
  } | _llm_dedupe_and_cap
}

# llm_search_prompts: fuzzy-pick across past prompts from ALL four LLM CLIs and copy to clipboard
function llm_search_prompts() {
  if is_help_arg "${1:-}"; then
    echo "llm_search_prompts: fzf picker over past prompts from claude+copilot+gemini+opencode
  Usage: llm_search_prompts

Pipes llm_list_prompts into the shared fzf picker. The preview pane shows
the full prompt; Enter copies the selected prompt to the system clipboard
(via the universal copy helper). Paste back into whichever CLI you wanted."
    return 0
  fi
  _llm_search_prompts llm
}
