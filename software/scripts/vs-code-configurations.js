let COMMON_CONFIGS;

function _convertIgnoredFilesAndFolders(ignoredFiles) {
  const res = {};

  for (const ignoredFile of ignoredFiles) {
    const key = `**/${ignoredFile}`;
    res[key] = true;
  }

  return res;
}

async function doInit() {
  COMMON_CONFIGS = {
    'breadcrumbs.enabled': true,
    'editor.fontLigatures': true,
    'editor.fontSize': EDITOR_CONFIGS.fontSize,
    'editor.fontFamily': EDITOR_CONFIGS.fontFamily,
    'editor.fontWeight': '500',
    'editor.formatOnPaste': true,
    'editor.maxTokenizationLineLength': 10000,
    'editor.minimap.enabled': false,
    'editor.mouseWheelScrollSensitivity': 0,
    'editor.multiCursorModifier': 'ctrlCmd',
    'editor.renderControlCharacters': true,
    'editor.renderWhitespace': 'all',
    'editor.snippetSuggestions': 'top',
    'editor.suggestSelection': 'first',
    'editor.tabSize': EDITOR_CONFIGS.tabSize,
    'editor.wordWrap': 'wordWrapColumn',
    'editor.wordWrapColumn': EDITOR_CONFIGS.maxLineSize,
    'files.eol': '\n', // LF Unix mode
    'files.exclude': {
      ..._convertIgnoredFilesAndFolders(EDITOR_CONFIGS.ignoredFiles),
      ..._convertIgnoredFilesAndFolders(EDITOR_CONFIGS.ignoredFolders),
    },
    'files.hotExit': 'off',
    'files.insertFinalNewline': true,
    'files.trimTrailingWhitespace': true,
    'javascript.updateImportsOnFileMove.enabled': 'always',
    'typescript.updateImportsOnFileMove.enabled': 'always',
    'window.zoomLevel': 1,
    'workbench.colorTheme': 'Dracula Soft',
    'workbench.editor.showTabs': true,
    'workbench.editor.tabCloseButton': 'off',
    'workbench.iconTheme': 'vscode-great-icons',
    'workbench.tree.indent': 4,
    'editor.codeActionsOnSave': {
      // "source.fixAll": true,
      'source.organizeImports': true,
    },
    'telemetry.enableTelemetry': false,
    'telemetry.enableCrashReporter': false,
    'enable-crash-reporter': false,
    'update.mode': 'none',
  };
}

async function doWork() {
  const targetPath = _getPath();
  let targetFile;

  if (DEBUG_WRITE_TO_DIR) {
    console.log(consoleLogColor1('    >> DEBUG Mode: write to file'));

    // non -mac keybinding
    writeJson('vs-code-configurations', COMMON_CONFIGS);

    process.exit();
  }

  if (!fs.existsSync(targetPath)) {
    console.log('Not supported - Exit - targetPath not found: ', targetPath);
    process.exit();
  }

  console.log(`  >> Setting up Microsoft VS Code Configurations:`, targetPath);

  // get os specific settings
  const osSpecificSettings = {};

  // settings.json
  const vsCodeMainConfigPath = path.join(targetPath, 'User/settings.json');
  console.log(`    >> `, vsCodeMainConfigPath);
  writeJsonWithMerge(vsCodeMainConfigPath, Object.assign(COMMON_CONFIGS, osSpecificSettings));
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
