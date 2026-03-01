/**
 * Installs SSH bash autocomplete from ~/.ssh/config hostnames.
 */
async function doWork() {
  exitIfLimitedSupportOs();
  console.log("    >> SSH Bash Autocomplete");

  registerWithBashSyleAutocompleteWithRawContent(
    "SSH Autocomplete",
    trimLeftSpaces(`
      # ---------------------------------------------------------
      # SSH
      # Autocomplete hostnames from ~/.ssh/config and
      # ~/.ssh/config.d/* — filters out wildcard entries
      # ---------------------------------------------------------
      __ssh_complete(){
        opts=\$([ -f ~/.ssh/config ] && grep "^Host" ~/.ssh/config ~/.ssh/config.d/* 2>/dev/null | grep -v "[?*]" | cut -d " " -f 2-)
        cur="\${COMP_WORDS[COMP_CWORD]}"
        COMPREPLY=( \$(compgen -W "\$opts" -- \${cur}) )
      }
      complete -F __ssh_complete ssh
      complete -F __ssh_complete s
    `),
  );
}
