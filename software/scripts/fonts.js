async function doWork() {
  const targetFontPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'fonts');

  await mkdir(targetFontPath);

  console.log('  >> Download Ligatures Fonts Fira Code and Cascadia Code:', targetFontPath);

  if (!is_os_window && !is_os_darwin_mac) {
    console.log(consoleLogColor1('  >> Skipped : Only Mac or Windows'));
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
        try {
          const url = `https://raw.githubusercontent.com/synle/bashrc/master/${font}`;
          const destination = path.join(targetFontPath, 'Font-' + path.basename(font));
          await downloadFile(url, destination);
          console.log(consoleLogColor3('      >> Downloaded'), consoleLogColor4(destination));
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
