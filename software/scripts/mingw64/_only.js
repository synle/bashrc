/** * Gate check that exits early if the current OS is not MSYS2 / Cygwin / MinGW64. */
async function doWork() {
  registerPlatformTweaks(
    "Only MinGW64",
    ".bash_syle_only_mingw64",
    trimLeftSpaces(`
      # Only MinGW64 alias
    `).trim(),
  );
}
