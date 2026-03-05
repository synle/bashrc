/** * Gate check that exits early if the current OS is not Fedora / RHEL / CentOS / Rocky. */
async function doWork() {
  registerPlatformTweaks(
    "RedHat",
    trimLeftSpaces(`
      # Only RedHat alias
    `).trim(),
  );
}
