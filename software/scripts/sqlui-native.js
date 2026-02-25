/// <reference path="../index.js" />

const SQLUI_NATIVE_VERSION = "1.64.4";

/** * Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "sqlui-native");
  const baseUrl = `https://github.com/synle/sqlui-native/releases/download/${SQLUI_NATIVE_VERSION}`;

  let fileName;
  if (is_os_window) {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}-x64.exe`;
  } else if (is_os_darwin_mac) {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}-x64.dmg`;
  } else {
    fileName = `sqlui-native-${SQLUI_NATIVE_VERSION}.AppImage`;
  }

  const url = `${baseUrl}/${fileName}`;
  const destination = path.join(targetPath, fileName);

  if (TEST_FORCE_REFRESH) {
    console.log("  >> Force refresh: deleting old sqlui-native files");
    await deleteFolder(targetPath);
  }

  if (fs.existsSync(targetPath)) {
    console.log(`  >> sqlui-native v${SQLUI_NATIVE_VERSION} already installed, skipping:`, targetPath);
    return;
  }

  console.log(`  >> Installing sqlui-native v${SQLUI_NATIVE_VERSION} to:`, targetPath);

  await mkdir(targetPath);
  await downloadAsset(url, destination);

  console.log(`  >> sqlui-native v${SQLUI_NATIVE_VERSION} downloaded:`, destination);

  if (is_os_darwin_mac) {
    writeText(path.join(targetPath, "README.txt"), "xattr -cr /Applications/sqlui-native.app");
    console.log("  >> Created README.txt with macOS quarantine fix");
  }
}
