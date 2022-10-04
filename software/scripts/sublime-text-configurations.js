let sublimeSetings;

async function _getPathSublimeText() {
  try {
    if (is_os_window) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), /Sublime[ ]*Text/i);
    }

    if (is_os_darwin_mac) {
      return findDirSingle(getOsxApplicationSupportCodeUserPath(), /Sublime[ ]*Text/i);
    }

    if (is_os_arch_linux) {
      // for sublime installed using Discover in arch linux
      return path.join(process.env.HOME, '.var/app/com.sublimetext.three/config/sublime-text-3');
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
    update_check: false,
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
    font_face: `Fira Code Bold`, // EDITOR_CONFIGS.fontFamily
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

  console.log(`  >> Setting up Sublime Text configurations:`, consoleLogColor4(targetPath));

  if (DEBUG_WRITE_TO_DIR) {
    console.log(consoleLogColor1('    >> DEBUG Mode: write to file'));

    // non -mac keybinding
    writeJson('sublime-text-configurations', sublimeSetings);

    return process.exit();
  }

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  const baseThemeConfig = [
    {
      class: 'sidebar_tree',
      'font.size': 12,
      indent_offset: 0,
      indent: 10,
      row_padding: [5, 2, 4, 2],
    },
    {
      class: 'tab_label',
      'font.size': 12,
    },
  ];

  const themeNames = ['Default', 'Default Dark', 'Adaptive'];

  for (const themeName of themeNames) {
    let sublimeThemeConfigPath;
    sublimeThemeConfigPath = path.join(targetPath, `Packages/User/${themeName}.sublime-theme`);
    console.log('    >> theme', sublimeThemeConfigPath);
    writeJson(sublimeThemeConfigPath, baseThemeConfig);
  }

  //
  const sublimeMainConfigPath = path.join(targetPath, 'Packages/User/Preferences.sublime-settings');
  console.log('    >> settings', sublimeMainConfigPath);

  let osSpecificSettings = {};
  if (is_os_darwin_mac) {
    osSpecificSettings = {
      color_scheme: 'auto',
      dark_color_scheme: 'Mariana.sublime-color-scheme',
      light_color_scheme: 'Breakers.sublime-color-scheme',
    };
  } else if(is_os_window) {
    osSpecificSettings = {
      color_scheme: 'auto',
      dark_color_scheme: 'Mariana.sublime-color-scheme',
      light_color_scheme: 'Breakers.sublime-color-scheme',
    };
  } else {
    // linux, let's not use auto theme
    osSpecificSettings = {
      color_scheme: 'Mariana.sublime-color-scheme',
    };
  }

  // set the path to the sublime merge binary
  let sublimeMergeBinary = findDirSingle('/mnt/d/Applications', /sublime[_]*merge[a-z0-9]*/);
  if (sublimeMergeBinary && fs.existsSync(path.join(sublimeMergeBinary, 'sublime_merge.exe'))) {
    sublimeMergeBinary = path.join(sublimeMergeBinary, 'sublime_merge.exe');
    osSpecificSettings.sublime_merge_path = sublimeMergeBinary.replace('/mnt/d', 'D:');
  }

  writeJsonWithMerge(sublimeMainConfigPath, {
    ...sublimeSetings,
    ...osSpecificSettings,
  });
}
