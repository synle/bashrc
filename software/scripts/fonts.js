/// <reference path="../index.js" />

const linuxFontPath = '/usr/share/fonts/truetype';

/** * Downloads ligature fonts and generates platform-specific font installation guides. */
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

  // curl: Add -s (silent, no progress bars) and use --parallel to download all files concurrently instead of sequentially. This reuses connections and downloads simultaneously.
  const linuxFontGuide = `# Fonts - Linux / MacOS
cd ~/Desktop
curl -sSLJ --parallel --parallel-max 10 \\
${fontBaseNames.map((fontBaseName) => `  -O ${BASH_PROFILE_CODE_REPO_RAW_URL}/fonts/${fontBaseName}`).join(' \\\n')}
echo "Done downloading fonts"`;

  // Start-BitsTransfer: Use ForEach-Object to pass each URL explicitly to -Source, since Start-BitsTransfer cannot bind plain strings from the pipeline
  const windowFontGuide = `# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
${fontBaseNames.map((fontBaseName) => `  "${BASH_PROFILE_CODE_REPO_RAW_URL}/fonts/${fontBaseName}"`).join(',\n')}
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"`;

  writeToBuildFile({
    file: 'font.sh',
    data: `${linuxFontGuide}\n\n${windowFontGuide}`,
  });
}
