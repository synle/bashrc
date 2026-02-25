/// <reference path="../index.js" />

includeSource("software/scripts/sublime-text.common.js");

let mySublimeTextConfigs = {};

/**
 * Converts lists of files and folders into Sublime Text compatible arrays.
 * @param {string[]} list - The array of files, folders, or binary patterns.
 * @returns {string[]} A cleaned array for Sublime Text settings.
 */
function _convertIgnoredFilesAndFoldersForSublimeText(list = []) {
  // Sublime Text patterns don't use the '**/ ' prefix.
  // We ensure we return a clean array of strings.
  return list.map((item) => {
    // If a pattern was accidentally passed with VS Code globs, strip them
    return item.replace(/^\*\*\//, "");
  });
}

/**
 * Builds the full Sublime Text settings object with editor, performance, and OS-specific configs.
 * @param {object} options - Configuration options.
 * @param {boolean} [options.is_prebuilt_config] - Whether to use fallback font sizes for prebuilt configs.
 * @param {boolean} [options.is_os_darwin_mac] - Whether the target OS is macOS.
 * @returns {object} The Sublime Text settings object.
 */
function _getConfigs({ is_prebuilt_config = false, is_os_darwin_mac = false }) {
  const fontSizeToUse = is_prebuilt_config ? EDITOR_CONFIGS.fontSizeDefaultFallback : EDITOR_CONFIGS.fontSize;

  const configs = {
    // --- Core Performance & Behavior ---
    update_check: false, // Disable update checking on startup
    atomic_save: true, // Write to a temp file first, then move — prevents corruption on crash
    hot_exit: false, // Don't save unsaved buffers on close — start fresh every time
    remember_open_files: false, // Don't reopen files from previous session on startup
    gpu_window_buffer: true, // Use GPU buffer for the window — smoother rendering
    hardware_acceleration: is_os_darwin_mac ? "metal" : "opengl", // Metal for macOS, OpenGL for everything else
    index_workers: 2, // Limit indexing threads to 2 — prevents CPU hogging while still enabling Goto Symbol

    // --- Typography & Rendering ---
    font_face: is_prebuilt_config ? EDITOR_CONFIGS.fontFamilyDefaultFallback : EDITOR_CONFIGS.fontFamily, // Primary editor font
    font_size: fontSizeToUse, // Base font size for the editor
    font_options: ["gray_antialias", "subpixel_antialias", "bold"], // Font rendering hints for sharp, bold text
    line_padding_top: 1, // 1px padding above each line for readability
    highlight_line: true, // Highlight the line the cursor is on
    scroll_speed: 0.0, // Instant scrolling — no animation delay

    // --- UI Cleanliness ---
    show_tab_close_buttons: false, // Hide per-tab close buttons — use keyboard or middle-click instead
    bold_folder_labels: true, // Make folder names bold in the sidebar for visual hierarchy
    auto_hide_menu: true, // Hide the menu bar until Alt is pressed — more vertical space
    tree_animation_enabled: false, // Disable sidebar expand/collapse animation
    animation_enabled: false, // Disable all UI animations globally
    theme: "Adaptive.sublime-theme", // Use the built-in adaptive theme
    show_folding_buttons: false, // Hide code folding arrows in the gutter — saves CPU on large files
    fade_fold_buttons: false, // No fade effect for fold buttons (moot when buttons are hidden)
    preview_on_click: true, // Single-click a file in sidebar to preview without fully opening it

    // --- Editing & Whitespace ---
    draw_white_space: "selection", // Only render whitespace dots in selected text — faster than 'all'
    translate_tabs_to_spaces: true, // Insert spaces when pressing Tab
    tab_size: EDITOR_CONFIGS.tabSize, // Number of spaces per tab
    trim_trailing_white_space_on_save: true, // Remove trailing spaces on every save
    ensure_newline_at_eof_on_save: true, // Always end files with a newline (POSIX convention)
    default_line_ending: "unix", // Use LF line endings by default
    show_line_endings: true, // Display the line ending type (LF/CRLF) in the status bar
    spell_check: false, // Disable spell checking — significantly speeds up typing in large files
    inlay_hints_enabled: false, // Disable LSP inlay hints — removes ghost-text lag

    // --- Project & Search ---
    rulers: [EDITOR_CONFIGS.maxLineSize], // Show a vertical ruler at the max line length
    index_exclude_gitignore: true, // Respect .gitignore — don't index ignored files

    // --- Features & Extensions ---
    highlight_modified_tabs: true, // Show a dot on tabs with unsaved changes
    alignment_chars: ["=", ":"], // Characters used by the Alignment plugin
    open_externally_patterns: ["*.jpg", "*.jpeg", "*.png", "*.gif", "*.zip", "*.pdf"], // Open these file types in OS default app instead of editor

    // --- Git ---
    show_git_status: false, // Disable git status badges in sidebar — reduces I/O on large repos
    mini_diff: false, // Disable inline diff markers in the gutter

    // --- Misc ---
    close_windows_when_empty: false, // Keep the window open even when all tabs are closed
    show_definitions: false, // Disable the inline definition popup on hover — reduces lag
    auto_complete_commit_on_tab: true, // Press Tab to accept autocomplete instead of requiring Enter
    ignored_packages: ["Vintage"], // Disable Vintage (vim mode) — not needed if you don't use vim bindings
    color_scheme: "Monokai.sublime-color-scheme", // Default color scheme with good contrast

    // --- Ignored Files ---
    file_exclude_patterns: _convertIgnoredFilesAndFoldersForSublimeText(EDITOR_CONFIGS.ignoredFiles), // Files hidden from sidebar and Goto Anything
    folder_exclude_patterns: _convertIgnoredFilesAndFoldersForSublimeText(EDITOR_CONFIGS.ignoredFolders), // Folders hidden from sidebar and Goto Anything
    binary_file_patterns: _convertIgnoredFilesAndFoldersForSublimeText(EDITOR_CONFIGS.ignoredBinaries), // Files visible in sidebar but excluded from search index
    index_exclude_patterns: ["*.log", "node_modules/*", ".git/*", "dist/*", "build/*"], // Patterns excluded from the indexer entirely
  };

  return configs;
}

/**
 * Writes Sublime Text settings to prebuilt config files and applies them to the local Sublime Text installation.
 */
async function doWork() {
  console.log(`  >> Sublime Text Configurations / Settings:`);

  // write to build file
  const comments = "Preferences Settings";
  console.log(`    >> For prebuilt configs`);
  writeToBuildFile([
    {
      file: "sublime-text-config",
      data: _getConfigs({ is_prebuilt_config: true, is_os_darwin_mac: false }),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: "sublime-text-config-macosx",
      data: _getConfigs({ is_prebuilt_config: true, is_os_darwin_mac: true }),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  ]);

  // for my own system
  let targetPath = await _getPathSublimeText();
  console.log("    >> For my own system", targetPath);
  exitIfPathNotFound(targetPath);

  writeConfigToFile(targetPath, "Packages/User/Preferences.sublime-settings", _getConfigs({ is_os_darwin_mac: is_os_darwin_mac }));
}
