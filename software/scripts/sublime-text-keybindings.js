includeSource('software/scripts/sublime-text.common.js');

let OS_KEY;
let COMMON_KEY_BINDINGS;
let WINDOWS_ONLY_KEY_BINDINGS;
let LINUX_ONLY_KEYBINDING;
let MAC_ONLY_KEY_BINDINGS;

const WINDOWS_OS_KEY = 'alt'; // alt for modern mode
const MAC_OSX_KEY = 'super';
const LINUX_OS_KEY = 'alt';

function _formatKey(keybindings, osKeyToUse) {
  osKeyToUse = osKeyToUse || OS_KEY;

  keybindings = clone(keybindings);

  for (const keybinding of keybindings) {
    keybinding.keys = []
      .concat(keybinding.keys || [])
      .concat(keybinding.key || [])
      .map((s) => s.replace('OS_KEY', osKeyToUse));

    delete keybinding.key;
  }

  return keybindings;
}

async function doInit() {
  OS_KEY = resolveOsKey({ windows: WINDOWS_OS_KEY, mac: MAC_OSX_KEY, linux: LINUX_OS_KEY });

  WINDOWS_ONLY_KEY_BINDINGS = parseJsonWithComments(await fetchUrlAsString('software/scripts/sublime-text-keybindings.windows.json')) || [];
  LINUX_ONLY_KEYBINDING = parseJsonWithComments(await fetchUrlAsString('software/scripts/sublime-text-keybindings.linux.json')) || [];
  LINUX_ONLY_KEYBINDING = [...LINUX_ONLY_KEYBINDING, ...WINDOWS_ONLY_KEY_BINDINGS];
  MAC_ONLY_KEY_BINDINGS = parseJsonWithComments(await fetchUrlAsString('software/scripts/sublime-text-keybindings.mac.json')) || [];

  // begin COMMON_KEY_BINDINGS
  COMMON_KEY_BINDINGS = [
    { keys: ['OS_KEY+shift+;'], command: 'alignment' },
    {
      key: 'f5',
      command: 'refresh_folder_list',
    },
    {
      key: 'OS_KEY+r',
      command: 'show_overlay',
      args: {
        overlay: 'goto',
        text: '@',
      },
    },
    {
      key: 'OS_KEY+;',
      command: 'show_overlay',
      args: {
        overlay: 'goto',
        text: ':',
      },
    },
    {
      key: 'OS_KEY+m',
      command: 'move_to',
      args: { to: 'brackets' },
    },
    {
      key: 'OS_KEY+o',
      command: 'prompt_open_file',
    },
    {
      key: 'OS_KEY+\\',
      command: 'toggle_side_bar',
    },
    {
      key: 'OS_KEY+enter',
      command: 'goto_definition',
    },
    {
      key: 'shift+enter',
      command: 'quick_goto_variable',
    },
    {
      key: 'OS_KEY+t',
      command: 'new_file',
    },
    {
      key: 'OS_KEY+ctrl+g',
      command: 'find_all_under',
    },

    {
      key: 'OS_KEY+shift+g',
      command: 'find_prev',
    },
    {
      key: 'OS_KEY+g',
      command: 'find_next',
    },
    { keys: ['OS_KEY+h'], command: 'show_panel', args: { panel: 'replace', reverse: false } },
    {
      key: 'OS_KEY+f',
      command: 'show_panel',
      args: {
        panel: 'find',
        reverse: false,
      },
    },
    {
      key: 'OS_KEY+shift+f',
      command: 'show_panel',
      args: {
        panel: 'find_in_files',
      },
    },

    // splits
    // split navigation
    // { key: "OS_KEY+ctrl+left", command: "focus_neighboring_group" },
    // { key: "OS_KEY+ctrl+right", command: "focus_neighboring_group" },
    // { key: "OS_KEY+ctrl+up", command: "focus_neighboring_group" },
    // { key: "OS_KEY+ctrl+down", command: "focus_neighboring_group" },
    // {
    //   key: ['OS_KEY+b', 'OS_KEY+w'],
    //   command: 'set_layout',
    //   args: {
    //     cols: [0.0, 1.0],
    //     rows: [0.0, 1.0],
    //     cells: [[0, 0, 1, 1]],
    //   },
    // },
    // {
    //   key: ['OS_KEY+b', 'OS_KEY+'],
    //   command: 'set_layout',
    //   args: {
    //     cols: [0.0, 0.5, 1.0],
    //     rows: [0.0, 1.0],
    //     cells: [
    //       [0, 0, 1, 1],
    //       [1, 0, 2, 1],
    //     ],
    //   },
    // },
    // {
    //   key: ['OS_KEY+b', "OS_KEY+'"],
    //   command: 'set_layout',
    //   args: {
    //     cols: [0.0, 1.0],
    //     rows: [0.0, 0.5, 1.0],
    //     cells: [
    //       [0, 0, 1, 1],
    //       [0, 1, 1, 2],
    //     ],
    //   },
    // },
    { key: ['OS_KEY+1'], command: 'select_by_index', args: { index: 0 } },
    { key: ['OS_KEY+2'], command: 'select_by_index', args: { index: 1 } },
    { key: ['OS_KEY+3'], command: 'select_by_index', args: { index: 2 } },
    { key: ['OS_KEY+4'], command: 'select_by_index', args: { index: 3 } },
    { key: ['OS_KEY+5'], command: 'select_by_index', args: { index: 4 } },
    { key: ['OS_KEY+6'], command: 'select_by_index', args: { index: 5 } },
    { key: ['OS_KEY+7'], command: 'select_by_index', args: { index: 6 } },
    { key: ['OS_KEY+8'], command: 'select_by_index', args: { index: 7 } },
    { key: ['OS_KEY+9'], command: 'select_by_index', args: { index: 8 } },
  ];
  // end COMMON_KEY_BINDINGS
}

async function doWork() {
  console.log(`  >> Sublime Text Keybindings:`);

  // write to build file
  const comments = '// Preferences Key Bindings';
  writeToBuildFile([
    {
      file: 'sublime-text-keybindings-windows',
      data: _formatKey([...COMMON_KEY_BINDINGS, ...WINDOWS_ONLY_KEY_BINDINGS], WINDOWS_OS_KEY),
      isJson: true,
      comments,
    },
    {
      file: 'sublime-text-keybindings-linux',
      data: _formatKey([...COMMON_KEY_BINDINGS, ...LINUX_ONLY_KEYBINDING], LINUX_OS_KEY),
      isJson: true,
      comments,
    },
    {
      file: 'sublime-text-keybindings-macosx',
      data: _formatKey([...COMMON_KEY_BINDINGS, ...MAC_ONLY_KEY_BINDINGS], MAC_OSX_KEY),
      isJson: true,
      comments,
    },
  ]);
}
