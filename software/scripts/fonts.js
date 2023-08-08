const linuxFontPath = '/usr/share/fonts/truetype';

async function doWork() {
  const targetFontPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'fonts');

  await mkdir(targetFontPath);

  console.log('  >> Download Ligatures Fonts:', targetFontPath);

  const files = await listRepoDir();

  const fonts = files.filter((f) => f.includes('.ttf'));

  console.log('  >> Downloading fonts', fonts.length);

  if (fonts.length.length === 0) {
    console.log(consoleLogColor1('    >> Skipped : No fonts found'));
    return process.exit();
  }

  const promises = [];
  for (const font of fonts) {
    promises.push(
      new Promise(async (resolve) => {
        const destination = path.join(targetFontPath, 'Font-' + path.basename(font));

        try {
          const url = font;
          const downloaded = await downloadFile(url, destination);
          if (downloaded === true) {
            console.log(consoleLogColor3('      >> Downloaded'), consoleLogColor4(destination));
          }
        } catch (err) {
          console.log(consoleLogColor3('      >> Error Downloading'), consoleLogColor4(font));
        }

        resolve();
      }),
    );
  }

  // for linux
  if (filePathExist(linuxFontPath)) {
    console.log('  >> Downloading fonts for Linux', linuxFontPath);
    console.log('    >> sudo fc-cache -fv');

    for (const font of fonts) {
      promises.push(
        new Promise(async (resolve) => {
          const destination = path.join(linuxFontPath, path.basename(font));

          try {
            const url = font;
            const downloaded = await downloadFile(url, destination);
            if (downloaded === true) {
              console.log(consoleLogColor3('      >> Downloaded'), consoleLogColor4(destination));
            }
          } catch (err) {
            console.log(consoleLogColor3('      >> Error Downloading'), consoleLogColor4(font));
          }

          resolve();
        }),
      );
    }
  }

  // await
  await Promise.allSettled(promises);
}
