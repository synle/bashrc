/// <reference path="../index.js" />

async function doWork() {
  await downloadWindowsApp('tightvnc', (f) => f.includes('tightvnc-jviewer.jar'));
}
