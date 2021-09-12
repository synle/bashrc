/** * Downloads the TightVNC Java viewer application for Windows. */
async function doWork() {
  await downloadWindowsApp('tightvnc', (f) => f.includes('tightvnc-jviewer.jar'));
}
