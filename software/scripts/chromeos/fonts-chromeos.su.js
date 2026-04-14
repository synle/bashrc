/** Installs fonts on Chrome OS by copying them to the system font directory. */
// SOURCE software/scripts/fonts.common.js
async function doWork() {
  exitIfNotSudo();

  const targetPath = `/usr/local/share/fonts`;
  const downloadPath = path.join(BASE_HOMEDIR_LINUX, "Downloads/fonts");

  log(">> Download Ligatures Fonts - for ChromeOS Ubuntu:", targetPath);

  exitIfPathNotFound(targetPath);

  const fonts = await getFonts();

  log(">> Downloading fonts", fonts.length);

  if (fonts.length === 0) {
    log(">>> Skipped : No fonts found");
    throw new ScriptSkipError("No fonts found");
  }

  await deleteFolder(downloadPath);
  await mkdir(downloadPath);
  const results = await downloadAssets(fonts, downloadPath);
  for (const downloaded of results) {
    if (downloaded) {
      log(">>>> Downloaded", downloaded);
    }
  }

  log(">> Moving fonts to", targetPath);
  await execBash(`cp -f "${downloadPath}"/*.ttf "${targetPath}/"`);
  await deleteFolder(downloadPath);
}
