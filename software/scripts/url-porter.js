/** * Downloads and installs the url-porter Chrome extension. */
async function doWork() {
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "url-porter");
  const zipUrl = "https://github.com/synle/url-porter/raw/refs/heads/main/url-porter.zip";
  const tmpZip = "/tmp/url-porter.zip";

  if (IS_FORCE_REFRESH) {
    log(">> Force refresh: deleting old url-porter files");
    await deleteFolder(targetPath);
  }

  if (fs.existsSync(targetPath)) {
    log(">> url-porter already installed, skipping:", targetPath);
    return;
  }

  log(">> Installing url-porter extension to:", targetPath);

  await mkdir(targetPath);
  await downloadAsset(zipUrl, tmpZip);
  await execBash(`unzip -oq "${tmpZip}" -d "${targetPath}"`);
  await deleteFolder(tmpZip);

  log(">> url-porter installed:", targetPath);
}
