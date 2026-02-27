/// <reference path="../../index.js" />

/** * Gate check that exits early if the current OS is not Windows. */
async function doWork() {
  const profile = readText("software/scripts/windows/_only-windows-profile.bash").trim();
  registerPlatformTweaks("Only Windows / WSL / Ubuntu", ".bash_syle_only_windows", profile);
}
