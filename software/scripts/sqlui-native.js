const SQLUI_NATIVE_RELEASE_URL = "https://raw.githubusercontent.com/synle/sqlui-native/refs/heads/main/release.json";

/** * Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  const SQLUI_NATIVE_VERSION = (await fetchUrlAsJson(SQLUI_NATIVE_RELEASE_URL)).version;
  exitIfLimitedSupportOs();
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "sqlui-native");
  const baseUrl = `https://github.com/synle/sqlui-native/releases/download/${SQLUI_NATIVE_VERSION}`;

  let fileName;
  if (is_os_windows) {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}-x64.exe`;
  } else if (is_os_mac) {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}-x64.dmg`;
  } else {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}.AppImage`;
  }

  const url = `${baseUrl}/${fileName}`;
  const destination = path.join(targetPath, fileName);

  if (IS_FORCE_REFRESH) {
    log(">> Force refresh: deleting old sqlui-native files");
    await deleteFolder(targetPath);
  }

  if (fs.existsSync(targetPath)) {
    log(`>> sqlui-native v${SQLUI_NATIVE_VERSION} already installed, skipping:`, targetPath);
    return;
  }

  log(`>> Installing sqlui-native v${SQLUI_NATIVE_VERSION} to:`, targetPath);

  await mkdir(targetPath);
  downloadAsset(url, destination).then(() => {
    log(`>> sqlui-native v${SQLUI_NATIVE_VERSION} downloaded:`, destination);

    if (is_os_mac) {
      const mountPoint = `/tmp/sqlui-native-dmg`;
      execBash(`hdiutil attach "${destination}" -mountpoint "${mountPoint}" -nobrowse -quiet`);
      execBash(`cp -R "${mountPoint}/sqlui-native.app" /Applications/`);
      execBash(`hdiutil detach "${mountPoint}" -quiet`);
      log(">> Installed sqlui-native.app to /Applications");
      clearMacQuarantine(path.join(targetPath, "README.txt"), "/Applications/sqlui-native.app");
    }
  });
}
