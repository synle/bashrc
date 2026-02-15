async function doWork() {
  await downloadWindowsApp('rufus', (f) => f.includes('rufus'));
}
