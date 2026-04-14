/** Downloads and installs the url-porter Chrome extension. */
async function doWork() {
  if (IS_CI) return;

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

  const targetPath = await getCustomTweaksPath("url-porter");
  const zipUrl = "https://synle.github.io/url-porter/url-porter.zip";
  const tmpZip = `${BASHRC_TEMP_DIR}/url-porter.zip`;

  log(">> Installing url-porter extension to:", targetPath);

  deleteFolder(targetPath).then(async () => {
    await mkdir(targetPath);
    await downloadAsset(zipUrl, tmpZip);
    await execBash(`unzip -oq "${tmpZip}" -d "${targetPath}"`);
    await deleteFile(tmpZip);
  });
}
