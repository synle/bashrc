/// <reference path="../../index.js" />

async function doWork() {
  await downloadWindowsApp('ngrok', (f) => f.includes('ngrok'));
}
