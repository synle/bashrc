/** * Configures iTerm2 terminal settings for macOS - deploys dark/light color schemes and keymaps. */
async function doWork() {
  log(">> Installing Mac Only - Iterm Dark/Light Themes");

  if (!is_os_mac) {
    log(">>> Skipped - mac only");
    return process.exit();
  }

  let baseTargetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "mac");
  let targetPath;

  // Deploy dark color scheme (Dracula)
  targetPath = path.join(baseTargetPath, "Sy Dark.itermcolors");
  log(">>> Iterm Dark Theme (Dracula)", targetPath);
  writeText(targetPath, await fetchUrlAsString("software/scripts/mac/iterm-color-scheme-dracula.xml"));

  // Deploy light color scheme
  targetPath = path.join(baseTargetPath, "Sy Light.itermcolors");
  log(">>> Iterm Light Theme", targetPath);
  writeText(targetPath, await fetchUrlAsString("software/scripts/mac/iterm-color-scheme-light.xml"));

  // Deploy keymap
  targetPath = path.join(baseTargetPath, "iterm.itermkeymap");
  log(">>> Iterm Keymap", targetPath);
  writeText(targetPath, await fetchUrlAsString("software/scripts/mac/iterm-keys.jsonc"));

  // Remove legacy auto-theme Python script (iTerm2 3.5+ has native dark/light mode support)
  targetPath = findDirSingle(getOsxApplicationSupportCodeUserPath(), /iTerm[ ]*[a-z0-9]*/i);
  if (filePathExist(targetPath)) {
    let legacyScript = path.join(targetPath, "Scripts/AutoLaunch/switch_automatic.py");
    if (filePathExist(legacyScript)) {
      log(">>> Removing legacy auto-theme script (iTerm2 3.5+ has native support)", legacyScript);
      execBash(`rm -f "${legacyScript}"`, true);
    }
  }

  log(">>> To enable auto dark/light switching: iTerm2 > Settings > Profiles > Colors > 'Use different colors for light mode and dark mode'");
  log(">>> Set Dark preset to 'Sy Dark' and Light preset to 'Sy Light'");
}
