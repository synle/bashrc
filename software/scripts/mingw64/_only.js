/** * Gate check that exits early if the current OS is not MSYS2 / Cygwin / MinGW64. */
async function doWork() {
  registerPlatformTweaks(
    "MinGW64",
    trimLeftSpaces(`
      # Only MinGW64 alias
    `).trim(),
  );
}
