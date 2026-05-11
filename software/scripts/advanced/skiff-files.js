/** Installs the synle/skiff-files desktop app from its GitHub release feed. */

/** @type {string} GitHub repo identifier for skiff-files releases. */
const SKIFF_FILES_REPO = "synle/skiff-files";

/**
 * Downloads the skiff-files application binary for the current platform.
 * No post-install permission reset is needed — skiff-files does not require
 * macOS Accessibility / input-event grants.
 */
async function doWork() {
  await downloadAndInstallBinary(SKIFF_FILES_REPO, (ver, isArm64) => {
    return is_os_mac
      ? `Skiff.Files_${ver}_${isArm64 ? "aarch64" : "x64"}.dmg`
      : is_os_windows
        ? `Skiff.Files_${ver}_x64-setup.exe`
        : `Skiff.Files_${ver}_amd64.AppImage`;
  });
}
