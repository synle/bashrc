let OS_KEY;
let COMMON_KEY_BINDINGS;

async function doInit() {
  OS_KEY = is_os_darwin_mac ? "super" : "alt";

  COMMON_KEY_BINDINGS = [
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
    {
      keys: [`${OS_KEY}+'`],
      command: "show_overlay",
      args: { overlay: "goto", text: "@" },
    },
    {
      keys: [`${OS_KEY}+;`],
      command: "show_overlay",
      args: { overlay: "goto", text: ":" },
    },
    {
      keys: [`${OS_KEY}+\\`],
      command: "toggle_side_bar",
    },
    {
      keys: [`${OS_KEY}+shift+enter`],
      command: "goto_definition",
    },
    {
      keys: [`${OS_KEY}+enter`],
      command: "quick_goto_variable",
    },
  ];
}

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

  console.log("  >> Setting up Sublime Text 3 keybindings:", targetPath);

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1("    >> Skipped : Target path not found"));
    process.exit();
  }

  const windowsKeymapPath = path.join(
    targetPath,
    "Default (Windows).sublime-keymap"
  );
  const macKeymapPath = path.join(targetPath, "Default (OSX).sublime-keymap");

  console.log("    >> Default (Windows).sublime-keymap");
  if (!fs.existsSync(windowsKeymapPath)) {
    console.log(consoleLogColor1("      >> Skipped "));
  } else {
    writeJson(windowsKeymapPath, [
      ...COMMON_KEY_BINDINGS,
      {
        keys: [`alt+r`],
        command: "show_overlay",
        args: { overlay: "goto", text: "@" },
      },
      { keys: `alt+w"], command: "close"` },
      {
        keys: [`alt+p`],
        command: "show_overlay",
        args: { overlay: "goto", show_files: true },
      },
      {
        keys: [`alt+shift+p`],
        command: "show_overlay",
        args: { overlay: "command_palette" },
      },
      {
        keys: [`alt+ctrl+p`],
        command: "prompt_select_workspace",
      },
      { keys: `ctrl+g"], command: "find_next"` },
      {
        keys: [`ctrl+shift+g`],
        command: "find_prev",
      },
      {
        keys: [`ctrl+up`],
        command: "move",
        args: { by: "pages", forward: false },
      },
      {
        keys: [`ctrl+down`],
        command: "move",
        args: { by: "pages", forward: true },
      },
      {
        keys: [`alt+shift+l`],
        command: "split_selection_into_lines",
      },
      {
        keys: [`ctrl+shift+[`],
        command: "prev_view",
      },
      {
        keys: [`ctrl+shift+]`],
        command: "next_view",
      },
      {
        keys: [`alt+ctrl+g`],
        command: "find_all_under",
      },
      {
        keys: [`ctrl+shift+l`],
        command: "split_selection_into_lines",
      },
      { keys: `alt+shift+["], command: "prev_view"` },
      { keys: `alt+shift+]"], command: "next_view"` },
      {
        keys: [`alt+ctrl+g`],
        command: "find_all_under",
      },
      {
        keys: [`alt+1`],
        command: "select_by_index",
        args: { index: 0 },
      },
      {
        keys: [`alt+2`],
        command: "select_by_index",
        args: { index: 1 },
      },
      {
        keys: [`alt+3`],
        command: "select_by_index",
        args: { index: 2 },
      },
      {
        keys: [`alt+4`],
        command: "select_by_index",
        args: { index: 3 },
      },
      {
        keys: [`alt+5`],
        command: "select_by_index",
        args: { index: 4 },
      },
      {
        keys: [`alt+6`],
        command: "select_by_index",
        args: { index: 5 },
      },
      {
        keys: [`alt+7`],
        command: "select_by_index",
        args: { index: 6 },
      },
      {
        keys: [`alt+8`],
        command: "select_by_index",
        args: { index: 7 },
      },
      {
        keys: [`alt+9`],
        command: "select_by_index",
        args: { index: 8 },
      },
      {
        keys: [`alt+0`],
        command: "select_by_index",
        args: { index: 9 },
      },
      { keys: [`alt+shift+a`], command: "alignment" },
      { keys: [`alt+x`], command: "cut" },
      { keys: [`alt+c`], command: "copy" },
      { keys: [`alt+v`], command: "paste" },
      { keys: [`alt+a`], command: "select_all" },
      { keys: [`alt+z`], command: "undo" },
      { keys: [`alt+s`], command: "save" },
      {
        keys: [`alt+shift+s`],
        command: "prompt_save_as",
      },
      {
        keys: [`alt+backspace`],
        command: "left_delete",
      },
      {
        keys: [`alt+=`],
        command: "increase_font_size",
      },
      {
        keys: [`alt+keypad_plus`],
        command: "increase_font_size",
      },
      {
        keys: [`alt+-`],
        command: "decrease_font_size",
      },
      {
        keys: [`alt+keypad_minus`],
        command: "decrease_font_size",
      },
      {
        keys: [`alt+d`],
        command: "find_under_expand",
      },
      {
        keys: [`alt+f`],
        command: "show_panel",
        args: { panel: "find", reverse: false },
      },
      {
        keys: [`alt+shift+f`],
        command: "show_panel",
        args: { panel: "find_in_files" },
      },
      { keys: `alt+]"], command: "indent"` },
      { keys: `alt+["], command: "unindent"` },
      {
        keys: [`alt+shift+n`],
        command: "new_window",
      },
      { keys: [`alt+n`], command: "new_file" },
      { keys: [`alt+w`], command: "close" },
      { keys: [`alt+y`], command: "redo_or_repeat" },
      {
        keys: [`alt+up`],
        command: "move",
        args: { by: "pages", forward: false },
      },
      {
        keys: [`alt+down`],
        command: "move",
        args: { by: "pages", forward: true },
      },
      {
        keys: [`alt+left`],
        command: "move_to",
        args: { to: "bol", extend: false },
      },
      {
        keys: [`alt+right`],
        command: "move_to",
        args: { to: "eol", extend: false },
      },
      {
        keys: [`shift+alt+left`],
        command: "move_to",
        args: { to: "bol", extend: true },
      },
      {
        keys: [`shift+alt+right`],
        command: "move_to",
        args: { to: "eol", extend: true },
      },
      {
        keys: [`ctrl+alt+left`],
        command: "move_to",
        args: { to: "bof", extend: false },
      },
      {
        keys: [`ctrl+alt+right`],
        command: "move_to",
        args: { to: "eof", extend: false },
      },
      {
        keys: ["ctrl+alt+up"],
        command: "move_to",
        args: { to: "bof", extend: false },
      },
      {
        keys: ["ctrl+alt+down"],
        command: "move_to",
        args: { to: "eof", extend: false },
      },
      {
        keys: ["ctrl+alt+shift+up"],
        command: "move_to",
        args: { to: "bof", extend: true },
      },
      {
        keys: ["ctrl+alt+shift+down"],
        command: "move_to",
        args: { to: "eof", extend: true },
      },
      {
        keys: [`shift+alt+up`],
        command: "move",
        args: { by: "pages", forward: false, extend: true },
      },
      {
        keys: [`shift+alt+down`],
        command: "move",
        args: { by: "pages", forward: true, extend: true },
      },
      {
        keys: [`alt+/`],
        command: "toggle_comment",
        args: { block: false },
      },
    ]);
  }

  console.log("    >> Default (OSX).sublime-keymap");
  if (!fs.existsSync(macKeymapPath)) {
    console.log(consoleLogColor1("      >> Skipped "));
  } else {
    writeJson(macKeymapPath, [...COMMON_KEY_BINDINGS]);
  }
}
