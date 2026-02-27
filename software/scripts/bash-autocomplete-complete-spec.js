/// <reference path="../index.js" />

/**
 * Installs bash autocomplete for docker using a spec-based approach.
 * Downloads the complete-spec file and registers a generic spec-based completer.
 */
async function doWork() {
  console.log("    >> Docker Bash Autocomplete");

  await registerWithBashSyleAutocompleteWithCompleteSpec("docker", "software/scripts/bash-autocomplete-complete-spec-docker");
}
