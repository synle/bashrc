async function doWork() {
  function _getPathSublimeMerge() {
    if (is_os_window) {
      return path.join(
        getWindowAppDataRoamingUserPath(),
        "Sublime Merge/Packages/User"
      );
    }
    if (is_os_darwin_mac) {
      return path.join(
        getOsxApplicationSupportCodeUserPath(),
        "Sublime Merge/Packages/User"
      );
    }
    return null;
  }

  let targetPath = _getPathSublimeMerge();

  console.log("    >> Setting up Sublime Merge:", targetPath);

  if (!fs.existsSync(targetPath)) {
    console.log(echoColor3("      >> Skipped : Target path not found"));
    process.exit();
  }

  console.log("    >> Preferences.sublime-settings");
  writeJson(path.join(targetPath, "Preferences.sublime-settings"), {
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
