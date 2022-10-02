async function doWork() {
  let targetPath = BASE_SY_CUSTOM_TWEAKS_DIR;

  await mkdir(targetPath);

  targetPath = path.join(targetPath, 'kde_konsole_profile.ini');
  console.log('  >> Download KDE Konsole Profile', targetPath);

  if (!is_os_arch_linux) {
    console.log(consoleLogColor1('    >> Skipped : Only Arch Linux'));
    return process.exit();
  }

  const url = `https://raw.githubusercontent.com/synle/bashrc/master/software/scripts/kde-konsole-profile.ini`;
  await downloadFile(url, targetPath);
}
