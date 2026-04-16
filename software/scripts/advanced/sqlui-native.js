/** @type {string} GitHub repo identifier for sqlui-native releases. */
const SQLUI_NATIVE_REPO = "synle/sqlui-native";

/** Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  const version = await fetchGitHubReleaseVersion(SQLUI_NATIVE_REPO);
  if (!version) return;

  const targetPath = await getCustomTweaksPath("sqlui-native");

  /** @type {string} */
  let fileName;
  if (is_os_mac) {
    const arch = os.arch() === "arm64" ? "arm64" : "x64";
    fileName = `sqlui-native-${arch}.dmg`;
  } else {
    fileName = is_os_windows ? `sqlui-native-x64.exe` : `sqlui-native.AppImage`;
  }

  const url = `https://github.com/synle/sqlui-native/releases/download/${version}/${fileName}`;

  log(`>> Installing sqlui-native ${version} for ${is_os_mac ? "Mac" : "NonMac"} to:`, targetPath);

  await deleteFolder(targetPath);
  await mkdir(targetPath);

  const destination = path.join(targetPath, fileName);
  const ok = await downloadAssetWithFallback(SQLUI_NATIVE_REPO, url, destination);

  if (ok) {
    log(`>> sqlui-native ${version} downloaded:`, destination);
    if (is_os_mac) {
      await installMacDmg(destination, "sqlui-native.app");
    }
  }
}
