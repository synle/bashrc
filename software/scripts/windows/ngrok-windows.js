async function doWork() {
  const targetPath = await getNewWindowsSyBinaryDir('ngrok');

  console.log('  >> Download ngrok for Windows:', targetPath);
  try{
    downloadFilesFromMainRepo((f) => f.includes('ngrok.exe'), targetPath);
  } catch(err){
    console.error('error', error);
  }
}
