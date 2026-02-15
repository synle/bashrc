includeSource('software/scripts/vs-code.common.js');

let OS_KEY;
let COMMON_KEY_BINDINGS;
let WINDOWS_ONLY_KEY_BINDINGS;
let MAC_ONLY_KEY_BINDINGS;

const WINDOWS_OS_KEY = 'alt'; // alt for modern mode
const MAC_OSX_KEY = 'cmd';
const LINUX_OS_KEY = 'alt';

function _formatKey(keybindings, osKeyToUse) {
  osKeyToUse = osKeyToUse || OS_KEY;

  keybindings = clone(keybindings);

  for (const keybinding of keybindings) {
    keybinding.key = keybinding.key.replace('OS_KEY', osKeyToUse);
  }

  return keybindings;
}

async function doInit() {
  OS_KEY = resolveOsKey({ windows: WINDOWS_OS_KEY, mac: MAC_OSX_KEY, linux: LINUX_OS_KEY });

  WINDOWS_ONLY_KEY_BINDINGS = parseJsonWithComments(await fetchUrlAsString('software/scripts/vs-code-keybindings.windows.json')) || [];
  LINUX_ONLY_KEYBINDING = parseJsonWithComments(await fetchUrlAsString('software/scripts/vs-code-keybindings.linux.json')) || [];
  MAC_ONLY_KEY_BINDINGS = parseJsonWithComments(await fetchUrlAsString('software/scripts/vs-code-keybindings.mac.json')) || [];

  // begin COMMON_KEY_BINDINGS
  COMMON_KEY_BINDINGS = [
    { key: 'OS_KEY+1', command: 'workbench.action.openEditorAtIndex1' },
    { key: 'OS_KEY+2', command: 'workbench.action.openEditorAtIndex2' },
    { key: 'OS_KEY+3', command: 'workbench.action.openEditorAtIndex3' },
    { key: 'OS_KEY+4', command: 'workbench.action.openEditorAtIndex4' },
    { key: 'OS_KEY+5', command: 'workbench.action.openEditorAtIndex5' },
    { key: 'OS_KEY+6', command: 'workbench.action.openEditorAtIndex6' },
    { key: 'OS_KEY+7', command: 'workbench.action.openEditorAtIndex7' },
    { key: 'OS_KEY+8', command: 'workbench.action.openEditorAtIndex8' },
    { key: 'OS_KEY+9', command: 'workbench.action.openEditorAtIndex9' },
    {
      key: 'f5',
      command: 'workbench.files.action.refreshFilesExplorer',
    },
    { key: 'OS_KEY+h', command: 'editor.action.startFindReplaceAction', when: 'editorFocus || editorIsOpen' },
    { key: 'OS_KEY+h', command: 'testing.toggleTestingPeekHistory', when: 'testing.isPeekVisible' },
    {
      key: 'OS_KEY+\\',
      command: 'workbench.action.toggleSidebarVisibility',
    }, // toggle just the explorer part
    {
      key: 'OS_KEY+shift+\\',
      command: 'workbench.action.toggleActivityBarVisibility',
    }, // toggle just the activity tiny strip
    {
      key: 'OS_KEY+;',
      command: 'workbench.action.gotoLine',
    },
    {
      key: 'OS_KEY+m',
      command: 'workbench.action.toggleMaximizedPanel',
    }, // this maximize the terminal panel size
    {
      key: 'OS_KEY+r',
      command: 'workbench.action.gotoSymbol',
    },
    {
      key: 'ctrl+m',
      command: 'editor.action.jumpToBracket',
      when: 'editorFocus',
    },
    {
      key: 'OS_KEY+shift+l',
      command: 'editor.action.insertCursorAtEndOfEachLineSelected',
      when: 'editorTextFocus',
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
    {
      key: 'OS_KEY+f',
      command: 'actions.find',
    },
    {
      key: 'OS_KEY+shift+f',
      command: 'workbench.action.findInFiles',
    },
    {
      key: "OS_KEY+'",
      command: 'workbench.action.debug.stepOver',
      when: "debugState == 'stopped'",
    },
    {
      key: "OS_KEY+shift+'",
      command: 'workbench.action.debug.stepInto',
      when: "debugState != 'inactive'",
    },

    // rename
    { key: 'f2', command: 'editor.action.rename', when: 'editorHasRenameProvider && editorTextFocus && !editorReadonly' },
    {
      key: 'f2',
      command: 'workbench.action.terminal.renameInstance',
      when: 'terminalHasBeenCreated && terminalTabsFocus && terminalTabsSingularSelection || terminalProcessSupported && terminalTabsFocus && terminalTabsSingularSelection',
    },
    { key: 'f2', command: 'debug.renameWatchExpression', when: 'watchExpressionsFocused' },
    { key: 'f2', command: 'debug.setVariable', when: 'variablesFocused' },
    {
      key: 'f2',
      command: 'remote.tunnel.label',
      when: "tunnelViewFocus && tunnelType == 'Forwarded' && tunnelViewMultiSelection == 'undefined'",
    },
    {
      key: 'f2',
      command: 'renameFile',
      when: 'explorerViewletVisible && filesExplorerFocus && !explorerResourceIsRoot && !explorerResourceReadonly && !inputFocus',
    },
    { key: 'f2', command: 'abracadabra.renameSymbol', when: 'editorTextFocus' },
    {
      key: 'OS_KEY+shift+1',
      command: 'workbench.view.explorer',
      when: 'viewContainer.workbench.view.explorer.enabled',
    },
    {
      key: 'OS_KEY+shift+2',
      command: 'workbench.view.search',
    },
    {
      key: 'OS_KEY+shift+`',
      command: 'workbench.view.debug',
    },
  ];
  // end COMMON_KEY_BINDINGS
}

async function doWork() {
  console.log(`  >> VS Code Keybindings:`);

  // write to build file
  const commentNote = '// Preferences Open Keyboard Shortcuts (JSON)';
  writeToBuildFile([
    ['vs-code-keybindings-windows', _formatKey([...COMMON_KEY_BINDINGS, ...WINDOWS_ONLY_KEY_BINDINGS], WINDOWS_OS_KEY), true, commentNote],
    [
      'vs-code-keybindings-linux',
      _formatKey([...COMMON_KEY_BINDINGS, ...WINDOWS_ONLY_KEY_BINDINGS, ...LINUX_ONLY_KEYBINDING], LINUX_OS_KEY),
      true,
      commentNote,
    ],
    ['vs-code-keybindings-macosx', _formatKey([...COMMON_KEY_BINDINGS, ...MAC_ONLY_KEY_BINDINGS], MAC_OSX_KEY), true, commentNote],
  ]);
}
