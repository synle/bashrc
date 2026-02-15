async function doWork() {
  await downloadWindowsApp('ngrok', (f) => f.includes('ngrok'));
}
