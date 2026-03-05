/** * Gate check that exits early if the current OS is not SteamOS. */
async function doWork() {
  registerPlatformTweaks(
    "SteamOS",
    trimLeftSpaces(`
      # Only SteamOS alias
    `).trim(),
  );
}
