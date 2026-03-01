/** * Gate check that exits early if the current OS is not Ubuntu / Debian / Mint. */
async function doWork() {
  registerPlatformTweaks(
    "Only Ubuntu",
    ".bash_syle_only_ubuntu",
    trimLeftSpaces(`
      # Only Ubuntu alias
    `).trim(),
  );
}
