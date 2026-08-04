/** Installs the synle/proxie desktop app from its GitHub release feed. */

/** @type {string} GitHub repo identifier for proxie releases. */
const PROXIE_REPO = "synle/proxie";

/**
 * Downloads the proxie application binary for the current platform.
 * Asset names follow the standard Tauri convention shared by display-dj /
 * sqlui-native / skiff-files (e.g. `Proxie_0.2.0_x64.dmg`). No post-install
 * permission reset is needed — proxie does not require macOS Accessibility
 * or other privileged grants.
 */
async function doWork() {
  await downloadAndInstallBinary(PROXIE_REPO, (ver, isArm64) => {
    return is_os_mac
      ? `Proxie_${ver}_${isArm64 ? "aarch64" : "x64"}.dmg`
      : is_os_windows
        ? `Proxie_${ver}_x64-setup.exe`
        : `Proxie_${ver}_amd64.AppImage`;
  });
}
