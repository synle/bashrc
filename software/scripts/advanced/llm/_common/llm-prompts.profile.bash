#!/usr/bin/env bash

################################################################################
# ---- LLM Prompt History — shared helpers ----
#
# Single source of truth for the four `<cli>_list_prompts` / `<cli>_search_prompts`
# pairs (claude / copilot / gemini / opencode). Each per-CLI `*.profile.bash`
# defines the storage-specific lister, then delegates the picker to the shared
# `_llm_search_prompts` helper here.
#
# Public surface (defined in each per-CLI partial, NOT here):
#   claude_list_prompts    / claude_search_prompts
#   copilot_list_prompts   / copilot_search_prompts
#   gemini_list_prompts    / gemini_search_prompts
#   opencode_list_prompts  / opencode_search_prompts
#
# Internal contract:
#   *_list_prompts  — emit user prompts to stdout as NUL-delimited records,
#                     newest first, deduplicated, capped at _LLM_PROMPTS_LIMIT.
#                     Use `_llm_dedupe_and_cap` as the final pipeline stage.
#   *_search_prompts — call `_llm_search_prompts <cli-name>` which consumes the
#                     matching `_list_prompts` function, drives fzf with a
#                     preview pane (a la `fuzzy_recent_files` / `fvim`), and
#                     copies the selected prompt to the system clipboard via
#                     the shared `copy` helper (defined in profile-advanced.sh).
#
# Why NUL records: user prompts span many lines (code, configs, multi-paragraph
# instructions). Newline-delimited would fracture every entry. NUL is the only
# byte legal prompt content cannot contain.
################################################################################

# Cap on emitted prompts per lister. Single place to tune for ALL four CLIs.
_LLM_PROMPTS_LIMIT=500

# _llm_dedupe_and_cap: dedupe NUL-delimited stdin records, cap at _LLM_PROMPTS_LIMIT, preserve input order
#
# Reads NUL-delimited records from stdin, drops duplicate records (first
# occurrence wins — so when piped newest-first, the newest copy of each
# repeated prompt is kept), and stops after _LLM_PROMPTS_LIMIT unique records.
# Output: same NUL-delimited records, no trailing newline. node is used for
# portability — BSD awk on macOS does not reliably honor `RS='\0'`.
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
      const seen = new Set();
      let kept = 0, start = 0;
      const out = [];
      for (let i = 0; i <= buf.length; i++) {
        if (i === buf.length || buf[i] === 0) {
          if (i > start) {
            const s = buf.slice(start, i).toString('utf8');
            if (!seen.has(s)) {
              seen.add(s);
              out.push(s);
              if (++kept >= lim) break;
            }
          }
          start = i + 1;
        }
      }
      for (const s of out) {
        process.stdout.write(s);
        process.stdout.write('\0');
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
    --delimiter=$'\t' --with-nth=1,2 \
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
