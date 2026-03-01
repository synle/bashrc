/** * Gate check that exits early if the current OS is not Steam Deck. */
async function doWork() {
  registerPlatformTweaks(
    "Only Steam Deck",
    ".bash_syle_only_steamdeck",
    trimLeftSpaces(`
      # Only Steam Deck alias
    `).trim(),
  );
}
