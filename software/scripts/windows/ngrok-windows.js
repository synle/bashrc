/// <reference path="../../base-node-script.js" />

async function doWork() {
  await downloadWindowsApp('ngrok', (f) => f.includes('ngrok'));
}