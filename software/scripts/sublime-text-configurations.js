let SUBLIME_VERSION;

const sublimeSetings = {
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
  hardware_acceleration: "opengl",
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
    "*.pid",
    "*.pid.lock",
    "*.psd",
    "*.pyc",
    "*.pyo",
    "*.sdf",
    "*.seed",
    "*.sln",
    "*.so",
    "*.suo",
    "*.swf",
    "*.swp",
    "*.zip",
    ".DS_Store",
    ".eslintcache",
    "npm-debug.log",
  ],
  folder_exclude_patterns: [
    "*min*.js",
    ".cache",
    ".ebextensions",
    ".generated",
    ".git",
    ".gradle",
    ".hg",
    ".idea",
    ".sass-cache",
    ".svn",
    "bower_components",
    "build",
    "CVS",
    "node_modules",
    "tmp",
  ],
  // The mid-line characters to align in a multi-line selection, changing
  // this to an empty array will disable mid-line alignment
  alignment_chars: ["=", ":"],
}

async function _getPathSublimeText() {
  const url =
    "https://raw.githubusercontent.com/synle/bashrc/master/software/metadata/sublime-text.config.json";
  try {
    let config = await fetchUrlAsJson(url);

    SUBLIME_VERSION = config.sublime_version;

    if (is_os_window) {
      return path.join(getWindowAppDataRoamingUserPath(), config.sublime_path);
    }
    if (is_os_darwin_mac) {
      return path.join(
        getOsxApplicationSupportCodeUserPath(),
        config.sublime_path
      );
    }
  } catch (err) {
    console.log("      >> Failed to get the path for Sublime Text", url, err);
  }

  return null;
}

async function doWork() {
  let targetPath = await _getPathSublimeText();

  console.log(
    `  >> Setting up Sublime Text ${SUBLIME_VERSION} configurations:`,
    targetPath
  );
  
  if(DEBUG_WRITE_TO_HOME){
    console.log(consoleLogColor1("    >> DEBUG Mode: write to file"));
    
    // non -mac keybinding
    writeJson(
      'sublime_common_settings',
      sublimeSetings
    );
    
    process.exit();
  }

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1("    >> Skipped : Target path not found"));
    process.exit();
  }

  console.log("    >> Package Control.sublime-settings");
  writeJson(path.join(targetPath, "Package Control.sublime-settings"), {
    bootstrapped: true,
    in_process_packages: [],
    installed_packages: [
      //       "Alignment",
      "All Autocomplete",
      //       "Babel",
      "BracketHighlighter",
      "Case Conversion",
      "CodeFormatter",
      "Compare Side-By-Side",
      "DocBlockr",
      "Dracula Color Scheme",
      // "LESS",
      "Markdown Preview",
      // "Package Control",
      "SCSS",
      "SideBarEnhancements",
      "SublimeCodeIntel",
      "SyncedSideBar",
      //       "Tabnine",
      "TodoReview",
      "TypeScript",
    ],
  });

  console.log("    >> Default.sublime-theme");
  writeJson(path.join(targetPath, "Default.sublime-theme"), [
    {
      class: "sidebar_label",
      "font.size": 15,
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
    ...sublimeSetings,
    ...osSpecificSettings,
  });
}
