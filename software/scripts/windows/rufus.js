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
  targetPath = path.join(targetPath, 'rufus');
  await mkdir(targetPath);

  targetPath = path.join(targetPath, 'rufus.exe');

  console.log('  >> Download Rufus ISO Creation', targetPath);

  if (!is_os_window) {
    console.log(consoleLogColor1('    >> Skipped : Only Windows'));
    return process.exit();
  }

  // refer to this link https://rufus.ie/en/
  const url = `https://raw.githubusercontent.com/synle/bashrc/master/binaries/rufus.exe`;
  await downloadFile(url, targetPath);
}
