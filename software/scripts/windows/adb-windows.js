async function doWork() {
  const applicationName = 'adb';
  const targetPath = await getWindowsApplicationBinaryDir(applicationName);

  console.log(`  >> Download ${applicationName} for Windows:`, targetPath);
  try {
    downloadFilesFromMainRepo((f) => f.includes('adb-windows'), targetPath);
  } catch (err) {
    console.error('error', error);
  }
}
