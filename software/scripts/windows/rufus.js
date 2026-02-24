/// <reference path="../../index.js" />

async function doWork() {
  await downloadWindowsApp('rufus', (f) => f.includes('rufus'));
}
