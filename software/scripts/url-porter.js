/// <reference path="../index.js" />

/** * Downloads and installs the url-porter Chrome extension. */
async function doWork() {
  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "url-porter");
  const zipUrl = "https://github.com/synle/url-porter/raw/refs/heads/main/url-porter.zip";
  const tmpZip = "/tmp/url-porter.zip";

  if (TEST_FORCE_REFRESH) {
    console.log("  >> Force refresh: deleting old url-porter files");
    await execBashSilent(`rm -rf "${targetPath}"`);
  }

  if (fs.existsSync(targetPath)) {
    console.log("  >> url-porter already installed, skipping:", targetPath);
    return;
  }

  console.log("  >> Installing url-porter extension to:", targetPath);

  await mkdir(targetPath);
  await execBash(`curl -L "${zipUrl}" -o "${tmpZip}"`);
  await execBash(`unzip -oq "${tmpZip}" -d "${targetPath}"`);
  await execBashSilent(`rm -f "${tmpZip}"`);

  console.log("  >> url-porter installed:", targetPath);
}
