/** * Downloads and installs the KDE Konsole terminal profile for Arch Linux. */
async function doWork() {
  let targetPath = BASE_SY_CUSTOM_TWEAKS_DIR;

  await mkdir(targetPath);

  targetPath = path.join(targetPath, "kde_konsole_profile.ini");
  log("  >> Download KDE Konsole Profile", targetPath);

  if (!is_os_arch_linux) {
    log("    >> Skipped : Only Arch Linux");
    return process.exit();
  }

  const content = await fetchUrlAsString("software/scripts/kde-konsole-profile.ini");
  writeText(targetPath, content);
}
