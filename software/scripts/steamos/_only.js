/** * Gate check that exits early if the current OS is not SteamOS. */
async function doWork() {
  registerPlatformTweaks(
    "Only SteamOS",
    ".bash_syle_only_steamos",
    trimLeftSpaces(`
      # Only SteamOS alias
    `).trim(),
  );
}
