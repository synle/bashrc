/** Downloads the display-dj application binary for the current platform. */

/** @type {string} GitHub API URL for the latest display-dj release. */
const DISPLAY_DJ_RELEASE_URL = "https://api.github.com/repos/synle/display-dj/releases/latest";

/** Downloads the display-dj application binary for the current platform. */
async function doWork() {
  const rawVersion = await fetchGitHubReleaseVersion(DISPLAY_DJ_RELEASE_URL);
  if (!rawVersion) return;

  const version = rawVersion.replace(/^v/, "");
  const targetPath = await getCustomTweaksPath("display-dj");

  /** @type {string} */
  let fileName;
  if (is_os_mac) {
    const arch = os.arch() === "arm64" ? "aarch64" : "x64";
    fileName = `Display.DJ_${version}_${arch}.dmg`;
  } else {
    fileName = is_os_windows ? `Display.DJ_${version}_x64-setup.exe` : `Display.DJ_${version}_amd64.AppImage`;
  }

  const url = `https://github.com/synle/display-dj/releases/download/v${version}/${fileName}`;

  log(`>> Installing display-dj v${version} for ${is_os_mac ? "Mac" : "NonMac"} to:`, targetPath);

  await deleteFolder(targetPath);
  await mkdir(targetPath);

  const destination = path.join(targetPath, fileName);
  const ok = await downloadAssetWithFallback(DISPLAY_DJ_RELEASE_URL, url, destination);

  if (ok) {
    log(`>> display-dj v${version} downloaded:`, destination);
    if (is_os_mac) {
      await installMacDmg(destination, "Display DJ.app");
    }
  }
}
