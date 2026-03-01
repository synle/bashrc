/** * Configures iTerm2 terminal settings for macOS. */
async function doWork() {
  log(">> Installing Mac Only - Iterm Dracula Theme");

  if (!is_os_mac) {
    log(">>> Skipped - mac only");
    return process.exit();
  }

  let baseTargetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "mac");
  let targetPath;

  targetPath = path.join(baseTargetPath, "iterm.Dracula.itermcolors");
  log(">>> Iterm Dracula Theme Path", targetPath);
  writeText(targetPath, await fetchUrlAsString("software/scripts/mac/iterm-color-scheme-dracula.xml"));

  targetPath = path.join(baseTargetPath, "iterm.itermkeymap");
  log(">>> Iterm Keymap", targetPath);
  writeText(targetPath, await fetchUrlAsString("software/scripts/mac/iterm-keys.jsonc"));

  targetPath = findDirSingle(getOsxApplicationSupportCodeUserPath(), /iTerm[ ]*[a-z0-9]*/i);

  if (filePathExist(targetPath)) {
    targetPath = path.join(targetPath, "Scripts/AutoLaunch");
    await mkdir(targetPath);
    targetPath = path.join(targetPath, "switch_automatic.py");

    log(">>> Auto switch color scheme", targetPath);
    writeText(targetPath, await fetchUrlAsString("software/scripts/mac/iterm-auto-theme.py"));
  }
}
