async function doWork() {
  let targetPath = getWindowsSyBinaryDir();

  if (fs.existsSync(targetPath)) {
    // push this binary into d drive
    targetPath = path.join(targetPath, 'Applications');
  } else {
    // else use the extra folder
    targetPath = BASE_SY_CUSTOM_TWEAKS_DIR;
  }

  // create the folder if needed
  targetPath = path.join(targetPath, 'tightvnc');
  await mkdir(targetPath);

  targetPath = path.join(targetPath, 'tightvnc-jviewer.jar');
  console.log('  >> Download tightvnc-jviewer.jar', targetPath);

  if (!is_os_window && !is_os_darwin_mac) {
    console.log(consoleLogColor1('  >> Skipped : Only Mac or Windows'));
    return process.exit();
  }

  const url = `/binaries/tightvnc-jviewer.jar`;
  await downloadFile(url, targetPath);
}
