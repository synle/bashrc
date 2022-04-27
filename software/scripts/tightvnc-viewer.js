async function doWork() {
  const applicationName = 'tightvnc';
  const targetPath = await getWindowsApplicationBinaryDir(applicationName);

  console.log(`  >> Download ${applicationName} for Windows:`, targetPath);
  try {
    downloadFilesFromMainRepo((f) => f.includes('tightvnc-jviewer.jar'), targetPath);
  } catch (err) {
    console.error('error', error);
  }
}
