async function doWork() {
  const targetFontPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'fonts');

  await mkdir(targetFontPath);

  console.log('  >> Download Ligatures Fonts:', targetFontPath);

  if (!is_os_window && !is_os_darwin_mac && !is_os_arch_linux) {
    console.log(consoleLogColor1('  >> Skipped : Only Mac or Windows or Arch Linux'));
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

  // await
  await Promise.allSettled(promises);
}
