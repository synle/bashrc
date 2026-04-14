const SQLUI_NATIVE_RELEASE_URL = "https://raw.githubusercontent.com/synle/sqlui-native/refs/heads/main/release.json";

/** Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  if (IS_CI) return;

  if (is_os_mac) {
    // mac: await download because we need to install the DMG after
    const version = (await readJson`${SQLUI_NATIVE_RELEASE_URL}`).version;
    const targetPath = await getCustomTweaksPath("sqlui-native");

    log(`>> Installing sqlui-native v${version} for Mac to:`, targetPath);

    await deleteFolder(targetPath);
    await mkdir(targetPath);

    const arch = os.arch() === "arm64" ? "arm64" : "x64";
    const fileName = `sqlui-native-${arch}.dmg`;
    const url = `https://github.com/synle/sqlui-native/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    await downloadAsset(url, destination);
    log(`>> sqlui-native v${version} downloaded:`, destination);
    await installMacDmg(destination, "sqlui-native.app");
  } else {
    // non-mac: await the download to prevent early exit
    const version = (await readJson`${SQLUI_NATIVE_RELEASE_URL}`).version;
    const targetPath = await getCustomTweaksPath("sqlui-native");

    log(`>> Installing sqlui-native v${version} for NonMac to:`, targetPath);

    await deleteFolder(targetPath);
    await mkdir(targetPath);

    const fileName = is_os_windows ? `sqlui-native-x64.exe` : `sqlui-native.AppImage`;
    const url = `https://github.com/synle/sqlui-native/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    await downloadAsset(url, destination);
    log(`>> sqlui-native v${version} downloaded:`, destination);
  }
}
