/// <reference path="../index.js" />

/**
 * Sets up bash autocomplete by registering the autocomplete source file with the profile.
 */
async function doWork() {
  console.log("  >> Installing Bash Autocomplete", consoleLogColor4(BASE_BASH_SYLE_AUTOCOMPLETE));

  // Register the autocomplete file to be sourced from .bash_syle
  registerWithBashSyleProfile("Sy bash autocomplete", `[ -s ${BASE_BASH_SYLE_AUTOCOMPLETE} ] && . ${BASE_BASH_SYLE_AUTOCOMPLETE}`);
}
