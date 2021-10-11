async function doWork() {
  let targetPath = BASE_SY_CUSTOM_TWEAKS_DIR;

  await mkdir(targetPath);

  targetPath = path.join(targetPath, 'wsl_kernel_update_x64.msi');
  console.log('  >> Download WSL2 Kernel Updates', targetPath);

  if (!is_os_window) {
    console.log(consoleLogColor1('    >> Skipped : Only Windows'));
    return process.exit();
  }

  const url = `https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi`;
  await downloadFile(url, targetPath);
}
