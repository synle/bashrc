/** Downloads and installs Android Debug Bridge (ADB) for Windows. */
async function doWork() {
  const adbBinaryDir = await downloadApp("adb", "adb-windows");
  const adbBinaryWinDir = toWindowsPath(adbBinaryDir);
  registerWithPowershellProfile("adb", `Set-Alias adb "${adbBinaryWinDir}/adb.exe"`);
}
