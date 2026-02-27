/** * Downloads and installs Android Debug Bridge (ADB) for Windows. */
async function doWork() {
  await downloadWindowsApp("adb", (f) => f.includes("adb-windows"));
}
