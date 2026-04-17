/** @type {string} GitHub repo identifier for sqlui-native releases. */
const SQLUI_NATIVE_REPO = "synle/sqlui-native";

/** Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  await downloadAndInstallBinary(SQLUI_NATIVE_REPO, () => {
    const arch = os.arch() === "arm64" ? "arm64" : "x64";
    return is_os_mac ? `sqlui-native-${arch}.dmg` : is_os_windows ? `sqlui-native-x64.exe` : `sqlui-native.AppImage`;
  });
}
