/** * Downloads and installs the url-porter Chrome extension. */
async function doWork() {
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "url-porter");
  const zipUrl = "https://github.com/synle/url-porter/raw/refs/heads/main/url-porter.zip";
  const tmpZip = "/tmp/url-porter.zip";

  if (TEST_FORCE_REFRESH) {
    console.log("  >> Force refresh: deleting old url-porter files");
    await deleteFolder(targetPath);
  }

  if (fs.existsSync(targetPath)) {
    console.log("  >> url-porter already installed, skipping:", targetPath);
    return;
  }

  console.log("  >> Installing url-porter extension to:", targetPath);

  await mkdir(targetPath);
  await downloadAsset(zipUrl, tmpZip);
  await execBash(`unzip -oq "${tmpZip}" -d "${targetPath}"`);
  await deleteFolder(tmpZip);

  console.log("  >> url-porter installed:", targetPath);
}
