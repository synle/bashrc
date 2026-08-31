#!/usr/bin/env bash
################################################################################
# --- Dynamic alias / command-variant cache ---
#
# Three generators build decorated command families at shell start, each by
# iterating over the live shell's aliases/functions and forking grep/type per
# entry — together ~0.5s of every shell start:
#
#   1. ls_*_first  — reversed twins of the eza ls_* listing aliases
#   2. i-prefixed  — case-insensitive twins of every fuzzy_* picker
#   3. snip        — transparent wrappers for snip-supported build commands
#
# Their output is deterministic for a given profile, so run them ONCE, cache the
# resulting function definitions + the _COMMAND_VARIANTS registry to
# $_BASH_SYLE_DYNAMIC_CACHE, and on every later shell just source that cache
# (plain function defs, zero forks).
#
# Invalidation is by mtime: a run.sh deploy rewrites ~/.bash_syle, so whenever
# it is newer than the cache the generators re-run and the cache is rebuilt.
# Delete the cache by hand (or `rm ~/.bash_syle_cache`) to force a rebuild.
#
# This partial is sourced LAST (after every alias, fuzzy_* picker, and snip
# base command exists) — see the SOURCE order in profile-advanced.sh.
################################################################################

_BASH_SYLE_DYNAMIC_CACHE="$HOME/.bash_syle_cache"

# _build_dynamic_aliases: run every dynamic generator once. Safe to call only
# after all of their inputs (ls_* aliases, fuzzy_* functions, snip base
# commands) are defined, which is why this partial sources last.
function _build_dynamic_aliases() {
  # 1. ls_*_first — same eza listing, reversed (--reverse after "$@").
  register_command_variants \
    --suffix=_first \
    --select-alias-name='^ls_[a-z]*$' \
    --args='--reverse'

  # 2. i-prefixed case-insensitive twins of every fuzzy_* picker.
  fzf_register_case_variants

  # 3. snip transparent wrappers — only worth defining when snip is installed;
  #    without it every wrapper would just pass through to the raw binary.
  if type -P snip > /dev/null 2>&1; then
    _register_snip_wrappers
  fi
}

# _dump_dynamic_aliases_cache: serialize every generated function definition and
# the _COMMAND_VARIANTS registry to the cache file so the next shell sources
# them instead of regenerating.
#
# Function definitions from `declare -f` are always global, even when the cache
# is sourced inside a function — which it is: .bashrc loads the profile through
# `safe_source`, a function. A variable is NOT: `declare -p` emits
# `declare -- _COMMAND_VARIANTS=...`, and a bare `declare` inside a function
# makes a function-LOCAL that vanishes on return (and `declare -g` is bash 4.2+,
# past the 3.2 floor). Strip the `declare -- ` prefix so it lands as a plain
# assignment, which writes the existing global via dynamic scoping.
function _dump_dynamic_aliases_cache() {
  local name tab reg
  tab=$(printf '\t')
  {
    # command-variant functions are tracked in _COMMAND_VARIANTS as
    # "<name><TAB><body>" lines; dump each one's definition.
    printf '%s\n' "$_COMMAND_VARIANTS" | while IFS="$tab" read -r name _; do
      [ -n "$name" ] && declare -f "$name" 2> /dev/null
    done
    # snip wrappers live outside _COMMAND_VARIANTS; dump the names the loop
    # actually defined this run (skipped/owned names are not listed).
    for name in $_SNIP_WRAPPED_NAMES; do
      declare -f "$name" 2> /dev/null
    done
    # persist the registry as a plain assignment (not `declare`) so it restores
    # the global even when the cache is sourced inside safe_source.
    reg=$(declare -p _COMMAND_VARIANTS 2> /dev/null)
    [ -n "$reg" ] && printf '%s\n' "${reg#declare -- }"
  } > "$_BASH_SYLE_DYNAMIC_CACHE" 2> /dev/null
}

# Load the cache when it exists and is at least as new as the profile; otherwise
# regenerate and rewrite it. `-nt` is a bash 3.2 test operator.
if [ -r "$_BASH_SYLE_DYNAMIC_CACHE" ] && [ ! "$HOME/.bash_syle" -nt "$_BASH_SYLE_DYNAMIC_CACHE" ]; then
  # The cache defines functions whose names can collide with an alias (a snip
  # wrapper vs the `pytest` alias, say). With alias expansion ON — the default in
  # an interactive shell — `.` rewrites `pytest ()` into `python -m pytest ()`
  # and aborts the whole source, so everything after that line is lost. Disable
  # expansion just for the load and restore the shell's prior setting after; the
  # alias still wins at the command line, the dumped function is a harmless twin.
  _bsda_prev_ea=$(shopt -p expand_aliases)
  shopt -u expand_aliases
  # shellcheck disable=SC1090
  . "$_BASH_SYLE_DYNAMIC_CACHE"
  eval "$_bsda_prev_ea"
  unset _bsda_prev_ea
else
  _build_dynamic_aliases
  _dump_dynamic_aliases_cache
fi
