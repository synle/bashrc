/** * Gate check that exits early if the current OS is not Ubuntu / Debian / Mint. */
async function doWork() {
  registerPlatformTweaks(
    "Ubuntu",
    trimLeftSpaces(`
      # Only Ubuntu alias
    `).trim(),
  );
}
