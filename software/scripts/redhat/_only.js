/** * Gate check that exits early if the current OS is not Fedora / RHEL / CentOS / Rocky. */
async function doWork() {
  registerPlatformTweaks(
    "Only RedHat",
    ".bash_syle_only_redhat",
    trimLeftSpaces(`
      # Only RedHat alias
    `).trim(),
  );
}
