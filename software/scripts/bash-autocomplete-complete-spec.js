/**
 * Installs bash autocomplete for docker and npm using a spec-based approach.
 * Downloads the complete-spec files and registers generic spec-based completers.
 */
async function doWork() {
  exitIfLimitedSupportOs();
  log(">>> Docker Bash Autocomplete");
  await registerWithBashSyleAutocompleteWithCompleteSpec("docker", "software/scripts/bash-autocomplete-complete-spec-docker");

  // TODO
  // log(">>> NPM Bash Autocomplete");
  // await registerWithBashSyleAutocompleteWithCompleteSpec("npm", "software/scripts/bash-autocomplete-complete-spec-npm");
}
