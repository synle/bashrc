const linuxFontPath = "/usr/share/fonts/truetype";

/** @param {string} fileName - Font filename like "FiraCode-Regular.ttf" @returns {string} Display name like "Fira Code Regular" */
function _getFontDisplayName(fileName) {
  return fileName
    .replace(/\.(ttf|otf)$/, "")
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

/** @param {string[]} fontFileNames - Array of font filenames @param {string} [fontBaseUrl=""] - Base URL prefix for font file paths (empty for relative) @returns {string} HTML content for font preview page */
function _getFontPreviewHtml(fontFileNames, fontBaseUrl = "") {
  const prefix = fontBaseUrl ? `${fontBaseUrl}/` : "";
  const sampleText = `=&gt; ==&gt; !== === &gt;= &lt;= != &amp;&amp; || -&gt; --&gt; &lt;-- :: ... ?? ?. |&gt; ++ -- ** // /* */ := += -=`;

  return trimLeftSpaces(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ligature Font Preview</title>
    <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: sans-serif; background: #1e1e1e; color: #d4d4d4; padding: 20px; }
    h1 { margin-bottom: 20px; color: #fff; }
    .font-card { background: #2d2d2d; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; }
    .font-name { font-size: 13px; color: #888; margin-bottom: 8px; font-family: sans-serif; }
    .font-preview { font-size: 18px; line-height: 1.6; color: #e0e0e0; }
    ${fontFileNames.map((file, i) => `@font-face { font-family: "font-${i}"; src: url("${prefix}${file}"); }`).join("\n")}
    </style>
    </head>
    <body>
    <h1>Ligature Font Preview</h1>
    ${fontFileNames
      .map((file, i) => {
        const name = _getFontDisplayName(file);
        return `<div class="font-card"><div class="font-name">${name} — ${file}</div><div class="font-preview" style="font-family: 'font-${i}', monospace">${sampleText}</div></div>`;
      })
      .join("\n")}
    </body>
    </html>
  `);
}

/** * Downloads ligature fonts and generates platform-specific font installation guides. */
async function doWork() {
  // Android Termux: download FiraCode to ~/.termux/font.ttf
  if (is_os_android_termux) {
    const termuxFontDir = path.join(HOME_DIR, ".termux");
    const termuxFontPath = path.join(termuxFontDir, "font.ttf");
    if (IS_FORCE_REFRESH || !fs.existsSync(termuxFontPath)) {
      await mkdir(termuxFontDir);
      const fontUrl = `${BASH_PROFILE_CODE_REPO_RAW_URL}/assets/fonts/FiraCode-Regular.ttf`;
      log(">> Downloading Termux font:", termuxFontPath);
      await downloadAsset(fontUrl, termuxFontPath);
    } else {
      log(">> Termux font already installed, skipping:", termuxFontPath);
    }
    return;
  }

  const targetFontPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "fonts");

  log(">> Download Ligatures Fonts:", targetFontPath);

  const files = await listRepoDir();
  const fonts = files.filter((f) => f.includes(".ttf") || f.includes(".otf"));

  if (fonts.length === 0) {
    log(">>> Skipped : No fonts found");
    return;
  }

  log(">> Found fonts:", fonts.length);

  if (IS_FORCE_REFRESH) {
    log(">> Force refresh: deleting old font files");
    await deleteFolder(targetFontPath);
  }

  if (!fs.existsSync(targetFontPath)) {
    await mkdir(targetFontPath);
    await downloadAssets(
      fonts.map((font) => {
        const fontUrl = `${BASH_PROFILE_CODE_REPO_RAW_URL}/${font}`;
        return fontUrl;
      }),
      targetFontPath,
    );
    log(">> Fonts downloaded to:", targetFontPath);
  } else {
    log(">> Fonts already installed, skipping:", targetFontPath);
  }

  // write to build file
  const fontBaseNames = fonts.map((font) => path.basename(font));

  // curl: Add -s (silent, no progress bars) and use --parallel to download all files concurrently instead of sequentially. This reuses connections and downloads simultaneously.
  const linuxFontGuide = `# Fonts - Linux / MacOS
cd ~/Desktop
curl -sSLJ --parallel --parallel-max 10 \\
${fontBaseNames.map((fontBaseName) => `  -O ${BASH_PROFILE_CODE_REPO_RAW_URL}/assets/fonts/${fontBaseName}`).join(" \\\n")}
echo "Done downloading fonts"`;

  // Start-BitsTransfer: Use ForEach-Object to pass each URL explicitly to -Source, since Start-BitsTransfer cannot bind plain strings from the pipeline
  const windowFontGuide = `# Fonts - Windows
cd ([Environment]::GetFolderPath('Desktop'))
$urls = @(
${fontBaseNames.map((fontBaseName) => `  "${BASH_PROFILE_CODE_REPO_RAW_URL}/assets/fonts/${fontBaseName}"`).join(",\n")}
)
$urls | ForEach-Object { Start-BitsTransfer -Source $_ -Destination . }
echo "Done downloading fonts"`;

  writeToBuildFile({
    file: "font.sh",
    data: `${linuxFontGuide}\n\n${windowFontGuide}`,
  });

  // generate font preview HTML (local copy with relative paths)
  const fontPreviewHtml = _getFontPreviewHtml(fontBaseNames);
  writeText(path.join(targetFontPath, "preview.html"), fontPreviewHtml);
  log(">> Font preview HTML:", path.join(targetFontPath, "preview.html"));

  // generate font preview HTML for GitHub Pages (uses raw GitHub URLs)
  const fontPreviewHtmlHosted = _getFontPreviewHtml(fontBaseNames, `${BASH_PROFILE_CODE_REPO_RAW_URL}/assets/fonts`);
  writeToBuildFile({
    file: "font-preview.html",
    data: fontPreviewHtmlHosted,
  });
}
