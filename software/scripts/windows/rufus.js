/// <reference path="../../base-node-script.js" />

async function doWork() {
  await downloadWindowsApp('rufus', (f) => f.includes('rufus'));
}
