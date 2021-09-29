let sublimeSetings;

async function _getPathSublimeText() {
  try {
    if (is_os_window) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), /Sublime[ ]*Text/i);
    }

    if (is_os_darwin_mac) {
      return findDirSingle(getOsxApplicationSupportCodeUserPath(), /Sublime[ ]*Text/i);
    }

    // for debian or chrome os debian linux
    return findDirSingle(globalThis.BASE_HOMEDIR_LINUX + '/.config', /Sublime[ ]*Text/i);
  } catch (err) {
    console.log('      >> Failed to get the path for Sublime Text', url, err);
  }

  return null;
}

async function doInit() {
  sublimeSetings = {
    atomic_save: true,
    default_line_ending: 'unix',
    font_size: EDITOR_CONFIGS.fontSize,
    show_tab_close_buttons: false,
    bold_folder_labels: true,
    draw_white_space: 'all',
    ensure_newline_at_eof_on_save: true,
    highlight_line: true,
    show_line_endings: true,
    hot_exit: false,
    remember_open_files: false,
    spell_check: true,
    tree_animation_enabled: false,
    animation_enabled: false,
    highlight_modified_tabs: true,
    translate_tabs_to_spaces: true,
    trim_trailing_white_space_on_save: true,
    auto_hide_menu: true,
    tab_size: EDITOR_CONFIGS.tabSize,
    rulers: [EDITOR_CONFIGS.maxLineSize],
    scroll_speed: 0.0,
    font_options: ['gray_antialias', 'subpixel_antialias'],
    font_face: EDITOR_CONFIGS.fontFamily,
    hardware_acceleration: 'opengl',
    theme: 'Adaptive.sublime-theme',
    file_exclude_patterns: [...EDITOR_CONFIGS.ignoredFiles],
    folder_exclude_patterns: [...EDITOR_CONFIGS.ignoredFolders],
    // The mid-line characters to align in a multi-line selection, changing
    // this to an empty array will disable mid-line alignment
    alignment_chars: ['=', ':'],
  };
}

async function doWork() {
  let targetPath = await _getPathSublimeText();

  console.log(`  >> Setting up Sublime Text configurations:`, targetPath);

  if (DEBUG_WRITE_TO_DIR) {
    console.log(consoleLogColor1('    >> DEBUG Mode: write to file'));

    // non -mac keybinding
    writeJson('sublime-text-configurations', sublimeSetings);

    process.exit();
  }

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Target path not found'));
    process.exit();
  }

  const sublimeThemeConfigPath = path.join(targetPath, 'Packages/User/Default.sublime-theme');
  console.log('    >> Default.sublime-theme', sublimeThemeConfigPath);
  writeJson(sublimeThemeConfigPath, [
    {
      class: 'sidebar_label',
      'font.size': EDITOR_CONFIGS.fontSize,
    },
    {
      class: 'tab_label',
      'font.size': EDITOR_CONFIGS.fontSize,
    },
  ]);

  //
  const sublimeMainConfigPath = path.join(targetPath, 'Packages/User/Preferences.sublime-settings');
  console.log('    >> Preferences.sublime-settings', sublimeMainConfigPath);
  console.log('      >> Installing', sublimeMainConfigPath);

  let osSpecificSettings = {};
  if (is_os_darwin_mac) {
    osSpecificSettings = {};
  } else {
    osSpecificSettings = {
      color_scheme: 'Packages/Dracula Color Scheme/Dracula.tmTheme',
    };
  }

  writeJsonWithMerge(sublimeMainConfigPath, {
    ...sublimeSetings,
    ...osSpecificSettings,
  });
}
