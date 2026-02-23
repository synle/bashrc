/// <reference path="../base-node-script.js" />

async function doWork() {
  await downloadWindowsApp('tightvnc', (f) => f.includes('tightvnc-jviewer.jar'));
}
