async function doWork() {
  function _getPathSublimeText3() {
    if (is_os_window) {
      return path.join(
        getWindowAppDataRoamingUserPath(),
        "Sublime Text 3/Packages/User"
      );
    }
    if (is_os_darwin_mac) {
      return path.join(
        getOsxApplicationSupportCodeUserPath(),
        "Sublime Text 3/Packages/User"
      );
    }
    return null;
  }

  let targetPath = _getPathSublimeText3();

  console.log("  >> Setting up Sublime Text 3 configurations:", targetPath);

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1("    >> Skipped : Target path not found"));
    process.exit();
  }

  console.log("    >> Package Control.sublime-settings");
  writeJson(path.join(targetPath, "Package Control.sublime-settings"), {
    bootstrapped: true,
    in_process_packages: [],
    installed_packages: [
      "Alignment",
      "All Autocomplete",
      "Babel",
      "BracketHighlighter",
      "Case Conversion",
      "CodeFormatter",
      "Compare Side-By-Side",
      "DocBlockr",
      "Dracula Color Scheme",
      "LESS",
      "Markdown Preview",
      "Package Control",
      "SCSS",
      "SideBarEnhancements",
      "SublimeCodeIntel",
      "SyncedSideBar",
      // "Tabnine",
      "TodoReview",
      "TypeScript",
    ],
  });

  console.log("    >> Default.sublime-theme");
  writeJson(path.join(targetPath, "Default.sublime-theme"), [
    {
      class: "sidebar_label",
      "font.size": 12,
      color: [0, 0, 0],
    },
    {
      class: "tab_label",
      "font.size": 12,
    },
  ]);

  console.log("    >> Preferences.sublime-settings");
  let osSpecificSettings;
  if (is_os_window) {
    osSpecificSettings = {
      color_scheme: "Packages/Dracula Color Scheme/Dracula.tmTheme",
    };
  }
  if (is_os_darwin_mac) {
    osSpecificSettings = {};
  }

  writeJsonWithMerge(path.join(targetPath, "Preferences.sublime-settings"), {
    atomic_save: true,
    default_line_ending: "unix",
    font_size: 13,
    show_tab_close_buttons: false,
    bold_folder_labels: true,
    draw_white_space: "all",
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
    tab_size: 2,
    trim_trailing_white_space_on_save: true,
    rulers: [100],
    scroll_speed: 0.0,
    font_options: ["gray_antialias", "subpixel_antialias"],
    font_face: CONFIGS.fontFamily,
    file_exclude_patterns: [
      "*.class",
      "*.db",
      "*.dll",
      "*.doc",
      "*.docx",
      "*.dylib",
      "*.exe",
      "*.idb",
      "*.jar",
      "*.js.map",
      "*.lib",
      "*.min.js",
      "*.mp3",
      "*.ncb",
      "*.o",
      "*.obj",
      "*.ogg",
      "*.pdb",
      "*.pdf",
      "*.psd",
      "*.pyc",
      "*.pyo",
      "*.sdf",
      "*.so",
      "*.suo",
      "*.swf",
      "*.zip",
      "*.swp",
      ".DS_Store",
      "*.pid",
      "*.seed",
      "*.pid.lock",
      ".eslintcache",
      "npm-debug.log",
      "*.sln",
    ],
    folder_exclude_patterns: [
      "*min*.js",
      ".cache",
      ".ebextensions",
      ".generated",
      ".git",
      ".hg",
      ".sass-cache",
      ".svn",
      "bower_components",
      "build",
      "CVS",
      "node_modules",
      ".gradle",
      "tmp",
      ".idea",
    ],
    // The mid-line characters to align in a multi-line selection, changing
    // this to an empty array will disable mid-line alignment
    alignment_chars: ["=", ":"],
    ...osSpecificSettings,
  });
}
