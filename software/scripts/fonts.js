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

  // write to build file
  const fontBaseNames = fonts.map((font) => path.basename(font));
  writeToBuildFile([
    [
      'font-linux.md',
      `
cd ~/Desktop
${fontBaseNames.map((fontBaseName) => `curl https://github.com/synle/bashrc/raw/master/fonts/${fontBaseName} -O -J -L && \\`).join('\n')}
echo "Done downloading fonts"
`.trim(),
      false,
    ],
    [
      'font-windows.md',
      `
C:
cd C:
${fontBaseNames
  .map((fontBaseName) => `Start-BitsTransfer -Source https://github.com/synle/bashrc/raw/master/fonts/${fontBaseName}`)
  .join('\n')}
echo "Done downloading fonts"
`.trim(),
      false,
    ],
  ]);
}
