const SQLUI_NATIVE_RELEASE_URL = "https://raw.githubusercontent.com/synle/sqlui-native/refs/heads/main/release.json";

/** * Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  exitIfLimitedSupportOs();
  exitIfUnsupportedOs("is_os_mingw64");

  const version = (await fetchUrlAsJson(SQLUI_NATIVE_RELEASE_URL)).version;
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "sqlui-native");

  log(`>> Installing sqlui-native v${version} to:`, targetPath);

  await deleteFolder(targetPath);
  await mkdir(targetPath);

  if (is_os_mac) {
    const fileName = `sqlui-native-${version}-x64.dmg`;
    const url = `https://github.com/synle/sqlui-native/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    downloadAsset(url, destination).then(async () => {
      log(`>> sqlui-native v${version} downloaded:`, destination);
      await installMacDmg(destination, "sqlui-native.app");
    });
  } else if (is_os_windows) {
    const fileName = `sqlui-native-${version}-x64.exe`;
    const url = `https://github.com/synle/sqlui-native/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    downloadAsset(url, destination).then(() => {
      log(`>> sqlui-native v${version} downloaded:`, destination);
    });
  } else {
    const fileName = `sqlui-native-${version}.AppImage`;
    const url = `https://github.com/synle/sqlui-native/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    downloadAsset(url, destination).then(() => {
      log(`>> sqlui-native v${version} downloaded:`, destination);
    });
  }
}
