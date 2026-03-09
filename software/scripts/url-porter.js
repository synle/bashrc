/** * Downloads and installs the url-porter Chrome extension. */
async function doWork() {
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "url-porter");
  const zipUrl = "https://github.com/synle/url-porter/raw/refs/heads/main/url-porter.zip";
  const tmpZip = "/tmp/url-porter.zip";

  log(">> Installing url-porter extension to:", targetPath);

  deleteFolder(targetPath).then(async () => {
    await mkdir(targetPath);
    await downloadAsset(zipUrl, tmpZip);
    await execBash(`unzip -oq "${tmpZip}" -d "${targetPath}"`);
    await deleteFolder(tmpZip);
  });
}
