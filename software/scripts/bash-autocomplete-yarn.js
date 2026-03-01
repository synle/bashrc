/**
 * Installs bash autocomplete for yarn commands.
 */
async function doWork() {
  exitIfLimitedSupportOs();
  log(">>> Yarn Bash Autocomplete");

  registerWithBashSyleAutocompleteWithRawContent(
    "Yarn Autocomplete",
    trimLeftSpaces(`
      # ---------------------------------------------------------
      # Yarn
      # Autocomplete yarn commands with script names from
      # package.json — same source as npm run
      # ---------------------------------------------------------
      __yarn_complete ()
      {
        opts=\$(__npm_run_complete_options)
        cur="\${COMP_WORDS[COMP_CWORD]}";
        prev="\${COMP_WORDS[COMP_CWORD-1]}";
        COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
      }
      complete -F __yarn_complete yarn
    `),
  );
}
