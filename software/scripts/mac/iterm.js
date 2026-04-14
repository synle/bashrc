/** Configures iTerm2 terminal settings for macOS - deploys profile with colors, keymaps, and preferences. */
async function doWork() {
  exitIfUnsupportedOs("is_os_ubuntu", "is_os_android_termux", "is_os_chromeos", "is_os_arch_linux");

  log(">> Installing Mac Only - iTerm Profile Config");

  const baseTargetPath = await getCustomTweaksPath("mac");

  // Deploy iTerm profile with high contrast dark color scheme (matches VS Code "Default High Contrast" / Sublime "High Contrast Dark")
  // and high contrast light color scheme (matches VS Code "Default High Contrast Light" / Sublime "High Contrast Light")
  const profilePath = path.join(baseTargetPath, "iterm-profile.json");
  const colorDarkPath = path.join(baseTargetPath, "iterm-color-dark.json");
  const colorLightPath = path.join(baseTargetPath, "iterm-color-light.json");
  log(">>> iTerm Profile", profilePath);
  log(">>> iTerm Color Dark", colorDarkPath);
  log(">>> iTerm Color Light", colorLightPath);
  await Promise.all([
    readJson`software/scripts/mac/iterm-profile.jsonc`.then((data) => writeJson(profilePath, data)),
    readJson`software/scripts/mac/iterm-color-dark.jsonc`.then((data) => writeJson(colorDarkPath, data)),
    readJson`software/scripts/mac/iterm-color-light.jsonc`.then((data) => writeJson(colorLightPath, data)),
  ]);

  // Import iTerm plist preferences when force refresh is enabled and stale
  if (isForceRefreshStale(baseTargetPath)) {
    const plistPath = path.join(baseTargetPath, "iterm.plist");
    log(">>> Downloading iTerm plist", plistPath);
    await downloadAsset(getFullUrl("software/scripts/mac/iterm.plist"), plistPath);
    log(">>> Importing iTerm plist preferences");
    execBash(`defaults import com.googlecode.iterm2 "${plistPath}"`, true);
  }

  log(">>> To apply: iTerm2 > Settings > Profiles > Other Actions > Import JSON Profiles");
  log(">>> To export plist: defaults export com.googlecode.iterm2 ./iterm.plist");
}
