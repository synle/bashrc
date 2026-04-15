/** Downloads the display-dj application binary for the current platform. */

/** @type {string} GitHub API URL for the latest display-dj release. */
const DISPLAY_DJ_RELEASE_URL = "https://api.github.com/repos/synle/display-dj/releases/latest";

/** Downloads the display-dj application binary for the current platform. */
async function doWork() {
  if (IS_CI) return;

  const releaseData = await readJson`${DISPLAY_DJ_RELEASE_URL}`;
  const version = releaseData.tag_name.replace(/^v/, "");
  const targetPath = await getCustomTweaksPath("display-dj");

  if (is_os_mac) {
    log(`>> Installing display-dj v${version} for Mac to:`, targetPath);

    await deleteFolder(targetPath);
    await mkdir(targetPath);

    const arch = os.arch() === "arm64" ? "aarch64" : "x64";
    const fileName = `Display.DJ_${version}_${arch}.dmg`;
    const url = `https://github.com/synle/display-dj/releases/download/v${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    await downloadAsset(url, destination);
    log(`>> display-dj v${version} downloaded:`, destination);
    await installMacDmg(destination, "Display DJ.app");
  } else {
    log(`>> Installing display-dj v${version} for NonMac to:`, targetPath);

    await deleteFolder(targetPath);
    await mkdir(targetPath);

    const fileName = is_os_windows ? `Display.DJ_${version}_x64-setup.exe` : `Display.DJ_${version}_amd64.AppImage`;
    const url = `https://github.com/synle/display-dj/releases/download/v${version}/${fileName}`;
    const destination = path.join(targetPath, fileName);

    await downloadAsset(url, destination);
    log(`>> display-dj v${version} downloaded:`, destination);
  }
}
