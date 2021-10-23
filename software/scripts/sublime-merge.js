async function doWork() {
  function _getPathSublimeMerge() {
    if (is_os_window) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), /Sublime[ ]*Merge/);
    }
    if (is_os_darwin_mac) {
      return path.join(getOsxApplicationSupportCodeUserPath(), 'Sublime Merge');
    }
    return null;
  }

  let targetPath = _getPathSublimeMerge();

  console.log('    >> Setting up Sublime Merge:', consoleLogColor4(targetPath));

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1('      >> Skipped : Not Found'));
    return process.exit();
  }

  const sublimeMergeConfigPath = path.join(targetPath, 'Packages/User/Preferences.sublime-settings');
  console.log('    >>', sublimeMergeConfigPath);
  writeJson(sublimeMergeConfigPath, {
    expand_merge_commits_by_default: false,
    font_face: EDITOR_CONFIGS.fontFamily,
    font_size: EDITOR_CONFIGS.fontSize,
    hide_menu: false,
    side_bar_layout: 'tabs',
    tab_size: 2,
    translate_tabs_to_spaces: false,
    hardware_acceleration: 'opengl',
    update_check: false,
  });
}
