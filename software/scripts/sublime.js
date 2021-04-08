async function doWork() {
  doWorkSublimeText3();
  doWorkSublimeMerge();
}

function doWorkSublimeText3() {
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
  if (!fs.existsSync(targetPath)) {
    console.log(
      "  >> Skipped Sublime Text 3 - targetPath not found: ",
      targetPath
    );
    process.exit();
  }

  console.log("  >> Setting up Sublime Text 3:", targetPath);

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

  const commonKeyBindings = [
    { keys: ["f5"], command: "refresh_folder_list" },

    // split navigation
    { keys: ["ctrl+b", "left"], command: "focus_neighboring_group" },
    { keys: ["ctrl+b", "right"], command: "focus_neighboring_group" },
    { keys: ["ctrl+b", "up"], command: "focus_neighboring_group" },
    { keys: ["ctrl+b", "down"], command: "focus_neighboring_group" },
    {
      keys: ["ctrl+b", "x"],
      command: "set_layout",
      args: {
        cols: [0.0, 1.0],
        rows: [0.0, 1.0],
        cells: [[0, 0, 1, 1]],
      },
    },
    {
      keys: ["ctrl+b", "%"],
      command: "set_layout",
      args: {
        cols: [0.0, 0.5, 1.0],
        rows: [0.0, 1.0],
        cells: [
          [0, 0, 1, 1],
          [1, 0, 2, 1],
        ],
      },
    },
    {
      keys: ["ctrl+b", '"'],
      command: "set_layout",
      args: {
        cols: [0.0, 1.0],
        rows: [0.0, 0.5, 1.0],
        cells: [
          [0, 0, 1, 1],
          [0, 1, 1, 2],
        ],
      },
    },
  ];

  console.log("    >> Default (Windows).sublime-keymap (If Needed)");
  writeJson(path.join(targetPath, "Default (Windows).sublime-keymap"), [
    ...commonKeyBindings,
    {
      keys: ["alt+''"],
      command: "show_overlay",
      args: { overlay: "goto", text: "@" },
    },
    {
      keys: ["alt+;"],
      command: "show_overlay",
      args: { overlay: "goto", text: ":" },
    },
    {
      keys: ["alt+r"],
      command: "show_overlay",
      args: { overlay: "goto", text: "@" },
    },
    { keys: ["alt+w"], command: "close" },
    {
      keys: ["alt+p"],
      command: "show_overlay",
      args: { overlay: "goto", show_files: true },
    },
    { keys: ["alt+\\"], command: "toggle_side_bar" },
    {
      keys: ["alt+shift+p"],
      command: "show_overlay",
      args: { overlay: "command_palette" },
    },
    { keys: ["alt+ctrl+p"], command: "prompt_select_workspace" },
    { keys: ["ctrl+g"], command: "find_next" },
    { keys: ["ctrl+shift+g"], command: "find_prev" },
    {
      keys: ["ctrl+up"],
      command: "move",
      args: { by: "pages", forward: false },
    },
    {
      keys: ["ctrl+down"],
      command: "move",
      args: { by: "pages", forward: true },
    },
    { keys: ["alt+shift+l"], command: "split_selection_into_lines" },
    { keys: ["ctrl+shift+["], command: "prev_view" },
    { keys: ["ctrl+shift+]"], command: "next_view" },
    { keys: ["alt+ctrl+g"], command: "find_all_under" },
    { keys: ["ctrl+shift+l"], command: "split_selection_into_lines" },
    { keys: ["alt+shift+["], command: "prev_view" },
    { keys: ["alt+shift+]"], command: "next_view" },
    { keys: ["alt+ctrl+g"], command: "find_all_under" },
    { keys: ["ctrl+\\"], command: "toggle_side_bar" },
    { keys: ["alt+1"], command: "select_by_index", args: { index: 0 } },
    { keys: ["alt+2"], command: "select_by_index", args: { index: 1 } },
    { keys: ["alt+3"], command: "select_by_index", args: { index: 2 } },
    { keys: ["alt+4"], command: "select_by_index", args: { index: 3 } },
    { keys: ["alt+5"], command: "select_by_index", args: { index: 4 } },
    { keys: ["alt+6"], command: "select_by_index", args: { index: 5 } },
    { keys: ["alt+7"], command: "select_by_index", args: { index: 6 } },
    { keys: ["alt+8"], command: "select_by_index", args: { index: 7 } },
    { keys: ["alt+9"], command: "select_by_index", args: { index: 8 } },
    { keys: ["alt+0"], command: "select_by_index", args: { index: 9 } },
    { keys: ["alt+shift+a"], command: "alignment" },
    { keys: ["alt+x"], command: "cut" },
    { keys: ["alt+c"], command: "copy" },
    { keys: ["alt+v"], command: "paste" },
    { keys: ["alt+a"], command: "select_all" },
    { keys: ["alt+z"], command: "undo" },
    { keys: ["alt+s"], command: "save" },
    { keys: ["alt+shift+s"], command: "prompt_save_as" },
    { keys: ["alt+backspace"], command: "left_delete" },
    { keys: ["alt+="], command: "increase_font_size" },
    { keys: ["alt+keypad_plus"], command: "increase_font_size" },
    { keys: ["alt+-"], command: "decrease_font_size" },
    { keys: ["alt+keypad_minus"], command: "decrease_font_size" },
    { keys: ["alt+d"], command: "find_under_expand" },
    {
      keys: ["alt+f"],
      command: "show_panel",
      args: { panel: "find", reverse: false },
    },
    {
      keys: ["alt+shift+f"],
      command: "show_panel",
      args: { panel: "find_in_files" },
    },
    { keys: ["alt+]"], command: "indent" },
    { keys: ["alt+["], command: "unindent" },
    { keys: ["alt+shift+n"], command: "new_window" },
    { keys: ["alt+n"], command: "new_file" },
    { keys: ["alt+w"], command: "close" },
    { keys: ["alt+y"], command: "redo_or_repeat" },
    {
      keys: ["alt+up"],
      command: "move",
      args: { by: "pages", forward: false },
    },
    {
      keys: ["alt+down"],
      command: "move",
      args: { by: "pages", forward: true },
    },
    {
      keys: ["alt+left"],
      command: "move_to",
      args: { to: "bol", extend: false },
    },
    {
      keys: ["alt+right"],
      command: "move_to",
      args: { to: "eol", extend: false },
    },
    {
      keys: ["shift+alt+left"],
      command: "move_to",
      args: { to: "bol", extend: true },
    },
    {
      keys: ["shift+alt+right"],
      command: "move_to",
      args: { to: "eol", extend: true },
    },
    {
      keys: ["ctrl+alt+left"],
      command: "move_to",
      args: { to: "bof", extend: false },
    },
    {
      keys: ["ctrl+alt+right"],
      command: "move_to",
      args: { to: "eof", extend: false },
    },
    {
      keys: ["shift+alt+up"],
      command: "move",
      args: { by: "pages", forward: false, extend: true },
    },
    {
      keys: ["shift+alt+down"],
      command: "move",
      args: { by: "pages", forward: true, extend: true },
    },
    { keys: ["alt+/"], command: "toggle_comment", args: { block: false } },
  ]);

  console.log("    >> Default (OSX).sublime-keymap (If Needed)");
  writeJson(path.join(targetPath, "Default (OSX).sublime-keymap"), [
    ...commonKeyBindings,
    {
      keys: ["super+''"],
      command: "show_overlay",
      args: { overlay: "goto", text: "@" },
    },
    {
      keys: ["super+;"],
      command: "show_overlay",
      args: { overlay: "goto", text: ":" },
    },
    { keys: ["super+\\"], command: "toggle_side_bar" },
    { keys: ["super+shift+enter"], command: "goto_definition" },
    { keys: ["super+enter"], command: "quick_goto_variable" },
  ]);
}

function doWorkSublimeMerge() {
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
  if (!fs.existsSync(targetPath)) {
    console.log(
      "    >> Skipped Sublime Merge - targetPath not found: ",
      targetPath
    );
    process.exit();
  }

  console.log("    >> Setting up Sublime Merge:", targetPath);

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
