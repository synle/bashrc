/** @type {string} GitHub API URL for the latest sqlui-native release. */
const SQLUI_NATIVE_RELEASE_URL = "https://api.github.com/repos/synle/sqlui-native/releases/latest";

/** Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  if (IS_CI) return;

  const releaseData = await readJson`${SQLUI_NATIVE_RELEASE_URL}`;
  const version = releaseData.tag_name;
  const targetPath = await getCustomTweaksPath("sqlui-native");

  if (is_os_mac) {
    log(`>> Installing sqlui-native ${version} for Mac to:`, targetPath);

    await deleteFolder(targetPath);
    await mkdir(targetPath);

    const arch = os.arch() === "arm64" ? "arm64" : "x64";
    const fileName = `sqlui-native-${arch}.dmg`;
    const url = `https://github.com/synle/sqlui-native/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    await downloadAsset(url, destination);
    log(`>> sqlui-native ${version} downloaded:`, destination);
    await installMacDmg(destination, "sqlui-native.app");
  } else {
    log(`>> Installing sqlui-native ${version} for NonMac to:`, targetPath);

    await deleteFolder(targetPath);
    await mkdir(targetPath);

    const fileName = is_os_windows ? `sqlui-native-x64.exe` : `sqlui-native.AppImage`;
    const url = `https://github.com/synle/sqlui-native/releases/download/${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    await downloadAsset(url, destination);
    log(`>> sqlui-native ${version} downloaded:`, destination);
  }
}
