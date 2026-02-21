includeSource('software/scripts/sublime-text.common.js');

let COMMON_CONFIGS;

/**
 * Converts lists of files and folders into Sublime Text compatible arrays.
 * @param {string[]} list - The array of files, folders, or binary patterns.
 * @returns {string[]} A cleaned array for Sublime Text settings.
 */
function _convertIgnoredFilesAndFoldersForSublimeText(list = []) {
  // Sublime Text patterns don't use the '**/ ' prefix.
  // We ensure we return a clean array of strings.
  return list.map(item => {
    // If a pattern was accidentally passed with VS Code globs, strip them
    return item.replace(/^\*\*\//, '');
  });
}

async function doInit() {
  // Optimized Sublime Text Configuration
  COMMON_CONFIGS = {
    // --- Core Performance & Behavior ---
    update_check: false,
    atomic_save: true,
    hot_exit: false,
    remember_open_files: false,
    index_workers: 2, // Keeps indexing from hogging all CPU cores
    index_exclude_patterns: ['*.log', 'node_modules/*', '.git/*', 'dist/*', 'build/*'],
    gpu_window_buffer: true,
    hardware_acceleration: 'opengl', // Default; overridden for Mac below
    "index_workers": 2, // processes workers to scan your code, cataloging functions, classes, and variables

    // --- Typography & Rendering ---
    font_face: 'Fira Code Bold',
    font_size: EDITOR_CONFIGS.fontSize,
    font_options: ['gray_antialias', 'subpixel_antialias'],
    line_padding_top: 1,
    highlight_line: true,
    scroll_speed: 0.0, // Instant scrolling

    // --- UI Cleanliness (Performance Gains) ---
    show_tab_close_buttons: false,
    bold_folder_labels: true,
    auto_hide_menu: true,
    tree_animation_enabled: false,
    animation_enabled: false,
    theme: 'Adaptive.sublime-theme',
    show_folding_buttons: false, // Disables code folding UI/calculation
    fade_fold_buttons: false, // Redundant since buttons are off
    preview_on_click: false, // Prevents lag from clicking large files

    // --- Editing & Whitespace ---
    draw_white_space: 'selection', // Much faster than 'all' for large files
    translate_tabs_to_spaces: true,
    tab_size: EDITOR_CONFIGS.tabSize,
    trim_trailing_white_space_on_save: true,
    ensure_newline_at_eof_on_save: true,
    default_line_ending: 'unix',
    show_line_endings: true,
    spell_check: false, // Disabling this significantly speeds up typing in large files
    inlay_hints_enabled: false, // Disables ghost-text lag from LSPs

    // --- Project & Search Management ---
    rulers: [EDITOR_CONFIGS.maxLineSize],
    index_exclude_gitignore: true, // tell sublime to follow ignore ignore and exclude and not indexing git ignored files

    // --- Features & Extensions ---
    highlight_modified_tabs: true,
    alignment_chars: ['=', ':'],
    open_externally_patterns: ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.zip', '*.pdf'],

    // --- Git Related
    show_git_status: false, // disable git
    mini_diff: false, // disable git

    // --- Ignored Files
    // Files hidden from the Sidebar and 'Goto Anything'
  "file_exclude_patterns": _convertIgnoredFilesAndFoldersForSublimeText(
    EDITOR_CONFIGS.ignoredFiles
  ),

  // Folders hidden from the Sidebar and 'Goto Anything'
  "folder_exclude_patterns": _convertIgnoredFilesAndFoldersForSublimeText(
    EDITOR_CONFIGS.ignoredFolders
  ),

  // Files visible in Sidebar but excluded from the Search Index (Performance)
  "binary_file_patterns": _convertIgnoredFilesAndFoldersForSublimeText(
    EDITOR_CONFIGS.ignoredBinaries
  )
  };

  // --- OS Specific Overrides ---
  if (is_os_darwin_mac) {
    // Metal is the native, high-performance API for modern macOS
    COMMON_CONFIGS['hardware_acceleration'] = 'metal';
  }
}

async function doWork() {
  console.log(`  >> Sublime Text Configurations / Settings:`);

  // write to build file
  const commentNote = '// Preferences Settings';
  writeToBuildFile([['sublime-text-configurations', COMMON_CONFIGS, true, commentNote]]);
}
