let SUBLIME_VERSION;

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

  process.exit();
  return null;
}

let OS_KEY;
let COMMON_KEY_BINDINGS;
let WINDOWS_ONLY_KEY_BINDINGS;
let MAC_ONLY_KEY_BINDINGS;

function _formatKey(keybindings) {
  for (const keybinding of keybindings) {
    keybinding.keys = []
      .concat(keybinding.keys || [])
      .concat(keybinding.key || [])
      .map((s) => s.replace("OS_KEY", OS_KEY));

    delete keybinding.key;
  }

  return keybindings;
}

async function doInit() {
  OS_KEY = is_os_darwin_mac ? "super" : "alt";

  // begin COMMON_KEY_BINDINGS
  COMMON_KEY_BINDINGS = [
    {
      key: "f5",
      command: "refresh_folder_list",
    },
    {
      key: "OS_KEY+r",
      command: "show_overlay",
      args: {
        overlay: "goto",
        text: "@",
      },
    },
    {
      key: "OS_KEY+;",
      command: "show_overlay",
      args: {
        overlay: "goto",
        text: ":",
      },
    },
    {
      key: "OS_KEY+m",
      command: "move_to",
      args: { to: "brackets" },
    },
    {
      key: "OS_KEY+o",
      command: "prompt_open_file",
    },
    {
      key: "OS_KEY+\\",
      command: "toggle_side_bar",
    },
    {
      key: "OS_KEY+shift+enter",
      command: "goto_definition",
    },
    {
      key: "OS_KEY+enter",
      command: "quick_goto_variable",
    },

    // splits
    // split navigation
    // { key: "OS_KEY+ctrl+left", command: "focus_neighboring_group" },
    // { key: "OS_KEY+ctrl+right", command: "focus_neighboring_group" },
    // { key: "OS_KEY+ctrl+up", command: "focus_neighboring_group" },
    // { key: "OS_KEY+ctrl+down", command: "focus_neighboring_group" },
    {
      key: ["OS_KEY+b", "OS_KEY+w"],
      command: "set_layout",
      args: {
        cols: [0.0, 1.0],
        rows: [0.0, 1.0],
        cells: [[0, 0, 1, 1]],
      },
    },
    {
      key: ["OS_KEY+b", "OS_KEY+"],
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
      key: ["OS_KEY+b", "OS_KEY+'"],
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
  // end COMMON_KEY_BINDINGS

  // begin WINDOWS_ONLY_KEY_BINDINGS
  WINDOWS_ONLY_KEY_BINDINGS = [
    {
      key: "alt+r",
      command: "show_overlay",
      args: {
        overlay: "goto",
        text: "@",
      },
    },
    {
      key: "alt+p",
      command: "show_overlay",
      args: {
        overlay: "goto",
        show_files: true,
      },
    },
    {
      key: "alt+shift+p",
      command: "show_overlay",
      args: {
        overlay: "command_palette",
      },
    },
    {
      key: "alt+ctrl+p",
      command: "prompt_select_workspace",
    },
    {
      key: "alt+shift+g",
      command: "find_prev",
    },
    {
      key: "alt+g",
      command: "find_next",
    },
    {
      key: "ctrl+up",
      command: "move",
      args: {
        by: "pages",
        forward: false,
      },
    },
    {
      key: "ctrl+down",
      command: "move",
      args: {
        by: "pages",
        forward: true,
      },
    },
    {
      key: "alt+shift+l",
      command: "split_selection_into_lines",
    },
    {
      key: "alt+shift+[",
      command: "prev_view",
    },
    {
      key: "alt+shift+]",
      command: "next_view",
    },
    {
      key: "alt+ctrl+g",
      command: "find_all_under",
    },
    {
      key: "alt+1",
      command: "select_by_index",
      args: {
        index: 0,
      },
    },
    {
      key: "alt+2",
      command: "select_by_index",
      args: {
        index: 1,
      },
    },
    {
      key: "alt+3",
      command: "select_by_index",
      args: {
        index: 2,
      },
    },
    {
      key: "alt+4",
      command: "select_by_index",
      args: {
        index: 3,
      },
    },
    {
      key: "alt+5",
      command: "select_by_index",
      args: {
        index: 4,
      },
    },
    {
      key: "alt+6",
      command: "select_by_index",
      args: {
        index: 5,
      },
    },
    {
      key: "alt+7",
      command: "select_by_index",
      args: {
        index: 6,
      },
    },
    {
      key: "alt+8",
      command: "select_by_index",
      args: {
        index: 7,
      },
    },
    {
      key: "alt+9",
      command: "select_by_index",
      args: {
        index: 8,
      },
    },
    {
      key: "alt+0",
      command: "select_by_index",
      args: {
        index: 9,
      },
    },
    {
      key: "alt+shift+a",
      command: "alignment",
    },
    {
      key: "alt+x",
      command: "cut",
    },
    {
      key: "alt+c",
      command: "copy",
    },
    {
      key: "alt+v",
      command: "paste",
    },
    {
      key: "alt+a",
      command: "select_all",
    },
    {
      key: "alt+z",
      command: "undo",
    },
    {
      key: "alt+s",
      command: "save",
    },
    {
      key: "alt+shift+s",
      command: "prompt_save_as",
    },
    {
      key: "alt+backspace",
      command: "left_delete",
    },
    {
      key: "alt+=",
      command: "increase_font_size",
    },
    {
      key: "alt+keypad_plus",
      command: "increase_font_size",
    },
    {
      key: "alt+-",
      command: "decrease_font_size",
    },
    {
      key: "alt+keypad_minus",
      command: "decrease_font_size",
    },
    {
      key: "alt+d",
      command: "find_under_expand",
    },
    {
      key: "alt+f",
      command: "show_panel",
      args: {
        panel: "find",
        reverse: false,
      },
    },
    {
      key: "alt+shift+f",
      command: "show_panel",
      args: {
        panel: "find_in_files",
      },
    },
    {
      key: "alt+shift+n",
      command: "new_window",
    },
    {
      key: "alt+n",
      command: "new_file",
    },
    {
      key: "alt+w",
      command: "close",
    },
    {
      key: "alt+y",
      command: "redo_or_repeat",
    },
    {
      key: "alt+up",
      command: "move",
      args: {
        by: "pages",
        forward: false,
      },
    },
    {
      key: "alt+down",
      command: "move",
      args: {
        by: "pages",
        forward: true,
      },
    },
    {
      key: "alt+left",
      command: "move_to",
      args: {
        to: "bol",
        extend: false,
      },
    },
    {
      key: "alt+right",
      command: "move_to",
      args: {
        to: "eol",
        extend: false,
      },
    },
    {
      key: "shift+alt+left",
      command: "move_to",
      args: {
        to: "bol",
        extend: true,
      },
    },
    {
      key: "shift+alt+right",
      command: "move_to",
      args: {
        to: "eol",
        extend: true,
      },
    },
    {
      key: "ctrl+alt+left",
      command: "move_to",
      args: {
        to: "bof",
        extend: false,
      },
    },
    {
      key: "ctrl+alt+right",
      command: "move_to",
      args: {
        to: "eof",
        extend: false,
      },
    },
    {
      key: "ctrl+alt+up",
      command: "move_to",
      args: {
        to: "bof",
        extend: false,
      },
    },
    {
      key: "ctrl+alt+down",
      command: "move_to",
      args: {
        to: "eof",
        extend: false,
      },
    },
    {
      key: "ctrl+alt+shift+up",
      command: "move_to",
      args: {
        to: "bof",
        extend: true,
      },
    },
    {
      key: "ctrl+alt+shift+down",
      command: "move_to",
      args: {
        to: "eof",
        extend: true,
      },
    },
    {
      key: "shift+alt+up",
      command: "move",
      args: {
        by: "pages",
        forward: false,
        extend: true,
      },
    },
    {
      key: "shift+alt+down",
      command: "move",
      args: {
        by: "pages",
        forward: true,
        extend: true,
      },
    },
    {
      key: "alt+/",
      command: "toggle_comment",
      args: {
        block: false,
      },
    },
  ];
  // end WINDOWS_ONLY_KEY_BINDINGS

  // begin MAC_ONLY_KEY_BINDINGS
  MAC_ONLY_KEY_BINDINGS = [];
  // end MAC_ONLY_KEY_BINDINGS
}

async function doWork() {
  let targetPath = await _getPathSublimeText();

  console.log(
    `  >> Setting up Sublime Text ${SUBLIME_VERSION} keybindings:`,
    targetPath
  );

  if (!fs.existsSync(targetPath)) {
    console.log(consoleLogColor1("    >> Skipped : Target path not found"));
    process.exit();
  }

  // windows only key bindings
  console.log("    >> Default (Windows).sublime-keymap");
  const windowsKeymapPath = path.join(
    targetPath,
    "Default (Windows).sublime-keymap"
  );
  if (!fs.existsSync(windowsKeymapPath) || !is_os_window) {
    console.log(consoleLogColor1("      >> Skipped : Windows Only"));
  } else {
    writeJson(
      windowsKeymapPath,
      _formatKey([...COMMON_KEY_BINDINGS, ...WINDOWS_ONLY_KEY_BINDINGS])
    );
  }

  // mac only key bindings
  console.log("    >> Default (OSX).sublime-keymap");
  const macKeymapPath = path.join(targetPath, "Default (OSX).sublime-keymap");
  if (!fs.existsSync(macKeymapPath) || !is_os_darwin_mac) {
    console.log(consoleLogColor1("      >> Skipped : Mac Only"));
  } else {
    writeJson(
      macKeymapPath,
      _formatKey([...COMMON_KEY_BINDINGS, ...MAC_ONLY_KEY_BINDINGS])
    );
  }
}
