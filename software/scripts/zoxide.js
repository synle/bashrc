/** Retires managed zoxide integration while preserving installed binaries and navigation history. */

/**
 * Queue legacy block removal and idempotent live-shell cleanup for the next profile load.
 * TODO: Remove this script, its marker, and dormant completion inventory after every managed machine has decommissioned zoxide.
 * @returns {Promise<void>} Resolves after profile changes are queued; the engine flushes them to disk.
 */
async function doWork() {
  log(">> Retiring zoxide shell integration");
  removeFromBashSyleProfile("zoxide init");
  removeFromBashSyleProfile("zoxide Spec Autocomplete");
  registerWithBashSyleProfile(
    "Retired zoxide cleanup",
    code`
      # Remove only zoxide-owned shell state; preserve other navigation and prompt customizations.
      # No arguments or output. Returns success; does not uninstall binaries or delete history.
      function _sy_remove_zoxide() {
        local name definition index value
        local hook_pattern='(^|;)[[:space:]]*__zoxide_hook[[:space:]]*(;|$)'
        for index in "\${!PROMPT_COMMAND[@]}"; do
          value="\${PROMPT_COMMAND[$index]}"
          while [[ "$value" =~ $hook_pattern ]]; do
            value="\${value/"\${BASH_REMATCH[0]}"/;}"
            value="\${value#;}"
            value="\${value%;}"
          done
          if [[ "$(declare -p PROMPT_COMMAND)" != 'declare -a'* ]]; then
            PROMPT_COMMAND="$value"
          elif [ -n "$value" ]; then
            PROMPT_COMMAND[$index]="$value"
          else
            unset 'PROMPT_COMMAND[index]'
          fi
        done

        for name in cd cdi z zi; do
          definition=$(alias "$name" 2> /dev/null)
          [[ "$definition" == *'__zoxide_'* ]] && unalias "$name"
          definition=$(declare -f "$name")
          [[ "$definition" == *'__zoxide_'* ]] && unset -f "$name"
          definition=$(complete -p "$name" 2> /dev/null)
          [[ "$definition" == *'__zoxide_'* ]] && complete -r "$name"
        done
        definition=$(complete -p zoxide 2> /dev/null)
        [[ "$definition" == *'__spec_complete_zoxide'* ]] && complete -r zoxide
        unset -f __spec_complete_zoxide
        # A pending interactive completion can leave this zoxide-owned Readline callback behind.
        if [[ -o emacs || -o vi ]] && [[ "$(bind -X 2> /dev/null)" == *'__zoxide_z_complete_helper'* ]]; then
          bind '"\\e[0n": redraw-current-line'
        fi
        while IFS= read -r name; do
          unset -f "$name"
        done < <(compgen -A function __zoxide_)
        while IFS= read -r name; do
          unset -v "$name"
        done < <(compgen -A variable __zoxide_)
        return 0
      }
      _sy_remove_zoxide
      unset -f _sy_remove_zoxide
    `,
  );
}
