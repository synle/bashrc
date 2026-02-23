/// <reference path="../../base-node-script.js" />


async function doWork() {
  await downloadWindowsApp('adb', (f) => f.includes('adb-windows'));
}