# Per-command spec autocomplete wrapper template (partial — not a standalone script).
# run: bash run.sh --files="bash-autocomplete-complete-spec.js"
# thin per-command wrapper — loads spec data and delegates to __spec_complete
function __spec_complete_{{COMMAND}}() {
  local spec_data
  read -r -d '' spec_data << '__SPEC_EOF__'
{{SPEC_CONTENT}}
__SPEC_EOF__
  __spec_complete "$spec_data" "${BASHRC_AUTOCOMPLETE_MAX_DEPTH:-{{MAX_NESTED_DEPTH}}}"
}
# nosort: preserve custom order (non-options first, --flags last). filenames: enable LS_COLORS coloring for filesystem completions
# bash 4.0+ supports -o nosort; older versions fall back to filenames only
if complete -o nosort -o filenames -F __spec_complete_{{COMMAND}} {{COMMAND}} 2> /dev/null; then
  : # registered with nosort
else
  complete -o filenames -F __spec_complete_{{COMMAND}} {{COMMAND}}
fi
