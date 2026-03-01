/** * Installs fonts on Chrome OS by copying them to the system font directory. */
async function doWork() {
  const targetPath = `/usr/local/share/fonts`;

  log("  >> Download Ligatures Fonts - for ChromeOS Ubuntu:", colorDim(targetPath));

  exitIfPathNotFound(targetPath);

  const files = await listRepoDir();

  const fonts = files.filter((f) => f.includes(".ttf"));

  log("  >> Downloading fonts", colorDim(fonts.length));

  if (fonts.length === 0) {
    log("    >> Skipped : No fonts found");
    return process.exit();
  }

  const promises = [];
  for (const font of fonts) {
    promises.push(
      new Promise(async (resolve) => {
        const destination = path.join(targetPath, "Font-" + path.basename(font));

        try {
          const url = font;
          const downloaded = await downloadFile(url, destination);
          if (downloaded === true) {
            log("      >> Downloaded", colorDim(destination));
          }
        } catch (err) {
          log("      >> Error Downloading", colorDim(font));
        }

        resolve();
      }),
    );
  }

  // await
  await Promise.allSettled(promises);
}
