/** * Gate check that exits early if the current OS is not Windows Subsystem for Linux. */
async function doWork() {
  registerPlatformTweaks(
    "WSL",
    trimLeftSpaces(`
      # Only WSL alias
    `).trim(),
  );
}
