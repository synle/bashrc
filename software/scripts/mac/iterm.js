/** * Configures iTerm2 terminal settings for macOS - deploys profile with colors, keymaps, and preferences. */
async function doWork() {
  exitIfUnsupportedOs("is_os_ubuntu", "is_os_android_termux", "is_os_chromeos", "is_os_arch_linux");

  log(">> Installing Mac Only - iTerm Profile Config");

  const baseTargetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, "mac");

  // Deploy iTerm profile with high contrast dark color scheme (matches VS Code "Default High Contrast" / Sublime "High Contrast Dark")
  // and high contrast light color scheme (matches VS Code "Default High Contrast Light" / Sublime "High Contrast Light")
  const profilePath = path.join(baseTargetPath, "iterm-profile.json");
  log(">>> iTerm Profile", profilePath);
  writeJson(profilePath, await fetchUrlAsJson("software/scripts/mac/iterm-profile.jsonc"));

  // Deploy standalone color scheme files
  const colorDarkPath = path.join(baseTargetPath, "iterm-color-dark.json");
  log(">>> iTerm Color Dark", colorDarkPath);
  writeJson(colorDarkPath, await fetchUrlAsJson("software/scripts/mac/iterm-color-dark.jsonc"));

  const colorLightPath = path.join(baseTargetPath, "iterm-color-light.json");
  log(">>> iTerm Color Light", colorLightPath);
  writeJson(colorLightPath, await fetchUrlAsJson("software/scripts/mac/iterm-color-light.jsonc"));

  // Import iTerm plist preferences when force refresh is enabled
  if (IS_FORCE_REFRESH) {
    const plistPath = path.join(baseTargetPath, "iterm.plist");
    log(">>> Downloading iTerm plist", plistPath);
    await downloadAsset(getFullUrl("software/scripts/mac/iterm.plist"), plistPath);
    log(">>> Importing iTerm plist preferences");
    execBash(`defaults import com.googlecode.iterm2 "${plistPath}"`, true);
  }

  log(">>> To apply: iTerm2 > Settings > Profiles > Other Actions > Import JSON Profiles");
  log(">>> To export plist: defaults export com.googlecode.iterm2 ./iterm.plist");
}
