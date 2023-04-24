async function doWork() {
  const targetPath = `/usr/local/share/fonts`;

  console.log('  >> Download Ligatures Fonts - for ChromeOS Ubuntu:', targetPath);

  if (!filePathExist(targetPath)) {
    console.log(consoleLogColor1('      >> Skipped : Not Found'));
    return process.exit();
  }

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
        const destination = path.join(targetPath, 'Font-' + path.basename(font));

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

  // await
  await Promise.allSettled(promises);
}
