/// <reference path="../index.js" />

/**
 * Installs bash autocomplete for docker using a spec-based approach.
 * Downloads the complete-spec file and registers a generic spec-based completer.
 */
async function doWork() {
  exitIfUnsupportedOs("is_os_android_termux", "is_os_arch_linux", "is_os_chromeos");
  console.log("    >> Docker Bash Autocomplete");

  await registerWithBashSyleAutocompleteWithCompleteSpec("docker", "software/scripts/bash-autocomplete-complete-spec-docker");
}
