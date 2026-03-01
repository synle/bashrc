// BEGIN software/scripts/editor.common.js
/** Color theme constants */
const SUBLIME_DARK_COLOR_SCHEME = "Monokai.sublime-color-scheme";
const SUBLIME_LIGHT_COLOR_SCHEME = "Breakers.sublime-color-scheme";
const SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME = "High Contrast Dark.sublime-color-scheme";
const SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME = "High Contrast Light.sublime-color-scheme";
const VSCODE_DARK_COLOR_THEME = "Default High Contrast";
const VSCODE_LIGHT_COLOR_THEME = "Default High Contrast Light";

/** Glob patterns for locating the Sublime Text binary across platforms */
const _SUBL_PATHS = [
  "/Applications/Sublime*Text.app/Contents/SharedSupport/bin/subl",
  "/mnt/c/Program*Files/Sublime*Text*/sublime*.exe",
  "/mnt/c/Program*Files/Sublime*Text*/subl*",
  "/opt/sublime_text/subl*",
  "/usr/bin/subl",
  "/usr/local/bin/subl",
];

/** Glob patterns for locating the VS Code / VSCodium binary across platforms */
const _CODE_PATHS = [
  "/mnt/c/Users/Sy*/AppData/Local/Programs/Microsoft*Code/Code.exe",
  "/mnt/c/Users/Le*/AppData/Local/Programs/Microsoft*Code/Code.exe",
  "/mnt/c/Program*Files/VSCodium/VSCodium.exe",
  "/mnt/c/Program*Files/Microsoft*VS*Code/Code.exe",
  "/usr/local/bin/codium",
  "/usr/local/bin/code",
  "/usr/bin/codium",
  "/usr/bin/code",
];

/**
 * Searches standard OS paths for VS Code and VSCodium installation directories.
 * @returns {string[]} Array of absolute paths to found VS Code/VSCodium config directories.
 */
function _getVSCodeAndVSCodiumPaths() {
  const res = [];
  const home = process.env.HOME || process.env.USERPROFILE;

  // 1. Initialize search roots with standard OS locations
  const searchRoots = [
    process.env.APPDATA, // Windows Native
    path.join(home, "Library/Application Support"), // macOS
    path.join(home, ".config"), // Linux Standard
    path.join(home, ".var/app/com.visualstudio.code/config"), // Linux Flatpak
    path.join(home, ".var/app/com.vscodium/config"), // Linux Flatpak
  ];

  // 2. Account for WSL and Git Bash Windows mounts
  // Iterates through C:\Users\* to find Roaming folders
  const windowsMounts = ["/mnt/c/Users", "/c/Users"];
  windowsMounts.forEach((mount) => {
    if (fs.existsSync(mount)) {
      try {
        const directoryItems = fs.readdirSync(mount);
        for (const item of directoryItems) {
          const roamingPath = path.join(mount, item, "AppData/Roaming");
          if (fs.existsSync(roamingPath)) {
            searchRoots.push(roamingPath);
          }
        }
      } catch (e) {
        // Skip folders with permission issues (like System folders)
      }
    }
  });

  // 3. Patterns for the apps we want to find
  const patterns = [/Code/i, /VSCodium/i];

  // 4. Execution logic using your findDirSingle method
  searchRoots.forEach((root) => {
    if (!root || !fs.existsSync(root)) return;

    patterns.forEach((pattern) => {
      try {
        // Use your method to find the matching directory (e.g., "Code")
        const foundAppPath = findDirSingle(root, pattern);

        if (foundAppPath && fs.existsSync(foundAppPath)) {
          // Normalize the path and ensure it's not already in the array
          const absolutePath = path.resolve(foundAppPath);
          if (!res.includes(absolutePath)) {
            res.push(absolutePath);
          }
        }
      } catch (err) {
        // Silent fail for locked directories
      }
    });
  });

  return res;
}

/**
 * Searches for the Sublime Text config directory based on the current OS.
 * @returns {Promise<string|null>} Path to the Sublime Text config directory, or null if not found.
 */
async function _getPathSublimeText() {
  exitIfUnsupportedOs("is_os_android_termux", "is_os_arch_linux", "is_os_chromeos");
  const regexBinary = /Sublime[ -]*Text[0-9]*[0-9]*/i;

  try {
    if (is_os_window) {
      return findDirSingle(getWindowAppDataRoamingUserPath(), regexBinary);
    }

    if (is_os_mac) {
      return findDirSingle(getOsxApplicationSupportCodeUserPath(), regexBinary);
    }

    if (is_os_arch_linux) {
      return findDirSingle(path.join(process.env.HOME, ".var/app/com.sublimetext.three/config"), regexBinary);
    }

    // for debian or chrome os debian linux
    return findDirSingle(BASE_HOMEDIR_LINUX + "/.config", regexBinary);
  } catch (err) {
    console.log("      >> Failed to get the path", err);
  }

  return null;
}
// END software/scripts/editor.common.js

const USE_CUSTOM_HIGH_CONTRAST_THEME = true;

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
 * @param {boolean} [options.is_os_mac] - Whether the target OS is macOS.
 * @returns {object} The Sublime Text settings object.
 */
function _getConfigs({ is_prebuilt_config = false, is_os_mac = false }) {
  const fontSizeToUse = is_prebuilt_config ? EDITOR_CONFIGS.fontSizeDefaultFallback : EDITOR_CONFIGS.fontSize;

  const configs = {
    // --- Core Performance & Behavior ---
    update_check: false, // Disable update checking on startup
    atomic_save: true, // Write to a temp file first, then move — prevents corruption on crash
    hot_exit: false, // Don't save unsaved buffers on close — start fresh every time
    remember_open_files: false, // Don't reopen files from previous session on startup
    gpu_window_buffer: true, // Use GPU buffer for the window — smoother rendering
    hardware_acceleration: is_os_mac ? "metal" : "opengl", // Metal for macOS, OpenGL for everything else
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
    sidebar_font_size: fontSizeToUse, // Match sidebar font size to editor font size (ST4 4200+)
    auto_hide_menu: true, // Hide the menu bar until Alt is pressed — more vertical space
    tree_animation_enabled: false, // Disable sidebar expand/collapse animation
    animation_enabled: false, // Disable all UI animations globally
    theme: "auto", // Auto-switch theme based on OS dark/light mode
    dark_theme: "Adaptive.sublime-theme", // Theme for dark mode
    light_theme: "Adaptive.sublime-theme", // Theme for light mode
    show_folding_buttons: false, // Hide code folding arrows in the gutter — saves CPU on large files
    fade_fold_buttons: false, // No fade effect for fold buttons (moot when buttons are hidden)
    preview_on_click: true, // Single-click a file in sidebar to preview without fully opening it

    // --- Editing & Whitespace ---
    draw_white_space: "selection", // Only render whitespace dots in selected text — faster than 'all'
    translate_tabs_to_spaces: true, // Insert spaces when pressing Tab
    tab_size: EDITOR_CONFIGS.tabSize, // Number of spaces per tab
    trim_trailing_white_space_on_save: "all", // Remove trailing spaces on every save
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
    color_scheme: "auto", // Auto-switch color scheme based on OS dark/light mode
    dark_color_scheme:
      is_prebuilt_config || !USE_CUSTOM_HIGH_CONTRAST_THEME ? SUBLIME_DARK_COLOR_SCHEME : SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME,
    light_color_scheme:
      is_prebuilt_config || !USE_CUSTOM_HIGH_CONTRAST_THEME ? SUBLIME_LIGHT_COLOR_SCHEME : SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME,

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
  exitIfUnsupportedOs("is_os_android_termux");
  console.log(`  >> Sublime Text Configurations / Settings:`);

  // write to build file
  const comments = "Preferences Settings";
  console.log(`    >> For prebuilt configs`);
  writeToBuildFile([
    {
      file: "sublime-text-config",
      data: _getConfigs({ is_prebuilt_config: true, is_os_mac: false }),
      isJson: true,
      comments,
      commentStyle: "json",
    },
    {
      file: "sublime-text-config-macosx",
      data: _getConfigs({ is_prebuilt_config: true, is_os_mac: true }),
      isJson: true,
      comments,
      commentStyle: "json",
    },
  ]);

  // for my own system
  let targetPath = await _getPathSublimeText();
  console.log("    >> For my own system", targetPath);
  exitIfPathNotFound(targetPath);

  // deploy custom color schemes (only when high contrast theme is enabled)
  if (USE_CUSTOM_HIGH_CONTRAST_THEME) {
    const colorSchemes = [
      { src: "software/scripts/sublime-text-color-dark.jsonc", dest: SUBLIME_DARK_HIGH_CONTRAST_COLOR_SCHEME },
      { src: "software/scripts/sublime-text-color-light.jsonc", dest: SUBLIME_LIGHT_HIGH_CONTRAST_COLOR_SCHEME },
    ];
    for (const { src, dest } of colorSchemes) {
      console.log(`    >> Deploying color scheme: ${dest}`);
      const data = await fetchUrlAsJson(src);

      console.log(`      >> Parsing: ${dest}`, src);
      writeConfigToFile(targetPath, `Packages/User/${dest}`, data);
    }
  }

  console.log(`    >> Deployed config:`, targetPath);
  writeConfigToFile(targetPath, "Packages/User/Preferences.sublime-settings", _getConfigs({ is_os_mac: is_os_mac }));
}
