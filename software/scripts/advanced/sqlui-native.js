/** Installs the sqlui-native desktop app from the synle/sqlui-native release feed. */

/** @type {string} GitHub repo identifier for sqlui-native releases. */
const SQLUI_NATIVE_REPO = "synle/sqlui-native";

/**
 * Installs the sqlui-native desktop app (.dmg / .exe / .AppImage) via
 * downloadAndInstallBinary, which routes the Mac .dmg through BASHRC_TEMP_DIR
 * (no longer parked in ~/_extra/sqlui-native/).
 *
 * The Node-based sqlui-portal CLI was split out into its own dedicated script
 * (software/scripts/advanced/sqlui-portal.js) and now pulls from the
 * synle/sqlui-portal release feed.
 */
async function doWork() {
  await downloadAndInstallBinary(SQLUI_NATIVE_REPO, (ver, isArm64) => {
    return is_os_mac
      ? `sqlui-native_${ver}_${isArm64 ? "aarch64" : "x64"}.dmg`
      : is_os_windows
        ? `sqlui-native_${ver}_x64-setup.exe`
        : `sqlui-native_${ver}_amd64.AppImage`;
  });
}
