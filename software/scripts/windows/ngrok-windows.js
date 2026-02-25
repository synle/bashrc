/// <reference path="../../index.js" />

/** * Downloads and installs ngrok for Windows. */
async function doWork() {
  await downloadWindowsApp("ngrok", (f) => f.includes("ngrok"));
}
