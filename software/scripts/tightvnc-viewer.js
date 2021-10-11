async function doWork() {
  let targetPath = BASE_SY_CUSTOM_TWEAKS_DIR;

  await mkdir(targetPath);

  targetPath = path.join(targetPath, 'tightvnc-jviewer.jar');
  console.log('  >> Download tightvnc-jviewer.jar', targetPath);

  if (!is_os_window && !is_os_darwin_mac) {
    console.log(consoleLogColor1('  >> Skipped : Only Mac or Windows'));
    return process.exit();
  }

  const url = `https://raw.githubusercontent.com/synle/bashrc/master/binaries/tightvnc-jviewer.jar`;
  await downloadFile(url, targetPath);
}
