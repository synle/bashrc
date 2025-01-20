includeSource('software/scripts/sublime-text.common.js');

let sublimeSetings;

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
    // these are used to open these files externally (by using Non Text File extension)
    open_externally_patterns: ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.zip', '*.pdf'],
  };
}

async function doWork() {
  console.log(`  >> Sublime Text Configurations / Settings:`);

  // write to build file
  const commentNote = '// Preferences Settings';
  writeToBuildFile([['sublime-text-configurations', sublimeSetings, true, commentNote]]);
}
