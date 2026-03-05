/** * Gate check that exits early if the current OS is not Windows. */
async function doWork() {
  const profile = (await fetchUrlAsString("software/scripts/windows/_only-profile.bash")).trim();
  registerPlatformTweaks("Windows / WSL / Ubuntu", profile);
}
