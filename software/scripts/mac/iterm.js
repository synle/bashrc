/** * Configures iTerm2 terminal settings for macOS - deploys high contrast dark/light color schemes and keymaps. */
async function doWork() {
  exitIfUnsupportedOs("is_os_ubuntu", "is_os_android_termux", "is_os_chromeos", "is_os_arch_linux");

  log(">> Installing Mac Only - iTerm High Contrast Themes & Keymap");

  const baseTargetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "mac");

  // Deploy high contrast dark color scheme (matches VS Code "Default High Contrast" / Sublime "High Contrast Dark")
  const darkThemePath = path.join(baseTargetPath, "Sy Dark.itermcolors");
  log(">>> iTerm Dark Theme (High Contrast)", darkThemePath);
  writeText(darkThemePath, await fetchUrlAsString("software/scripts/mac/iterm-color-scheme-dracula.xml"));

  // Deploy high contrast light color scheme (matches VS Code "Default High Contrast Light" / Sublime "High Contrast Light")
  const lightThemePath = path.join(baseTargetPath, "Sy Light.itermcolors");
  log(">>> iTerm Light Theme (High Contrast)", lightThemePath);
  writeText(lightThemePath, await fetchUrlAsString("software/scripts/mac/iterm-color-scheme-light.xml"));

  // Deploy keymap
  const keymapPath = path.join(baseTargetPath, "iterm.itermkeymap");
  log(">>> iTerm Keymap", keymapPath);
  writeText(keymapPath, await fetchUrlAsString("software/scripts/mac/iterm-keys.jsonc"));

  // Remove legacy auto-theme Python script (iTerm2 3.5+ has native dark/light mode support)
  const itermAppSupportPath = findDirSingle(getOsxApplicationSupportCodeUserPath(), /iTerm[ ]*[a-z0-9]*/i);
  if (filePathExist(itermAppSupportPath)) {
    const legacyScript = path.join(itermAppSupportPath, "Scripts/AutoLaunch/switch_automatic.py");
    if (filePathExist(legacyScript)) {
      log(">>> Removing legacy auto-theme script", legacyScript);
      execBash(`rm -f "${legacyScript}"`, true);
    }
  }

  log(">>> To enable auto dark/light switching: iTerm2 > Settings > Profiles > Colors > 'Use different colors for light mode and dark mode'");
  log(">>> Set Dark preset to 'Sy Dark' and Light preset to 'Sy Light'");
}
