/** @type {string} GitHub repo identifier for display-dj releases. */
const DISPLAY_DJ_REPO = "synle/display-dj";

/** Downloads the display-dj application binary for the current platform. */
async function doWork() {
  await downloadAndInstallBinary(DISPLAY_DJ_REPO, (v) => {
    const ver = v.replace(/^v/, "");
    const arch = os.arch() === "arm64" ? "aarch64" : "x64";
    return is_os_mac ? `Display.DJ_${ver}_${arch}.dmg` : is_os_windows ? `Display.DJ_${ver}_x64-setup.exe` : `Display.DJ_${ver}_amd64.AppImage`;
  });
}
