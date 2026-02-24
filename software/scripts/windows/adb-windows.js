/// <reference path="../../index.js" />

async function doWork() {
  await downloadWindowsApp('adb', (f) => f.includes('adb-windows'));
}
