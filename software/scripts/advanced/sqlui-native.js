/** @type {string} GitHub repo identifier for sqlui-native releases. */
const SQLUI_NATIVE_REPO = "synle/sqlui-native";

/** Downloads the sqlui-native application binary for the current platform. */
async function doWork() {
  await downloadAndInstallBinary(SQLUI_NATIVE_REPO, (ver, isArm64) => {
    return is_os_mac
      ? `sqlui-native_${ver}_${isArm64 ? "aarch64" : "x64"}.dmg`
      : is_os_windows
        ? `sqlui-native_${ver}_x64-setup.exe`
        : `sqlui-native_${ver}_amd64.AppImage`;
  });
}
