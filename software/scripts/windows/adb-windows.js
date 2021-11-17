async function doWork() {
  let targetPath = getWindowsSyBinaryDir();

  if (fs.existsSync(targetPath)) {
    // push this binary into d drive
    targetPath = path.join(targetPath, 'Applications');
  } else {
    // else use the extra folder
    targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'windows');
  }

  // create the folder if needed
  targetPath = path.join(targetPath, 'adb');
  await mkdir(targetPath);

  console.log('  >> Download ADB (Android Debug Bridge) for Windows:', targetPath);

  const files = await listRepoDir();

  const adbFiles = files.filter((f) => f.includes('binaries/adb-windows/') && !f.includes('README'));

  const promises = [];
  for (const file of adbFiles) {
    promises.push(
      new Promise(async (resolve) => {
        const destination = path.join(targetPath, path.basename(file));

        try {
          const url = file;
          const downloaded = await downloadFile(url, destination);
          if (downloaded === true) {
            console.log(consoleLogColor3('      >> Downloaded'), consoleLogColor4(destination));
          }
        } catch (err) {
          console.log(consoleLogColor3('      >> Error Downloading'), consoleLogColor4(file));
        }

        resolve();
      }),
    );
  }

  // await
  await Promise.allSettled(promises);
}
