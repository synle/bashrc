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

  // begin WINDOWS_ONLY_KEY_BINDINGS
  WINDOWS_ONLY_KEY_BINDINGS = [
    {
      key: 'alt+shift+p',
      command: 'workbench.action.showCommands',
    },
    {
      key: 'alt+p',
      command: 'workbench.action.quickOpen',
    },
    {
      key: 'alt+right',
      command: 'cursorEnd',
      when: 'textInputFocus',
    },
    {
      key: 'alt+left',
      command: 'cursorHome',
      when: 'textInputFocus',
    },
    {
      key: 'alt+f',
      command: 'actions.find',
    },
    {
      key: 'alt+shift+f',
      command: 'workbench.action.findInFiles',
    },
    {
      key: 'alt+shift+h',
      command: 'workbench.action.replaceInFiles',
    },
    {
      key: 'alt+a',
      command: 'editor.action.selectAll',
    },
    {
      key: 'alt+a',
      command: 'editor.action.webvieweditor.selectAll',
      when: "!editorFocus && !inputFocus && activeEditor == 'WebviewEditor'",
    },
    {
      key: 'alt+a',
      command: 'list.selectAll',
      when: 'listFocus && listSupportsMultiselect && !inputFocus',
    },
    {
      key: 'alt+c',
      command: 'editor.action.clipboardCopyAction',
    },
    {
      key: 'alt+x',
      command: 'editor.action.clipboardCutAction',
    },
    {
      key: 'alt+v',
      command: 'editor.action.clipboardPasteAction',
    },
    {
      key: 'alt+s',
      command: 'workbench.action.files.save',
    },
    {
      key: 'alt+l',
      command: 'expandLineSelection',
    },
    {
      key: 'alt+shift+s',
      command: 'workbench.action.files.saveAll',
    },
    {
      key: 'alt+z',
      command: 'undo',
      when: 'textInputFocus && !editorReadonly',
    },
    {
      key: 'alt+shift+z',
      command: 'redo',
      when: 'textInputFocus && !editorReadonly',
    },
    {
      key: 'alt+y',
      command: 'redo',
      when: 'textInputFocus && !editorReadonly',
    },
    {
      key: 'alt+ctrl+c',
      command: 'workbench.files.action.compareWithSaved',
    },
    {
      key: 'alt+shift+]',
      command: 'workbench.action.nextEditor',
    },
    {
      key: 'alt+shift+[',
      command: 'workbench.action.previousEditor',
    },
    {
      key: 'alt+w',
      command: 'workbench.action.closeActiveEditor',
    },
    {
      key: 'alt+d',
      command: 'workbench.action.splitEditor',
    },
    {
      key: 'alt+shift+d',
      command: 'workbench.action.splitEditorDown',
    },
    {
      key: 'alt+down',
      command: 'cursorPageDown',
      when: 'textInputFocus',
    },
    {
      key: 'alt+up',
      command: 'cursorPageUp',
      when: 'textInputFocus',
    },
    {
      key: 'alt+shift+up',
      command: 'cursorPageUpSelect',
      when: 'textInputFocus',
    },
    {
      key: 'alt+shift+down',
      command: 'cursorPageDownSelect',
      when: 'textInputFocus',
    },
    {
      key: 'alt+shift+left',
      command: 'cursorHomeSelect',
      when: 'textInputFocus',
    },
    {
      key: 'alt+shift+right',
      command: 'cursorEndSelect',
      when: 'textInputFocus',
      args: {
        sticky: false,
      },
    },
    {
      key: 'alt+ctrl+left',
      command: 'cursorTop',
      when: 'textInputFocus',
    },
    {
      key: 'alt+ctrl+up',
      command: 'cursorTop',
      when: 'textInputFocus',
    },
    {
      key: 'alt+ctrl+shift+up',
      command: 'cursorTopSelect',
      when: 'textInputFocus',
    },
    {
      key: 'alt+ctrl+right',
      command: 'cursorBottom',
      when: 'textInputFocus',
    },
    {
      key: 'alt+ctrl+down',
      command: 'cursorBottom',
      when: 'textInputFocus',
    },
    {
      key: 'alt+ctrl+shift+down',
      command: 'cursorBottomSelect',
      when: 'textInputFocus',
    },
    {
      key: 'alt+ctrl+shift+left',
      command: 'cursorTopSelect',
      when: 'textInputFocus',
    },
    {
      key: 'alt+ctrl+shift+right',
      command: 'cursorBottomSelect',
      when: 'textInputFocus',
    },
    {
      key: 'alt+n',
      command: 'workbench.action.files.newUntitledFile',
    },
    {
      key: 'alt+shift+n',
      command: 'workbench.action.newWindow',
    },
    {
      key: 'alt+d',
      command: 'editor.action.addSelectionToNextFindMatch',
    },
    {
      key: 'alt+/',
      command: 'editor.action.commentLine',
      when: 'editorTextFocus && !editorReadonly',
    },
    {
      key: 'alt+[',
      command: 'editor.action.outdentLines',
      when: 'editorTextFocus && !editorReadonly',
    },
    {
      key: 'alt+]',
      command: 'editor.action.indentLines',
      when: 'editorTextFocus && !editorReadonly',
    },
    {
      key: 'alt+=',
      command: 'workbench.action.zoomIn',
    },
    {
      key: 'alt+-',
      command: 'workbench.action.zoomOut',
    },
    {
      key: 'alt+o',
      command: 'workbench.action.files.openFile',
    },
    {
      key: 'alt+`',
      command: 'workbench.action.terminal.toggleTerminal',
      when: 'terminal.active',
    },
  ];
  // end WINDOWS_ONLY_KEY_BINDINGS

  // begin MAC_ONLY_KEY_BINDINGS
  MAC_ONLY_KEY_BINDINGS = [];
  // end MAC_ONLY_KEY_BINDINGS
}

async function doWork() {
  const targetPath = _getPath();
  let targetFile;

  if (DEBUG_WRITE_TO_DIR) {
    console.log(consoleLogColor1('    >> DEBUG Mode: write to file'));

    // non -mac keybinding
    writeJson('vs-code-keybindings-windows', _formatKey([...COMMON_KEY_BINDINGS, ...WINDOWS_ONLY_KEY_BINDINGS], WINDOWS_OS_KEY));
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
