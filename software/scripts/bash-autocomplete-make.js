/// <reference path="../index.js" />

/**
 * Installs Make bash autocomplete for Makefile target names.
 */
async function doWork() {
  console.log("    >> Make Bash Autocomplete");

  registerWithBashSyleAutocompleteWithRawContent(
    "Make Autocomplete",
    trimLeftSpaces(`
      # ---------------------------------------------------------
      # Make
      # Autocomplete Makefile target names by parsing the
      # Makefile in the current directory
      # ---------------------------------------------------------
      __make_complete ()
      {
        opts=\$([ -f Makefile ] && cat Makefile | grep -v ' ' | cut -d ':' -f 1 | uniq);
        cur="\${COMP_WORDS[COMP_CWORD]}";
        COMPREPLY=(\$(compgen -W "\$opts" -- \${cur}));
      }
      complete -F __make_complete make
    `),
  );
}
