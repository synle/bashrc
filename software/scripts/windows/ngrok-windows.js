async function doWork() {
  const applicationName = 'ngrok';
  const targetPath = await getWindowsApplicationBinaryDir(applicationName);

  console.log(`  >> Download ${applicationName} for Windows:`, targetPath);
  try {
    downloadFilesFromMainRepo((f) => f.includes(applicationName), targetPath);
  } catch (err) {
    console.error('error', error);
  }
}
