/** @type {string} GitHub API URL for the latest url-porter release. */
const URL_PORTER_RELEASE_URL = "https://api.github.com/repos/synle/url-porter/releases/latest";

/** Downloads and installs the url-porter Chrome extension. */
async function doWork() {
  const version = await fetchGitHubReleaseVersion(URL_PORTER_RELEASE_URL);
  if (!version) return;

  const targetPath = await getCustomTweaksPath("url-porter");
  const zipUrl = `https://github.com/synle/url-porter/releases/download/${version}/url-porter.zip`;
  const tmpZip = `${BASHRC_TEMP_DIR}/url-porter.zip`;

  const hasBrowser = resolveOsKey({
    mac: () =>
      pathExists("/Applications", /^Google Chrome\.app$/) ||
      pathExists("/Applications", /^Brave Browser\.app$/) ||
      pathExists("/Applications", /^Microsoft Edge\.app$/),
    windows: () =>
      pathExists(`${BASE_PROGRAM_FILES_WINDOW}/Google/Chrome`, /Application/) ||
      pathExists(`${BASE_PROGRAM_FILES_WINDOW}/BraveSoftware/Brave-Browser`, /Application/) ||
      pathExists(`${BASE_PROGRAM_FILES_WINDOW}/Microsoft/Edge`, /Application/),
    linux: () =>
      pathExists("/usr/bin", /^google-chrome$/) ||
      pathExists("/usr/bin", /^brave-browser$/) ||
      pathExists("/usr/bin", /^microsoft-edge$/) ||
      pathExists("/usr/bin", /^chromium$/) ||
      pathExists("/usr/bin", /^chromium-browser$/),
  })();
  if (!hasBrowser) {
    log(">> url-porter >> Skipped (no Chrome/Brave/Edge found)");
    return;
  }

  log(`>> Installing url-porter ${version} extension to:`, targetPath);

  deleteFolder(targetPath).then(async () => {
    await mkdir(targetPath);
    const ok = await downloadAssetWithFallback(URL_PORTER_RELEASE_URL, zipUrl, tmpZip);
    if (ok) {
      await execBash(`unzip -oq "${tmpZip}" -d "${targetPath}"`);
    }
    await deleteFile(tmpZip);
  });
}
