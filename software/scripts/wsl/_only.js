/** * Gate check that exits early if the current OS is not Windows Subsystem for Linux. */
async function doWork() {
  registerPlatformTweaks(
    "Only WSL",
    ".bash_syle_only_wsl",
    trimLeftSpaces(`
      # Only WSL alias
    `).trim(),
  );
}
