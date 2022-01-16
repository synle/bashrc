let OS_KEY;
let COMMON_KEY_BINDINGS;
let WINDOWS_ONLY_KEY_BINDINGS;
let MAC_ONLY_KEY_BINDINGS;

const WINDOWS_OS_KEY = 'alt';
const MAC_OSX_KEY = 'cmd';

function _formatKey(keybindings, osKeyToUse) {
  osKeyToUse = osKeyToUse || OS_KEY;

  keybindings = clone(keybindings);

  for (const keybinding of keybindings) {
    keybinding.key = keybinding.key.replace('OS_KEY', osKeyToUse);
  }

  return keybindings;
}

async function doInit() {
  OS_KEY = is_os_darwin_mac ? MAC_OSX_KEY : WINDOWS_OS_KEY;

  WINDOWS_ONLY_KEY_BINDINGS = parseJsonWithComments(await fetchUrlAsString('software/scripts/vs-code-keybindings.windows.json')) || [];
  LINUX_ONLY_KEYBINDING = parseJsonWithComments(await fetchUrlAsString('software/scripts/vs-code-keybindings.linux.json')) || [];
  MAC_ONLY_KEY_BINDINGS = parseJsonWithComments(await fetchUrlAsString('software/scripts/vs-code-keybindings.mac.json')) || [];

  // begin COMMON_KEY_BINDINGS
  COMMON_KEY_BINDINGS = [
    {
      key: 'f5',
      command: 'workbench.files.action.refreshFilesExplorer',
    },
    {
      key: 'OS_KEY+\\',
      command: 'workbench.action.toggleSidebarVisibility',
    },
    {
      key: 'OS_KEY+;',
      command: 'workbench.action.gotoLine',
    },
    {
      key: 'OS_KEY+r',
      command: 'workbench.action.gotoSymbol',
    },
    {
      key: 'OS_KEY+m',
      command: 'editor.action.jumpToBracket',
      when: 'editorFocus',
    },
    {
      key: 'OS_KEY+shift+l',
      command: 'editor.action.insertCursorAtEndOfEachLineSelected',
      when: 'editorTextFocus',
    },
    {
      key: 'OS_KEY+shift+\\',
      command: 'workbench.view.explorer',
    },
    {
      key: "OS_KEY+shift+'",
      command: 'workbench.action.showAllSymbols',
    },
    {
      key: 'OS_KEY+ctrl+g',
      command: 'editor.action.selectHighlights',
    },
    {
      key: 'OS_KEY+ctrl+p',
      command: 'workbench.action.openWorkspace',
    },
    {
      key: 'OS_KEY+ctrl+p',
      command: 'projectManager.listProjects',
    },
    {
      key: 'OS_KEY+ctrl+c',
      command: 'workbench.files.action.compareWithSaved',
    },
    {
      key: 'OS_KEY+n',
      command: 'workbench.action.files.newUntitledFile',
    },
    { key: 'OS_KEY+1', command: 'workbench.action.openEditorAtIndex1' },
    { key: 'OS_KEY+2', command: 'workbench.action.openEditorAtIndex2' },
    { key: 'OS_KEY+3', command: 'workbench.action.openEditorAtIndex3' },
    { key: 'OS_KEY+4', command: 'workbench.action.openEditorAtIndex4' },
    { key: 'OS_KEY+5', command: 'workbench.action.openEditorAtIndex5' },
    { key: 'OS_KEY+6', command: 'workbench.action.openEditorAtIndex6' },
    { key: 'OS_KEY+7', command: 'workbench.action.openEditorAtIndex7' },
    { key: 'OS_KEY+8', command: 'workbench.action.openEditorAtIndex8' },
    { key: 'OS_KEY+9', command: 'workbench.action.openEditorAtIndex9' },
  ];
  // end COMMON_KEY_BINDINGS
}

async function doWork() {
  const targetPath = _getPath();
  let targetFile;

  if (DEBUG_WRITE_TO_DIR) {
    console.log(consoleLogColor1('    >> DEBUG Mode: write to file'));

    // non -mac keybinding
    writeJson('vs-code-keybindings-windows', _formatKey([...COMMON_KEY_BINDINGS, ...WINDOWS_ONLY_KEY_BINDINGS], WINDOWS_OS_KEY));
    writeJson('vs-code-keybindings-linux', _formatKey([...COMMON_KEY_BINDINGS, ...LINUX_ONLY_KEYBINDING], WINDOWS_OS_KEY));
    writeJson('vs-code-keybindings-macosx', _formatKey([...COMMON_KEY_BINDINGS, ...MAC_ONLY_KEY_BINDINGS], MAC_OSX_KEY));

    return process.exit();
  }

  if (!fs.existsSync(targetPath)) {
    console.log('Not supported - Exit - targetPath not found: ', consoleLogColor4(targetPath));
    return process.exit();
  }

  const vsCodeKeybindingConfigPath = path.join(targetPath, 'User/keybindings.json');
  let compiledKeyBindings;
  console.log('  >> Setting up Microsoft VS Code keybindings', vsCodeKeybindingConfigPath);

  if (is_os_darwin_mac) {
    // Mac OSX only key bindings
    console.log('    >> Mac Only', vsCodeKeybindingConfigPath);
    compiledKeyBindings = _formatKey([...COMMON_KEY_BINDINGS, ...MAC_ONLY_KEY_BINDINGS]);
  } else if (is_os_window) {
    // windows only key bindings
    console.log('    >> Windows Only');
    compiledKeyBindings = _formatKey([...COMMON_KEY_BINDINGS, ...WINDOWS_ONLY_KEY_BINDINGS]);
  } else {
    // linux only key bindings
    console.log('    >> Linux Only');
    compiledKeyBindings = _formatKey([...COMMON_KEY_BINDINGS, ...LINUX_ONLY_KEYBINDING]);
  }

  if (compiledKeyBindings) {
    writeJson(vsCodeKeybindingConfigPath, compiledKeyBindings);
  }
}

function _getPath() {
  if (is_os_window) {
    return findDirSingle(getWindowAppDataRoamingUserPath(), /Code/);
  }
  if (is_os_darwin_mac) {
    return findDirSingle(getOsxApplicationSupportCodeUserPath(), /Code/);
  }
  return null;
}
