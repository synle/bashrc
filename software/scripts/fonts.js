const linuxFontPath = "/usr/share/fonts/truetype";

/** * Downloads ligature fonts and generates platform-specific font installation guides. */
async function doWork() {
  // Android Termux: download FiraCode to ~/.termux/font.ttf
  if (is_os_android_termux) {
    const termuxFontDir = path.join(HOME_DIR, ".termux");
    const termuxFontPath = path.join(termuxFontDir, "font.ttf");
    if (IS_FORCE_REFRESH || !fs.existsSync(termuxFontPath)) {
      await mkdir(termuxFontDir);
      const fontUrl = `${BASH_PROFILE_CODE_REPO_RAW_URL}/fonts/FiraCode-Regular.ttf`;
      console.log("  >> Downloading Termux font:", termuxFontPath);
      await downloadAsset(fontUrl, termuxFontPath);
    } else {
      console.log("  >> Termux font already installed, skipping:", termuxFontPath);
    }
    return;
  }

  const targetFontPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "fonts");

  console.log("  >> Download Ligatures Fonts:", targetFontPath);

  const files = await listRepoDir();
  const fonts = files.filter((f) => f.includes(".ttf"));

  if (fonts.length === 0) {
    console.log(consoleLogColor1("    >> Skipped : No fonts found"));
    return;
  }

  console.log("  >> Found fonts:", fonts.length);

  if (IS_FORCE_REFRESH) {
    console.log("  >> Force refresh: deleting old font files");
    await deleteFolder(targetFontPath);
  }

  if (!fs.existsSync(targetFontPath)) {
    await mkdir(targetFontPath);
    for (const font of fonts) {
      const fontUrl = `${BASH_PROFILE_CODE_REPO_RAW_URL}/${font}`;
      const destination = path.join(targetFontPath, path.basename(font));
      console.log("    >> Downloading:", path.basename(font));
      await downloadAsset(fontUrl, destination);
    }
    console.log("  >> Fonts downloaded to:", targetFontPath);
  } else {
    console.log("  >> Fonts already installed, skipping:", targetFontPath);
  }

  // write to build file
  const fontBaseNames = fonts.map((font) => path.basename(font));

  // curl: Add -s (silent, no progress bars) and use --parallel to download all files concurrently instead of sequentially. This reuses connections and downloads simultaneously.
  const linuxFontGuide = `# Fonts - Linux / MacOS
cd ~/Desktop
curl -sSLJ --parallel --parallel-max 10 \\
${fontBaseNames.map((fontBaseName) => `  -O ${BASH_PROFILE_CODE_REPO_RAW_URL}/fonts/${fontBaseName}`).join(" \\\n")}
echo "Done downloading fonts"`;

  // Start-BitsTransfer: Use ForEach-Object to pass each URL explicitly to -Source, since Start-BitsTransfer cannot bind plain strings from the pipeline
  const windowFontGuide = `# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
${fontBaseNames.map((fontBaseName) => `  "${BASH_PROFILE_CODE_REPO_RAW_URL}/fonts/${fontBaseName}"`).join(",\n")}
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"`;

  writeToBuildFile({
    file: "font.sh",
    data: `${linuxFontGuide}\n\n${windowFontGuide}`,
  });
}
