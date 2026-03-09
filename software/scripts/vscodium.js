const VSCODIUM_RELEASE_URL = "https://api.github.com/repos/VSCodium/vscodium/releases/latest";

/** * Downloads and installs VSCodium for the current platform. */
async function doWork() {
  exitIfLimitedSupportOs();
  exitIfUnsupportedOs(
    "is_os_android_termux",
    "is_os_arch_linux",
    "is_os_chromeos",
    "is_os_steamos",
    "is_os_mingw64",
    "is_os_redhat",
    "is_os_ubuntu",
  );

  const version = (await fetchUrlAsJson(VSCODIUM_RELEASE_URL)).tag_name;
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "vscodium");

  if (IS_FORCE_REFRESH) {
    log(">> Force refresh: deleting old vscodium files");
    await deleteFolder(targetPath);
  }

  if (fs.existsSync(targetPath)) {
    log(`>> VSCodium v${version} already installed, skipping:`, targetPath);
    return;
  }

  log(`>> Installing VSCodium v${version} to:`, targetPath);

  if (is_os_mac) {
    const arch = process.arch === "x64" ? "x64" : "arm64";
    const fileName = `VSCodium.${arch}.${version}.dmg`;
    const url = `https://github.com/VSCodium/vscodium/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    await mkdir(targetPath);
    downloadAsset(url, destination).then(() => {
      log(`>> VSCodium v${version} downloaded:`, destination);
      installMacDmg(destination);
      log(">> Installed VSCodium.app to /Applications");
      clearMacQuarantine(path.join(targetPath, "README.txt"), "/Applications/VSCodium.app");
    });
  } else if (is_os_windows) {
    const fileName = `VSCodiumSetup-x64-${version}.exe`;
    const url = `https://github.com/VSCodium/vscodium/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    await mkdir(targetPath);
    downloadAsset(url, destination).then(() => {
      log(`>> VSCodium v${version} downloaded:`, destination);
    });
  }
}
