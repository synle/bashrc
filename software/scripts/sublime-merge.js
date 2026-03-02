const SUBLIME_MERGE_CONFIG = {
  expand_merge_commits_by_default: false,
  font_face: EDITOR_CONFIGS.fontFamily,
  font_size: EDITOR_CONFIGS.fontSize,
  hide_menu: false,
  side_bar_layout: "tabs",
  tab_size: 2,
  translate_tabs_to_spaces: false,
  hardware_acceleration: "opengl",
  update_check: false,
};

/**
 * Returns the Sublime Merge config directory path based on the current OS.
 * @returns {string|null} Path to Sublime Merge config directory, or null if not found.
 */
function _getPathSublimeMerge() {
  if (is_os_windows) {
    return findDirSingle(getWindowAppDataRoamingUserPath(), /Sublime[ ]*Merge/);
  }
  if (is_os_mac) {
    return path.join(getOsxApplicationSupportCodeUserPath(), "Sublime Merge");
  }
  return null;
}

/**
 * Writes Sublime Merge settings to the build output and applies them to the local installation.
 */
async function doWork() {
  exitIfLimitedSupportOs();
  let targetPath = _getPathSublimeMerge();

  log(">>> Setting up Sublime Merge:", targetPath);

  // write to build file
  writeToBuildFile([{ file: "sublime-merge", data: SUBLIME_MERGE_CONFIG, isJson: true }]);
  exitIfPathNotFound(targetPath);

  const sublimeMergeConfigPath = path.join(targetPath, "Packages/User/Preferences.sublime-settings");
  log(">>>", sublimeMergeConfigPath);
  writeJson(sublimeMergeConfigPath, SUBLIME_MERGE_CONFIG);
}
