/**
 * Installs git bash autocomplete from upstream and registers alias completion.
 */
async function doWork() {
  exitIfLimitedSupportOs();
  log("    >> Git Bash Autocomplete");
  const gitAutocompleteScript = await fetchUrlAsString(
    "https://raw.githubusercontent.com/git/git/master/contrib/completion/git-completion.bash",
  );

  registerWithBashSyleAutocompleteWithRawContent(
    "Git Autocomplete",
    trimLeftSpaces(`
      ##########################################################
      # Git Autocomplete (upstream)
      # Provides full tab completion for all git commands,
      # branches, remotes, tags, and options.
      ##########################################################
      ${gitAutocompleteScript}

      # ---------------------------------------------------------
      # Git Aliases
      # Enable git tab completion for the 'g' shorthand alias
      # so 'g che<TAB>' expands just like 'git che<TAB>'
      # ---------------------------------------------------------
      __git_complete g __git_main
      __git_complete git __git_main
    `),
  );
}
