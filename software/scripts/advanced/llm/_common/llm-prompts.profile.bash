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
# Pattern mirrors `fuzzy_recent_files`: each prompt is materialized into a
# temp file (`<tmpdir>/<idx>`), and fzf is fed a tab-delimited
# `<idx>\t<one-line-summary>` table. `--with-nth=2` shows only the summary in
# the picker row; `--preview` renders the full prompt via `bat` on the
# numbered file (same trick as `fuzzy_edit`). On selection, the file's content
# is piped to `copy` (universal clipboard helper from profile-advanced.sh).
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

  local tmp
  tmp=$(command mktemp -d -t llm-prompts.XXXXXX) || return 1
  # shellcheck disable=SC2064 — expand $tmp now; we want the literal path baked in.
  trap "command rm -rf '$tmp'" RETURN

  local fzf_input="$tmp/_fzf_input"
  : > "$fzf_input"

  local idx=0 prompt summary
  # NUL-delimited read works on bash 3.2+ (`read -d ''` sets the delimiter
  # to a literal NUL byte). Each record is one full prompt.
  while IFS= read -r -d '' prompt; do
    idx=$((idx + 1))
    printf '%s' "$prompt" > "$tmp/$idx"
    # Collapse newlines/tabs to spaces so the fzf row stays one visual line.
    summary=$(printf '%s' "$prompt" | command tr '\n\t' '  ' | command head -c 240)
    printf '%05d\t%s\n' "$idx" "$summary" >> "$fzf_input"
  done < <("$list_fn")

  if [ "$idx" -eq 0 ]; then
    echo "No ${name} prompts found" >&2
    return 0
  fi

  local OUT
  OUT=$(fzf < "$fzf_input" \
    --prompt="${name} prompts> " \
    --header="(${name}) - select a past prompt; Enter copies full prompt to clipboard" \
    --delimiter=$'\t' --with-nth=2 \
    --preview="bat --paging=never --style=plain --color=always --language=md '$tmp/{1}'" \
    --preview-window=down:60%:wrap)

  if [ -n "$OUT" ]; then
    local sel_idx="${OUT%%$'\t'*}"
    local sel_file="$tmp/$sel_idx"
    if [ -f "$sel_file" ]; then
      local bytes
      bytes=$(command wc -c < "$sel_file" | command tr -d ' ')
      command cat "$sel_file" | copy
      echo ">> Copied ${name} prompt #${sel_idx} (${bytes} bytes) to clipboard" >&2
    fi
  fi
}
