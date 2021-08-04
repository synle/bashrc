async function doWork() {
  function _getPathSublimeMerge() {
    if (is_os_window) {
      return findDir(
        getWindowAppDataRoamingUserPath(),
        /Sublime[ ]*Merge/,
        true
      );
    }
    if (is_os_darwin_mac) {
      return path.join(getOsxApplicationSupportCodeUserPath(), "Sublime Merge");
    }
    return null;
  }

  let targetPath = _getPathSublimeMerge();

  console.log("    >> Setting up Sublime Merge:", targetPath);

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1("      >> Skipped : Target path not found"));
    process.exit();
  }

  const sublimeMergeConfigPath = path.join(
    targetPath,
    "Packages/User/Preferences.sublime-settings"
  );
  console.log("    >> ", sublimeMergeConfigPath);
  writeJson(sublimeMergeConfigPath, {
    expand_merge_commits_by_default: false,
    font_face: "Courier News",
    font_size: 12,
    hide_menu: false,
    side_bar_layout: "tabs",
    tab_size: 2,
    theme: "Merge Dark.sublime-theme",
    translate_tabs_to_spaces: false,
    hardware_acceleration: "opengl",
    update_check: false,
  });
}
